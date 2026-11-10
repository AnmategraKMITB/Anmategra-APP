import { and, eq } from 'drizzle-orm';
import { type db as Db } from '~/server/db';
import {
  organizationPosition,
  organizationUnit,
  placement,
} from '~/server/db/schema';

import { canManageEvent } from './access';
import { subtreeIds } from './routers/organization/tree';

type Database = typeof Db;

export type OrganogramActor = {
  id: string;
  role: string;
  lembagaId: string | null | undefined;
};

export type OrganogramAccess = {
  /** Owner/admin lembaga induk atau admin periode (lewat access_grant): boleh semuanya. */
  isManager: boolean;
  /** Unit tempat actor ditempatkan beserta turunannya (kosong untuk yang tidak ditempatkan). */
  memberUnitIds: Set<string>;
  /** Boleh mengubah isi pohon. Pengelola selalu boleh; anggota hanya bila tidak terkunci. */
  canEdit: boolean;
  /** Boleh mengunci/membuka: pengelola, atau pemegang posisi `head` di unit akar. */
  canLock: boolean;
};

/**
 * Hak actor atas satu organogram (struktur milik satu periode).
 *
 * - Pengelola (owner/admin, lihat `canManageEvent`) mengabaikan kunci edit.
 * - Anggota hanya bisa mengubah unit tempat ia ditempatkan beserta turunannya,
 *   dan tidak sama sekali bila struktur terkunci.
 */
export async function resolveOrganogramAccess(
  database: Database,
  actor: OrganogramActor,
  structure: { id: string; periodId: string; editLocked: boolean },
  units: { id: string; parentId: string | null }[],
): Promise<OrganogramAccess> {
  const manager =
    (await canManageEvent(
      database,
      actor.id,
      actor.role,
      actor.lembagaId,
      structure.periodId,
      'organization',
    )) !== null;

  const rows = await database
    .select({
      unitId: organizationPosition.unitId,
      rank: organizationPosition.rank,
    })
    .from(placement)
    .innerJoin(
      organizationPosition,
      eq(placement.positionId, organizationPosition.id),
    )
    .innerJoin(
      organizationUnit,
      eq(organizationPosition.unitId, organizationUnit.id),
    )
    .where(
      and(
        eq(placement.userId, actor.id),
        eq(organizationUnit.structure_id, structure.id),
      ),
    );

  const unitsForTree = units.map((u) => ({
    id: u.id,
    parentId: u.parentId,
    name: '',
    typeLabel: null,
    sortOrder: 0,
    layout: null,
  }));
  const memberUnitIds = subtreeIds(
    unitsForTree,
    rows.map((r) => r.unitId),
  );

  const rootIds = new Set(units.filter((u) => u.parentId === null).map((u) => u.id));
  const isRootHead = rows.some((r) => r.rank === 'head' && rootIds.has(r.unitId));

  return {
    isManager: manager,
    memberUnitIds,
    canEdit: manager || (!structure.editLocked && memberUnitIds.size > 0),
    canLock: manager || isRootHead,
  };
}
