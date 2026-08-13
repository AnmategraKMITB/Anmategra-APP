import { TRPCError } from '@trpc/server';
import { and, eq, max } from 'drizzle-orm';
import { createTRPCRouter, lembagaProcedure } from '~/server/api/trpc';
import {
  CreateOrganizationRoleInputSchema,
  CreateOrganizationRoleOutputSchema,
  DeleteOrganizationRoleInputSchema,
  DeleteOrganizationRoleOutputSchema,
  GetAllOrganizationRoleInputSchema,
  GetAllOrganizationRoleOutputSchema,
  ReorderOrganizationRoleInputSchema,
  ReorderOrganizationRoleOutputSchema,
  UpdateOrganizationRoleInputSchema,
  UpdateOrganizationRoleOutputSchema,
} from '~/server/api/types/organization.type';
import { keanggotaan, kehimpunan, organizationRole } from '~/server/db/schema';

import {
  type StructureOwner,
  assertExactSiblingSet,
  countMembersReferencing,
  isForeignKeyViolation,
  resolveRoleOwnership,
  resolveStructureOwnership,
} from './services';

const ROLE_COLUMNS = {
  id: organizationRole.id,
  structure_id: organizationRole.structure_id,
  name: organizationRole.name,
  ring_level: organizationRole.ring_level,
  sort_order: organizationRole.sort_order,
};

type Db = Parameters<typeof countMembersReferencing>[0];

function loadStructureRoles(db: Db, structureId: string) {
  return db
    .select(ROLE_COLUMNS)
    .from(organizationRole)
    .where(eq(organizationRole.structure_id, structureId))
    .orderBy(
      organizationRole.ring_level,
      organizationRole.sort_order,
      organizationRole.name,
    );
}

async function nextSortOrder(db: Db, structureId: string): Promise<number> {
  const rows = await db
    .select({ value: max(organizationRole.sort_order) })
    .from(organizationRole)
    .where(eq(organizationRole.structure_id, structureId));

  return (rows[0]?.value ?? -1) + 1;
}

/** Keeps the denormalized `position` text on member rows in step with a rename. */
async function propagateRoleName(
  tx: Db,
  structure: StructureOwner,
  roleId: string,
  name: string,
) {
  if (structure.lembagaId) {
    await tx
      .update(kehimpunan)
      .set({ position: name })
      .where(
        and(
          eq(kehimpunan.lembagaId, structure.lembagaId),
          eq(kehimpunan.org_role_id, roleId),
        ),
      );
    return;
  }

  if (structure.eventId) {
    await tx
      .update(keanggotaan)
      .set({ position: name })
      .where(
        and(
          eq(keanggotaan.event_id, structure.eventId),
          eq(keanggotaan.org_role_id, roleId),
        ),
      );
  }
}

export const organizationRoleRouter = createTRPCRouter({
  create: lembagaProcedure
    .input(CreateOrganizationRoleInputSchema)
    .output(CreateOrganizationRoleOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await resolveStructureOwnership(ctx, input.structure_id);

      const roleId = await ctx.db.transaction(async (tx) => {
        const sortOrder = await nextSortOrder(tx, input.structure_id);
        const rows = await tx
          .insert(organizationRole)
          .values({
            structure_id: input.structure_id,
            name: input.name,
            ring_level: input.ring_level,
            sort_order: sortOrder,
          })
          .returning({ id: organizationRole.id });

        return rows[0]!.id;
      });

      return { success: true, role_id: roleId };
    }),

  update: lembagaProcedure
    .input(UpdateOrganizationRoleInputSchema)
    .output(UpdateOrganizationRoleOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { structure } = await resolveRoleOwnership(ctx, input.role_id);

      if (input.name === undefined && input.ring_level === undefined) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Tidak ada perubahan yang dikirim.',
        });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(organizationRole)
          .set({
            ...(input.name !== undefined && { name: input.name }),
            ...(input.ring_level !== undefined && {
              ring_level: input.ring_level,
            }),
          })
          .where(eq(organizationRole.id, input.role_id));

        if (input.name !== undefined) {
          // UPDATE only — the member_count triggers fire on INSERT/DELETE, so
          // counts stay untouched.
          await propagateRoleName(tx, structure, input.role_id, input.name);
        }
      });

      return { success: true };
    }),

  reorder: lembagaProcedure
    .input(ReorderOrganizationRoleInputSchema)
    .output(ReorderOrganizationRoleOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await resolveStructureOwnership(ctx, input.structure_id);
      await assertExactSiblingSet(
        ctx.db,
        'role',
        input.structure_id,
        null,
        input.role_ids,
      );

      await ctx.db.transaction(async (tx) => {
        for (const [i, id] of input.role_ids.entries()) {
          await tx
            .update(organizationRole)
            .set({ sort_order: i })
            .where(eq(organizationRole.id, id));
        }
      });

      return { success: true };
    }),

  delete: lembagaProcedure
    .input(DeleteOrganizationRoleInputSchema)
    .output(DeleteOrganizationRoleOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { structure } = await resolveRoleOwnership(ctx, input.role_id);

      const members = await countMembersReferencing(
        ctx.db,
        structure,
        'org_role_id',
        input.role_id,
      );
      if (members > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Masih ada ${members} anggota yang ditugaskan pada posisi ini.`,
        });
      }

      try {
        await ctx.db
          .delete(organizationRole)
          .where(eq(organizationRole.id, input.role_id));
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (isForeignKeyViolation(error)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Posisi masih direferensikan oleh data lain.',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal menghapus posisi.',
        });
      }

      return { success: true };
    }),

  getAll: lembagaProcedure
    .input(GetAllOrganizationRoleInputSchema)
    .output(GetAllOrganizationRoleOutputSchema)
    .query(async ({ ctx, input }) => {
      await resolveStructureOwnership(ctx, input.structure_id);

      const roles = await loadStructureRoles(ctx.db, input.structure_id);

      return { roles };
    }),
});
