import { TRPCError } from '@trpc/server';
import { and, count, eq, max, sql } from 'drizzle-orm';
import { createTRPCRouter, formScopedProcedure } from '~/server/api/trpc';
import { formEnding } from '~/server/db/schema';

import {
  CreateEndingInputSchema,
  CreateEndingOutputSchema,
  DeleteEndingInputSchema,
  DeleteEndingOutputSchema,
  MAX_ENDINGS_PER_FORM,
  ReorderEndingsInputSchema,
  ReorderEndingsOutputSchema,
  UpdateEndingInputSchema,
  UpdateEndingOutputSchema,
} from '../../types/form.type';
import {
  type Queryable,
  enforceConditions,
  loadEndings,
  lockForm,
  rethrow,
} from './services';

async function endingOutput(db: Queryable, formId: string, endingId: string) {
  const found = (await loadEndings(db, formId)).find((e) => e.id === endingId);
  if (!found) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Ending tidak ditemukan.',
    });
  }
  return found;
}

export const formEndingRouter = createTRPCRouter({
  create: formScopedProcedure
    .input(CreateEndingInputSchema)
    .output(CreateEndingOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const id = await ctx.db.transaction(async (tx) => {
          await lockForm(tx, ctx.form.id);
          const [total] = await tx
            .select({ value: count() })
            .from(formEnding)
            .where(eq(formEnding.formId, ctx.form.id));
          if ((total?.value ?? 0) >= MAX_ENDINGS_PER_FORM) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Formulir maksimal memiliki ${MAX_ENDINGS_PER_FORM} ending.`,
            });
          }
          const [last] = await tx
            .select({ value: max(formEnding.sortOrder) })
            .from(formEnding)
            .where(eq(formEnding.formId, ctx.form.id));
          const [created] = await tx
            .insert(formEnding)
            .values({
              formId: ctx.form.id,
              title: input.title,
              description: input.description ?? null,
              condition: input.condition ?? null,
              sortOrder: (last?.value ?? -1) + 1,
            })
            .returning({ id: formEnding.id });
          await enforceConditions(tx, ctx.form.id, { edited: [created!.id] });
          return created!.id;
        });
        return await endingOutput(ctx.db, ctx.form.id, id);
      } catch (error) {
        rethrow(error, 'Gagal menambahkan ending.');
      }
    }),

  update: formScopedProcedure
    .input(UpdateEndingInputSchema)
    .output(UpdateEndingOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          await lockForm(tx, ctx.form.id);
          await endingOutput(tx, ctx.form.id, input.endingId);
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
              .update(formEnding)
              .set(patch)
              .where(eq(formEnding.id, input.endingId));
          }
          await enforceConditions(tx, ctx.form.id, {
            edited: [input.endingId],
          });
        });
        return await endingOutput(ctx.db, ctx.form.id, input.endingId);
      } catch (error) {
        rethrow(error, 'Gagal memperbarui ending.');
      }
    }),

  delete: formScopedProcedure
    .input(DeleteEndingInputSchema)
    .output(DeleteEndingOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          await lockForm(tx, ctx.form.id);
          await endingOutput(tx, ctx.form.id, input.endingId);
          await tx
            .delete(formEnding)
            .where(
              and(
                eq(formEnding.id, input.endingId),
                eq(formEnding.formId, ctx.form.id),
              ),
            );
        });
        return { success: true as const, message: 'Ending berhasil dihapus.' };
      } catch (error) {
        rethrow(error, 'Gagal menghapus ending.');
      }
    }),

  reorder: formScopedProcedure
    .input(ReorderEndingsInputSchema)
    .output(ReorderEndingsOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          await lockForm(tx, ctx.form.id);
          const all = await loadEndings(tx, ctx.form.id);
          const allIds = new Set(all.map((e) => e.id));
          const wanted = new Set(input.endingIds);
          if (
            wanted.size !== input.endingIds.length ||
            wanted.size !== allIds.size ||
            input.endingIds.some((id) => !allIds.has(id))
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'Urutan harus memuat semua ending formulir ini tepat satu kali.',
            });
          }
          const urutan = sql.join(
            input.endingIds.map(
              (id, i) => sql`(${id}::varchar, ${i}::integer)`,
            ),
            sql`, `,
          );
          await tx.execute(
            sql`update ${formEnding} as e
                set sort_order = v.sort_order, updated_at = now()
                from (values ${urutan}) as v(id, sort_order)
                where e.id = v.id and e.form_id = ${ctx.form.id}`,
          );
        });
        return { success: true as const, message: 'Urutan ending disimpan.' };
      } catch (error) {
        rethrow(error, 'Gagal mengubah urutan ending.');
      }
    }),
});
