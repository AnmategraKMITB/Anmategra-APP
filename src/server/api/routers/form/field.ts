import { TRPCError } from '@trpc/server';
import { and, asc, count, eq, inArray, isNull, max, sql } from 'drizzle-orm';
import { createTRPCRouter, formScopedProcedure } from '~/server/api/trpc';
import { formField, formFieldOption } from '~/server/db/schema';
import { deleteUploadedFiles } from '~/server/uploads';

import {
  type CreateFieldInput,
  CreateFieldInputSchema,
  CreateFieldOutputSchema,
  DeleteFieldInputSchema,
  DeleteFieldOutputSchema,
  MAX_FIELDS_PER_FORM,
  MoveFieldInputSchema,
  MoveFieldOutputSchema,
  ReorderFieldsInputSchema,
  ReorderFieldsOutputSchema,
  type UpdateFieldInput,
  UpdateFieldInputSchema,
  UpdateFieldOutputSchema,
  normalizeMatrixConfig,
} from '../../types/form.type';
import {
  type Queryable,
  type Tx,
  assertOwnedImage,
  assertUnitChoiceAllowed,
  countAnswerableFields,
  enforceConditions,
  fieldHasAnswers,
  getActiveField,
  getSectionForForm,
  imageOut,
  isAnswerable,
  isChoiceType,
  loadFieldOutput,
  lockForm,
  optionsWithAnswers,
  rethrow,
  unreferencedImageKeys,
} from './services';

type OptionInput = { id?: string; label: string };

function optionsOf(input: CreateFieldInput | UpdateFieldInput): OptionInput[] {
  return 'options' in input ? input.options : [];
}

/**
 * Makes the field's active options match `wanted`, in that order. Existing
 * options are matched by id; ones left out are archived if an answer picked
 * them (so old answers keep a real row) and deleted otherwise.
 */
async function syncOptions(tx: Tx, fieldId: string, wanted: OptionInput[]) {
  const existing = await tx
    .select({ id: formFieldOption.id })
    .from(formFieldOption)
    .where(
      and(
        eq(formFieldOption.fieldId, fieldId),
        isNull(formFieldOption.archivedAt),
      ),
    );
  const existingIds = new Set(existing.map((o) => o.id));

  const seen = new Set<string>();
  for (const option of wanted) {
    if (option.id === undefined) continue;
    if (!existingIds.has(option.id) || seen.has(option.id)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Pilihan tidak ditemukan pada pertanyaan ini.',
      });
    }
    seen.add(option.id);
  }

  // Dibuang: satu query untuk mencari mana yang sudah pernah dipilih, lalu dua
  // perintah massal — bukan satu pasang query per opsi.
  const dibuang = existing.map((o) => o.id).filter((id) => !seen.has(id));
  if (dibuang.length > 0) {
    const terpakai = await optionsWithAnswers(tx, fieldId, dibuang);
    const diarsipkan = dibuang.filter((id) => terpakai.has(id));
    const dihapus = dibuang.filter((id) => !terpakai.has(id));
    if (diarsipkan.length > 0) {
      await tx
        .update(formFieldOption)
        .set({ archivedAt: new Date() })
        .where(inArray(formFieldOption.id, diarsipkan));
    }
    if (dihapus.length > 0) {
      await tx
        .delete(formFieldOption)
        .where(inArray(formFieldOption.id, dihapus));
    }
  }

  const bernomor = wanted.map((option, sortOrder) => ({
    ...option,
    sortOrder,
  }));

  const diperbarui = bernomor.filter((o) => o.id !== undefined);
  if (diperbarui.length > 0) {
    const nilai = sql.join(
      diperbarui.map(
        (o) =>
          sql`(${o.id!}::varchar, ${o.label}::varchar, ${o.sortOrder}::integer)`,
      ),
      sql`, `,
    );
    // `updated_at` diset manual: lihat catatan di `reorder`.
    await tx.execute(
      sql`update ${formFieldOption} as o
          set label = v.label, sort_order = v.sort_order, updated_at = now()
          from (values ${nilai}) as v(id, label, sort_order)
          where o.id = v.id and o.field_id = ${fieldId}`,
    );
  }

  const ditambahkan = bernomor.filter((o) => o.id === undefined);
  if (ditambahkan.length > 0) {
    await tx.insert(formFieldOption).values(
      ditambahkan.map((o) => ({
        fieldId,
        label: o.label,
        sortOrder: o.sortOrder,
      })),
    );
  }
}

