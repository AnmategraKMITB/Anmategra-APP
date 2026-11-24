import { and, desc, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import { listedAsKegiatan } from '~/server/api/period-listing';
import { resolveAssessAccess } from '~/server/api/routers/oprec/assess-access';
import { type db } from '~/server/db';
import {
  accessGrant,
  events,
  lembaga,
  organizationPosition,
  organizationUnit,
  placement,
  recruitment,
  recruitmentAssessor,
  recruitmentDivision,
} from '~/server/db/schema';

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

/**
 * Dipakai sidebar untuk memutuskan apakah menu "Kelola" tampil: Owner, pemegang
 * Grant aktif, atau penangan oprec (`listHandledOprecs`).
 */
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
  if (grant) return true;
  return (await listHandledOprecs(database, user)).length > 0;
}

export type HandledOprec = {
  recruitmentId: string;
  recruitmentName: string;
  status: string;
  periodId: string;
  periodName: string;
  lembagaNama: string | null;
  /** Tab tujuan: `prioritas` untuk metode prioritas, selain itu `nilai`. */
  tab: 'nilai' | 'prioritas';
  /** Jumlah divisi yang boleh dinilai atau diputuskan. */
  divisionCount: number;
  canDecide: boolean;
};

/**
 * Oprec yang ditangani seseorang tanpa menjadi pengelolanya: sebagai pengurus
 * di organogram (Kadiv, Kabid, Ketua, lihat `oprec/pengurus.ts`) atau penilai
 * tambahan. Oprec draf tidak ikut. Hak tiap baris diperiksa ulang dengan
 * `resolveAssessAccess`, jadi daftar ini sama dengan yang bisa dibuka.
 */
export async function listHandledOprecs(
  database: Database,
  user: ManagedUser,
): Promise<HandledOprec[]> {
  const myStructures = await database
    .select({ id: organizationUnit.structure_id })
    .from(placement)
    .innerJoin(
      organizationPosition,
      eq(organizationPosition.id, placement.positionId),
    )
    .innerJoin(
      organizationUnit,
      eq(organizationUnit.id, organizationPosition.unitId),
    )
    .where(eq(placement.userId, user.id));
  const structureIds = [...new Set(myStructures.map((r) => r.id))];

  const [viaOrganogram, viaAssessor] = await Promise.all([
    structureIds.length === 0
      ? []
      : database
          .select({ id: recruitmentDivision.recruitmentId })
          .from(recruitmentDivision)
          .innerJoin(
            organizationUnit,
            eq(organizationUnit.id, recruitmentDivision.unitId),
          )
          .where(inArray(organizationUnit.structure_id, structureIds)),
    database
      .select({ id: recruitmentAssessor.recruitmentId })
      .from(recruitmentAssessor)
      .where(eq(recruitmentAssessor.userId, user.id)),
  ]);
  const candidates = [
    ...new Set([...viaOrganogram, ...viaAssessor].map((r) => r.id)),
  ];
  if (candidates.length === 0) return [];

  const rows = await database
    .select({
      recruitment,
      periodName: events.name,
      lembagaNama: lembaga.name,
    })
    .from(recruitment)
    .innerJoin(events, eq(events.id, recruitment.periodId))
    .leftJoin(lembaga, eq(lembaga.id, events.org_id))
    .where(
      and(inArray(recruitment.id, candidates), ne(recruitment.status, 'draft')),
    )
    .orderBy(desc(recruitment.created_at));

  const actor = {
    id: user.id,
    role: user.role,
    lembagaId: user.lembagaId ?? null,
  };
  const out: HandledOprec[] = [];
  for (const row of rows) {
    const access = await resolveAssessAccess(database, actor, row.recruitment);
    // Pengelola sudah melihat oprec ini lewat kegiatannya di Kelola.
    if (!access || access.isAdmin) continue;
    const divisions = new Set([
      ...access.divisionIds,
      ...access.deciderDivisionIds,
    ]);
    out.push({
      recruitmentId: row.recruitment.id,
      recruitmentName: row.recruitment.name,
      status: row.recruitment.status,
      periodId: row.recruitment.periodId,
      periodName: row.periodName,
      lembagaNama: row.lembagaNama,
      tab:
        row.recruitment.placementMethod === 'prioritas' ? 'prioritas' : 'nilai',
      divisionCount: divisions.size,
      canDecide: access.deciderDivisionIds.size > 0,
    });
  }
  return out;
}
