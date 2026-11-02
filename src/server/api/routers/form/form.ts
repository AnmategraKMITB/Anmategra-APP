import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import {
  createTRPCRouter,
  eventScopedProcedure,
  formScopedProcedure,
  lembagaScopedProcedure,
} from '~/server/api/trpc';
import { type FormStatus, form } from '~/server/db/schema';

import {
  CreateFormForEventInputSchema,
  CreateFormForLembagaInputSchema,
  CreateFormOutputSchema,
  DeleteFormInputSchema,
  DeleteFormOutputSchema,
  GetFormByIdInputSchema,
  GetFormByIdOutputSchema,
  ListFormsByEventInputSchema,
  ListFormsByLembagaInputSchema,
  ListFormsOutputSchema,
  SetFormStatusInputSchema,
  SetFormStatusOutputSchema,
  UpdateFormInputSchema,
  UpdateFormOutputSchema,
} from '../../types/form.type';
import {
  type Queryable,
  assertPublishable,
  countSubmissions,
  loadActiveFields,
  lockForm,
  rethrow,
  toFormOutput,
} from './services';

async function listWithCounts(
  db: Queryable,
  rows: (typeof form.$inferSelect)[],
) {
  const counts = await countSubmissions(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    ...toFormOutput(r),
    submissionCount: counts.get(r.id) ?? 0,
  }));
}

/**
 * Which status moves are allowed. Going back to Draft is only possible while
 * nobody has submitted — checked separately, under the row lock.
 */
const TRANSITIONS: Record<FormStatus, readonly FormStatus[]> = {
  Draft: ['Published'],
  Published: ['Closed', 'Draft'],
  Closed: ['Published', 'Draft'],
};

export const formFormRouter = createTRPCRouter({
  createForLembaga: lembagaScopedProcedure
    .input(CreateFormForLembagaInputSchema)
    .output(CreateFormOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [row] = await ctx.db
          .insert(form)
          .values({
            lembagaId: ctx.lembagaId,
            title: input.title,
            description: input.description ?? null,
            closesAt: input.closesAt ?? null,
            allowMultipleSubmissions: input.allowMultipleSubmissions ?? false,
            createdBy: ctx.session.user.id,
          })
          .returning();
        return toFormOutput(row!);
      } catch (error) {
        rethrow(error, 'Gagal membuat formulir.');
      }
    }),

  createForEvent: eventScopedProcedure
    .input(CreateFormForEventInputSchema)
    .output(CreateFormOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [row] = await ctx.db
          .insert(form)
          .values({
            eventId: ctx.eventId,
            title: input.title,
            description: input.description ?? null,
            closesAt: input.closesAt ?? null,
            allowMultipleSubmissions: input.allowMultipleSubmissions ?? false,
            createdBy: ctx.session.user.id,
          })
          .returning();
        return toFormOutput(row!);
      } catch (error) {
        rethrow(error, 'Gagal membuat formulir.');
      }
    }),

  listByLembaga: lembagaScopedProcedure
    .input(ListFormsByLembagaInputSchema)
    .output(ListFormsOutputSchema)
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select()
        .from(form)
        .where(eq(form.lembagaId, ctx.lembagaId))
        .orderBy(desc(form.created_at));
      return listWithCounts(ctx.db, rows);
    }),

  listByEvent: eventScopedProcedure
    .input(ListFormsByEventInputSchema)
    .output(ListFormsOutputSchema)
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select()
        .from(form)
        .where(eq(form.eventId, ctx.eventId))
        .orderBy(desc(form.created_at));
      return listWithCounts(ctx.db, rows);
    }),

  getById: formScopedProcedure
    .input(GetFormByIdInputSchema)
    .output(GetFormByIdOutputSchema)
    .query(async ({ ctx }) => {
      const [fields, counts] = await Promise.all([
        loadActiveFields(ctx.db, ctx.form.id),
        countSubmissions(ctx.db, [ctx.form.id]),
      ]);
      return {
        ...toFormOutput(ctx.form),
        submissionCount: counts.get(ctx.form.id) ?? 0,
        fields,
      };
    }),

  update: formScopedProcedure
    .input(UpdateFormInputSchema)
    .output(UpdateFormOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // A live form must not be silently closed by moving its deadline
        // into the past; close it explicitly instead.
        if (
          ctx.form.status === 'Published' &&
          input.closesAt &&
          input.closesAt.getTime() <= Date.now()
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'Tenggat penutupan harus di masa depan. Tutup formulir jika ingin menghentikan pengisian.',
          });
        }

        const [row] = await ctx.db
          .update(form)
          .set({
            ...(input.title !== undefined && { title: input.title }),
            ...(input.description !== undefined && {
              description: input.description,
            }),
            ...(input.closesAt !== undefined && { closesAt: input.closesAt }),
            ...(input.allowMultipleSubmissions !== undefined && {
              allowMultipleSubmissions: input.allowMultipleSubmissions,
            }),
          })
          .where(eq(form.id, ctx.form.id))
          .returning();
        return toFormOutput(row!);
      } catch (error) {
        rethrow(error, 'Gagal memperbarui formulir.');
      }
    }),

  delete: formScopedProcedure
    .input(DeleteFormInputSchema)
    .output(DeleteFormOutputSchema)
    .mutation(async ({ ctx }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          // Lock first so a submission cannot land between the count and the delete.
          await lockForm(tx, ctx.form.id);
          const counts = await countSubmissions(tx, [ctx.form.id]);
          if ((counts.get(ctx.form.id) ?? 0) > 0) {
            throw new TRPCError({
              code: 'CONFLICT',
              message:
                'Formulir yang sudah memiliki jawaban tidak dapat dihapus. Tutup formulir sebagai gantinya.',
            });
          }
          await tx.delete(form).where(eq(form.id, ctx.form.id));
        });
        return {
          success: true as const,
          message: 'Formulir berhasil dihapus.',
        };
      } catch (error) {
        rethrow(error, 'Gagal menghapus formulir.');
      }
    }),

  setStatus: formScopedProcedure
    .input(SetFormStatusInputSchema)
    .output(SetFormStatusOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const row = await ctx.db.transaction(async (tx) => {
          const current = await lockForm(tx, ctx.form.id);
          if (current.status === input.status) return current;

          if (!TRANSITIONS[current.status].includes(input.status)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Status formulir tidak dapat diubah dari ${current.status} ke ${input.status}.`,
            });
          }

          if (input.status === 'Published') {
            assertPublishable(current, await loadActiveFields(tx, current.id));
          }

          if (input.status === 'Draft') {
            const counts = await countSubmissions(tx, [current.id]);
            if ((counts.get(current.id) ?? 0) > 0) {
              throw new TRPCError({
                code: 'CONFLICT',
                message:
                  'Formulir yang sudah memiliki jawaban tidak dapat dikembalikan ke Draft.',
              });
            }
          }

          const [updated] = await tx
            .update(form)
            .set({
              status: input.status,
              ...(input.status === 'Published' &&
                current.publishedAt === null && { publishedAt: new Date() }),
            })
            .where(eq(form.id, current.id))
            .returning();
          return updated!;
        });
        return toFormOutput(row);
      } catch (error) {
        rethrow(error, 'Gagal mengubah status formulir.');
      }
    }),
});
