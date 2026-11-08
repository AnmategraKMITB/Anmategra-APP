import { and, eq, inArray } from 'drizzle-orm';
import {
  type AssessmentInput,
  type ComputedStatus,
  type CriterionInput,
  type CriterionResult,
  aggregateCriterion,
  autoGateTriggered,
  choiceScore,
  preStatus,
  rankCandidates,
  scopeScore,
} from '~/lib/oprec/scoring';
import {
  application,
  applicationChoice,
  assessment,
  criterion,
  organizationPosition,
  recruitment,
  recruitmentDivision,
} from '~/server/db/schema';

import { type Tx } from '../form/services';
import { loadGateAnswers } from './gate-answers';
import { type Database } from './services';

type Q = Tx | Database;

export type ChoiceComputation = {
  choiceId: string;
  applicationId: string;
  divisionId: string;
  score: number | null;
  status: ComputedStatus | null;
};

/**
 * Menghitung ulang `score` dan `computed_status` (cache di `application_choice`)
 * untuk semua pilihan pada divisi yang disebut. Metode peringkat membandingkan
 * seluruh pilihan satu divisi, jadi satu perubahan menghitung ulang divisinya
 * sekaligus. Mengembalikan hasil hitungan tiap pilihan.
 */
export async function recomputeDivisions(
  db: Q,
  recruitmentId: string,
  divisionIds: string[] | 'all',
): Promise<ChoiceComputation[]> {
  const [rec] = await db
    .select()
    .from(recruitment)
    .where(eq(recruitment.id, recruitmentId));
  if (!rec) return [];

  const divisions = await db
    .select({
      id: recruitmentDivision.id,
      quota: organizationPosition.quota,
    })
    .from(recruitmentDivision)
    .innerJoin(
      organizationPosition,
      eq(organizationPosition.id, recruitmentDivision.positionId),
    )
    .where(eq(recruitmentDivision.recruitmentId, recruitmentId));
  const targets =
    divisionIds === 'all'
      ? divisions.map((d) => d.id)
      : divisions.filter((d) => divisionIds.includes(d.id)).map((d) => d.id);
  if (targets.length === 0) return [];
  const quotaOf = new Map(divisions.map((d) => [d.id, d.quota]));

  const choices = await db
    .select({
      id: applicationChoice.id,
      applicationId: applicationChoice.applicationId,
      divisionId: applicationChoice.divisionId,
      formSubmissionId: application.formSubmissionId,
      score: applicationChoice.score,
      computedStatus: applicationChoice.computedStatus,
    })
    .from(applicationChoice)
    .innerJoin(application, eq(application.id, applicationChoice.applicationId))
    .where(inArray(applicationChoice.divisionId, targets));
  if (choices.length === 0) return [];

  // Mode tanpa skor: status ditetapkan manual, tidak ada hitungan otomatis.
  if (rec.scoringMode === 'keputusan_langsung') {
    return writeResults(
      db,
      choices,
      choices.map((c) => ({
        choiceId: c.id,
        applicationId: c.applicationId,
        divisionId: c.divisionId,
        score: null,
        status: null,
      })),
    );
  }

  const criteriaRows = await db
    .select()
    .from(criterion)
    .where(eq(criterion.recruitmentId, recruitmentId));
  const criteria: CriterionInput[] = criteriaRows.map((c) => ({
    id: c.id,
    divisionId: c.divisionId,
    kind: c.kind,
    weight: c.weight,
    gateRule: c.gateRule,
  }));
  const umumCriteria = criteria.filter((c) => c.divisionId === null);

  const applicationIds = [...new Set(choices.map((c) => c.applicationId))];
  const assessments = applicationIds.length
    ? await db
        .select({
          applicationId: assessment.applicationId,
          choiceId: assessment.choiceId,
          criterionId: assessment.criterionId,
          assessorId: assessment.assessorId,
          rating: assessment.rating,
          gateState: assessment.gateState,
        })
        .from(assessment)
        .where(inArray(assessment.applicationId, applicationIds))
    : [];

  const { answersBySubmission, fieldTypes } = await loadGateAnswers(
    db,
    rec,
    criteria,
    choices.flatMap((c) => (c.formSubmissionId ? [c.formSubmissionId] : [])),
  );

  const settings = {
    ratingMin: rec.ratingMin,
    ratingMax: rec.ratingMax,
    minReviewers: rec.minReviewers,
  };
  /** Hasil gabungan penilai per kriteria untuk satu lingkup (umum atau satu pilihan). */
  const resultsFor = (
    list: AssessmentInput[],
  ): Map<string, CriterionResult> => {
    const byCriterion = new Map<string, AssessmentInput[]>();
    for (const a of list) {
      byCriterion.set(a.criterionId, [
        ...(byCriterion.get(a.criterionId) ?? []),
        a,
      ]);
    }
    return new Map(
      [...byCriterion].map(([id, rows]) => [
        id,
        aggregateCriterion(rows, settings),
      ]),
    );
  };

  const umumByApp = new Map<string, Map<string, CriterionResult>>();
  const choicesOfApp = new Map<string, typeof choices>();
  for (const c of choices) {
    choicesOfApp.set(c.applicationId, [
      ...(choicesOfApp.get(c.applicationId) ?? []),
      c,
    ]);
  }
  for (const appId of applicationIds) {
    umumByApp.set(
      appId,
      resultsFor(
        assessments.filter(
          (a) => a.applicationId === appId && a.choiceId === null,
        ),
      ),
    );
  }

  type Pending = {
    choice: (typeof choices)[number];
    pre: ReturnType<typeof preStatus>;
  };
  const pendingByDivision = new Map<string, Pending[]>();
  for (const c of choices) {
    const umumResults = umumByApp.get(c.applicationId)!;
    const divCriteria = criteria.filter((x) => x.divisionId === c.divisionId);
    const divResults = resultsFor(
      assessments.filter((a) => a.choiceId === c.id),
    );
    const umumScope = scopeScore(umumCriteria, umumResults);
    const divScope = scopeScore(divCriteria, divResults);
    const cs = choiceScore(
      umumScope,
      divScope,
      rec.scoreSource,
      rec.weightUmum,
    );

    const scope = [...umumCriteria, ...divCriteria];
    const answers = c.formSubmissionId
      ? (answersBySubmission.get(c.formSubmissionId) ?? {})
      : {};
    const autoTriggered = scope
      .filter((x) => x.kind === 'gugur_otomatis' && x.gateRule)
      .map((x) => autoGateTriggered(x.gateRule!, answers, fieldTypes));
    const manualGates = scope
      .filter((x) => x.kind === 'gugur_manual')
      .map(
        (x) => (umumResults.get(x.id) ?? divResults.get(x.id))?.gate ?? null,
      );

    const pre = preStatus({ autoTriggered, manualGates, score: cs });
    pendingByDivision.set(c.divisionId, [
      ...(pendingByDivision.get(c.divisionId) ?? []),
      { choice: c, pre },
    ]);
  }

  const results: ChoiceComputation[] = [];
  for (const [divisionId, list] of pendingByDivision) {
    const ranked = rankCandidates(
      list.flatMap((p) =>
        p.pre.kind === 'candidate'
          ? [{ id: p.choice.id, score: p.pre.score }]
          : [],
      ),
      rec.statusMethod,
      rec.statusMinScore,
      quotaOf.get(divisionId) ?? 0,
    );
    for (const p of list) {
      results.push({
        choiceId: p.choice.id,
        applicationId: p.choice.applicationId,
        divisionId,
        score: p.pre.score,
        status:
          p.pre.kind === 'final'
            ? p.pre.status
            : (ranked.get(p.choice.id) ?? 'belum_lengkap'),
      });
    }
  }
  return writeResults(db, choices, results);
}

async function writeResults(
  db: Q,
  existing: {
    id: string;
    score: string | null;
    computedStatus: ComputedStatus | null;
  }[],
  results: ChoiceComputation[],
) {
  const before = new Map(existing.map((c) => [c.id, c]));
  const now = new Date();
  for (const r of results) {
    const prev = before.get(r.choiceId);
    const prevScore =
      prev?.score === null || prev?.score === undefined
        ? null
        : Number(prev.score);
    const same =
      prev?.computedStatus === r.status &&
      (prevScore === r.score ||
        (prevScore !== null &&
          r.score !== null &&
          Math.abs(prevScore - r.score) < 1e-9));
    if (same) continue;
    await db
      .update(applicationChoice)
      .set({
        score: r.score === null ? null : String(r.score),
        computedStatus: r.status,
        scoredAt: now,
      })
      .where(and(eq(applicationChoice.id, r.choiceId)));
  }
  return results;
}
