import { inArray } from 'drizzle-orm';
import { storedAnswerToInput } from '~/lib/forms/answer-value';
import {
  type CriterionInput,
  type CriterionResult,
  autoGateTriggered,
} from '~/lib/oprec/scoring';
import { formAnswer } from '~/server/db/schema';

import { type Tx, loadActiveFields } from '../form/services';
import { type Database } from './services';

type Q = Tx | Database;

/**
 * Memuat jawaban yang dipakai gate otomatis (hanya pertanyaan yang dirujuk
 * aturan) beserta tipe pertanyaannya, supaya aturan bisa dievaluasi tanpa I/O.
 */
export async function loadGateAnswers(
  db: Q,
  rec: { formId: string },
  criteria: CriterionInput[],
  formSubmissionIds: string[],
): Promise<{
  answersBySubmission: Map<string, Record<string, unknown>>;
  fieldTypes: Record<string, string>;
}> {
  const gateRules = criteria.filter(
    (c) => c.kind === 'gugur_otomatis' && c.gateRule,
  );
  const answersBySubmission = new Map<string, Record<string, unknown>>();
  const fieldTypes: Record<string, string> = {};
  if (gateRules.length === 0) return { answersBySubmission, fieldTypes };

  const fields = await loadActiveFields(db, rec.formId);
  const wanted = new Set(gateRules.map((c) => c.gateRule!.fieldId));
  const byId = new Map(fields.map((f) => [f.id, f]));
  for (const id of wanted) {
    const f = byId.get(id);
    if (f) fieldTypes[id] = f.type;
  }

  const submissionIds = [...new Set(formSubmissionIds)];
  if (submissionIds.length === 0) return { answersBySubmission, fieldTypes };

  const rows = await db
    .select({
      submissionId: formAnswer.submissionId,
      fieldId: formAnswer.fieldId,
      value: formAnswer.value,
    })
    .from(formAnswer)
    .where(inArray(formAnswer.submissionId, submissionIds));
  for (const r of rows) {
    const f = r.fieldId ? byId.get(r.fieldId) : undefined;
    if (!f || !wanted.has(f.id)) continue;
    const mine = answersBySubmission.get(r.submissionId) ?? {};
    mine[f.id] = storedAnswerToInput(f, r.value);
    answersBySubmission.set(r.submissionId, mine);
  }
  return { answersBySubmission, fieldTypes };
}

export type GeneralGateStatus = 'lolos' | 'gugur' | 'perlu_ditinjau' | 'belum';

/**
 * Status syarat umum satu pendaftar: gate otomatis dan gate manual pada
 * kriteria lingkup umum. Gugur mengalahkan perlu ditinjau, lalu belum.
 */
export function generalGateStatus(
  umumCriteria: CriterionInput[],
  umumResults: Map<string, CriterionResult>,
  answers: Record<string, unknown>,
  fieldTypes: Record<string, string>,
): GeneralGateStatus {
  const gates = umumCriteria.filter(
    (c) => c.kind === 'gugur_otomatis' || c.kind === 'gugur_manual',
  );
  if (gates.length === 0) return 'lolos';

  const autoTriggered = gates
    .filter((c) => c.kind === 'gugur_otomatis' && c.gateRule)
    .map((c) => autoGateTriggered(c.gateRule!, answers, fieldTypes));
  const manualGates = gates
    .filter((c) => c.kind === 'gugur_manual')
    .map((c) => umumResults.get(c.id)?.gate ?? null);

  if (autoTriggered.some(Boolean) || manualGates.some((g) => g === 'tidak')) {
    return 'gugur';
  }
  if (manualGates.some((g) => g === 'ditinjau')) return 'perlu_ditinjau';
  if (manualGates.some((g) => g === null)) return 'belum';
  return 'lolos';
}
