import { TRPCError } from '@trpc/server';
import { and, eq, isNull, max } from 'drizzle-orm';
import { createTRPCRouter, lembagaProcedure } from '~/server/api/trpc';
import {
  CreateOrganizationUnitInputSchema,
  CreateOrganizationUnitOutputSchema,
  DeleteOrganizationUnitInputSchema,
  DeleteOrganizationUnitOutputSchema,
  GetAllOrganizationUnitInputSchema,
  GetAllOrganizationUnitOutputSchema,
  MoveOrganizationUnitInputSchema,
  MoveOrganizationUnitOutputSchema,
  ReorderOrganizationUnitInputSchema,
  ReorderOrganizationUnitOutputSchema,
  UpdateOrganizationUnitInputSchema,
  UpdateOrganizationUnitOutputSchema,
} from '~/server/api/types/organization.type';
import { keanggotaan, kehimpunan, organizationUnit } from '~/server/db/schema';

import {
  type FlatUnit,
  ORGANIZATION_UNIT_MAX_LEVEL,
  type StructureOwner,
  buildPathLabels,
  countMembersReferencing,
  isForeignKeyViolation,
  resolveParentPlacement,
  resolveStructureOwnership,
  resolveUnitOwnership,
} from './services';

const UNIT_COLUMNS = {
  id: organizationUnit.id,
  structure_id: organizationUnit.structure_id,
  parent_id: organizationUnit.parent_id,
  name: organizationUnit.name,
  kind: organizationUnit.kind,
  level: organizationUnit.level,
  sort_order: organizationUnit.sort_order,
};

type Db = Parameters<typeof countMembersReferencing>[0];

function loadStructureUnits(db: Db, structureId: string) {
  return db
    .select(UNIT_COLUMNS)
    .from(organizationUnit)
    .where(eq(organizationUnit.structure_id, structureId))
    .orderBy(
      organizationUnit.level,
      organizationUnit.sort_order,
      organizationUnit.name,
    );
}

/** Every unit below `rootId`, walked breadth-first over the flat list. */
function collectDescendants(units: FlatUnit[], rootId: string): FlatUnit[] {
  const childrenOf = new Map<string, FlatUnit[]>();
  for (const u of units) {
    if (!u.parent_id) continue;
    const list = childrenOf.get(u.parent_id);
    if (list) list.push(u);
    else childrenOf.set(u.parent_id, [u]);
  }

  const out: FlatUnit[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const child of childrenOf.get(id) ?? []) {
      out.push(child);
      stack.push(child.id);
    }
  }
  return out;
}

/** Next sort_order among the target siblings, so new units land at the end. */
async function nextSortOrder(
  db: Db,
  structureId: string,
  parentId: string | null,
): Promise<number> {
  const rows = await db
    .select({ value: max(organizationUnit.sort_order) })
    .from(organizationUnit)
    .where(
      and(
        eq(organizationUnit.structure_id, structureId),
        parentId === null
          ? isNull(organizationUnit.parent_id)
          : eq(organizationUnit.parent_id, parentId),
      ),
    );
  return (rows[0]?.value ?? -1) + 1;
}

/** Keeps the denormalized `division` text on member rows in step with a rename. */
async function propagateUnitName(
  tx: Db,
  structure: StructureOwner,
  unitId: string,
  name: string,
) {
  if (structure.lembagaId) {
    await tx
      .update(kehimpunan)
      .set({ division: name })
      .where(
        and(
          eq(kehimpunan.lembagaId, structure.lembagaId),
          eq(kehimpunan.org_unit_id, unitId),
        ),
      );
    return;
  }
  if (structure.eventId) {
    await tx
      .update(keanggotaan)
      .set({ division: name })
      .where(
        and(
          eq(keanggotaan.event_id, structure.eventId),
          eq(keanggotaan.org_unit_id, unitId),
        ),
      );
  }
}

