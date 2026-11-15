import { eq } from 'drizzle-orm';
import { formSubmission, recruitmentSectionBinding } from '~/server/db/schema';

import {
  attachAnswers,
  loadResponseFields,
  submissionQuery,
  toRespondent,
} from '../form/responses';
import { type Queryable } from '../form/services';

export type AnswerColumn = {
  fieldId: string;
  type: string;
  label: string;
  sectionId: string | null;
  /** true = pertanyaan di bagian yang terikat ke divisi ini; false = pertanyaan umum. */
  forDivision: boolean;
};

/**
 * Jawaban pendaftar yang relevan dengan satu lingkup: pertanyaan umum (bagian
 * tanpa ikatan) plus bagian yang terikat ke `divisionId`. Pertanyaan divisi
 * lain tidak ikut, karena pasti kosong bagi yang tidak memilihnya.
 */
export async function loadApplicantAnswers(
  db: Queryable,
  rec: { id: string; formId: string },
  formSubmissionId: string | null,
  divisionId: string | null,
): Promise<{ columns: AnswerColumn[]; answers: Record<string, unknown> }> {
  if (!formSubmissionId) return { columns: [], answers: {} };

  const bindings = await db
    .select()
    .from(recruitmentSectionBinding)
    .where(eq(recruitmentSectionBinding.recruitmentId, rec.id));
  const boundTo = new Map<string, Set<string>>();
  for (const b of bindings) {
    boundTo.set(
      b.formSectionId,
      new Set([...(boundTo.get(b.formSectionId) ?? []), b.divisionId]),
    );
  }

  const fields = await loadResponseFields(db, rec.formId);
  const columns = fields.flatMap((f) => {
    if (f.type === 'unit_choice') return [];
    const sec = f.sectionId ? boundTo.get(f.sectionId) : undefined;
    if (sec && (divisionId === null || !sec.has(divisionId))) return [];
    return [
      {
        fieldId: f.id,
        type: f.type,
        label: f.label,
        sectionId: f.sectionId,
        forDivision: !!sec,
      },
    ];
  });

  const [found] = await submissionQuery(db).where(
    eq(formSubmission.id, formSubmissionId),
  );
  if (!found) return { columns, answers: {} };
  const [row] = await attachAnswers(db, [toRespondent(found)]);
  return { columns, answers: row?.answers ?? {} };
}
