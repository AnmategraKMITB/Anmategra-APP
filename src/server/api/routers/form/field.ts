import { TRPCError } from '@trpc/server';
import { and, eq, isNull, max } from 'drizzle-orm';
import { createTRPCRouter, formScopedProcedure } from '~/server/api/trpc';
import { formField, formFieldOption } from '~/server/db/schema';

import {
  type CreateFieldInput,
  CreateFieldInputSchema,
  CreateFieldOutputSchema,
  DeleteFieldInputSchema,
  DeleteFieldOutputSchema,
  MAX_FIELDS_PER_FORM,
  ReorderFieldsInputSchema,
  ReorderFieldsOutputSchema,
  UpdateFieldInputSchema,
  UpdateFieldOutputSchema,
} from '../../types/form.type';
import {
  type Tx,
  fieldHasAnswers,
  getActiveField,
  isChoiceType,
  loadFieldOutput,
  lockForm,
  optionHasAnswers,
  rethrow,
} from './services';

type OptionInput = { id?: string; label: string };

function optionsOf(input: CreateFieldInput): OptionInput[] {
  return 'options' in input ? input.options : [];
}

/**
 * Makes the field's active options match `wanted`, in that order. Existing
 * options are matched by id; ones left out are archived if an answer picked
 * them (so old answers keep a real row) and deleted otherwise.
 */
async function syncOptions(tx: Tx, fieldId: string, wanted: OptionInput[]) {
  const existing = await tx
    .select()
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

  for (const old of existing) {
    if (seen.has(old.id)) continue;
    if (await optionHasAnswers(tx, fieldId, old.id)) {
      await tx
        .update(formFieldOption)
        .set({ archivedAt: new Date() })
        .where(eq(formFieldOption.id, old.id));
    } else {
      await tx.delete(formFieldOption).where(eq(formFieldOption.id, old.id));
    }
  }

  for (const [sortOrder, option] of wanted.entries()) {
    if (option.id) {
      await tx
        .update(formFieldOption)
        .set({ label: option.label, sortOrder })
        .where(eq(formFieldOption.id, option.id));
    } else {
      await tx
        .insert(formFieldOption)
        .values({ fieldId, label: option.label, sortOrder });
    }
  }
}

async function countActiveFields(tx: Tx, formId: string) {
  const rows = await tx
    .select({ id: formField.id })
    .from(formField)
    .where(and(eq(formField.formId, formId), isNull(formField.archivedAt)));
  return rows.length;
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

          // Archived fields count too, so a new field never reuses a slot.
          const [last] = await tx
            .select({ value: max(formField.sortOrder) })
            .from(formField)
            .where(eq(formField.formId, ctx.form.id));

          const [created] = await tx
            .insert(formField)
            .values({
              formId: ctx.form.id,
              type: input.type,
              label: input.label,
              description: input.description ?? null,
              required: input.required,
              config: input.config,
              sortOrder: (last?.value ?? -1) + 1,
            })
            .returning({ id: formField.id });

          await syncOptions(tx, created!.id, optionsOf(input));
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
        await ctx.db.transaction(async (tx) => {
          const field = await getActiveField(tx, ctx.form.id, input.fieldId);

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

          await tx
            .update(formField)
            .set({
              type: input.type,
              label: input.label,
              description: input.description ?? null,
              required: input.required,
              config: input.config,
            })
            .where(eq(formField.id, field.id));

          // A non-choice type keeps no options: passing [] removes them all.
          await syncOptions(
            tx,
            field.id,
            isChoiceType(input.type) ? optionsOf(input) : [],
          );
        });
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

          if (
            current.status === 'Published' &&
            (await countActiveFields(tx, ctx.form.id)) === 1
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
            return 'archived' as const;
          }
          await tx.delete(formField).where(eq(formField.id, field.id));
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
          const active = await tx
            .select({ id: formField.id })
            .from(formField)
            .where(
              and(
                eq(formField.formId, ctx.form.id),
                isNull(formField.archivedAt),
              ),
            );
          const activeIds = new Set(active.map((f) => f.id));
          const wanted = new Set(input.fieldIds);

          // Must be exactly the active set: no missing, extra, foreign or
          // duplicated ids — otherwise the order would be ambiguous.
          if (
            wanted.size !== input.fieldIds.length ||
            wanted.size !== activeIds.size ||
            input.fieldIds.some((id) => !activeIds.has(id))
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'Urutan harus memuat semua pertanyaan aktif formulir ini tepat satu kali.',
            });
          }

          for (const [sortOrder, id] of input.fieldIds.entries()) {
            await tx
              .update(formField)
              .set({ sortOrder })
              .where(
                and(eq(formField.id, id), eq(formField.formId, ctx.form.id)),
              );
          }
        });
        return {
          success: true as const,
          message: 'Urutan pertanyaan disimpan.',
        };
      } catch (error) {
        rethrow(error, 'Gagal mengubah urutan pertanyaan.');
      }
    }),
});
