import { TRPCError } from '@trpc/server';
import { LembagaScopeInput, withoutLembagaId } from '~/server/api/types/scope';
import { and, eq } from 'drizzle-orm';
import { type Prodi } from '~/server/auth';
import {
  events,
  lembaga,
  mahasiswa,
  riwayatKepanitiaan,
  users,
} from '~/server/db/schema';

import daftarProdi from '../../../db/kode-program-studi.json';
import { lembagaScopedProcedure } from '../../trpc';
import {
  AddNewPanitiaKegiatanInputSchema,
  AddNewPanitiaKegiatanManualInputSchema,
  AddNewPanitiaKegiatanOutputSchema,
  EditPanitiaKegiatanInputSchema,
  EditPanitiaKegiatanOutputSchema,
  RemovePanitiaKegiatanInputSchema,
  RemovePanitiaKegiatanOutputSchema,
  ToggleHighlightInputSchema,
  ToggleHighlightOutputSchema,
  ToggleRaporVisibilityInputSchema,
  ToggleRaporVisibilityOutputSchema,
  UpdateEventInputSchema,
  UpdateEventOutputSchema,
} from '../../types/event.type';
import {
  isPeriodMember,
  periodMemberOf,
  removeFromPeriod,
  upsertPlacementByText,
} from '../organization/membership';
import { isUniqueViolation } from '../organization/services';

export const updateEvent = lembagaScopedProcedure
  .input(UpdateEventInputSchema.and(LembagaScopeInput))
  .output(UpdateEventOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const eventToUpdate = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.id),
          eq(events.org_id, ctx.lembagaId),
        ),
        columns: {
          id: true,
        },
      });

      if (!eventToUpdate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'Kegiatan tidak ditemukan atau Anda tidak memiliki izin untuk mengubahnya.',
        });
      }

      const updatedEvent = await ctx.db
        .update(events)
        .set({
          org_id: ctx.lembagaId,
          ...withoutLembagaId(input),
          start_date: input.start_date ? new Date(input.start_date) : undefined,
          end_date: input.end_date ? new Date(input.end_date) : undefined,
        })
        .where(eq(events.id, eventToUpdate.id))
        .returning();

      if (!updatedEvent[0]) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal memperbarui kegiatan.',
        });
      }

      return updatedEvent[0];
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Terjadi kesalahan tak terduga saat memperbarui kegiatan.',
      });
    }
  });

export const addNewPanitia = lembagaScopedProcedure
  .input(AddNewPanitiaKegiatanInputSchema.and(LembagaScopeInput))
  .output(AddNewPanitiaKegiatanOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const eventToUpdate = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.event_id),
          eq(events.org_id, ctx.lembagaId),
        ),
        columns: {
          id: true,
          participant_count: true,
        },
      });

      if (!eventToUpdate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'Kegiatan tidak ditemukan atau Anda tidak memiliki izin untuk mengubahnya.',
        });
      }

      if (await isPeriodMember(ctx.db, input.event_id, input.user_id)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Anggota tersebut sudah terdaftar sebagai panitia.',
        });
      }

      await upsertPlacementByText(ctx.db, {
        periodId: input.event_id,
        userId: input.user_id,
        division: input.division,
        position: input.position,
        createdBy: ctx.session.user.id,
      });

      return {
        success: true,
        message: 'Panitia berhasil ditambahkan.',
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      if (isUniqueViolation(error)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Anggota tersebut sudah terdaftar sebagai panitia.',
        });
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Terjadi kesalahan tak terduga saat menambahkan panitia.',
      });
    }
  });

export const removePanitia = lembagaScopedProcedure
  .input(RemovePanitiaKegiatanInputSchema.and(LembagaScopeInput))
  .output(RemovePanitiaKegiatanOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const eventToUpdate = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.event_id),
          eq(events.org_id, ctx.lembagaId),
        ),
        columns: {
          id: true,
          name: true,
          org_id: true,
          participant_count: true,
        },
      });

      if (!eventToUpdate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'Kegiatan tidak ditemukan atau Anda tidak memiliki izin untuk mengubahnya.',
        });
      }

      const lembagaRow = eventToUpdate.org_id
        ? await ctx.db.query.lembaga.findFirst({
            where: eq(lembaga.id, eventToUpdate.org_id),
            columns: { name: true },
          })
        : null;

      const existingKeanggotaan = await periodMemberOf(
        ctx.db,
        input.event_id,
        input.id,
      );

      if (!existingKeanggotaan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Panitia tidak ditemukan.',
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx.insert(riwayatKepanitiaan).values({
          userId: existingKeanggotaan.userId,
          eventId: eventToUpdate.id,
          eventNama: eventToUpdate.name,
          lembagaId: eventToUpdate.org_id,
          lembagaNama: lembagaRow?.name,
          division: existingKeanggotaan.division,
          position: existingKeanggotaan.position,
          startedAt: existingKeanggotaan.createdAt,
          endedAt: new Date(),
          endReason: 'removed',
        });

        await removeFromPeriod(tx, input.event_id, input.id);
      });

      return {
        success: true,
        message: 'Panitia berhasil dihapus.',
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Terjadi kesalahan tak terduga saat menghapus panitia.',
      });
    }
  });

