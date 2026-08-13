import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { createTRPCRouter, lembagaProcedure } from '~/server/api/trpc';
import {
  CreateOrganizationStructureInputSchema,
  CreateOrganizationStructureOutputSchema,
  DeleteOrganizationStructureInputSchema,
  DeleteOrganizationStructureOutputSchema,
  GetAllOrganizationStructureInputSchema,
  GetAllOrganizationStructureOutputSchema,
  GetOrganizationStructureTreeInputSchema,
  GetOrganizationStructureTreeOutputSchema,
  UpdateOrganizationStructureInputSchema,
  UpdateOrganizationStructureOutputSchema,
} from '~/server/api/types/organization.type';
import {
  organizationRole,
  organizationStructure,
  organizationUnit,
} from '~/server/db/schema';

import {
  type StructureOwner,
  buildUnitTree,
  countMembersByUnit,
  isUniqueViolation,
  resolveOwnerScope,
  resolveStructureOwnership,
} from './services';

const AKTIF_GANDA =
  'Sudah ada struktur organisasi aktif. Nonaktifkan yang lama terlebih dahulu.';

/** Drizzle row -> output contract (snake_case ids, as the API exposes them). */
function toOutput(row: StructureOwner) {
  return {
    id: row.id,
    lembaga_id: row.lembagaId,
    event_id: row.eventId,
    name: row.name,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const organizationStructureRouter = createTRPCRouter({
  create: lembagaProcedure
    .input(CreateOrganizationStructureInputSchema)
    .output(CreateOrganizationStructureOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const owner = await resolveOwnerScope(ctx, input.event_id);

      try {
        const rows = await ctx.db
          .insert(organizationStructure)
          .values({
            lembagaId: owner.lembagaId,
            eventId: owner.eventId,
            name: input.name,
            is_active: true,
          })
          .returning({ id: organizationStructure.id });

        return { success: true, structure_id: rows[0]!.id };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        // organization_structure_active_{lembaga,event}_unique
        if (isUniqueViolation(error)) {
          throw new TRPCError({ code: 'CONFLICT', message: AKTIF_GANDA });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal membuat struktur organisasi.',
        });
      }
    }),

  getAll: lembagaProcedure
    .input(GetAllOrganizationStructureInputSchema)
    .output(GetAllOrganizationStructureOutputSchema)
    .query(async ({ ctx, input }) => {
      const owner = await resolveOwnerScope(ctx, input.event_id);

      const rows = await ctx.db
        .select()
        .from(organizationStructure)
        .where(
          owner.eventId
            ? eq(organizationStructure.eventId, owner.eventId)
            : and(
                eq(organizationStructure.lembagaId, owner.lembagaId!),
                isNull(organizationStructure.eventId),
              ),
        )
        .orderBy(
          desc(organizationStructure.is_active),
          desc(organizationStructure.created_at),
          organizationStructure.name,
        );

      return { structures: rows.map(toOutput) };
    }),

  getTree: lembagaProcedure
    .input(GetOrganizationStructureTreeInputSchema)
    .output(GetOrganizationStructureTreeOutputSchema)
    .query(async ({ ctx, input }) => {
      const structure = await resolveStructureOwnership(
        ctx,
        input.structure_id,
      );

      // Flat query + assemble in JS: depth is capped at 3, and this leaves an
      // obvious place to attach member counts that a nested query would not.
      const units = await ctx.db
        .select({
          id: organizationUnit.id,
          structure_id: organizationUnit.structure_id,
          parent_id: organizationUnit.parent_id,
          name: organizationUnit.name,
          kind: organizationUnit.kind,
          level: organizationUnit.level,
          sort_order: organizationUnit.sort_order,
        })
        .from(organizationUnit)
        .where(eq(organizationUnit.structure_id, structure.id))
        .orderBy(
          organizationUnit.level,
          organizationUnit.sort_order,
          organizationUnit.name,
        );

      const roles = await ctx.db
        .select({
          id: organizationRole.id,
          structure_id: organizationRole.structure_id,
          name: organizationRole.name,
          ring_level: organizationRole.ring_level,
          sort_order: organizationRole.sort_order,
        })
        .from(organizationRole)
        .where(eq(organizationRole.structure_id, structure.id))
        .orderBy(
          organizationRole.ring_level,
          organizationRole.sort_order,
          organizationRole.name,
        );

      const memberCounts = await countMembersByUnit(ctx.db, structure);

      return {
        structure: toOutput(structure),
        units: buildUnitTree(units, memberCounts),
        roles,
      };
    }),

  update: lembagaProcedure
    .input(UpdateOrganizationStructureInputSchema)
    .output(UpdateOrganizationStructureOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await resolveStructureOwnership(ctx, input.structure_id);

      if (input.name === undefined && input.is_active === undefined) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Tidak ada perubahan yang dikirim.',
        });
      }

      try {
        await ctx.db
          .update(organizationStructure)
          .set({
            ...(input.name !== undefined && { name: input.name }),
            ...(input.is_active !== undefined && {
              is_active: input.is_active,
            }),
          })
          .where(eq(organizationStructure.id, input.structure_id));

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        // Reactivating collides with the partial unique index just like create.
        if (isUniqueViolation(error)) {
          throw new TRPCError({ code: 'CONFLICT', message: AKTIF_GANDA });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal memperbarui struktur organisasi.',
        });
      }
    }),

  delete: lembagaProcedure
    .input(DeleteOrganizationStructureInputSchema)
    .output(DeleteOrganizationStructureOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await resolveStructureOwnership(ctx, input.structure_id);

      // Units and roles cascade. Member rows survive: their org_unit_id /
      // org_role_id are set to NULL, and the legacy division/position text
      // stays intact so every existing read path keeps working.
      await ctx.db
        .delete(organizationStructure)
        .where(eq(organizationStructure.id, input.structure_id));

      return { success: true };
    }),
});