export const organizationUnitRouter = createTRPCRouter({
  create: lembagaProcedure
    .input(CreateOrganizationUnitInputSchema)
    .output(CreateOrganizationUnitOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await resolveStructureOwnership(ctx, input.structure_id);

      let parent: FlatUnit | null = null;
      if (input.parent_id) {
        const rows = await ctx.db
          .select(UNIT_COLUMNS)
          .from(organizationUnit)
          .where(
            and(
              eq(organizationUnit.id, input.parent_id),
              eq(organizationUnit.structure_id, input.structure_id),
            ),
          )
          .limit(1);
        parent = rows[0] ?? null;
        if (!parent) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Induk tidak ditemukan di struktur organisasi ini.',
          });
        }
      }

      // `level` is derived, never accepted from input — that kills an entire
      // class of kind/level inconsistency at the source.
      const level = resolveParentPlacement(
        input.kind,
        parent,
        input.structure_id,
      );

      const unitId = await ctx.db.transaction(async (tx) => {
        const sortOrder = await nextSortOrder(
          tx,
          input.structure_id,
          input.parent_id ?? null,
        );
        const rows = await tx
          .insert(organizationUnit)
          .values({
            structure_id: input.structure_id,
            parent_id: input.parent_id ?? null,
            name: input.name,
            kind: input.kind,
            level,
            sort_order: sortOrder,
          })
          .returning({ id: organizationUnit.id });
        return rows[0]!.id;
      });

      return { success: true, unit_id: unitId };
    }),

  update: lembagaProcedure
    .input(UpdateOrganizationUnitInputSchema)
    .output(UpdateOrganizationUnitOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { structure } = await resolveUnitOwnership(ctx, input.unit_id);

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(organizationUnit)
          .set({ name: input.name })
          .where(eq(organizationUnit.id, input.unit_id));

        // UPDATE only — the member_count triggers fire on INSERT/DELETE, so
        // counts stay untouched.
        await propagateUnitName(tx, structure, input.unit_id, input.name);
      });

      return { success: true };
    }),

  move: lembagaProcedure
    .input(MoveOrganizationUnitInputSchema)
    .output(MoveOrganizationUnitOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { unit, structure } = await resolveUnitOwnership(
        ctx,
        input.unit_id,
      );

      if (input.parent_id === input.unit_id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Unit tidak dapat menjadi induk dirinya sendiri.',
        });
      }

      const units = await loadStructureUnits(ctx.db, structure.id);
      const descendants = collectDescendants(units, unit.id);

      let parent: FlatUnit | null = null;
      if (input.parent_id) {
        parent = units.find((u) => u.id === input.parent_id) ?? null;
        if (!parent) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Induk tidak ditemukan di struktur organisasi ini.',
          });
        }
        // The kind ordering already makes cycles structurally impossible, but
        // check explicitly so a future rule change cannot open the hole.
        if (descendants.some((d) => d.id === parent!.id)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'Unit tidak dapat dipindahkan ke dalam turunannya sendiri.',
          });
        }
      }

      const newLevel = resolveParentPlacement(unit.kind, parent, structure.id);
      const delta = newLevel - unit.level;

      // Moving a unit drags its whole subtree along; the deepest descendant is
      // what decides whether the move still fits inside the 3-level cap.
      const deepest = descendants.reduce(
        (m, d) => Math.max(m, d.level),
        unit.level,
      );
      if (deepest + delta > ORGANIZATION_UNIT_MAX_LEVEL) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Pemindahan membuat struktur melebihi ${ORGANIZATION_UNIT_MAX_LEVEL} tingkat.`,
        });
      }

      if (delta === 0 && unit.parent_id === (input.parent_id ?? null)) {
        return { success: true };
      }

      await ctx.db.transaction(async (tx) => {
        const sortOrder = await nextSortOrder(
          tx,
          structure.id,
          input.parent_id ?? null,
        );
        await tx
          .update(organizationUnit)
          .set({
            parent_id: input.parent_id ?? null,
            level: newLevel,
            sort_order: sortOrder,
          })
          .where(eq(organizationUnit.id, unit.id));

        // Descendants keep their shape but shift with the subtree, otherwise
        // `level` silently desyncs from real depth — the DB CHECK only guards
        // the root case and would not catch it.
        if (delta !== 0) {
          for (const d of descendants) {
            await tx
              .update(organizationUnit)
              .set({ level: d.level + delta })
              .where(eq(organizationUnit.id, d.id));
          }
        }
      });

      return { success: true };
    }),

  reorder: lembagaProcedure
    .input(ReorderOrganizationUnitInputSchema)
    .output(ReorderOrganizationUnitOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await resolveStructureOwnership(ctx, input.structure_id);

      const units = await loadStructureUnits(ctx.db, input.structure_id);
      const siblings = units.filter(
        (u) => (u.parent_id ?? null) === input.parent_id,
      );

      const storedIds = new Set(siblings.map((s) => s.id));
      const submitted = new Set(input.unit_ids);
      if (
        submitted.size !== input.unit_ids.length ||
        storedIds.size !== submitted.size ||
        input.unit_ids.some((id) => !storedIds.has(id))
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Daftar urutan harus memuat tepat semua unit pada tingkat yang sama, tanpa duplikat.',
        });
      }

      await ctx.db.transaction(async (tx) => {
        for (const [i, id] of input.unit_ids.entries()) {
          await tx
            .update(organizationUnit)
            .set({ sort_order: i })
            .where(eq(organizationUnit.id, id));
        }
      });

      return { success: true };
    }),

  delete: lembagaProcedure
    .input(DeleteOrganizationUnitInputSchema)
    .output(DeleteOrganizationUnitOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { structure } = await resolveUnitOwnership(ctx, input.unit_id);

      const children = await ctx.db
        .select({ id: organizationUnit.id })
        .from(organizationUnit)
        .where(eq(organizationUnit.parent_id, input.unit_id))
        .limit(1);
      if (children.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'Unit masih memiliki sub-unit. Hapus atau pindahkan sub-unit terlebih dahulu.',
        });
      }

      const members = await countMembersReferencing(
        ctx.db,
        structure,
        'org_unit_id',
        input.unit_id,
      );
      if (members > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Masih ada ${members} anggota yang ditugaskan pada unit ini.`,
        });
      }

      try {
        await ctx.db
          .delete(organizationUnit)
          .where(eq(organizationUnit.id, input.unit_id));
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        // Backstop for a child inserted between the pre-check and the delete.
        if (isForeignKeyViolation(error)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Unit masih direferensikan oleh data lain.',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal menghapus unit.',
        });
      }

      return { success: true };
    }),

  getAll: lembagaProcedure
    .input(GetAllOrganizationUnitInputSchema)
    .output(GetAllOrganizationUnitOutputSchema)
    .query(async ({ ctx, input }) => {
      await resolveStructureOwnership(ctx, input.structure_id);

      const units = await loadStructureUnits(ctx.db, input.structure_id);
      const labels = buildPathLabels(units);

      return {
        units: units.map((u) => ({
          ...u,
          path_label: labels.get(u.id) ?? u.name,
        })),
      };
    }),
});
