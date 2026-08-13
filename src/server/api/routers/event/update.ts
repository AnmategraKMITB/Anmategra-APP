import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { type Prodi } from '~/server/auth';
import { events, keanggotaan, mahasiswa, users } from '~/server/db/schema';

import daftarProdi from '../../../db/kode-program-studi.json';
import { lembagaProcedure } from '../../trpc';
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
import { resolveOrgAssignment } from '../organization/services';

export const updateEvent = lembagaProcedure
  .input(UpdateEventInputSchema)
  .output(UpdateEventOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const eventToUpdate = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.id),
          eq(events.org_id, ctx.session.user.lembagaId!),
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
          org_id: ctx.session.user.lembagaId,
          ...input,
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

export const addNewPanitia = lembagaProcedure
  .input(AddNewPanitiaKegiatanInputSchema)
  .output(AddNewPanitiaKegiatanOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const eventToUpdate = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.event_id),
          eq(events.org_id, ctx.session.user.lembagaId!),
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

      const assignment = await resolveOrgAssignment(ctx.db, {
        ownerType: 'event',
        ownerId: input.event_id,
        org_unit_id: input.org_unit_id,
        org_role_id: input.org_role_id,
      });

      await ctx.db.insert(keanggotaan).values({
        id: input.event_id + '_' + input.user_id,
        event_id: input.event_id,
        user_id: input.user_id,
        org_unit_id: assignment.org_unit_id,
        org_role_id: assignment.org_role_id,
        position: assignment.position ?? input.position,
        division: assignment.division ?? input.division,
      });

      return {
        success: true,
        message: 'Panitia berhasil ditambahkan.',
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23505'
      ) {
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

export const removePanitia = lembagaProcedure
  .input(RemovePanitiaKegiatanInputSchema)
  .output(RemovePanitiaKegiatanOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const eventToUpdate = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.event_id),
          eq(events.org_id, ctx.session.user.lembagaId!),
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

      await ctx.db
        .delete(keanggotaan)
        .where(
          and(
            eq(keanggotaan.user_id, input.id),
            eq(keanggotaan.event_id, input.event_id),
          ),
        );

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

export const editPanitia = lembagaProcedure
  .input(EditPanitiaKegiatanInputSchema)
  .output(EditPanitiaKegiatanOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const eventToUpdate = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.event_id),
          eq(events.org_id, ctx.session.user.lembagaId!),
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

      const hasOrgAssignmentInput =
        input.org_unit_id !== undefined || input.org_role_id !== undefined;
      const assignment = await resolveOrgAssignment(ctx.db, {
        ownerType: 'event',
        ownerId: input.event_id,
        org_unit_id: input.org_unit_id,
        org_role_id: input.org_role_id,
      });

      const result = await ctx.db
        .update(keanggotaan)
        .set({
          ...(hasOrgAssignmentInput && {
            org_unit_id: assignment.org_unit_id,
            org_role_id: assignment.org_role_id,
          }),
          position: assignment.position ?? input.position,
          division: assignment.division ?? input.division,
        })
        .where(
          and(
            eq(keanggotaan.user_id, input.user_id),
            eq(keanggotaan.event_id, input.event_id),
          ),
        )
        .returning();

      if (!result[0]) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengubah data panitia.',
        });
      }

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

export const addNewPanitiaManual = lembagaProcedure
  .input(AddNewPanitiaKegiatanManualInputSchema)
  .output(AddNewPanitiaKegiatanOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const eventToUpdate = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.event_id),
          eq(events.org_id, ctx.session.user.lembagaId!),
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

      const assignment = await resolveOrgAssignment(ctx.db, {
        ownerType: 'event',
        ownerId: input.event_id,
        org_unit_id: input.org_unit_id,
        org_role_id: input.org_role_id,
      });

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
        // User exists, just add them to keanggotaan
        await ctx.db.insert(keanggotaan).values({
          id: input.event_id + '_' + existingUser.id,
          event_id: input.event_id,
          user_id: existingUser.id,
          org_unit_id: assignment.org_unit_id,
          org_role_id: assignment.org_role_id,
          position: assignment.position ?? input.position,
          division: assignment.division ?? input.division,
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

        await tx.insert(keanggotaan).values({
          id: input.event_id + '_' + user[0]!.id,
          event_id: input.event_id,
          user_id: user[0]!.id,
          org_unit_id: assignment.org_unit_id,
          org_role_id: assignment.org_role_id,
          position: assignment.position ?? input.position,
          division: assignment.division ?? input.division,
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
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23505'
      ) {
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

export const toggleHighlight = lembagaProcedure
  .input(ToggleHighlightInputSchema)
  .output(ToggleHighlightOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const eventToUpdate = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.id),
          eq(events.org_id, ctx.session.user.lembagaId!),
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

export const toggleRaporVisibility = lembagaProcedure
  .input(ToggleRaporVisibilityInputSchema)
  .output(ToggleRaporVisibilityOutputSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const eventToUpdate = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.id),
          eq(events.org_id, ctx.session.user.lembagaId!),
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