export const editPanitia = lembagaScopedProcedure
  .input(EditPanitiaKegiatanInputSchema.and(LembagaScopeInput))
  .output(EditPanitiaKegiatanOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const eventToUpdate = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.event_id),
          eq(events.org_id, ctx.lembagaId),
        ),
        columns: {
          id: true,
          participant_count: true,
        },
      });

      if (!eventToUpdate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'Kegiatan tidak ditemukan atau Anda tidak memiliki izin untuk mengubahnya.',
        });
      }

      const current = await periodMemberOf(
        ctx.db,
        input.event_id,
        input.user_id,
      );
      if (!current) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengubah data panitia.',
        });
      }

      // Urutan lama dipertahankan; hanya bagian dan jabatannya yang berubah.
      await upsertPlacementByText(ctx.db, {
        periodId: input.event_id,
        userId: input.user_id,
        division: input.division,
        position: input.position,
        createdBy: ctx.session.user.id,
        sortOrder: current.index,
      });

      return {
        success: true,
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Terjadi kesalahan tak terduga saat mengubah panitia.',
      });
    }
  });

export const addNewPanitiaManual = lembagaScopedProcedure
  .input(AddNewPanitiaKegiatanManualInputSchema.and(LembagaScopeInput))
  .output(AddNewPanitiaKegiatanOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const eventToUpdate = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.event_id),
          eq(events.org_id, ctx.lembagaId),
        ),
        columns: {
          id: true,
          participant_count: true,
        },
      });

      if (!eventToUpdate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'Kegiatan tidak ditemukan atau Anda tidak memiliki izin untuk mengubahnya.',
        });
      }

      // Check if user already exists by email (primary identifier)
      const email = `${input.nim}@mahasiswa.itb.ac.id`;
      const existingUser = await ctx.db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (existingUser) {
        // Name doesn't match
        if (existingUser.name !== input.name) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Sudah ada mahasiswa dengan NIM ${input.nim} bernama ${existingUser.name}`,
          });
        }
        // User exists, just place them in the period
        if (await isPeriodMember(ctx.db, input.event_id, existingUser.id)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Anggota tersebut sudah terdaftar sebagai panitia.',
          });
        }
        await upsertPlacementByText(ctx.db, {
          periodId: input.event_id,
          userId: existingUser.id,
          division: input.division,
          position: input.position,
          createdBy: ctx.session.user.id,
        });

        return {
          success: true,
          message: 'Panitia berhasil ditambahkan.',
        };
      }

      const kodeProdi = parseInt(input.nim.substring(0, 3));
      const jurusan =
        daftarProdi.find((item: Prodi) => item.kode === kodeProdi)?.jurusan ??
        'TPB';

      // asumsi cuma ada angkatan 2000-an
      const angkatan = parseInt(input.nim.substring(3, 5)) + 2000;

      await ctx.db.transaction(async (tx) => {
        const user = await tx
          .insert(users)
          .values({
            name: input.name,
            email: email,
            role: 'mahasiswa',
            emailVerified: null, // Not verified yet
          })
          .returning({ id: users.id });

        await tx.insert(mahasiswa).values({
          userId: user[0]!.id,
          nim: Number(input.nim),
          jurusan: jurusan,
          angkatan: angkatan,
        });

        await upsertPlacementByText(tx, {
          periodId: input.event_id,
          userId: user[0]!.id,
          division: input.division,
          position: input.position,
          createdBy: ctx.session.user.id,
        });
      });

      return {
        success: true,
        message: 'Panitia berhasil ditambahkan.',
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      if (isUniqueViolation(error)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Anggota tersebut sudah terdaftar sebagai panitia.',
        });
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Terjadi kesalahan tak terduga saat menambahkan panitia.',
      });
    }
  });

export const toggleHighlight = lembagaScopedProcedure
  .input(ToggleHighlightInputSchema.and(LembagaScopeInput))
  .output(ToggleHighlightOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const eventToUpdate = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.id),
          eq(events.org_id, ctx.lembagaId),
        ),
        columns: {
          id: true,
        },
      });

      if (!eventToUpdate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'Kegiatan tidak ditemukan atau Anda tidak memiliki izin untuk mengubahnya.',
        });
      }

      await ctx.db
        .update(events)
        .set({
          is_highlighted: input.is_highlighted,
        })
        .where(eq(events.id, input.id));

      return {
        success: true,
        is_highlighted: input.is_highlighted,
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Terjadi kesalahan saat mengubah status highlight.',
      });
    }
  });

export const toggleRaporVisibility = lembagaScopedProcedure
  .input(ToggleRaporVisibilityInputSchema.and(LembagaScopeInput))
  .output(ToggleRaporVisibilityOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const eventToUpdate = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.id),
          eq(events.org_id, ctx.lembagaId),
        ),
        columns: {
          id: true,
        },
      });

      if (!eventToUpdate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'Kegiatan tidak ditemukan atau Anda tidak memiliki izin untuk mengubahnya.',
        });
      }

      await ctx.db
        .update(events)
        .set({
          rapor_visible: input.rapor_visible,
        })
        .where(eq(events.id, input.id));

      return {
        success: true,
        rapor_visible: input.rapor_visible,
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Terjadi kesalahan saat mengubah visibilitas rapor.',
      });
    }
  });
