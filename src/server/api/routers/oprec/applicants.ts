import { TRPCError } from '@trpc/server';
import {
  type SQL,
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import {
  type CriterionInput,
  type CriterionResult,
  aggregateCriterion,
  effectiveStatus,
  overrideNeedsReview,
} from '~/lib/oprec/scoring';
import { oprecScopedProcedure } from '~/server/api/trpc';
import {
  application,
  applicationChoice,
  applicationFlag,
  assessment,
  choiceStatusOverride,
  criterion,
  flagLabel,
  formSubmission,
  mahasiswa,
  organizationUnit,
  recruitmentDivision,
  recruitmentWave,
  users,
} from '~/server/db/schema';

import {
  ApplicantDetailInputSchema,
  ApplicantsListInputSchema,
  RecruitmentIdInputSchema,
} from '../../types/oprec.type';
import {
  attachAnswers,
  loadResponseFields,
  submissionQuery,
  toColumns,
  toRespondent,
} from '../form/responses';
import { type Tx } from '../form/services';
import {
  type GeneralGateStatus,
  generalGateStatus,
  loadGateAnswers,
} from './gate-answers';
import {
  type Database,
  type Queryable,
  loadRecruitmentDetail,
} from './services';

type ApplicantsFilter = {
  search?: string;
  waveId?: string;
  divisionId?: string;
  angkatan?: number;
  prodi?: string;
  status?: 'belum_lengkap' | 'perlu_ditinjau' | 'lolos' | 'tidak_lolos';
  flagLabelId?: string;
};

/** Nama tampil: nama di data mahasiswa, lalu nama akun. */
const displayName = sql<
  string | null
>`coalesce(${mahasiswa.nama}, ${users.name})`;

function whereOf(recruitmentId: string, f: ApplicantsFilter): SQL {
  const parts: (SQL | undefined)[] = [
    eq(application.recruitmentId, recruitmentId),
  ];
  if (f.search) {
    const like = `%${f.search.replace(/[\\%_]/g, '\\$&')}%`;
    parts.push(
      or(
        ilike(mahasiswa.nama, like),
        ilike(users.name, like),
        sql`${mahasiswa.nim}::text like ${like}`,
      ),
    );
  }
  if (f.waveId) parts.push(eq(application.waveId, f.waveId));
  if (f.angkatan !== undefined) parts.push(eq(mahasiswa.angkatan, f.angkatan));
  if (f.prodi) parts.push(eq(mahasiswa.jurusan, f.prodi));
  if (f.divisionId) {
    parts.push(
      exists(
        sql`(select 1 from ${applicationChoice} where ${applicationChoice.applicationId} = ${application.id} and ${applicationChoice.divisionId} = ${f.divisionId})`,
      ),
    );
  }
  if (f.status) {
    // Status efektif: override aktif menggantikan computed_status.
    parts.push(
      exists(
        sql`(select 1 from ${applicationChoice}
          where ${applicationChoice.applicationId} = ${application.id}
            and coalesce(
              (select ${choiceStatusOverride.status} from ${choiceStatusOverride}
                where ${choiceStatusOverride.choiceId} = ${applicationChoice.id}
                  and ${choiceStatusOverride.clearedAt} is null
                limit 1),
              ${applicationChoice.computedStatus}
            ) = ${f.status})`,
      ),
    );
  }
  if (f.flagLabelId) {
    parts.push(
      exists(
        sql`(select 1 from ${applicationFlag}
          where ${applicationFlag.applicationId} = ${application.id}
            and ${applicationFlag.labelId} = ${f.flagLabelId})`,
      ),
    );
  }
  return and(...parts)!;
}

/** Nama tujuan pilihan ke-1, untuk mengelompokkan dan mengurutkan. */
const firstChoiceLabel = sql<string | null>`(
  select ${organizationUnit.name}
  from ${applicationChoice}
  join ${recruitmentDivision} on ${recruitmentDivision.id} = ${applicationChoice.divisionId}
  join ${organizationUnit} on ${organizationUnit.id} = ${recruitmentDivision.unitId}
  where ${applicationChoice.applicationId} = ${application.id} and ${applicationChoice.rank} = 1
)`;

function groupKeyOf(groupBy: string) {
  switch (groupBy) {
    case 'gelombang':
      return sql<string | null>`${recruitmentWave.label}`;
    case 'pilihan1':
      return firstChoiceLabel;
    case 'angkatan':
      return sql<string | null>`${mahasiswa.angkatan}::text`;
    case 'prodi':
      return sql<string | null>`${mahasiswa.jurusan}`;
    default:
      return sql<string | null>`null`;
  }
}

type RecruitmentScoring = {
  id: string;
  formId: string;
  scoringMode: string;
  ratingMin: number;
  ratingMax: number;
  minReviewers: number;
};

/** Pilihan satu pendaftar beserta skor dan status efektif (override aktif menang). */
async function choicesOf(db: Queryable, applicationIds: string[]) {
  if (applicationIds.length === 0) {
    return new Map<string, ReturnType<typeof choiceView>[]>();
  }
  const rows = await db
    .select({
      id: applicationChoice.id,
      applicationId: applicationChoice.applicationId,
      rank: applicationChoice.rank,
      origin: applicationChoice.origin,
      divisionId: applicationChoice.divisionId,
      label: organizationUnit.name,
      score: applicationChoice.score,
      computedStatus: applicationChoice.computedStatus,
    })
    .from(applicationChoice)
    .innerJoin(
      recruitmentDivision,
      eq(recruitmentDivision.id, applicationChoice.divisionId),
    )
    .innerJoin(
      organizationUnit,
      eq(organizationUnit.id, recruitmentDivision.unitId),
    )
    .where(inArray(applicationChoice.applicationId, applicationIds))
    .orderBy(asc(applicationChoice.rank));
  const overrides = await db
    .select()
    .from(choiceStatusOverride)
    .where(
      and(
        inArray(
          choiceStatusOverride.choiceId,
          rows.map((r) => r.id),
        ),
        isNull(choiceStatusOverride.clearedAt),
      ),
    );
  const overrideOf = new Map(overrides.map((o) => [o.choiceId, o]));

  const byApp = new Map<string, ReturnType<typeof choiceView>[]>();
  for (const r of rows) {
    byApp.set(r.applicationId, [
      ...(byApp.get(r.applicationId) ?? []),
      choiceView(r, overrideOf.get(r.id) ?? null),
    ]);
  }
  return byApp;
}

function choiceView(
  c: {
    id: string;
    rank: number | null;
    origin: string;
    divisionId: string;
    label: string;
    score: string | null;
    computedStatus: CriterionStatus;
  },
  ov: typeof choiceStatusOverride.$inferSelect | null,
) {
  const score = c.score === null ? null : Number(c.score);
  const active = ov
    ? {
        status: ov.status,
        computedStatusAtOverride: ov.computedStatusAtOverride,
        scoreAtOverride:
          ov.scoreAtOverride === null ? null : Number(ov.scoreAtOverride),
      }
    : null;
  return {
    id: c.id,
    rank: c.rank,
    origin: c.origin,
    divisionId: c.divisionId,
    label: c.label,
    score,
    status: effectiveStatus(c.computedStatus, active),
    overridden: ov !== null,
    needsReview: overrideNeedsReview(active, c.computedStatus, score),
    // Alasan yang sensitif tidak dikirim.
    overrideReason: ov && !ov.isSensitive ? ov.reason : null,
  };
}
type CriterionStatus = Parameters<typeof effectiveStatus>[0];

/** Flag per pendaftar. Halaman ini hanya untuk pengelola oprec, jadi sensitif ikut. */
async function flagsOf(db: Queryable, applicationIds: string[]) {
  const byApp = new Map<
    string,
    { labelId: string; name: string; color: string; isSensitive: boolean }[]
  >();
  if (applicationIds.length === 0) return byApp;
  const rows = await db
    .select({
      applicationId: applicationFlag.applicationId,
      labelId: flagLabel.id,
      name: flagLabel.name,
      color: flagLabel.color,
      isSensitive: flagLabel.isSensitive,
    })
    .from(applicationFlag)
    .innerJoin(flagLabel, eq(flagLabel.id, applicationFlag.labelId))
    .where(inArray(applicationFlag.applicationId, applicationIds))
    .orderBy(asc(flagLabel.name));
  for (const { applicationId, ...flag } of rows) {
    byApp.set(applicationId, [...(byApp.get(applicationId) ?? []), flag]);
  }
  return byApp;
}

async function criteriaOf(
  db: Queryable,
  recruitmentId: string,
): Promise<CriterionInput[]> {
  const rows = await db
    .select()
    .from(criterion)
    .where(eq(criterion.recruitmentId, recruitmentId));
  return rows.map((c) => ({
    id: c.id,
    divisionId: c.divisionId,
    kind: c.kind,
    weight: c.weight,
    gateRule: c.gateRule,
  }));
}

/** Status syarat umum (gate lingkup umum) untuk sekumpulan pendaftar. */
async function syaratUmumFor(
  db: Tx | Database,
  rec: RecruitmentScoring,
  apps: { id: string; formSubmissionId: string | null }[],
) {
  const out = new Map<string, GeneralGateStatus>();
  if (apps.length === 0) return out;
  const criteria =
    rec.scoringMode === 'keputusan_langsung'
      ? []
      : await criteriaOf(db, rec.id);
  const umum = criteria.filter((c) => c.divisionId === null);
  const gates = umum.filter(
    (c) => c.kind === 'gugur_otomatis' || c.kind === 'gugur_manual',
  );
  if (gates.length === 0) {
    for (const a of apps) out.set(a.id, 'lolos');
    return out;
  }
  const rows = await db
    .select({
      applicationId: assessment.applicationId,
      criterionId: assessment.criterionId,
      assessorId: assessment.assessorId,
      rating: assessment.rating,
      gateState: assessment.gateState,
    })
    .from(assessment)
    .where(
      and(
        inArray(
          assessment.applicationId,
          apps.map((a) => a.id),
        ),
        isNull(assessment.choiceId),
        inArray(
          assessment.criterionId,
          gates.map((c) => c.id),
        ),
      ),
    );
  const { answersBySubmission, fieldTypes } = await loadGateAnswers(
    db,
    rec,
    criteria,
    apps.flatMap((a) => (a.formSubmissionId ? [a.formSubmissionId] : [])),
  );
  const settings = {
    ratingMin: rec.ratingMin,
    ratingMax: rec.ratingMax,
    minReviewers: rec.minReviewers,
  };
  for (const a of apps) {
    const mine = rows.filter((r) => r.applicationId === a.id);
    const results = new Map<string, CriterionResult>(
      gates.map((c) => [
        c.id,
        aggregateCriterion(
          mine.filter((r) => r.criterionId === c.id),
          settings,
        ),
      ]),
    );
    out.set(
      a.id,
      generalGateStatus(
        umum,
        results,
        a.formSubmissionId
          ? (answersBySubmission.get(a.formSubmissionId) ?? {})
          : {},
        fieldTypes,
      ),
    );
  }
  return out;
}

/** Nilai kriteria hasil gabungan penilai (umum dan tiap pilihan), hanya baca. */
async function aggregatedAssessments(
  db: Queryable,
  rec: RecruitmentScoring,
  applicationId: string,
  choices: { id: string; divisionId: string }[],
) {
  const criteria = (await criteriaOf(db, rec.id)).filter(
    (c) => c.kind !== 'gugur_otomatis',
  );
  if (criteria.length === 0) return [];
  const names = await db
    .select({ id: criterion.id, name: criterion.name })
    .from(criterion)
    .where(eq(criterion.recruitmentId, rec.id));
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  const rows = await db
    .select({
      choiceId: assessment.choiceId,
      criterionId: assessment.criterionId,
      assessorId: assessment.assessorId,
      rating: assessment.rating,
      gateState: assessment.gateState,
    })
    .from(assessment)
    .where(eq(assessment.applicationId, applicationId));
  const settings = {
    ratingMin: rec.ratingMin,
    ratingMax: rec.ratingMax,
    minReviewers: rec.minReviewers,
  };
  const scopes = [
    {
      scope: 'umum',
      divisionId: null as string | null,
      choiceId: null as string | null,
    },
    ...choices.map((c) => ({
      scope: c.divisionId,
      divisionId: c.divisionId as string | null,
      choiceId: c.id as string | null,
    })),
  ];
  return scopes.flatMap((sc) =>
    criteria
      .filter((c) => c.divisionId === sc.divisionId)
      .map((c) => {
        const agg = aggregateCriterion(
          rows.filter(
            (r) => r.criterionId === c.id && r.choiceId === sc.choiceId,
          ),
          settings,
        );
        return {
          criterionId: c.id,
          name: nameOf.get(c.id) ?? '',
          kind: c.kind,
          scope: sc.scope,
          score: agg.score,
          gate: agg.gate,
          reviewers: agg.reviewers,
        };
      }),
  );
}

export const applicantProcedures = {
  /** Angka untuk kartu ringkasan dan pilihan filter. */
  applicantSummary: oprecScopedProcedure
    .input(RecruitmentIdInputSchema)
    .query(async ({ ctx, input }) => {
      const recruitmentId = input.recruitmentId;
      const detail = await loadRecruitmentDetail(ctx.db, recruitmentId);
      const [byChoice, byWave, people, appRows, flagLabels] = await Promise.all(
        [
          ctx.db
            .select({
              rank: applicationChoice.rank,
              divisionId: applicationChoice.divisionId,
              n: count(),
            })
            .from(applicationChoice)
            .innerJoin(
              application,
              eq(application.id, applicationChoice.applicationId),
            )
            .where(eq(application.recruitmentId, recruitmentId))
            .groupBy(applicationChoice.rank, applicationChoice.divisionId),
          ctx.db
            .select({ waveId: application.waveId, n: count() })
            .from(application)
            .where(eq(application.recruitmentId, recruitmentId))
            .groupBy(application.waveId),
          ctx.db
            .select({ angkatan: mahasiswa.angkatan, prodi: mahasiswa.jurusan })
            .from(application)
            .innerJoin(mahasiswa, eq(mahasiswa.userId, application.userId))
            .where(eq(application.recruitmentId, recruitmentId))
            .groupBy(mahasiswa.angkatan, mahasiswa.jurusan),
          ctx.db
            .select({
              id: application.id,
              formSubmissionId: application.formSubmissionId,
            })
            .from(application)
            .where(eq(application.recruitmentId, recruitmentId)),
          ctx.db
            .select({
              id: flagLabel.id,
              name: flagLabel.name,
              color: flagLabel.color,
              isSensitive: flagLabel.isSensitive,
            })
            .from(flagLabel)
            .where(eq(flagLabel.recruitmentId, recruitmentId))
            .orderBy(asc(flagLabel.name)),
        ],
      );
      const syarat = await syaratUmumFor(ctx.db, ctx.recruitment, appRows);
      const labelOf = new Map(detail.divisions.map((d) => [d.id, d.unitName]));
      const waveCount = new Map(byWave.map((w) => [w.waveId, w.n]));
      const total = byWave.reduce((sum, w) => sum + w.n, 0);
      return {
        total,
        lolosSyaratUmum: appRows.filter((a) => syarat.get(a.id) === 'lolos')
          .length,
        flagLabels,
        maxChoices: detail.maxChoices,
        // Hanya pilihan bernomor; closerec dan pilihan dialihkan tak punya urutan.
        byRank: Array.from({ length: detail.maxChoices }, (_, i) => ({
          rank: i + 1,
          items: byChoice
            .filter((c) => c.rank === i + 1)
            .map((c) => ({
              divisionId: c.divisionId,
              label: labelOf.get(c.divisionId) ?? '',
              count: c.n,
            }))
            .sort(
              (a, b) => b.count - a.count || a.label.localeCompare(b.label),
            ),
        })),
        byWave: [
          ...detail.waves.map((w) => ({
            waveId: w.id as string | null,
            label: w.label,
            count: waveCount.get(w.id) ?? 0,
          })),
          ...(waveCount.get(null)
            ? [
                {
                  waveId: null,
                  label: 'Tanpa gelombang',
                  count: waveCount.get(null)!,
                },
              ]
            : []),
        ],
        divisions: detail.divisions.map((d) => ({
          id: d.id,
          label: d.unitName,
        })),
        angkatan: [...new Set(people.map((p) => p.angkatan))].sort(
          (a, b) => b - a,
        ),
        prodi: [...new Set(people.map((p) => p.prodi))].sort((a, b) =>
          a.localeCompare(b),
        ),
      };
    }),

  applicants: oprecScopedProcedure
    .input(ApplicantsListInputSchema)
    .query(async ({ ctx, input }) => {
      const where = whereOf(input.recruitmentId, input);
      const groupKey = groupKeyOf(input.groupBy);

      const groupOrder: SQL[] =
        input.groupBy === 'gelombang'
          ? [sql`${recruitmentWave.sortOrder} asc nulls last`]
          : input.groupBy === 'angkatan'
            ? [desc(mahasiswa.angkatan)]
            : input.groupBy === 'pilihan1'
              ? [sql`${firstChoiceLabel} asc nulls last`]
              : input.groupBy === 'prodi'
                ? [asc(mahasiswa.jurusan)]
                : [];
      const sortOrder: SQL[] =
        input.sort === 'gelombang'
          ? [sql`${recruitmentWave.sortOrder} asc nulls last`, asc(displayName)]
          : input.sort === 'angkatan'
            ? [desc(mahasiswa.angkatan), asc(displayName)]
            : input.sort === 'prodi'
              ? [asc(mahasiswa.jurusan), asc(displayName)]
              : input.sort === 'waktu'
                ? [desc(application.submittedAt)]
                : [asc(displayName)];

      const base = ctx.db
        .select({
          id: application.id,
          name: displayName,
          nim: mahasiswa.nim,
          prodi: mahasiswa.jurusan,
          angkatan: mahasiswa.angkatan,
          waveId: application.waveId,
          waveLabel: recruitmentWave.label,
          source: application.source,
          willingToMove: application.willingToMove,
          submittedAt: application.submittedAt,
          formSubmissionId: application.formSubmissionId,
          groupKey,
        })
        .from(application)
        .innerJoin(users, eq(users.id, application.userId))
        .leftJoin(mahasiswa, eq(mahasiswa.userId, application.userId))
        .leftJoin(recruitmentWave, eq(recruitmentWave.id, application.waveId))
        .where(where);

      const decorate = async (page: typeof rows) => {
        const ids = page.map((r) => r.id);
        const [choices, flags, syarat] = await Promise.all([
          choicesOf(ctx.db, ids),
          flagsOf(ctx.db, ids),
          syaratUmumFor(ctx.db, ctx.recruitment, page),
        ]);
        return page.map(({ formSubmissionId: _f, ...r }) => ({
          ...r,
          choices: choices.get(r.id) ?? [],
          flags: flags.get(r.id) ?? [],
          syaratUmum: syarat.get(r.id) ?? ('lolos' as GeneralGateStatus),
        }));
      };
      const ordered = [...groupOrder, ...sortOrder, asc(application.id)];

      if (input.syaratUmum) {
        // Syarat umum dihitung di memori, jadi saringan ini mengambil semua
        // pendaftar yang lolos saringan SQL lalu memotong halaman sendiri.
        const all = await base.orderBy(...ordered);
        const syarat = await syaratUmumFor(ctx.db, ctx.recruitment, all);
        const kept = all.filter(
          (r) => (syarat.get(r.id) ?? 'lolos') === input.syaratUmum,
        );
        const pageRows = kept.slice(
          (input.page - 1) * input.pageSize,
          input.page * input.pageSize,
        );
        return {
          total: kept.length,
          page: input.page,
          pageSize: input.pageSize,
          rows: await decorate(pageRows),
        };
      }

      const [rows, [totalRow]] = await Promise.all([
        base
          .orderBy(...ordered)
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db
          .select({ n: count() })
          .from(application)
          .innerJoin(users, eq(users.id, application.userId))
          .leftJoin(mahasiswa, eq(mahasiswa.userId, application.userId))
          .where(where),
      ]);
      return {
        total: totalRow?.n ?? 0,
        page: input.page,
        pageSize: input.pageSize,
        rows: await decorate(rows),
      };
    }),

  /** Berkas satu pendaftar: identitas, pilihan, dan jawaban formulir. */
  applicantDetail: oprecScopedProcedure
    .input(ApplicantDetailInputSchema)
    .query(async ({ ctx, input }) => {
      const [app] = await ctx.db
        .select({
          id: application.id,
          source: application.source,
          willingToMove: application.willingToMove,
          submittedAt: application.submittedAt,
          formSubmissionId: application.formSubmissionId,
          waveLabel: recruitmentWave.label,
          name: displayName,
          nim: mahasiswa.nim,
          prodi: mahasiswa.jurusan,
          angkatan: mahasiswa.angkatan,
        })
        .from(application)
        .innerJoin(users, eq(users.id, application.userId))
        .leftJoin(mahasiswa, eq(mahasiswa.userId, application.userId))
        .leftJoin(recruitmentWave, eq(recruitmentWave.id, application.waveId))
        .where(
          and(
            eq(application.id, input.applicationId),
            eq(application.recruitmentId, input.recruitmentId),
          ),
        );
      if (!app) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pendaftar tidak ditemukan.',
        });
      }
      const choices = (await choicesOf(ctx.db, [app.id])).get(app.id) ?? [];
      let columns: ReturnType<typeof toColumns> = [];
      let answers: Record<string, unknown> = {};
      if (app.formSubmissionId) {
        // Dikunci ke form oprec ini lewat recruitment, bukan input klien.
        const [found] = await submissionQuery(ctx.db).where(
          and(
            eq(formSubmission.id, app.formSubmissionId),
            eq(formSubmission.formId, ctx.recruitment.formId),
          ),
        );
        if (found) {
          const [row] = await attachAnswers(ctx.db, [toRespondent(found)]);
          answers = row?.answers ?? {};
          columns = toColumns(
            await loadResponseFields(ctx.db, ctx.recruitment.formId),
          );
        }
      }
      const flags = (await flagsOf(ctx.db, [app.id])).get(app.id) ?? [];
      const assessments = await aggregatedAssessments(
        ctx.db,
        ctx.recruitment,
        app.id,
        choices.map((c) => ({ id: c.id, divisionId: c.divisionId })),
      );
      return { ...app, choices, flags, assessments, columns, answers };
    }),
};