/** `matrix` rows and columns get their stable ids before being stored. */
function configOf(input: CreateFieldInput | UpdateFieldInput) {
  return input.type === 'matrix'
    ? normalizeMatrixConfig(input.config)
    : input.config;
}

/**
 * A field belongs to one group: a section, or `null` for the fields outside
 * every section. `sort_order` is counted inside the group, so reordering or
 * moving only ever rewrites the groups it touches.
 */
function groupScope(formId: string, sectionId: string | null) {
  return and(
    eq(formField.formId, formId),
    sectionId === null
      ? isNull(formField.sectionId)
      : eq(formField.sectionId, sectionId),
  );
}

/** Ids of the active fields of a group, in display order. */
async function loadActiveFieldIdsInGroup(
  db: Queryable,
  formId: string,
  sectionId: string | null,
): Promise<string[]> {
  const rows = await db
    .select({ id: formField.id })
    .from(formField)
    .where(and(groupScope(formId, sectionId), isNull(formField.archivedAt)))
    .orderBy(asc(formField.sortOrder), asc(formField.created_at));
  return rows.map((r) => r.id);
}

/**
 * Puts `orderedFieldIds` into the group, numbered 0..n-1. Also sets
 * `section_id`, so it is how a moved field joins its new group. One UPDATE for
 * every row; explicit casts because a parameter inside VALUES has no type
 * Postgres can infer, and `updated_at` is set by hand (Drizzle's `$onUpdate`
 * only runs through `db.update()`, not raw SQL).
 */
async function renumberGroup(
  tx: Tx,
  formId: string,
  sectionId: string | null,
  orderedFieldIds: string[],
) {
  if (orderedFieldIds.length === 0) return;
  const urutan = sql.join(
    orderedFieldIds.map((id, i) => sql`(${id}::varchar, ${i}::integer)`),
    sql`, `,
  );
  await tx.execute(
    sql`update ${formField} as f
        set sort_order = v.sort_order,
            section_id = ${sectionId}::varchar,
            updated_at = now()
        from (values ${urutan}) as v(id, sort_order)
        where f.id = v.id and f.form_id = ${formId}`,
  );
}

async function countActiveFields(tx: Tx, formId: string) {
  const [row] = await tx
    .select({ n: count() })
    .from(formField)
    .where(and(eq(formField.formId, formId), isNull(formField.archivedAt)));
  return row?.n ?? 0;
}

