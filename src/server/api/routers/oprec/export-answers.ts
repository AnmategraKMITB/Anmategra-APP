import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { oprecAssessProcedure, oprecScopedProcedure } from '~/server/api/trpc';
import {
  application,
  applicationChoice,
  formAnswer,
  organizationUnit,
  recruitmentDivision,
  recruitmentSectionBinding,
} from '~/server/db/schema';

import {
  OprecExportAnswersInputSchema,
  OprecExportPresetDeleteInputSchema,
  OprecExportPresetSaveInputSchema,
  RecruitmentIdInputSchema,
} from '../../types/oprec.type';
import {
  type ExportField,
  deleteExportPreset,
  listExportPresets,
  loadExportFields,
  saveExportPreset,
} from '../form/export-presets';
import { type Queryable } from '../form/services';
import { type AssessAccess, canAssessScope } from './assess-access';

export type OprecExportField = ExportField & {
  /** Divisi tempat bagian pertanyaan ini terikat; kosong = pertanyaan umum. */
  divisionIds: string[];
};

/** Divisi yang jawabannya boleh dibaca: yang dinilai atau diputuskan pemanggil. */
const visibleDivisions = (a: AssessAccess) =>
  new Set([...a.divisionIds, ...a.deciderDivisionIds]);

/**
 * Pertanyaan formulir oprec yang boleh diekspor pemanggil, mengikuti aturan
 * halaman penilaian: pertanyaan umum untuk semua, pertanyaan di bagian yang
 * terikat divisi hanya untuk admin dan orang di divisi itu. Pilihan divisi
 * (`unit_choice`) tidak ikut karena sudah tampil sebagai kolom sendiri.
 */
export async function loadOprecExportFields(
  db: Queryable,
  rec: { id: string; formId: string },
  a: AssessAccess,
) {
  const [fields, bindings, divisions] = await Promise.all([
    loadExportFields(db, rec.formId),
    db
      .select({
        sectionId: recruitmentSectionBinding.formSectionId,
        divisionId: recruitmentSectionBinding.divisionId,
      })
      .from(recruitmentSectionBinding)
      .where(eq(recruitmentSectionBinding.recruitmentId, rec.id)),
    db
      .select({ id: recruitmentDivision.id, label: organizationUnit.name })
      .from(recruitmentDivision)
      .innerJoin(
        organizationUnit,
        eq(organizationUnit.id, recruitmentDivision.unitId),
      )
      .where(eq(recruitmentDivision.recruitmentId, rec.id))
      .orderBy(asc(recruitmentDivision.sortOrder)),
  ]);
  const boundTo = new Map<string, string[]>();
  for (const b of bindings) {
    boundTo.set(b.sectionId, [
      ...(boundTo.get(b.sectionId) ?? []),
      b.divisionId,
    ]);
  }
  const mine = visibleDivisions(a);
  const visible: OprecExportField[] = fields.flatMap((f) => {
    if (f.type === 'unit_choice') return [];
    const bound = f.sectionId ? (boundTo.get(f.sectionId) ?? []) : [];
    const divisionIds = a.isAdmin ? bound : bound.filter((d) => mine.has(d));
    if (bound.length > 0 && divisionIds.length === 0) return [];
    return [{ ...f, divisionIds }];
  });
  return { fields: visible, divisions };
}

/**
 * Jawaban formulir untuk ekspor oprec, satu baris per pendaftar yang boleh
 * dilihat pemanggil. Admin dan penilai umum melihat semua pendaftar; yang lain
 * hanya pendaftar yang memilih divisinya.
 */
