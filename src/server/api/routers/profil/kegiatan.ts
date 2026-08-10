import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { createTRPCRouter, lembagaProcedure, protectedProcedure } from '~/server/api/trpc';
import {
  CreateProfilKegiatanInputSchema,
  CreateProfilKegiatanOutputSchema,
  DeleteProfilInputSchema,
  DeleteProfilOutputSchema,
  EditProfilInputSchema,
  EditProfilOutputSchema,
  GetAllProfilKegiatanInputSchema,
  GetAllProfilKegiatanOutputSchema,
} from '~/server/api/types/profil.type';
import {
  events,
  pemetaanProfilKegiatan,
  profilKegiatan,
} from '~/server/db/schema';

import {
  validateKegiatanOwnership,
  validateKegiatanProfileOwnership,
} from '../profil/services';

export const profilKegiatanRouter = createTRPCRouter({
  getAllProfilKegiatan: protectedProcedure
    .input(GetAllProfilKegiatanInputSchema)
    .output(GetAllProfilKegiatanOutputSchema)
    .query(async ({ ctx, input }) => {
      const profil = await ctx.db.query.profilKegiatan.findMany({
        where: eq(profilKegiatan.eventId, input.event_id),
        with: {
          pemetaanProfilKegiatan: {
            columns: {
              profilKMId: true,
            },
          },
        },
      });

      return {
        profil_kegiatan: profil.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          profil_km_id: item.pemetaanProfilKegiatan.map(
            (subItem) => subItem.profilKMId,
          ),
        })),
      };
    }),

  createProfilKegiatan: lembagaProcedure
    .input(CreateProfilKegiatanInputSchema)
    .output(CreateProfilKegiatanOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await validateKegiatanOwnership(ctx, input.event_id);

      const eventExists = await ctx.db.query.events.findFirst({
        where: eq(events.id, input.event_id),
      });

      if (!eventExists) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Kegiatan tidak ditemukan.',
        });
      }

      // Validate profil KM IDs exist
      if (input.profil_km_id && input.profil_km_id.length > 0) {
        const existingProfilKM = await ctx.db.query.profilKM.findMany({
          where: (profilKM, { inArray }) =>
            inArray(profilKM.id, input.profil_km_id),
        });

        const existingIds = existingProfilKM.map((p) => p.id);
        const invalidIds = input.profil_km_id.filter(
          (id) => !existingIds.includes(id),
        );

        if (invalidIds.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Invalid profil KM IDs: ${invalidIds.join(', ')}`,
          });
        }
      }

      const result = await ctx.db.transaction(async (tx) => {
        // Create the profil kegiatan
        const newProfil = await tx
          .insert(profilKegiatan)
          .values({
            eventId: input.event_id,
            name: input.name,
            description: input.description,
          })
          .returning();

        const profilId = newProfil[0]!.id;

        // Create the mappings to profil KM
        if (input.profil_km_id && input.profil_km_id.length > 0) {
          const mappings = input.profil_km_id.map((kmId) => ({
            profilKegiatanId: profilId,
            profilKMId: kmId,
          }));

          await tx.insert(pemetaanProfilKegiatan).values(mappings);
        }

        return {
          profil_id: profilId,
          event_id: newProfil[0]!.eventId,
          name: newProfil[0]!.name,
          description: newProfil[0]!.description,
          profil_km_id: input.profil_km_id || [],
        };
      });

      return result;
    }),

  deleteProfilKegiatan: lembagaProcedure
    .input(DeleteProfilInputSchema)
    .output(DeleteProfilOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await validateKegiatanProfileOwnership(ctx, input.profil_id);

      const profilExists = await ctx.db.query.profilKegiatan.findFirst({
        where: eq(profilKegiatan.id, input.profil_id),
      });

      if (!profilExists) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Profil Kegiatan tidak ditemukan.',
        });
      }

      await ctx.db
        .delete(profilKegiatan)
        .where(eq(profilKegiatan.id, input.profil_id));

      return { success: true };
    }),

  editProfilKegiatan: lembagaProcedure
    .input(EditProfilInputSchema)
    .output(EditProfilOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await validateKegiatanProfileOwnership(ctx, input.profil_id);

      // Validate profil KM IDs exist
      if (input.profil_km_id && input.profil_km_id.length > 0) {
        const existingProfilKM = await ctx.db.query.profilKM.findMany({
          where: (profilKM, { inArray }) =>
            inArray(profilKM.id, input.profil_km_id),
        });

        const existingIds = existingProfilKM.map((p) => p.id);
        const invalidIds = input.profil_km_id.filter(
          (id) => !existingIds.includes(id),
        );

        if (invalidIds.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Invalid profil KM IDs: ${invalidIds.join(', ')}`,
          });
        }
      }

      // Validate profil kegiatan exists
      const profilExists = await ctx.db.query.profilKegiatan.findFirst({
        where: eq(profilKegiatan.id, input.profil_id),
      });

      if (!profilExists) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Profil Kegiatan tidak ditemukan.',
        });
      }

      const result = await ctx.db.transaction(async (tx) => {
        await tx
          .update(profilKegiatan)
          .set({
            name: input.name,
            description: input.description,
          })
          .where(eq(profilKegiatan.id, input.profil_id));

        // Update the mappings — always resync to input.profil_km_id,
        // including clearing all mappings when it's sent empty.
        await tx
          .delete(pemetaanProfilKegiatan)
          .where(eq(pemetaanProfilKegiatan.profilKegiatanId, input.profil_id));

        if (input.profil_km_id.length > 0) {
          const mappings = input.profil_km_id.map((kmId) => ({
            profilKegiatanId: input.profil_id,
            profilKMId: kmId,
          }));

          await tx.insert(pemetaanProfilKegiatan).values(mappings);
        }
        return true;
      });

      if (result) {
        return { success: true };
      } else {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal memperbarui profil kegiatan',
        });
      }
    }),
});
