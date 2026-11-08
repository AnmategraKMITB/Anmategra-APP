import { TRPCError } from '@trpc/server';
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  max,
  notInArray,
} from 'drizzle-orm';
import { MAX_RULES } from '~/lib/forms/conditions';
import {
  createTRPCRouter,
  oprecPeriodProcedure,
  oprecScopedProcedure,
} from '~/server/api/trpc';
import {
  application,
  applicationChoice,
  form,
  formField,
  formSection,
  formSubmission,
  recruitment,
  recruitmentDivision,
  recruitmentEligibilityRule,
  recruitmentSectionBinding,
  recruitmentWave,
} from '~/server/db/schema';

import {
  AddDivisionInputSchema,
  CreateRecruitmentInputSchema,
  ListRecruitmentsInputSchema,
  OkOutputSchema,
  RecruitmentIdInputSchema,
  RemoveDivisionInputSchema,
  ReorderDivisionsInputSchema,
  ReplaceEligibilityInputSchema,
  ReplaceWavesInputSchema,
  SaveSetupInputSchema,
  SetRecruitmentStatusInputSchema,
  SetSectionBindingsInputSchema,
  UpdateRecruitmentInputSchema,
} from '../../types/oprec.type';
import { enforceConditions, lockForm } from '../form/services';
import {
  assertDivisionTarget,
  assertSectionsOfForm,
  conflict,
  countApplications,
  loadRecruitmentDetail,
  notFound,
  pgCode,
} from './services';

const OK = { success: true };

/** Kolom yang tak boleh berubah setelah ada pendaftar (agar pilihan lama tetap sah). */
const LOCKED_AFTER_APPLICATIONS = ['minChoices', 'maxChoices'] as const;

