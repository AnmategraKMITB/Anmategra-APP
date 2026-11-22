import { TRPCError } from '@trpc/server';
import { and, asc, eq } from 'drizzle-orm';
import { createTRPCRouter, formScopedProcedure } from '~/server/api/trpc';
import { formExportPreset, formSection } from '~/server/db/schema';

import {
  FormExportOptionsInputSchema,
  FormExportPresetDeleteInputSchema,
  FormExportPresetSaveInputSchema,
} from '../../types/form.type';
import { loadResponseFields } from './responses';
import { type Queryable } from './services';

export const MAX_EXPORT_PRESETS = 30;

export type ExportField = {
  fieldId: string;
  type: string;
  label: string;
  archived: boolean;
  sectionId: string | null;
  sectionTitle: string | null;
};

/** Pertanyaan yang bisa dipilih untuk ekspor, urut seperti di form, beserta judul bagiannya. */
export async function loadExportFields(
  db: Queryable,
  formId: string,
): Promise<ExportField[]> {
  const [fields, sections] = await Promise.all([
    loadResponseFields(db, formId),
    db
      .select({ id: formSection.id, title: formSection.title })
      .from(formSection)
      .where(eq(formSection.formId, formId)),
  ]);
  const titleOf = new Map(sections.map((s) => [s.id, s.title] as const));
  return fields.map((f) => ({
    fieldId: f.id,
    type: f.type,
    label: f.label,
    archived: !!f.archivedAt,
    sectionId: f.sectionId,
    sectionTitle: f.sectionId ? (titleOf.get(f.sectionId) ?? null) : null,
  }));
}

/**
 * Preset ekspor satu form. Id pertanyaan yang sudah tidak ada atau tidak boleh
 * dilihat pemanggil (`known`) dibuang, jadi preset tidak pernah membuka
 * pertanyaan di luar hak akses.
 */
export async function listExportPresets(
  db: Queryable,
  formId: string,
  known: Set<string>,
) {
  const rows = await db
    .select({
      id: formExportPreset.id,
      name: formExportPreset.name,
      fieldIds: formExportPreset.fieldIds,
      updatedAt: formExportPreset.updated_at,
    })
    .from(formExportPreset)
    .where(eq(formExportPreset.formId, formId))
    .orderBy(asc(formExportPreset.name));
  return rows.map((row) => ({
    ...row,
    fieldIds: row.fieldIds.filter((id) => known.has(id)),
  }));
}

/** Simpan atau timpa preset bernama sama. Hanya id pertanyaan milik form ini yang disimpan. */
export async function saveExportPreset(
  db: Queryable,
  args: { formId: string; name: string; fieldIds: string[]; userId: string },
) {
  const known = new Set(
    (await loadExportFields(db, args.formId)).map((f) => f.fieldId),
  );
  const fieldIds = [...new Set(args.fieldIds)].filter((id) => known.has(id));
  const existing = await db
    .select({ id: formExportPreset.id, name: formExportPreset.name })
    .from(formExportPreset)
    .where(eq(formExportPreset.formId, args.formId));
  const same = existing.find((p) => p.name === args.name);
  if (!same && existing.length >= MAX_EXPORT_PRESETS) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Maksimal ${MAX_EXPORT_PRESETS} preset per form. Hapus yang tidak dipakai dulu.`,
    });
  }
  const [saved] = await db
    .insert(formExportPreset)
    .values({
      formId: args.formId,
      name: args.name,
      fieldIds,
      createdBy: args.userId,
    })
    .onConflictDoUpdate({
      target: [formExportPreset.formId, formExportPreset.name],
      set: { fieldIds, updated_at: new Date() },
    })
    .returning({ id: formExportPreset.id });
  return { id: saved!.id, name: args.name, fieldIds };
}

export async function deleteExportPreset(
  db: Queryable,
  formId: string,
  presetId: string,
) {
  const removed = await db
    .delete(formExportPreset)
    .where(
      and(
        eq(formExportPreset.formId, formId),
        eq(formExportPreset.id, presetId),
      ),
    )
    .returning({ id: formExportPreset.id });
  if (removed.length === 0) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Preset tidak ditemukan.',
    });
  }
  return { id: presetId };
}

export const formExportRouter = createTRPCRouter({
  /** Pertanyaan yang bisa dipilih untuk ekspor respons, beserta preset bersama form ini. */
  options: formScopedProcedure
    .input(FormExportOptionsInputSchema)
    .query(async ({ ctx }) => {
      const fields = await loadExportFields(ctx.db, ctx.form.id);
      return {
        fields: fields.map((f) => ({ ...f, divisions: [] as string[] })),
        presets: await listExportPresets(
          ctx.db,
          ctx.form.id,
          new Set(fields.map((f) => f.fieldId)),
        ),
        canSavePresets: true,
      };
    }),

  presetSave: formScopedProcedure
    .input(FormExportPresetSaveInputSchema)
    .mutation(({ ctx, input }) =>
      saveExportPreset(ctx.db, {
        formId: ctx.form.id,
        name: input.name,
        fieldIds: input.fieldIds,
        userId: ctx.session.user.id,
      }),
    ),

  presetDelete: formScopedProcedure
    .input(FormExportPresetDeleteInputSchema)
    .mutation(({ ctx, input }) =>
      deleteExportPreset(ctx.db, ctx.form.id, input.presetId),
    ),
});
