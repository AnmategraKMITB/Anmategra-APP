import { TRPCError } from '@trpc/server';
import { and, count, eq, isNull, max, sql } from 'drizzle-orm';
import { createTRPCRouter, formScopedProcedure } from '~/server/api/trpc';
import { formField, formSection } from '~/server/db/schema';

import {
  CreateSectionInputSchema,
  CreateSectionOutputSchema,
  DeleteSectionInputSchema,
  DeleteSectionOutputSchema,
  MAX_SECTIONS_PER_FORM,
  ReorderSectionsInputSchema,
  ReorderSectionsOutputSchema,
  UpdateSectionInputSchema,
  UpdateSectionOutputSchema,
} from '../../types/form.type';
import {
  type Queryable,
  enforceConditions,
  getSectionForForm,
  loadSections,
  lockForm,
  rethrow,
} from './services';

async function countActiveFieldsInSection(
  db: Queryable,
  formId: string,
  sectionId: string,
) {
  const [row] = await db
    .select({ n: count() })
    .from(formField)
    .where(
      and(
        eq(formField.formId, formId),
        eq(formField.sectionId, sectionId),
        isNull(formField.archivedAt),
      ),
    );
  return row?.n ?? 0;
}

async function loadSectionOutput(
  db: Queryable,
  formId: string,
  sectionId: string,
) {
  const sections = await loadSections(db, formId);
  const section = sections.find((s) => s.id === sectionId);
  if (!section) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Bagian tidak ditemukan.',
    });
  }
  return section;
}

export const formSectionRouter = createTRPCRouter({
  create: formScopedProcedure
    .input(CreateSectionInputSchema)
    .output(CreateSectionOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const sectionId = await ctx.db.transaction(async (tx) => {
          // Serialises concurrent creates so sort orders do not collide.
          await lockForm(tx, ctx.form.id);

          const [total] = await tx
            .select({ n: count(), last: max(formSection.sortOrder) })
            .from(formSection)
            .where(eq(formSection.formId, ctx.form.id));
          if ((total?.n ?? 0) >= MAX_SECTIONS_PER_FORM) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Formulir maksimal memiliki ${MAX_SECTIONS_PER_FORM} bagian.`,
            });
          }

          const [created] = await tx
            .insert(formSection)
            .values({
              formId: ctx.form.id,
              title: input.title,
              description: input.description ?? null,
              sortOrder: (total?.last ?? -1) + 1,
            })
            .returning({ id: formSection.id });
          return created!.id;
        });
        return await loadSectionOutput(ctx.db, ctx.form.id, sectionId);
      } catch (error) {
        rethrow(error, 'Gagal menambahkan bagian.');
      }
    }),

  update: formScopedProcedure
    .input(UpdateSectionInputSchema)
    .output(UpdateSectionOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          await lockForm(tx, ctx.form.id);
          const section = await getSectionForForm(
            tx,
            ctx.form.id,
            input.sectionId,
          );
          const patch = {
            ...(input.title !== undefined && { title: input.title }),
            ...(input.description !== undefined && {
              description: input.description,
            }),
            ...(input.condition !== undefined && {
              condition: input.condition,
            }),
          };
          if (Object.keys(patch).length > 0) {
            await tx
              .update(formSection)
              .set(patch)
              .where(eq(formSection.id, section.id));
          }
          await enforceConditions(tx, ctx.form.id, {
            edited: [section.id],
            clearDependents: input.clearDependents,
          });
        });
        return await loadSectionOutput(ctx.db, ctx.form.id, input.sectionId);
      } catch (error) {
        rethrow(error, 'Gagal memperbarui bagian.');
      }
    }),

  delete: formScopedProcedure
    .input(DeleteSectionInputSchema)
    .output(DeleteSectionOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          await lockForm(tx, ctx.form.id);
          const section = await getSectionForForm(
            tx,
            ctx.form.id,
            input.sectionId,
          );

          const [sections] = await tx
            .select({ n: count() })
            .from(formSection)
            .where(eq(formSection.formId, ctx.form.id));
          if ((sections?.n ?? 0) <= 1) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Formulir harus punya minimal satu bagian.',
            });
          }

          // Active questions block the delete; archived ones do not (their
          // `section_id` is cleared by the FK, they are never shown anyway).
          const active = await countActiveFieldsInSection(
            tx,
            ctx.form.id,
            section.id,
          );
          if (active > 0) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: `Bagian masih berisi ${active} pertanyaan aktif. Pindahkan atau hapus pertanyaan terlebih dahulu.`,
            });
          }
          await tx.delete(formSection).where(eq(formSection.id, section.id));
        });
        return { success: true as const, message: 'Bagian berhasil dihapus.' };
      } catch (error) {
        rethrow(error, 'Gagal menghapus bagian.');
      }
    }),

  reorder: formScopedProcedure
    .input(ReorderSectionsInputSchema)
    .output(ReorderSectionsOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          await lockForm(tx, ctx.form.id);
          const all = await loadSections(tx, ctx.form.id);
          const allIds = new Set(all.map((s) => s.id));
          const wanted = new Set(input.sectionIds);

          // Must be exactly the form's sections: no missing, extra, foreign or
          // duplicated ids — otherwise the order would be ambiguous.
          if (
            wanted.size !== input.sectionIds.length ||
            wanted.size !== allIds.size ||
            input.sectionIds.some((id) => !allIds.has(id))
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'Urutan harus memuat semua bagian formulir ini tepat satu kali.',
            });
          }

          // Satu UPDATE untuk semua baris, dengan casting eksplisit seperti
          // pada `field.reorder`; `updated_at` diset manual karena SQL mentah.
          const urutan = sql.join(
            input.sectionIds.map(
              (id, i) => sql`(${id}::varchar, ${i}::integer)`,
            ),
            sql`, `,
          );
          await tx.execute(
            sql`update ${formSection} as s
                set sort_order = v.sort_order, updated_at = now()
                from (values ${urutan}) as v(id, sort_order)
                where s.id = v.id and s.form_id = ${ctx.form.id}`,
          );
          await enforceConditions(tx, ctx.form.id, input);
        });
        return { success: true as const, message: 'Urutan bagian disimpan.' };
      } catch (error) {
        rethrow(error, 'Gagal mengubah urutan bagian.');
      }
    }),
});
