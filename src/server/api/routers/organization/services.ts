import { TRPCError } from '@trpc/server';
import type { inferAsyncReturnType } from '@trpc/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { type createTRPCContext } from '~/server/api/trpc';
import {
  type OrganizationUnitKind,
  keanggotaan,
  kehimpunan,
  organizationRole,
  organizationStructure,
  organizationUnit,
} from '~/server/db/schema';

import {
  validateKegiatanOwnership,
  validateLembagaOwnership,
} from '../profil/services';

type TRPCContext = inferAsyncReturnType<typeof createTRPCContext>;
type Db = TRPCContext['db'];

export const ORGANIZATION_UNIT_MAX_LEVEL = 3;

/**
 * Hierarchy ordering. A child's kind must rank strictly BELOW its parent's.
 * A root may carry any kind — production data has flat structures where
 * `Divisi` sits at the root with no `Bidang` above it.
 */
export const ORG_UNIT_KIND_RANK: Record<OrganizationUnitKind, number> = {
  Bidang: 1,
  Divisi: 2,
  Subdivisi: 3,
};

export type StructureOwner = typeof organizationStructure.$inferSelect;

/** Postgres unique_violation — a duplicate that callers should see as CONFLICT. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

/** Postgres foreign_key_violation — e.g. deleting a unit that still has children. */
export function isForeignKeyViolation(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === '23503'
  );
}

/**
 * Resolves which owner a request is scoped to. `event_id` present means the
 * structure hangs off that kegiatan (ownership checked); absent means it
 * belongs to the caller's own lembaga — taken from the session, never input.
 */
export async function resolveOwnerScope(
  ctx: TRPCContext,
  eventId?: string,
): Promise<{ lembagaId: string | null; eventId: string | null }> {
  if (eventId) {
    await validateKegiatanOwnership(ctx, eventId);
    return { lembagaId: null, eventId };
  }
  const lembagaId = ctx.session?.user?.lembagaId;
  if (!lembagaId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Akun ini tidak terhubung ke lembaga mana pun.',
    });
  }
  return { lembagaId, eventId: null };
}

/**
 * `lembagaProcedure` only proves "you are some lembaga". Every structure-scoped
 * operation must additionally prove it owns the structure — either directly, or
 * through the event the structure hangs off.
 */
async function assertStructureOwnership(
  ctx: TRPCContext,
  structure: StructureOwner,
) {
  if (structure.lembagaId) {
    await validateLembagaOwnership(ctx, structure.lembagaId);
    return;
  }
  if (structure.eventId) {
    await validateKegiatanOwnership(ctx, structure.eventId);
    return;
  }
  // organization_structure_owner_xor makes this unreachable through SQL.
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Struktur organisasi tidak memiliki pemilik yang valid.',
  });
}

export async function resolveStructureOwnership(
  ctx: TRPCContext,
  structureId: string,
): Promise<StructureOwner> {
  const rows = await ctx.db
    .select()
    .from(organizationStructure)
    .where(eq(organizationStructure.id, structureId))
    .limit(1);

  const structure = rows[0];
  if (!structure) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Struktur organisasi tidak ditemukan.',
    });
  }

  await assertStructureOwnership(ctx, structure);
  return structure;
}

export type OwnedUnit = typeof organizationUnit.$inferSelect;
export type OwnedRole = typeof organizationRole.$inferSelect;

export async function resolveUnitOwnership(
  ctx: TRPCContext,
  unitIdValue: string,
): Promise<{ unit: OwnedUnit; structure: StructureOwner }> {
  const rows = await ctx.db
    .select({
      unit: organizationUnit,
      structure: organizationStructure,
    })
    .from(organizationUnit)
    .innerJoin(
      organizationStructure,
      eq(organizationUnit.structure_id, organizationStructure.id),
    )
    .where(eq(organizationUnit.id, unitIdValue))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Unit tidak ditemukan.',
    });
  }

  await assertStructureOwnership(ctx, row.structure);
  return row;
}

export async function resolveRoleOwnership(
  ctx: TRPCContext,
  roleIdValue: string,
): Promise<{ role: OwnedRole; structure: StructureOwner }> {
  const rows = await ctx.db
    .select({
      role: organizationRole,
      structure: organizationStructure,
    })
    .from(organizationRole)
    .innerJoin(
      organizationStructure,
      eq(organizationRole.structure_id, organizationStructure.id),
    )
    .where(eq(organizationRole.id, roleIdValue))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Posisi tidak ditemukan.',
    });
  }

  await assertStructureOwnership(ctx, row.structure);
  return row;
}

