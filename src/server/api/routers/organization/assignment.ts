import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { createTRPCRouter, lembagaProcedure } from '~/server/api/trpc';
import {
  AssignAnggotaLembagaOrganizationInputSchema,
  AssignAnggotaLembagaOrganizationOutputSchema,
  AssignPanitiaKegiatanOrganizationInputSchema,
  AssignPanitiaKegiatanOrganizationOutputSchema,
  UnassignAnggotaLembagaOrganizationInputSchema,
  UnassignAnggotaLembagaOrganizationOutputSchema,
  UnassignPanitiaKegiatanOrganizationInputSchema,
  UnassignPanitiaKegiatanOrganizationOutputSchema,
} from '~/server/api/types/organization.type';
import { keanggotaan, kehimpunan } from '~/server/db/schema';

import { validateKegiatanOwnership } from '../profil/services';
import { resolveOrgAssignment } from './services';

function getSessionLembagaId(lembagaId: string | undefined) {
  if (!lembagaId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Akun ini tidak terhubung ke lembaga mana pun.',
    });
  }
  return lembagaId;
}

function assertUpdated(rows: unknown[], message: string) {
  if (rows.length === 0) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message,
    });
  }
}

export const organizationAssignmentRouter = createTRPCRouter({
  assignAnggotaLembaga: lembagaProcedure
    .input(AssignAnggotaLembagaOrganizationInputSchema)
    .output(AssignAnggotaLembagaOrganizationOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const lembagaId = getSessionLembagaId(ctx.session.user.lembagaId);

      try {
        const assignment = await resolveOrgAssignment(ctx.db, {
          ownerType: 'lembaga',
          ownerId: lembagaId,
          org_unit_id: input.org_unit_id,
          org_role_id: input.org_role_id,
        });

        const updated = await ctx.db
          .update(kehimpunan)
          .set({
            org_unit_id: assignment.org_unit_id,
            org_role_id: assignment.org_role_id,
            ...(assignment.division !== undefined && {
              division: assignment.division,
            }),
            ...(assignment.position !== undefined && {
              position: assignment.position,
            }),
          })
          .where(
            and(
              eq(kehimpunan.lembagaId, lembagaId),
              eq(kehimpunan.userId, input.user_id),
            ),
          )
          .returning({ id: kehimpunan.id });

        assertUpdated(updated, 'Anggota lembaga tidak ditemukan.');

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal menugaskan anggota ke struktur organisasi.',
        });
      }
    }),

  unassignAnggotaLembaga: lembagaProcedure
    .input(UnassignAnggotaLembagaOrganizationInputSchema)
    .output(UnassignAnggotaLembagaOrganizationOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const lembagaId = getSessionLembagaId(ctx.session.user.lembagaId);

      try {
        const updated = await ctx.db
          .update(kehimpunan)
          .set({
            org_unit_id: null,
            org_role_id: null,
          })
          .where(
            and(
              eq(kehimpunan.lembagaId, lembagaId),
              eq(kehimpunan.userId, input.user_id),
            ),
          )
          .returning({ id: kehimpunan.id });

        assertUpdated(updated, 'Anggota lembaga tidak ditemukan.');

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal menghapus penugasan anggota lembaga.',
        });
      }
    }),

  assignPanitiaKegiatan: lembagaProcedure
    .input(AssignPanitiaKegiatanOrganizationInputSchema)
    .output(AssignPanitiaKegiatanOrganizationOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await validateKegiatanOwnership(ctx, input.event_id);

        const assignment = await resolveOrgAssignment(ctx.db, {
          ownerType: 'event',
          ownerId: input.event_id,
          org_unit_id: input.org_unit_id,
          org_role_id: input.org_role_id,
        });

        const updated = await ctx.db
          .update(keanggotaan)
          .set({
            org_unit_id: assignment.org_unit_id,
            org_role_id: assignment.org_role_id,
            ...(assignment.division !== undefined && {
              division: assignment.division,
            }),
            ...(assignment.position !== undefined && {
              position: assignment.position,
            }),
          })
          .where(
            and(
              eq(keanggotaan.event_id, input.event_id),
              eq(keanggotaan.user_id, input.user_id),
            ),
          )
          .returning({ id: keanggotaan.id });

        assertUpdated(updated, 'Panitia kegiatan tidak ditemukan.');

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal menugaskan panitia ke struktur organisasi.',
        });
      }
    }),

  unassignPanitiaKegiatan: lembagaProcedure
    .input(UnassignPanitiaKegiatanOrganizationInputSchema)
    .output(UnassignPanitiaKegiatanOrganizationOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await validateKegiatanOwnership(ctx, input.event_id);

        const updated = await ctx.db
          .update(keanggotaan)
          .set({
            org_unit_id: null,
            org_role_id: null,
          })
          .where(
            and(
              eq(keanggotaan.event_id, input.event_id),
              eq(keanggotaan.user_id, input.user_id),
            ),
          )
          .returning({ id: keanggotaan.id });

        assertUpdated(updated, 'Panitia kegiatan tidak ditemukan.');

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal menghapus penugasan panitia kegiatan.',
        });
      }
    }),
});
