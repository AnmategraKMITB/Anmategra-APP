import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { createTRPCRouter, lembagaProcedure, protectedProcedure } from '~/server/api/trpc';
import {
  CreateProfilLembagaInputSchema,
  CreateProfilLembagaOutputSchema,
  DeleteProfilInputSchema,
  DeleteProfilOutputSchema,
  EditProfilInputSchema,
  EditProfilOutputSchema,
  GetAllProfilLembagaInputSchema,
  GetAllProfilLembagaOutputSchema,
} from '~/server/api/types/profil.type';
import {
  lembaga,
  pemetaanProfilLembaga,
  profilLembaga,
} from '~/server/db/schema';

import {
  validateLembagaOwnership,
  validateLembagaProfileOwnership,
} from './services';

export const profileLembagaRouter = createTRPCRouter({
  getAllProfilLembaga: protectedProcedure
    .input(GetAllProfilLembagaInputSchema)
    .output(GetAllProfilLembagaOutputSchema)
    .query(async ({ ctx, input }) => {
      const profil = await ctx.db.query.profilLembaga.findMany({
        where: eq(profilLembaga.lembagaId, input.lembaga_id),
        with: {
          pemetaanProfilLembaga: {
            columns: {
              profilKMId: true,
            },
          },
        },
      });

      return {
        profil_lembaga: profil.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          profil_km_id: item.pemetaanProfilLembaga.map(
            (subItem) => subItem.profilKMId,
          ),
        })),
      };
    }),

  createProfilLembaga: lembagaProcedure
    .input(CreateProfilLembagaInputSchema)
    .output(CreateProfilLembagaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await validateLembagaOwnership(ctx, input.lembaga_id);

      const lembagaExists = await ctx.db.query.lembaga.findFirst({
        where: eq(lembaga.id, input.lembaga_id),
      });

      if (!lembagaExists) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Lembaga tidak ditemukan.',
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
        const newProfil = await tx
          .insert(profilLembaga)
          .values({
            lembagaId: input.lembaga_id,
            name: input.name,
            description: input.description,
          })
          .returning();

        const profilId = newProfil[0]!.id;

        // Create the mappings to profil KM
        if (input.profil_km_id && input.profil_km_id.length > 0) {
          const mappings = input.profil_km_id.map((kmId) => ({
            profilLembagaId: profilId,
            profilKMId: kmId,
          }));

          await tx.insert(pemetaanProfilLembaga).values(mappings);
        }

        return {
          profil_id: profilId,
          lembaga_id: newProfil[0]!.lembagaId,
          name: newProfil[0]!.name,
          description: newProfil[0]!.description,
          profil_km_id: input.profil_km_id || [],
        };
      });

      return result;
    }),

  deleteProfilLembaga: lembagaProcedure
    .input(DeleteProfilInputSchema)
    .output(DeleteProfilOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await validateLembagaProfileOwnership(ctx, input.profil_id);

      const profilExists = await ctx.db.query.profilLembaga.findFirst({
        where: eq(profilLembaga.id, input.profil_id),
      });

      if (!profilExists) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Profil Lembaga tidak ditemukan.',
        });
      }

      await ctx.db
        .delete(profilLembaga)
        .where(eq(profilLembaga.id, input.profil_id));

      return { success: true };
    }),

  editProfilLembaga: lembagaProcedure
    .input(EditProfilInputSchema)
    .output(EditProfilOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await validateLembagaProfileOwnership(ctx, input.profil_id);

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

      // Validate profil lembaga exists
      const profilExists = await ctx.db.query.profilLembaga.findFirst({
        where: eq(profilLembaga.id, input.profil_id),
      });

      if (!profilExists) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Profil Lembaga tidak ditemukan.',
        });
      }

      const result = await ctx.db.transaction(async (tx) => {
        await tx
          .update(profilLembaga)
          .set({
            name: input.name,
            description: input.description,
          })
          .where(eq(profilLembaga.id, input.profil_id));

        // Update the mappings
        if (input.profil_km_id && input.profil_km_id.length > 0) {
          await tx
            .delete(pemetaanProfilLembaga)
            .where(eq(pemetaanProfilLembaga.profilLembagaId, input.profil_id));

          const mappings = input.profil_km_id.map((kmId) => ({
            profilLembagaId: input.profil_id,
            profilKMId: kmId,
          }));

          await tx.insert(pemetaanProfilLembaga).values(mappings);
        }
        return true;
      });

      if (result) {
        return { success: true };
      } else {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal memperbarui profil lembaga',
        });
      }
    }),
});
