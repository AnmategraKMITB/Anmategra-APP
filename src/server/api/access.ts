import { and, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { type db } from '~/server/db';
import {
  accessGrant,
  adminPermission,
  events,
  lembaga,
} from '~/server/db/schema';

/**
 * RO-03: Owner/Admin Lembaga & Kepanitiaan.
 *
 * Owner Lembaga tetap akun `role==='lembaga'` yang memiliki lembaga tsb
 * (dicek via `session.user.lembagaId`). Admin Lembaga adalah akun lain
 * (biasanya `role==='mahasiswa'`) yang di-grant akses lewat tabel
 * `access_grant` tanpa mengubah role top-level mereka — makanya
 * permission check ini di-scope oleh `lembagaId` yang ada di *input*
 * procedure, bukan cuma dari JWT.
 */
export type LembagaAccess = 'owner' | 'admin';

/**
 * Kunci fitur pada `access_grant.features`. 'admin' = semua kemampuan, sehingga
 * lolos untuk fitur apa pun; fitur lain membatasi hibah pada satu kemampuan.
 */
export const GRANT_FEATURES = [
  'admin',
  'oprec',
  'forms',
  'events',
  'organization',
] as const;
export type GrantFeature = (typeof GRANT_FEATURES)[number];

/** Hibah yang memuat fitur 'admin' atau fitur yang diminta. */
const hasFeature = (feature: GrantFeature) =>
  sql`('admin' = ANY(${accessGrant.features}) OR ${feature} = ANY(${accessGrant.features}))`;

/** Batas penelusuran pohon lembaga untuk propagasi; juga pengaman terhadap siklus. */
const MAX_LEMBAGA_TREE_DEPTH = 16;

const ADMIN_SCOPE_PERMISSION: Partial<Record<GrantFeature, string>> = {
  organization: 'lembaga.organization',
  events: 'lembaga.events',
  forms: 'lembaga.forms',
  oprec: 'lembaga.oprec',
};

async function hasAdminOperatorScope(
  database: typeof db,
  userId: string,
  feature: GrantFeature,
): Promise<boolean> {
  const required = ADMIN_SCOPE_PERMISSION[feature];
  if (!required) return false;
  const row = await database.query.adminPermission.findFirst({
    where: and(
      eq(adminPermission.userId, userId),
      isNull(adminPermission.revokedAt),
      or(isNull(adminPermission.expiresAt), sql`${adminPermission.expiresAt} > now()`),
    ),
    columns: { permissions: true },
  });
  return row?.permissions.includes('*') === true || row?.permissions.includes(required) === true;
}

export async function canManageLembaga(
  database: typeof db,
  userId: string,
  role: string,
  sessionLembagaId: string | null | undefined,
  lembagaId: string,
  feature: GrantFeature = 'admin',
): Promise<LembagaAccess | null> {
  if (role === 'admin') return 'admin';
  if (
    role !== 'lembaga' &&
    (await hasAdminOperatorScope(database, userId, feature))
  ) {
    return 'admin';
  }
  if (role === 'lembaga' && sessionLembagaId === lembagaId) {
    return 'owner';
  }

  const grants = await database.query.accessGrant.findMany({
    where: and(
      eq(accessGrant.userId, userId),
      eq(accessGrant.status, 'active'),
      isNotNull(accessGrant.lembagaId),
      hasFeature(feature),
    ),
    columns: { lembagaId: true, propagate: true },
  });
  if (grants.some((g) => g.lembagaId === lembagaId)) return 'admin';

  // Hibah `propagate` pada lembaga induk juga menjangkau semua turunannya.
  const propagating = new Set(
    grants.flatMap((g) => (g.propagate && g.lembagaId ? [g.lembagaId] : [])),
  );
  if (propagating.size === 0) return null;

  const visited = new Set<string>([lembagaId]);
  let current = lembagaId;
  for (let depth = 0; depth < MAX_LEMBAGA_TREE_DEPTH; depth++) {
    const row = await database.query.lembaga.findFirst({
      where: eq(lembaga.id, current),
      columns: { parentId: true },
    });
    const parentId = row?.parentId;
    if (!parentId || visited.has(parentId)) return null;
    if (propagating.has(parentId)) return 'admin';
    visited.add(parentId);
    current = parentId;
  }
  return null;
}

/**
 * Kepanitiaan (event) tidak punya Owner sendiri — Owner Lembaga induknya
 * otomatis jadi Owner Kepanitiaan. Admin Kepanitiaan bisa di-grant scoped
 * ke 1 periode lewat `access_grant` (scope periode), terpisah dari Admin Lembaga.
 */
export async function canManageEvent(
  database: typeof db,
  userId: string,
  role: string,
  sessionLembagaId: string | null | undefined,
  eventId: string,
  feature: GrantFeature = 'admin',
): Promise<LembagaAccess | null> {
  if (role === 'admin') return 'admin';

  const event = await database.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { id: true, org_id: true },
  });
  if (!event) return null;
  if (
    role !== 'lembaga' &&
    (await hasAdminOperatorScope(database, userId, feature))
  ) {
    return 'admin';
  }

  if (event.org_id) {
    const lembagaAccess = await canManageLembaga(
      database,
      userId,
      role,
      sessionLembagaId,
      event.org_id,
      feature,
    );
    if (lembagaAccess) return lembagaAccess;
  }

  const grant = await database.query.accessGrant.findFirst({
    where: and(
      eq(accessGrant.periodId, eventId),
      eq(accessGrant.userId, userId),
      eq(accessGrant.status, 'active'),
      hasFeature(feature),
    ),
  });
  return grant ? 'admin' : null;
}