/**
 * Validates a prospective parent for a unit of `childKind`, and returns the
 * level the child must sit at. A null parent means the child becomes a root.
 */
export function resolveParentPlacement(
  childKind: OrganizationUnitKind,
  parent: Pick<OwnedUnit, 'id' | 'kind' | 'level' | 'structure_id'> | null,
  structureId: string,
): number {
  if (!parent) return 1;

  if (parent.structure_id !== structureId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Induk harus berada di struktur organisasi yang sama.',
    });
  }

  if (ORG_UNIT_KIND_RANK[childKind] <= ORG_UNIT_KIND_RANK[parent.kind]) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `${childKind} tidak boleh berada di bawah ${parent.kind}.`,
    });
  }

  const level = parent.level + 1;
  if (level > ORGANIZATION_UNIT_MAX_LEVEL) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Struktur maksimal ${ORGANIZATION_UNIT_MAX_LEVEL} tingkat.`,
    });
  }
  return level;
}

export type FlatUnit = Pick<
  OwnedUnit,
  'id' | 'structure_id' | 'parent_id' | 'name' | 'kind' | 'level' | 'sort_order'
>;

export type UnitTreeNode = FlatUnit & {
  member_count: number;
  children: UnitTreeNode[];
};

/**
 * Builds the nested tree from a flat, already-ordered unit list in one pass.
 *
 * Flat query + assemble in JS beats a nested relational query here: depth is
 * capped at 3, row counts per structure are small, and this leaves an obvious
 * place to attach member counts, which a json-agg query does not.
 */
export function buildUnitTree(
  units: FlatUnit[],
  memberCounts: Map<string, number>,
): UnitTreeNode[] {
  const nodes = new Map<string, UnitTreeNode>();
  for (const u of units) {
    nodes.set(u.id, {
      ...u,
      member_count: memberCounts.get(u.id) ?? 0,
      children: [],
    });
  }

  const roots: UnitTreeNode[] = [];
  for (const u of units) {
    const node = nodes.get(u.id)!;
    const parent = u.parent_id ? nodes.get(u.parent_id) : undefined;
    // A parent outside this list would orphan the node; treat it as a root so
    // nothing silently disappears from the response.
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** "Bidang Internal / Divisi SDM" — for flat dropdown labels. */
export function buildPathLabels(units: FlatUnit[]): Map<string, string> {
  const byId = new Map(units.map((u) => [u.id, u]));
  const labels = new Map<string, string>();
  for (const u of units) {
    const parts: string[] = [];
    let cur: FlatUnit | undefined = u;
    // Depth is capped at 3; the guard is a cycle backstop, not a real limit.
    for (let i = 0; cur && i <= ORGANIZATION_UNIT_MAX_LEVEL; i++) {
      parts.unshift(cur.name);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    labels.set(u.id, parts.join(' / '));
  }
  return labels;
}

export async function countMembersByUnit(
  db: Db,
  structure: StructureOwner,
): Promise<Map<string, number>> {
  const rows = structure.lembagaId
    ? await db
        .select({
          unitId: kehimpunan.org_unit_id,
          n: sql<number>`count(*)::int`,
        })
        .from(kehimpunan)
        .where(eq(kehimpunan.lembagaId, structure.lembagaId))
        .groupBy(kehimpunan.org_unit_id)
    : await db
        .select({
          unitId: keanggotaan.org_unit_id,
          n: sql<number>`count(*)::int`,
        })
        .from(keanggotaan)
        .where(eq(keanggotaan.event_id, structure.eventId!))
        .groupBy(keanggotaan.org_unit_id);

  const counts = new Map<string, number>();
  for (const r of rows) if (r.unitId) counts.set(r.unitId, r.n);
  return counts;
}

export type OrgAssignment = {
  org_unit_id: string | null;
  org_role_id: string | null;
  division?: string;
  position?: string;
};

/**
 * Shared by the assignment endpoints and the legacy member write endpoints.
 *
 * Org ids are authoritative when present: the caller's `division`/`position`
 * strings are overwritten with the unit/role names so the denormalized text
 * columns cannot drift from the rows they mirror.
 */
export async function resolveOrgAssignment(
  db: Db,
  opts: {
    ownerType: 'lembaga' | 'event';
    ownerId: string;
    org_unit_id?: string | null;
    org_role_id?: string | null;
  },
): Promise<OrgAssignment> {
  const { org_unit_id = null, org_role_id = null } = opts;
  if (!org_unit_id && !org_role_id) {
    return { org_unit_id: null, org_role_id: null };
  }

  const ownerMatches = (s: {
    lembagaId: string | null;
    eventId: string | null;
  }) =>
    opts.ownerType === 'lembaga'
      ? s.lembagaId === opts.ownerId
      : s.eventId === opts.ownerId;

  const result: OrgAssignment = { org_unit_id, org_role_id };
  let unitStructureId: string | null = null;
  let roleStructureId: string | null = null;

  if (org_unit_id) {
    const rows = await db
      .select({
        name: organizationUnit.name,
        structureId: organizationStructure.id,
        lembagaId: organizationStructure.lembagaId,
        eventId: organizationStructure.eventId,
        is_active: organizationStructure.is_active,
      })
      .from(organizationUnit)
      .innerJoin(
        organizationStructure,
        eq(organizationUnit.structure_id, organizationStructure.id),
      )
      .where(eq(organizationUnit.id, org_unit_id))
      .limit(1);

    const unit = rows[0];
    if (!unit) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Unit tidak ditemukan.',
      });
    }
    if (!ownerMatches(unit)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Unit tersebut bukan milik lembaga/kegiatan ini.',
      });
    }
    if (!unit.is_active) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Struktur organisasi unit tersebut sudah tidak aktif.',
      });
    }
    unitStructureId = unit.structureId;
    result.division = unit.name;
  }

  if (org_role_id) {
    const rows = await db
      .select({
        name: organizationRole.name,
        structureId: organizationStructure.id,
        lembagaId: organizationStructure.lembagaId,
        eventId: organizationStructure.eventId,
        is_active: organizationStructure.is_active,
      })
      .from(organizationRole)
      .innerJoin(
        organizationStructure,
        eq(organizationRole.structure_id, organizationStructure.id),
      )
      .where(eq(organizationRole.id, org_role_id))
      .limit(1);

    const role = rows[0];
    if (!role) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Posisi tidak ditemukan.',
      });
    }
    if (!ownerMatches(role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Posisi tersebut bukan milik lembaga/kegiatan ini.',
      });
    }
    if (!role.is_active) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Struktur organisasi posisi tersebut sudah tidak aktif.',
      });
    }
    roleStructureId = role.structureId;
    result.position = role.name;
  }

  if (
    unitStructureId &&
    roleStructureId &&
    unitStructureId !== roleStructureId
  ) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Unit dan posisi harus berasal dari struktur yang sama.',
    });
  }

  return result;
}

/**
 * Sibling reorder guard shared by unit and role: the submitted id set must match
 * the stored set exactly, so a partial list can never silently renumber.
 */
export async function assertExactSiblingSet(
  db: Db,
  table: 'unit' | 'role',
  structureId: string,
  parentId: string | null,
  submitted: string[],
) {
  const stored =
    table === 'unit'
      ? await db
          .select({ id: organizationUnit.id })
          .from(organizationUnit)
          .where(
            and(
              eq(organizationUnit.structure_id, structureId),
              parentId === null
                ? isNull(organizationUnit.parent_id)
                : eq(organizationUnit.parent_id, parentId),
            ),
          )
      : await db
          .select({ id: organizationRole.id })
          .from(organizationRole)
          .where(eq(organizationRole.structure_id, structureId));

  const storedIds = new Set(stored.map((r) => r.id));
  const submittedIds = new Set(submitted);

  if (
    submittedIds.size !== submitted.length ||
    storedIds.size !== submittedIds.size ||
    [...submittedIds].some((id) => !storedIds.has(id))
  ) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'Daftar urutan harus memuat tepat semua item pada tingkat yang sama, tanpa duplikat.',
    });
  }
}

/** Guard used before deleting a unit or role that members still point at. */
export async function countMembersReferencing(
  db: Db,
  structure: StructureOwner,
  column: 'org_unit_id' | 'org_role_id',
  targetId: string,
): Promise<number> {
  const rows = structure.lembagaId
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(kehimpunan)
        .where(
          and(
            eq(kehimpunan.lembagaId, structure.lembagaId),
            eq(
              column === 'org_unit_id'
                ? kehimpunan.org_unit_id
                : kehimpunan.org_role_id,
              targetId,
            ),
          ),
        )
    : await db
        .select({ n: sql<number>`count(*)::int` })
        .from(keanggotaan)
        .where(
          and(
            eq(keanggotaan.event_id, structure.eventId!),
            eq(
              column === 'org_unit_id'
                ? keanggotaan.org_unit_id
                : keanggotaan.org_role_id,
              targetId,
            ),
          ),
        );

  return rows[0]?.n ?? 0;
}