export const oprecRouter = createTRPCRouter({
  list: oprecPeriodProcedure
    .input(ListRecruitmentsInputSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(recruitment)
        .where(eq(recruitment.periodId, input.eventId))
        .orderBy(desc(recruitment.created_at));
      if (rows.length === 0) return [];
      const ids = rows.map((r) => r.id);
      const [apps, divs] = await Promise.all([
        ctx.db
          .select({ id: application.recruitmentId, n: count() })
          .from(application)
          .where(inArray(application.recruitmentId, ids))
          .groupBy(application.recruitmentId),
        ctx.db
          .select({ id: recruitmentDivision.recruitmentId, n: count() })
          .from(recruitmentDivision)
          .where(inArray(recruitmentDivision.recruitmentId, ids))
          .groupBy(recruitmentDivision.recruitmentId),
      ]);
      const appCount = new Map(apps.map((a) => [a.id, a.n]));
      const divCount = new Map(divs.map((d) => [d.id, d.n]));
      return rows.map((r) => ({
        ...r,
        applicationCount: appCount.get(r.id) ?? 0,
        divisionCount: divCount.get(r.id) ?? 0,
      }));
    }),

  create: oprecPeriodProcedure
    .input(CreateRecruitmentInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.transaction(async (tx) => {
          const [formRow] = await tx
            .select({ id: form.id, eventId: form.eventId })
            .from(form)
            .where(eq(form.id, input.formId))
            .for('update');
          if (!formRow) notFound('Formulir tidak ditemukan.');
          if (formRow.eventId !== input.eventId) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Formulir harus milik periode yang sama dengan oprec.',
            });
          }
          // Jawaban yang sudah ada tidak punya pilihan divisi, jadi tak bisa
          // diubah menjadi pendaftar. Form harus kosong.
          const [subs] = await tx
            .select({ n: count() })
            .from(formSubmission)
            .where(eq(formSubmission.formId, input.formId));
          if ((subs?.n ?? 0) > 0) {
            conflict(
              'Formulir ini sudah menerima jawaban, sehingga tidak bisa dipakai untuk oprec. Buat formulir baru.',
            );
          }
          // Formulir oprec: satu respons per akun, tanpa edit, tanpa kuota respons.
          await tx
            .update(form)
            .set({
              allowMultipleSubmissions: false,
              allowEditAfterSubmit: false,
              maxResponses: null,
            })
            .where(eq(form.id, input.formId));
          const [row] = await tx
            .insert(recruitment)
            .values({
              periodId: input.eventId,
              formId: input.formId,
              name: input.name,
            })
            .returning({ id: recruitment.id });
          return { id: row!.id };
        });
      } catch (error) {
        if (pgCode(error) === '23505') {
          conflict('Formulir ini sudah dipakai oleh oprec lain.');
        }
        throw error;
      }
    }),

  get: oprecScopedProcedure
    .input(RecruitmentIdInputSchema)
    .query(({ ctx, input }) =>
      loadRecruitmentDetail(ctx.db, input.recruitmentId),
    ),

  update: oprecScopedProcedure
    .input(UpdateRecruitmentInputSchema)
    .output(OkOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const patch = input.settings;
      await ctx.db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(recruitment)
          .where(eq(recruitment.id, input.recruitmentId))
          .for('update');
        if (!current) notFound('Oprec tidak ditemukan.');

        const min = patch.minChoices ?? current.minChoices;
        const max_ = patch.maxChoices ?? current.maxChoices;
        if (min > max_) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Batas pilihan minimum tidak boleh melebihi maksimum.',
          });
        }
        const changesLocked = LOCKED_AFTER_APPLICATIONS.some(
          (key) => patch[key] !== undefined && patch[key] !== current[key],
        );
        if (changesLocked && (await countApplications(tx, current.id)) > 0) {
          conflict(
            'Jumlah pilihan tidak bisa diubah setelah ada yang mendaftar.',
          );
        }
        if (Object.keys(patch).length > 0) {
          await tx
            .update(recruitment)
            .set(patch)
            .where(eq(recruitment.id, current.id));
        }
      });
      return OK;
    }),

  setStatus: oprecScopedProcedure
    .input(SetRecruitmentStatusInputSchema)
    .output(OkOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(recruitment)
          .where(eq(recruitment.id, input.recruitmentId))
          .for('update');
        if (!current) notFound('Oprec tidak ditemukan.');
        if (current.status === input.status) return;

        if (input.status === 'open') {
          if (!current.setupCompletedAt) {
            conflict('Selesaikan pengaturan oprec sebelum membukanya.');
          }
          const [divs] = await tx
            .select({ n: count() })
            .from(recruitmentDivision)
            .where(eq(recruitmentDivision.recruitmentId, current.id));
          const [choice] = await tx
            .select({ n: count() })
            .from(formField)
            .where(
              and(
                eq(formField.formId, current.formId),
                eq(formField.type, 'unit_choice'),
                isNull(formField.archivedAt),
              ),
            );
          if ((choice?.n ?? 0) === 0) {
            conflict(
              'Tambahkan blok Pilihan tujuan ke formulir sebelum membuka oprec.',
            );
          }
          if ((divs?.n ?? 0) === 0) {
            conflict(
              'Pilih minimal satu tujuan penempatan sebelum membuka oprec.',
            );
          }
        }
        if (
          input.status === 'draft' &&
          (await countApplications(tx, current.id)) > 0
        ) {
          conflict(
            'Oprec yang sudah punya pendaftar tidak bisa kembali ke draf.',
          );
        }
        await tx
          .update(recruitment)
          .set({ status: input.status })
          .where(eq(recruitment.id, current.id));
      });
      return OK;
    }),

  saveSetup: oprecScopedProcedure
    .input(SaveSetupInputSchema)
    .output(OkOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(recruitment)
        .set({
          setupAnswers: input.answers,
          ...(input.complete ? { setupCompletedAt: new Date() } : {}),
        })
        .where(eq(recruitment.id, input.recruitmentId));
      return OK;
    }),

  delete: oprecScopedProcedure
    .input(RecruitmentIdInputSchema)
    .output(OkOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        const [current] = await tx
          .select({ id: recruitment.id, status: recruitment.status })
          .from(recruitment)
          .where(eq(recruitment.id, input.recruitmentId))
          .for('update');
        if (!current) return;
        if (
          current.status !== 'draft' ||
          (await countApplications(tx, current.id)) > 0
        ) {
          conflict('Hanya oprec draf tanpa pendaftar yang bisa dihapus.');
        }
        await tx.delete(recruitment).where(eq(recruitment.id, current.id));
      });
      return OK;
    }),

  /** Ubah, tambah, dan hapus gelombang sekaligus; id yang tak dikirim dihapus. */
  replaceWaves: oprecScopedProcedure
    .input(ReplaceWavesInputSchema)
    .output(OkOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        await tx
          .select({ id: recruitment.id })
          .from(recruitment)
          .where(eq(recruitment.id, input.recruitmentId))
          .for('update');
        const existing = await tx
          .select({ id: recruitmentWave.id })
          .from(recruitmentWave)
          .where(eq(recruitmentWave.recruitmentId, input.recruitmentId));
        const existingIds = new Set(existing.map((w) => w.id));
        const keepIds = input.waves.flatMap((w) => (w.id ? [w.id] : []));
        if (keepIds.some((id) => !existingIds.has(id))) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ada gelombang yang bukan milik oprec ini.',
          });
        }
        const removing = existing
          .map((w) => w.id)
          .filter((id) => !keepIds.includes(id));
        if (removing.length > 0) {
          const [used] = await tx
            .select({ n: count() })
            .from(application)
            .where(inArray(application.waveId, removing));
          if ((used?.n ?? 0) > 0) {
            conflict(
              'Gelombang yang sudah ada pendaftarnya tidak bisa dihapus.',
            );
          }
          await tx
            .delete(recruitmentWave)
            .where(inArray(recruitmentWave.id, removing));
        }
        for (const [index, wave] of input.waves.entries()) {
          const values = {
            label: wave.label,
            startsAt: wave.startsAt,
            endsAt: wave.endsAt,
            sortOrder: index,
          };
          if (wave.id) {
            await tx
              .update(recruitmentWave)
              .set(values)
              .where(eq(recruitmentWave.id, wave.id));
          } else {
            await tx
              .insert(recruitmentWave)
              .values({ ...values, recruitmentId: input.recruitmentId });
          }
        }
      });
      return OK;
    }),

  replaceEligibility: oprecScopedProcedure
    .input(ReplaceEligibilityInputSchema)
    .output(OkOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        await tx
          .update(recruitment)
          .set({ eligibilityMatch: input.match })
          .where(eq(recruitment.id, input.recruitmentId));
        await tx
          .delete(recruitmentEligibilityRule)
          .where(
            eq(recruitmentEligibilityRule.recruitmentId, input.recruitmentId),
          );
        if (input.rules.length > 0) {
          await tx.insert(recruitmentEligibilityRule).values(
            input.rules.map((rule) => ({
              recruitmentId: input.recruitmentId,
              attribute: rule.attribute,
              op: rule.op,
              value: rule.value,
            })),
          );
        }
      });
      return OK;
    }),

  addDivision: oprecScopedProcedure
    .input(AddDivisionInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertDivisionTarget(
        ctx.db,
        ctx.recruitment,
        input.unitId,
        input.positionId,
      );
      try {
        return await ctx.db.transaction(async (tx) => {
          const [top] = await tx
            .select({ n: max(recruitmentDivision.sortOrder) })
            .from(recruitmentDivision)
            .where(eq(recruitmentDivision.recruitmentId, input.recruitmentId));
          const [row] = await tx
            .insert(recruitmentDivision)
            .values({
              recruitmentId: input.recruitmentId,
              unitId: input.unitId,
              positionId: input.positionId,
              code: input.code ?? null,
              sortOrder: (top?.n ?? -1) + 1,
            })
            .returning({ id: recruitmentDivision.id });
          return { id: row!.id };
        });
      } catch (error) {
        if (pgCode(error) === '23505') {
          conflict('Tujuan ini sudah dibuka di oprec.');
        }
        throw error;
      }
    }),

  removeDivision: oprecScopedProcedure
    .input(RemoveDivisionInputSchema)
    .output(OkOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const [used] = await ctx.db
        .select({ n: count() })
        .from(applicationChoice)
        .where(eq(applicationChoice.divisionId, input.divisionId));
      if ((used?.n ?? 0) > 0) {
        conflict('Tujuan yang sudah dipilih pendaftar tidak bisa dikeluarkan.');
      }
      await ctx.db
        .delete(recruitmentDivision)
        .where(
          and(
            eq(recruitmentDivision.id, input.divisionId),
            eq(recruitmentDivision.recruitmentId, input.recruitmentId),
          ),
        );
      return OK;
    }),

  reorderDivisions: oprecScopedProcedure
    .input(ReorderDivisionsInputSchema)
    .output(OkOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        const rows = await tx
          .select({ id: recruitmentDivision.id })
          .from(recruitmentDivision)
          .where(eq(recruitmentDivision.recruitmentId, input.recruitmentId));
        const ids = new Set(rows.map((r) => r.id));
        if (
          input.divisionIds.length !== ids.size ||
          input.divisionIds.some((id) => !ids.has(id))
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Urutan harus memuat semua tujuan oprec ini tepat sekali.',
          });
        }
        for (const [index, id] of input.divisionIds.entries()) {
          await tx
            .update(recruitmentDivision)
            .set({ sortOrder: index })
            .where(eq(recruitmentDivision.id, id));
        }
      });
      return OK;
    }),

  /** Tetapkan divisi mana yang menampilkan sebuah bagian formulir (mengganti ikatan lama). */
  setSectionBindings: oprecScopedProcedure
    .input(SetSectionBindingsInputSchema)
    .output(OkOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertSectionsOfForm(ctx.db, ctx.recruitment.formId, [
        input.formSectionId,
      ]);
      const divisionIds = [...new Set(input.divisionIds)];
      if (divisionIds.length > MAX_RULES) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Satu bagian formulir maksimal diikat ke ${MAX_RULES} tujuan.`,
        });
      }
      await ctx.db.transaction(async (tx) => {
        await lockForm(tx, ctx.recruitment.formId);
        if (divisionIds.length > 0) {
          const rows = await tx
            .select({ id: recruitmentDivision.id })
            .from(recruitmentDivision)
            .where(
              and(
                eq(recruitmentDivision.recruitmentId, input.recruitmentId),
                inArray(recruitmentDivision.id, divisionIds),
              ),
            );
          if (rows.length !== divisionIds.length) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Ada tujuan yang bukan milik oprec ini.',
            });
          }
        }
        const sameSection = and(
          eq(recruitmentSectionBinding.recruitmentId, input.recruitmentId),
          eq(recruitmentSectionBinding.formSectionId, input.formSectionId),
        );
        await tx
          .delete(recruitmentSectionBinding)
          .where(
            divisionIds.length > 0
              ? and(
                  sameSection,
                  notInArray(recruitmentSectionBinding.divisionId, divisionIds),
                )
              : sameSection,
          );
        if (divisionIds.length > 0) {
          await tx
            .insert(recruitmentSectionBinding)
            .values(
              divisionIds.map((divisionId) => ({
                recruitmentId: input.recruitmentId,
                formSectionId: input.formSectionId,
                divisionId,
              })),
            )
            .onConflictDoNothing();
        }

        // Ikatan sekaligus menjadi kondisi tampil bagian itu: muncul bila salah
        // satu tujuan terikat dipilih di pilihan mana pun.
        const [choice] = await tx
          .select({ id: formField.id })
          .from(formField)
          .where(
            and(
              eq(formField.formId, ctx.recruitment.formId),
              eq(formField.type, 'unit_choice'),
              isNull(formField.archivedAt),
            ),
          );
        if (divisionIds.length > 0 && !choice) {
          conflict(
            'Tambahkan blok Pilihan tujuan ke formulir terlebih dahulu.',
          );
        }
        await tx
          .update(formSection)
          .set({
            condition:
              divisionIds.length === 0 || !choice
                ? null
                : {
                    cocok: 'salah-satu',
                    aturan: divisionIds.map((divisionId) => ({
                      jenis: 'jawaban',
                      fieldId: choice.id,
                      op: 'memilih',
                      nilai: divisionId,
                    })),
                  },
          })
          .where(eq(formSection.id, input.formSectionId));
        await enforceConditions(tx, ctx.recruitment.formId, {
          edited: [input.formSectionId],
        });
      });
      return OK;
    }),
});
