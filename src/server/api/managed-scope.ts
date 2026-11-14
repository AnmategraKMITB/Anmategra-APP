import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';

import { listedAsKegiatan } from '~/server/api/period-listing';
import { type db } from '~/server/db';
import { accessGrant, events, lembaga } from '~/server/db/schema';

/**
 * Lembaga dan kegiatan yang boleh dikelola seorang pengguna. Dipakai menu
 * "Kelola" dan halaman /manage. Daftar ini hanya untuk navigasi; keputusan
 * akses tetap di `canManageLembaga` dan `canManageEvent`.
 */

type Database = typeof db;

export type ManagedUser = {
  id: string;
  role: string;
  lembagaId?: string | null;
};

export type ManagedLembaga = {
  lembagaId: string;
  lembagaNama: string;
  access: 'owner' | 'admin';
  /** Fitur yang boleh dikelola; `admin` berarti semuanya. */
  features: string[];
};

export type ManagedEvent = {
  eventId: string;
  eventNama: string;
  lembagaId: string | null;
  lembagaNama: string | null;
  access: 'owner' | 'admin';
  features: string[];
};

/** Batas penelusuran pohon lembaga; selaras dengan `access.ts`. */
const MAX_TREE_DEPTH = 16;

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

/** Semua keturunan dari `rootIds`, tanpa root itu sendiri. */
async function descendantsOf(database: Database, rootIds: string[]) {
  const seen = new Set(rootIds);
  const found: { id: string; name: string }[] = [];
  let frontier = rootIds;
  for (let depth = 0; depth < MAX_TREE_DEPTH && frontier.length > 0; depth++) {
    const children = await database
      .select({ id: lembaga.id, name: lembaga.name })
      .from(lembaga)
      .where(inArray(lembaga.parentId, frontier));
    frontier = [];
    for (const child of children) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      found.push(child);
      frontier.push(child.id);
    }
  }
  return found;
}

export async function listManagedLembaga(
  database: Database,
  user: ManagedUser,
): Promise<ManagedLembaga[]> {
  const byId = new Map<string, ManagedLembaga>();
  const add = (entry: ManagedLembaga) => {
    const current = byId.get(entry.lembagaId);
    if (!current) {
      byId.set(entry.lembagaId, entry);
      return;
    }
    current.features = union(current.features, entry.features);
    if (entry.access === 'owner') current.access = 'owner';
  };

  if (user.role === 'lembaga' && user.lembagaId) {
    const owned = await database.query.lembaga.findFirst({
      where: eq(lembaga.id, user.lembagaId),
      columns: { id: true, name: true },
    });
    if (owned) {
      add({
        lembagaId: owned.id,
        lembagaNama: owned.name,
        access: 'owner',
        features: ['admin'],
      });
    }
  }

  const grants = await database.query.accessGrant.findMany({
    where: and(
      eq(accessGrant.userId, user.id),
      eq(accessGrant.status, 'active'),
      isNotNull(accessGrant.lembagaId),
    ),
  });
  const grantedIds = grants.flatMap((g) => (g.lembagaId ? [g.lembagaId] : []));
  if (grantedIds.length > 0) {
    const rows = await database
      .select({ id: lembaga.id, name: lembaga.name })
      .from(lembaga)
      .where(inArray(lembaga.id, grantedIds));
    const nameById = new Map(rows.map((r) => [r.id, r.name]));

    for (const grant of grants) {
      const name = grant.lembagaId ? nameById.get(grant.lembagaId) : undefined;
      if (!grant.lembagaId || name === undefined) continue;
      add({
        lembagaId: grant.lembagaId,
        lembagaNama: name,
        access: 'admin',
        features: grant.features,
      });
    }

    // Hibah `propagate` menjangkau semua lembaga turunan.
    const propagating = grants.flatMap((g) =>
      g.propagate && g.lembagaId ? [g] : [],
    );
    for (const grant of propagating) {
      for (const child of await descendantsOf(database, [grant.lembagaId!])) {
        add({
          lembagaId: child.id,
          lembagaNama: child.name,
          access: 'admin',
          features: grant.features,
        });
      }
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.lembagaNama.localeCompare(b.lembagaNama),
  );
}

export async function listManagedEvents(
  database: Database,
  user: ManagedUser,
): Promise<ManagedEvent[]> {
  const managedLembaga = await listManagedLembaga(database, user);
  const lembagaById = new Map(managedLembaga.map((l) => [l.lembagaId, l]));
  const byId = new Map<string, ManagedEvent>();

  // Kegiatan milik lembaga yang dikelola, termasuk kepengurusan lembaga
  // Kepanitiaan (lihat `listedAsKegiatan`); kepengurusan lain ditangani terpisah.
  if (managedLembaga.length > 0) {
    const rows = await database
      .select({
        id: events.id,
        name: events.name,
        orgId: events.org_id,
      })
      .from(events)
      .where(
        and(
          inArray(events.org_id, [...lembagaById.keys()]),
          listedAsKegiatan(events),
        ),
      )
      .orderBy(desc(events.start_date));
    for (const row of rows) {
      const parent = row.orgId ? lembagaById.get(row.orgId) : undefined;
      if (!parent) continue;
      byId.set(row.id, {
        eventId: row.id,
        eventNama: row.name,
        lembagaId: parent.lembagaId,
        lembagaNama: parent.lembagaNama,
        access: parent.access,
        features: parent.features,
      });
    }
  }

  // Hibah langsung pada satu kegiatan.
  const grants = await database.query.accessGrant.findMany({
    where: and(
      eq(accessGrant.userId, user.id),
      eq(accessGrant.status, 'active'),
      isNotNull(accessGrant.periodId),
    ),
  });
  const grantedIds = grants.flatMap((g) => (g.periodId ? [g.periodId] : []));
  if (grantedIds.length > 0) {
    const rows = await database
      .select({
        id: events.id,
        name: events.name,
        orgId: events.org_id,
        orgName: lembaga.name,
      })
      .from(events)
      .leftJoin(lembaga, eq(lembaga.id, events.org_id))
      .where(inArray(events.id, grantedIds))
      .orderBy(desc(events.start_date));
    const featuresByEvent = new Map(
      grants.flatMap((g) => (g.periodId ? [[g.periodId, g.features]] : [])),
    );
    for (const row of rows) {
      const features = featuresByEvent.get(row.id) ?? [];
      const current = byId.get(row.id);
      if (current) {
        current.features = union(current.features, features);
        continue;
      }
      byId.set(row.id, {
        eventId: row.id,
        eventNama: row.name,
        lembagaId: row.orgId,
        lembagaNama: row.orgName,
        access: 'admin',
        features,
      });
    }
  }

  return [...byId.values()];
}

/** Ringkas dan murah: dipakai sidebar untuk memutuskan apakah menu "Kelola" tampil. */
export async function hasManagedScope(
  database: Database,
  user: ManagedUser,
): Promise<boolean> {
  if (user.role === 'lembaga') return true;
  const grant = await database.query.accessGrant.findFirst({
    where: and(
      eq(accessGrant.userId, user.id),
      eq(accessGrant.status, 'active'),
    ),
    columns: { id: true },
  });
  return grant !== undefined;
}