export const formFieldRouter = createTRPCRouter({
  create: formScopedProcedure
    .input(CreateFieldInputSchema)
    .output(CreateFieldOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const fieldId = await ctx.db.transaction(async (tx) => {
          // Serialises concurrent creates so sort orders do not collide.
          await lockForm(tx, ctx.form.id);

          if (
            (await countActiveFields(tx, ctx.form.id)) >= MAX_FIELDS_PER_FORM
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Formulir maksimal memiliki ${MAX_FIELDS_PER_FORM} pertanyaan.`,
            });
          }

          const sectionId = input.sectionId;
          await getSectionForForm(tx, ctx.form.id, sectionId);
          if (input.image) {
            await assertOwnedImage(tx, ctx.form.id, input.image);
          }

          if (input.type === 'unit_choice') {
            await assertUnitChoiceAllowed(tx, ctx.form.id, {
              willingFieldId: input.config.willingFieldId,
            });
          }

          // Archived fields count too, so a new field never reuses a slot.
          const [last] = await tx
            .select({ value: max(formField.sortOrder) })
            .from(formField)
            .where(groupScope(ctx.form.id, sectionId));

          const [created] = await tx
            .insert(formField)
            .values({
              formId: ctx.form.id,
              type: input.type,
              label: input.label,
              description: input.description ?? null,
              // Blok Pilihan selalu wajib: pendaftar tanpa pilihan tidak sah.
              required: input.type === 'unit_choice' ? true : input.required,
              config: configOf(input),
              condition: input.condition ?? null,
              image: input.image ?? null,
              sectionId,
              sortOrder: (last?.value ?? -1) + 1,
            })
            .returning({ id: formField.id });

          await syncOptions(tx, created!.id, optionsOf(input));
          await enforceConditions(tx, ctx.form.id, {
            edited: [created!.id],
            clearDependents: input.clearDependents,
          });
          return created!.id;
        });
        return loadFieldOutput(ctx.db, ctx.form.id, fieldId);
      } catch (error) {
        rethrow(error, 'Gagal menambahkan pertanyaan.');
      }
    }),

  update: formScopedProcedure
    .input(UpdateFieldInputSchema)
    .output(UpdateFieldOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const replacedKey = await ctx.db.transaction(async (tx) => {
          // Same lock as the other field writes: without it two concurrent
          // updates (or an update racing a delete) read the same field state
          // and the last writer silently wins.
          const current = await lockForm(tx, ctx.form.id);
          const field = await getActiveField(tx, ctx.form.id, input.fieldId);
          const before = imageOut(field.image);

          if (input.image && input.image.key !== before?.key) {
            await assertOwnedImage(tx, ctx.form.id, input.image);
          }

          // Same rule as `delete`: turning the last answerable question of a
          // live form into a text block would leave nothing to answer.
          if (
            current.status === 'Published' &&
            isAnswerable(field.type) &&
            !isAnswerable(input.type) &&
            (await countAnswerableFields(tx, ctx.form.id)) === 1
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'Formulir yang sedang dirilis harus memiliki minimal satu pertanyaan.',
            });
          }

          // Old answers were validated against the old type; reinterpreting
          // them under a new one would corrupt them. Make a new field instead.
          if (
            field.type !== input.type &&
            (await fieldHasAnswers(tx, field.id))
          ) {
            throw new TRPCError({
              code: 'CONFLICT',
              message:
                'Tipe pertanyaan yang sudah memiliki jawaban tidak dapat diubah. Buat pertanyaan baru sebagai gantinya.',
            });
          }

          if (input.type === 'unit_choice') {
            await assertUnitChoiceAllowed(tx, ctx.form.id, {
              willingFieldId: input.config.willingFieldId,
              selfId: field.id,
            });
          }

          await tx
            .update(formField)
            .set({
              type: input.type,
              label: input.label,
              description: input.description ?? null,
              required: input.type === 'unit_choice' ? true : input.required,
              config: configOf(input),
              ...(input.condition === undefined
                ? {}
                : { condition: input.condition }),
              ...(input.image === undefined ? {} : { image: input.image }),
            })
            .where(eq(formField.id, field.id));

          // A non-choice type keeps no options: passing [] removes them all.
          await syncOptions(
            tx,
            field.id,
            isChoiceType(input.type) ? optionsOf(input) : [],
          );
          await enforceConditions(tx, ctx.form.id, {
            edited: [field.id],
            clearDependents: input.clearDependents,
          });
          return input.image !== undefined &&
            before &&
            before.key !== input.image?.key
            ? before.key
            : null;
        });
        if (replacedKey) {
          const unused = await unreferencedImageKeys(ctx.db, ctx.form.id, [
            replacedKey,
          ]);
          void deleteUploadedFiles(unused);
        }
        return loadFieldOutput(ctx.db, ctx.form.id, input.fieldId);
      } catch (error) {
        rethrow(error, 'Gagal memperbarui pertanyaan.');
      }
    }),

  delete: formScopedProcedure
    .input(DeleteFieldInputSchema)
    .output(DeleteFieldOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await ctx.db.transaction(async (tx) => {
          const current = await lockForm(tx, ctx.form.id);
          const field = await getActiveField(tx, ctx.form.id, input.fieldId);

          // Only questions count: a form must keep one that can be answered,
          // however many text blocks surround it.
          if (
            current.status === 'Published' &&
            isAnswerable(field.type) &&
            (await countAnswerableFields(tx, ctx.form.id)) === 1
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'Formulir yang sedang dirilis harus memiliki minimal satu pertanyaan.',
            });
          }

          if (await fieldHasAnswers(tx, field.id)) {
            await tx
              .update(formField)
              .set({ archivedAt: new Date() })
              .where(eq(formField.id, field.id));
            await enforceConditions(tx, ctx.form.id, input);
            return 'archived' as const;
          }
          await tx.delete(formField).where(eq(formField.id, field.id));
          await enforceConditions(tx, ctx.form.id, input);
          // Berkas gambarnya sengaja tidak dihapus: "Urungkan" membuat ulang
          // pertanyaan ini dengan kunci yang sama dan gambarnya harus masih ada.
          return 'deleted' as const;
        });
        return {
          success: true as const,
          message: 'Pertanyaan berhasil dihapus.',
          result,
        };
      } catch (error) {
        rethrow(error, 'Gagal menghapus pertanyaan.');
      }
    }),

  reorder: formScopedProcedure
    .input(ReorderFieldsInputSchema)
    .output(ReorderFieldsOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          await lockForm(tx, ctx.form.id);
          if (input.sectionId !== null) {
            await getSectionForForm(tx, ctx.form.id, input.sectionId);
          }
          const activeIds = new Set(
            await loadActiveFieldIdsInGroup(tx, ctx.form.id, input.sectionId),
          );
          const wanted = new Set(input.fieldIds);

          // Must be exactly the active set of this group: no missing, extra,
          // foreign or duplicated ids — otherwise the order would be ambiguous.
          if (
            wanted.size !== input.fieldIds.length ||
            wanted.size !== activeIds.size ||
            input.fieldIds.some((id) => !activeIds.has(id))
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                input.sectionId === null
                  ? 'Urutan harus memuat semua pertanyaan aktif formulir ini tepat satu kali.'
                  : 'Urutan harus memuat semua pertanyaan aktif di bagian ini tepat satu kali.',
            });
          }

          await renumberGroup(tx, ctx.form.id, input.sectionId, input.fieldIds);
          await enforceConditions(tx, ctx.form.id, input);
        });
        return {
          success: true as const,
          message: 'Urutan pertanyaan disimpan.',
        };
      } catch (error) {
        rethrow(error, 'Gagal mengubah urutan pertanyaan.');
      }
    }),

  move: formScopedProcedure
    .input(MoveFieldInputSchema)
    .output(MoveFieldOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          await lockForm(tx, ctx.form.id);
          const field = await getActiveField(tx, ctx.form.id, input.fieldId);
          if (input.toSectionId !== null) {
            await getSectionForForm(tx, ctx.form.id, input.toSectionId);
          }

          const from = field.sectionId;
          const sameGroup = from === input.toSectionId;
          const fromIds = await loadActiveFieldIdsInGroup(
            tx,
            ctx.form.id,
            from,
          );
          const targetIds = sameGroup
            ? fromIds
            : await loadActiveFieldIdsInGroup(
                tx,
                ctx.form.id,
                input.toSectionId,
              );
          const without = targetIds.filter((id) => id !== field.id);
          if (input.toIndex > without.length) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'Posisi tujuan melebihi jumlah pertanyaan di bagian tujuan.',
            });
          }

          const next = [
            ...without.slice(0, input.toIndex),
            field.id,
            ...without.slice(input.toIndex),
          ];
          if (!sameGroup) {
            // Close the gap the field leaves behind in its old group.
            await renumberGroup(
              tx,
              ctx.form.id,
              from,
              fromIds.filter((id) => id !== field.id),
            );
          }
          await renumberGroup(tx, ctx.form.id, input.toSectionId, next);
          await enforceConditions(tx, ctx.form.id, input);
        });
        return {
          success: true as const,
          message: 'Pertanyaan dipindahkan.',
        };
      } catch (error) {
        rethrow(error, 'Gagal memindahkan pertanyaan.');
      }
    }),
});
