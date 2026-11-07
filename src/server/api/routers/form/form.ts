import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import {
  createTRPCRouter,
  eventScopedProcedure,
  formScopedProcedure,
  lembagaScopedProcedure,
} from '~/server/api/trpc';
import { type FormStatus, form, formField } from '~/server/db/schema';
import { deleteUploadedFiles, keyFromUploadUrl } from '~/server/uploads';

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
  RotatePreviewTokenInputSchema,
  RotatePreviewTokenOutputSchema,
  SetFormStatusInputSchema,
  SetFormStatusOutputSchema,
  SetPreviewInputSchema,
  SetPreviewOutputSchema,
  StoredFormThemeSchema,
  UpdateFormInputSchema,
  UpdateFormOutputSchema,
} from '../../types/form.type';
import {
  type Queryable,
  assertOwnedImageUrl,
  assertPublishable,
  countSubmissions,
  generatePreviewToken,
  imageOut,
  loadActiveFields,
  loadEndings,
  loadSections,
  lockForm,
  ownedImageKeys,
  rethrow,
  toFormOutput,
  unreferencedImageKeys,
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

/** URL banner dan logo dari kolom theme (jsonb, tidak dipercaya). */
function readThemeImages(theme: unknown): string[] {
  const parsed = StoredFormThemeSchema.safeParse(theme);
  if (!parsed.success) return [];
  return [parsed.data.banner, parsed.data.logo].flatMap((u) => u ?? []);
}

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
      const [fields, sections, endings, counts] = await Promise.all([
        loadActiveFields(ctx.db, ctx.form.id),
        loadSections(ctx.db, ctx.form.id),
        loadEndings(ctx.db, ctx.form.id),
        countSubmissions(ctx.db, [ctx.form.id]),
      ]);
      return {
        ...toFormOutput(ctx.form),
        submissionCount: counts.get(ctx.form.id) ?? 0,
        fields,
        sections,
        endings,
      };
    }),

  update: formScopedProcedure
    .input(UpdateFormInputSchema)
    .output(UpdateFormOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        let droppedKeys: string[] = [];
        const row = await ctx.db.transaction(async (tx) => {
          // `ctx.form` dibaca middleware sebelum transaksi ini dibuka, jadi
          // statusnya bisa sudah basi. Baca ulang di bawah lock: tanpa itu
          // `update` yang berbarengan dengan `setStatus('Published')` bisa
          // meloloskan formulir rilis yang tenggatnya sudah lewat.
          const current = await lockForm(tx, ctx.form.id);

          // A live form must not be silently closed by moving its deadline
          // into the past; close it explicitly instead.
          if (
            current.status === 'Published' &&
            input.closesAt &&
            input.closesAt.getTime() <= Date.now()
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message:
                'Tenggat penutupan harus di masa depan. Tutup formulir jika ingin menghentikan pengisian.',
            });
          }

          const [updated] = await tx
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
              // Each JSON block is replaced as a whole, not merged.
              ...(input.settings !== undefined && { settings: input.settings }),
              ...(input.theme !== undefined && { theme: input.theme }),
              ...(input.welcome !== undefined && { welcome: input.welcome }),
            })
            .where(eq(form.id, current.id))
            .returning();
          // Banner atau logo yang diganti atau dihapus: berkasnya ikut dibuang.
          // Dibandingkan lewat kunci, bukan URL: URL yang sama bisa ditulis
          // dalam dua bentuk host dan tetap menunjuk berkas yang sama.
          if (input.theme !== undefined) {
            const beforeKeys = readThemeImages(current.theme)
              .map((url) => keyFromUploadUrl(url))
              .filter((key): key is string => key !== null);
            const afterUrls = readThemeImages(input.theme);
            const afterKeys = afterUrls
              .map((url) => keyFromUploadUrl(url))
              .filter((key): key is string => key !== null);
            for (const url of afterUrls) {
              const key = keyFromUploadUrl(url);
              if (key && !beforeKeys.includes(key)) {
                await assertOwnedImageUrl(tx, current.id, url);
              }
            }
            droppedKeys = beforeKeys.filter((key) => !afterKeys.includes(key));
          }
          return updated!;
        });
        const unused = await unreferencedImageKeys(
          ctx.db,
          ctx.form.id,
          droppedKeys,
        );
        void deleteUploadedFiles(unused);
        return toFormOutput(row);
      } catch (error) {
        rethrow(error, 'Gagal memperbarui formulir.');
      }
    }),

  delete: formScopedProcedure
    .input(DeleteFormInputSchema)
    .output(DeleteFormOutputSchema)
    .mutation(async ({ ctx }) => {
      try {
        let keys: string[] = [];
        await ctx.db.transaction(async (tx) => {
          // Lock first so a submission cannot land between the count and the delete.
          const current = await lockForm(tx, ctx.form.id);
          const counts = await countSubmissions(tx, [ctx.form.id]);
          if ((counts.get(ctx.form.id) ?? 0) > 0) {
            throw new TRPCError({
              code: 'CONFLICT',
              message:
                'Formulir yang sudah memiliki jawaban tidak dapat dihapus. Tutup formulir sebagai gantinya.',
            });
          }
          const images = await tx
            .select({ image: formField.image })
            .from(formField)
            .where(eq(formField.formId, ctx.form.id));
          // Catatan kepemilikan ikut terhapus lewat cascade, jadi saring
          // kuncinya sebelum baris form dihapus.
          keys = await ownedImageKeys(tx, ctx.form.id, [
            ...readThemeImages(current.theme).flatMap(
              (url) => keyFromUploadUrl(url) ?? [],
            ),
            ...images.flatMap((r) => imageOut(r.image)?.key ?? []),
          ]);
          await tx.delete(form).where(eq(form.id, ctx.form.id));
        });
        void deleteUploadedFiles(keys);
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

  /**
   * Turns the public preview link on or off. The token is created the first
   * time the link is enabled and kept while it is off, so switching back on
   * restores the same link; `rotatePreviewToken` is what revokes it.
   */
  setPreview: formScopedProcedure
    .input(SetPreviewInputSchema)
    .output(SetPreviewOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const row = await ctx.db.transaction(async (tx) => {
          const current = await lockForm(tx, ctx.form.id);
          const [updated] = await tx
            .update(form)
            .set({
              previewEnabled: input.enabled,
              ...(input.enabled &&
                current.previewToken === null && {
                  previewToken: generatePreviewToken(),
                }),
            })
            .where(eq(form.id, current.id))
            .returning();
          return updated!;
        });
        return toFormOutput(row);
      } catch (error) {
        rethrow(error, 'Gagal mengubah pratinjau formulir.');
      }
    }),

  /** Issues a new preview token; the old link stops working at once. */
  rotatePreviewToken: formScopedProcedure
    .input(RotatePreviewTokenInputSchema)
    .output(RotatePreviewTokenOutputSchema)
    .mutation(async ({ ctx }) => {
      try {
        const row = await ctx.db.transaction(async (tx) => {
          const current = await lockForm(tx, ctx.form.id);
          const [updated] = await tx
            .update(form)
            .set({ previewToken: generatePreviewToken() })
            .where(eq(form.id, current.id))
            .returning();
          return updated!;
        });
        return toFormOutput(row);
      } catch (error) {
        rethrow(error, 'Gagal membuat ulang tautan pratinjau.');
      }
    }),
});