export async function loadOprecExportAnswers(
  db: Queryable,
  rec: { id: string; formId: string },
  a: AssessAccess,
  fieldIds: string[] | undefined,
) {
  const { fields, divisions } = await loadOprecExportFields(db, rec, a);
  const wanted = fieldIds ? new Set(fieldIds) : null;
  const columns = wanted ? fields.filter((f) => wanted.has(f.fieldId)) : fields;
  if (columns.length === 0) return { columns, divisions, rows: [] };

  const apps = await db
    .select({
      id: application.id,
      submissionId: application.formSubmissionId,
    })
    .from(application)
    .where(
      and(
        eq(application.recruitmentId, rec.id),
        isNotNull(application.formSubmissionId),
      ),
    );
  let allowed = apps;
  if (!canAssessScope(a, null)) {
    const mine = [...visibleDivisions(a)];
    const chosen = mine.length
      ? await db
          .select({ applicationId: applicationChoice.applicationId })
          .from(applicationChoice)
          .innerJoin(
            application,
            eq(application.id, applicationChoice.applicationId),
          )
          .where(
            and(
              eq(application.recruitmentId, rec.id),
              inArray(applicationChoice.divisionId, mine),
            ),
          )
      : [];
    const ids = new Set(chosen.map((c) => c.applicationId));
    allowed = apps.filter((app) => ids.has(app.id));
  }
  const submissionIds = allowed.flatMap((app) =>
    app.submissionId ? [app.submissionId] : [],
  );
  const answers = submissionIds.length
    ? await db
        .select({
          submissionId: formAnswer.submissionId,
          fieldId: formAnswer.fieldId,
          value: formAnswer.value,
        })
        .from(formAnswer)
        .where(
          and(
            inArray(formAnswer.submissionId, submissionIds),
            inArray(
              formAnswer.fieldId,
              columns.map((c) => c.fieldId),
            ),
          ),
        )
    : [];
  const bySubmission = new Map<string, Record<string, unknown>>();
  for (const answer of answers) {
    if (!answer.fieldId) continue;
    const row = bySubmission.get(answer.submissionId) ?? {};
    row[answer.fieldId] = answer.value;
    bySubmission.set(answer.submissionId, row);
  }
  return {
    columns,
    divisions,
    rows: allowed.map((app) => ({
      applicationId: app.id,
      answers: bySubmission.get(app.submissionId ?? '') ?? {},
    })),
  };
}

export const exportAnswerProcedures = {
  /**
   * Pilihan pertanyaan untuk dialog ekspor oprec: pertanyaan yang boleh
   * dilihat pemanggil (dengan divisi bagiannya) dan preset bersama form oprec.
   * Hanya admin yang boleh menyimpan atau menghapus preset.
   */
  exportOptions: oprecAssessProcedure
    .input(RecruitmentIdInputSchema)
    .query(async ({ ctx }) => {
      const rec = ctx.recruitment;
      const { fields, divisions } = await loadOprecExportFields(
        ctx.db,
        rec,
        ctx.assess,
      );
      const labelOf = new Map(divisions.map((d) => [d.id, d.label] as const));
      return {
        fields: fields.map(({ divisionIds, ...f }) => ({
          ...f,
          divisions: divisionIds.flatMap((d) => labelOf.get(d) ?? []),
        })),
        presets: await listExportPresets(
          ctx.db,
          rec.formId,
          new Set(fields.map((f) => f.fieldId)),
        ),
        canSavePresets: ctx.assess.isAdmin,
      };
    }),

  exportAnswers: oprecAssessProcedure
    .input(OprecExportAnswersInputSchema)
    .query(({ ctx, input }) =>
      loadOprecExportAnswers(
        ctx.db,
        ctx.recruitment,
        ctx.assess,
        input.fieldIds,
      ),
    ),

  exportPresetSave: oprecScopedProcedure
    .input(OprecExportPresetSaveInputSchema)
    .mutation(({ ctx, input }) =>
      saveExportPreset(ctx.db, {
        formId: ctx.recruitment.formId,
        name: input.name,
        fieldIds: input.fieldIds,
        userId: ctx.session.user.id,
      }),
    ),

  exportPresetDelete: oprecScopedProcedure
    .input(OprecExportPresetDeleteInputSchema)
    .mutation(({ ctx, input }) =>
      deleteExportPreset(ctx.db, ctx.recruitment.formId, input.presetId),
    ),
};
