import { and, eq, inArray } from 'drizzle-orm';
import {
  DEFAULT_ORGANIZATION_RANKS,
  type OrganizationRankDef,
  organizationPosition,
  organizationStructure,
  organizationUnit,
  placement,
  recruitmentDivision,
} from '~/server/db/schema';

import { type Queryable } from './services';

/**
 * Pengurus sebuah bagian oprec: pemegang jabatan di atas Staf (lebih senior
 * dari rank `staff` menurut daftar rank struktur) pada bagian itu atau bagian
 * mana pun di atasnya. Jadi Kadiv, Wakadiv, Kabid, Wakabid, sampai Ketua
 * Pelaksana di akar ikut mengurus bagian di bawahnya. Pengganti aturan lama
 * "hanya pemegang rank `head` di bagian itu sendiri".
 */
export function isAboveStaff(
  rank: string,
  ranks: readonly OrganizationRankDef[] | null,
): boolean {
  const list = ranks && ranks.length > 0 ? ranks : DEFAULT_ORGANIZATION_RANKS;
  const index = list.findIndex((r) => r.id === rank);
  if (index < 0) return false;
  const staff = list.findIndex((r) => r.id === 'staff');
  // Tanpa rank `staff`, rank paling junior yang dianggap setara Staf.
  return index < (staff >= 0 ? staff : list.length - 1);
}

type UnitNode = { id: string; parentId: string | null };
type Holder = { userId: string; unitId: string; rank: string };

/** Bagian itu sendiri beserta semua leluhurnya (aman terhadap siklus). */
function selfAndAncestors(
  parentOf: Map<string, string | null>,
  unitId: string,
): Set<string> {
  const out = new Set<string>();
  let cursor: string | null | undefined = unitId;
  while (cursor && !out.has(cursor)) {
    out.add(cursor);
    cursor = parentOf.get(cursor);
  }
  return out;
}

/**
 * Pasangan (bagian, pengguna) untuk setiap bagian di `unitIds` yang diurus
 * seorang pengurus. Logika murni; pemuatan data ada di `loadPengurus`.
 */
export function pengurusOfUnits(
  unitIds: readonly string[],
  units: readonly UnitNode[],
  holders: readonly Holder[],
  ranksOfUnit: (unitId: string) => readonly OrganizationRankDef[] | null,
): { unitId: string; userId: string }[] {
  const parentOf = new Map(units.map((u) => [u.id, u.parentId]));
  const pengurus = holders.filter((h) =>
    isAboveStaff(h.rank, ranksOfUnit(h.unitId)),
  );
  const out: { unitId: string; userId: string }[] = [];
  for (const unitId of new Set(unitIds)) {
    const chain = selfAndAncestors(parentOf, unitId);
    const seen = new Set<string>();
    for (const h of pengurus) {
      if (chain.has(h.unitId) && !seen.has(h.userId)) {
        seen.add(h.userId);
        out.push({ unitId, userId: h.userId });
      }
    }
  }
  return out;
}

/**
 * Pengurus untuk bagian-bagian `unitIds`, dari organogram tempat bagian itu
 * berada. `userId` membatasi ke satu orang (dipakai saat memeriksa akses).
 */
export async function loadPengurus(
  db: Queryable,
  unitIds: readonly string[],
  userId?: string,
): Promise<{ unitId: string; userId: string }[]> {
  if (unitIds.length === 0) return [];
  const owners = await db
    .select({ structureId: organizationUnit.structure_id })
    .from(organizationUnit)
    .where(inArray(organizationUnit.id, [...unitIds]));
  const structureIds = [...new Set(owners.map((o) => o.structureId))];
  if (structureIds.length === 0) return [];

  const [units, structures, holders] = await Promise.all([
    db
      .select({
        id: organizationUnit.id,
        parentId: organizationUnit.parent_id,
        structureId: organizationUnit.structure_id,
      })
      .from(organizationUnit)
      .where(inArray(organizationUnit.structure_id, structureIds)),
    db
      .select({
        id: organizationStructure.id,
        ranks: organizationStructure.ranks,
      })
      .from(organizationStructure)
      .where(inArray(organizationStructure.id, structureIds)),
    db
      .select({
        userId: placement.userId,
        unitId: organizationPosition.unitId,
        rank: organizationPosition.rank,
      })
      .from(placement)
      .innerJoin(
        organizationPosition,
        eq(organizationPosition.id, placement.positionId),
      )
      .innerJoin(
        organizationUnit,
        eq(organizationUnit.id, organizationPosition.unitId),
      )
      .where(
        and(
          inArray(organizationUnit.structure_id, structureIds),
          userId ? eq(placement.userId, userId) : undefined,
        ),
      ),
  ]);

  const structureOf = new Map(units.map((u) => [u.id, u.structureId]));
  const ranksOf = new Map(structures.map((s) => [s.id, s.ranks]));
  return pengurusOfUnits(unitIds, units, holders, (unitId) => {
    const structureId = structureOf.get(unitId);
    return structureId ? (ranksOf.get(structureId) ?? null) : null;
  });
}

/** Divisi sebuah oprec beserta pengurusnya (satu baris per pasangan). */
export async function loadDivisionPengurus(
  db: Queryable,
  recruitmentId: string,
  userId?: string,
): Promise<{ divisionId: string; unitId: string; userId: string }[]> {
  const divisions = await db
    .select({ id: recruitmentDivision.id, unitId: recruitmentDivision.unitId })
    .from(recruitmentDivision)
    .where(eq(recruitmentDivision.recruitmentId, recruitmentId));
  const pairs = await loadPengurus(
    db,
    divisions.map((d) => d.unitId),
    userId,
  );
  return divisions.flatMap((d) =>
    pairs
      .filter((p) => p.unitId === d.unitId)
      .map((p) => ({ divisionId: d.id, unitId: d.unitId, userId: p.userId })),
  );
}
