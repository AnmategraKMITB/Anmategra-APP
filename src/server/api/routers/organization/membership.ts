import { and, asc, desc, eq, inArray, max, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type * as schema from '~/server/db/schema';
import {
  events,
  lembaga,
  lembagaMembership,
  organizationPosition,
  organizationStructure,
  organizationUnit,
  placement,
  users,
} from '~/server/db/schema';

import { isListedAsKegiatan } from '../../period-listing';
import {
  DEFAULT_POSITION_TITLE,
  GENERAL_UNIT_NAME,
  canonicalPositionTitle,
  collapse,
  foldKey,
  guessRank,
  isBlank,
} from './import-plan';

/** `ctx.db` atau transaksi `tx` di dalam `ctx.db.transaction(...)`. */
type Db = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

/** Nama periode kepengurusan bawaan sebuah lembaga (Fase 2D). */
export const DEFAULT_PERIOD_LABEL = '2025/2026';

// Urutan rank mengikuti daftar rank struktur (senior dulu); tanpa daftar, memakai urutan bawaan.
const rankOrder = sql`coalesce(
  (SELECT t.ord FROM jsonb_array_elements(${organizationStructure.ranks}) WITH ORDINALITY AS t(r, ord) WHERE t.r->>'id' = ${organizationPosition.rank}),
  CASE ${organizationPosition.rank} WHEN 'head' THEN 1 WHEN 'vice' THEN 2 WHEN 'coordinator' THEN 3 WHEN 'staff' THEN 4 ELSE 999 END
)`;

/**
 * Anggota sebuah periode: satu baris per orang, memakai penempatan utamanya
 * (rank tertinggi, lalu urutan bagian dan jabatan). Pengganti `keanggotaan`:
 * kolom `division`, `position`, `index` bentuknya sama dengan kolom lama.
 */
export function periodMembersSq(db: Db, periodId: string) {
  return db
    .selectDistinctOn([placement.userId], {
      userId: placement.userId,
      division: organizationUnit.name,
      position: organizationPosition.title,
      index: placement.sortOrder,
      createdAt: placement.created_at,
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
    .innerJoin(
      organizationStructure,
      and(
        eq(organizationStructure.id, organizationUnit.structure_id),
        eq(organizationStructure.eventId, periodId),
        eq(organizationStructure.is_active, true),
      ),
    )
    .orderBy(
      placement.userId,
      rankOrder,
      asc(organizationUnit.sort_order),
      asc(organizationPosition.sort_order),
      asc(placement.created_at),
    )
    .as('period_members');
}

/** Periode kepengurusan yang berlaku bagi sebuah lembaga (On going dulu, lalu terbaru). */
export async function currentLembagaPeriodId(
  db: Db,
  lembagaId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.org_id, lembagaId), eq(events.kind, 'kepengurusan')))
    .orderBy(desc(sql`${events.status} = 'On going'`), desc(events.start_date))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Anggota sebuah lembaga: keanggotaan aktif, dengan bagian dan jabatan dari
 * periode kepengurusan yang berlaku ("-" bila belum ditempatkan). Pengganti
 * `kehimpunan`.
 */
export async function lembagaMembersSq(db: Db, lembagaId: string) {
  const periodId = await currentLembagaPeriodId(db, lembagaId);
  // Tanpa periode kepengurusan: periode '' tidak punya penempatan, semua "-".
  const members = periodMembersSq(db, periodId ?? '');
  return db
    .select({
      userId: lembagaMembership.userId,
      division: sql<string>`coalesce(${members.division}, '-')`.as('division'),
      position: sql<string>`coalesce(${members.position}, '-')`.as('position'),
      index: sql<number>`coalesce(${members.index}, 2147483647)`.as('index'),
    })
    .from(lembagaMembership)
    .leftJoin(members, eq(members.userId, lembagaMembership.userId))
    .where(
      and(
        eq(lembagaMembership.lembagaId, lembagaId),
        eq(lembagaMembership.status, 'aktif'),
      ),
    )
    .as('lembaga_members');
}

export async function isPeriodMember(
  db: Db,
  periodId: string,
  userId: string,
): Promise<boolean> {
  const members = periodMembersSq(db, periodId);
  const [row] = await db
    .select({ userId: members.userId })
    .from(members)
    .where(eq(members.userId, userId))
    .limit(1);
  return row !== undefined;
}

export async function isLembagaMember(
  db: Db,
  lembagaId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: lembagaMembership.id })
    .from(lembagaMembership)
    .where(
      and(
        eq(lembagaMembership.lembagaId, lembagaId),
        eq(lembagaMembership.userId, userId),
        eq(lembagaMembership.status, 'aktif'),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/** Struktur aktif sebuah periode; dibuat kosong bila belum ada. */
async function ensureStructure(db: Db, periodId: string): Promise<string> {
  const [existing] = await db
    .select({ id: organizationStructure.id })
    .from(organizationStructure)
    .where(
      and(
        eq(organizationStructure.eventId, periodId),
        eq(organizationStructure.is_active, true),
      ),
    )
    .limit(1);
  if (existing) return existing.id;
  const [period] = await db
    .select({ name: events.name })
    .from(events)
    .where(eq(events.id, periodId))
    .limit(1);
  const [created] = await db
    .insert(organizationStructure)
    .values({
      eventId: periodId,
      name: period?.name ?? 'Organogram',
      is_active: true,
    })
    .onConflictDoNothing()
    .returning({ id: organizationStructure.id });
  if (created) return created.id;
  // Kalah balapan dengan pembuat lain: ambil yang sudah ada.
  const [raced] = await db
    .select({ id: organizationStructure.id })
    .from(organizationStructure)
    .where(
      and(
        eq(organizationStructure.eventId, periodId),
        eq(organizationStructure.is_active, true),
      ),
    )
    .limit(1);
  return raced!.id;
}

/** Hapus semua penempatan seorang pengguna pada struktur aktif sebuah periode. */
export async function removeFromPeriod(
  db: Db,
  periodId: string,
  userId: string,
): Promise<number> {
  const ids = await db
    .select({ id: placement.id })
    .from(placement)
    .innerJoin(
      organizationPosition,
      eq(placement.positionId, organizationPosition.id),
    )
    .innerJoin(
      organizationUnit,
      eq(organizationPosition.unitId, organizationUnit.id),
    )
    .innerJoin(
      organizationStructure,
      and(
        eq(organizationStructure.id, organizationUnit.structure_id),
        eq(organizationStructure.eventId, periodId),
        eq(organizationStructure.is_active, true),
      ),
    )
    .where(eq(placement.userId, userId));
  if (ids.length === 0) return 0;
  await db.delete(placement).where(
    inArray(
      placement.id,
      ids.map((r) => r.id),
    ),
  );
  return ids.length;
}

/**
 * Menempatkan seorang pengguna di periode berdasarkan teks bagian dan jabatan
 * (form lama masih berisi teks). Bagian dan jabatan dicari menurut nama
 * (huruf besar-kecil dan ejaan Staff/Staf diabaikan), dibuat bila belum ada.
 * Satu orang satu penempatan per periode: penempatan lamanya diganti.
 * Teks kosong atau "-" memakai bagian "Umum" dan jabatan "Anggota".
 */
export async function upsertPlacementByText(
  db: Db,
  input: {
    periodId: string;
    userId: string;
    division: string;
    position: string;
    createdBy: string | null;
    source?: 'manual' | 'import';
    sortOrder?: number;
  },
): Promise<{ positionId: string }> {
  const structureId = await ensureStructure(db, input.periodId);
  const divisionLabel = isBlank(input.division)
    ? GENERAL_UNIT_NAME
    : collapse(input.division);
  const positionLabel = isBlank(input.position)
    ? DEFAULT_POSITION_TITLE
    : canonicalPositionTitle(input.position);

  const units = await db
    .select({
      id: organizationUnit.id,
      name: organizationUnit.name,
      sortOrder: organizationUnit.sort_order,
    })
    .from(organizationUnit)
    .where(eq(organizationUnit.structure_id, structureId));
  let unit = units.find((u) => foldKey(u.name) === foldKey(divisionLabel));
  if (!unit) {
    const nextOrder = units.reduce((n, u) => Math.max(n, u.sortOrder), -1) + 1;
    const [created] = await db
      .insert(organizationUnit)
      .values({
        structure_id: structureId,
        parent_id: null,
        name: divisionLabel,
        level: 1,
        sort_order: nextOrder,
      })
      .returning({
        id: organizationUnit.id,
        name: organizationUnit.name,
        sortOrder: organizationUnit.sort_order,
      });
    unit = created!;
  }

  const positions = await db
    .select({
      id: organizationPosition.id,
      title: organizationPosition.title,
      sortOrder: organizationPosition.sort_order,
    })
    .from(organizationPosition)
    .where(eq(organizationPosition.unitId, unit.id));
  const wanted = foldKey(canonicalPositionTitle(positionLabel));
  let position = positions.find(
    (p) => foldKey(canonicalPositionTitle(p.title)) === wanted,
  );
  if (!position) {
    const nextOrder =
      positions.reduce((n, p) => Math.max(n, p.sortOrder), -1) + 1;
    const [created] = await db
      .insert(organizationPosition)
      .values({
        unitId: unit.id,
        title: positionLabel,
        rank: guessRank(positionLabel),
        kind: 'struktural',
        quota: 0,
        hidden: false,
        sort_order: nextOrder,
      })
      .returning({
        id: organizationPosition.id,
        title: organizationPosition.title,
        sortOrder: organizationPosition.sort_order,
      });
    position = created!;
  }

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const [top] = await db
      .select({ top: max(placement.sortOrder) })
      .from(placement)
      .innerJoin(
        organizationPosition,
        eq(placement.positionId, organizationPosition.id),
      )
      .innerJoin(
        organizationUnit,
        eq(organizationPosition.unitId, organizationUnit.id),
      )
      .where(eq(organizationUnit.structure_id, structureId));
    sortOrder = (top?.top ?? -1) + 1;
  }

  await removeFromPeriod(db, input.periodId, input.userId);
  await db.insert(placement).values({
    positionId: position.id,
    userId: input.userId,
    source: input.source ?? 'manual',
    createdBy: input.createdBy,
    sortOrder,
  });
  return { positionId: position.id };
}

/** Keanggotaan aktif jangka panjang; tidak berbuat apa-apa bila sudah aktif. */
export async function ensureMembership(
  db: Db,
  lembagaId: string,
  userId: string,
  source: 'manual' | 'import' = 'manual',
): Promise<void> {
  await db
    .insert(lembagaMembership)
    .values({
      lembagaId,
      userId,
      status: 'aktif',
      source,
      joinedAt: new Date(),
    })
    .onConflictDoNothing();
}

/** Mengakhiri keanggotaan aktif (status keluar), bukan menghapus barisnya. */
export async function endMembership(
  db: Db,
  lembagaId: string,
  userId: string,
): Promise<void> {
  await db
    .update(lembagaMembership)
    .set({ status: 'keluar', endedAt: new Date(), updated_at: new Date() })
    .where(
      and(
        eq(lembagaMembership.lembagaId, lembagaId),
        eq(lembagaMembership.userId, userId),
        eq(lembagaMembership.status, 'aktif'),
      ),
    );
}

/**
 * Periode kepengurusan yang berlaku bagi lembaga; dibuat ("2025/2026", On going)
 * bila belum ada. Pemanggil harus sudah memegang transaksi.
 */
export async function ensureCurrentPeriod(
  db: Db,
  lembagaId: string,
): Promise<string> {
  const existing = await currentLembagaPeriodId(db, lembagaId);
  if (existing) return existing;
  const [org] = await db
    .select({ name: lembaga.name })
    .from(lembaga)
    .where(eq(lembaga.id, lembagaId))
    .limit(1);
  const periodId = crypto.randomUUID();
  await db.insert(events).values({
    id: periodId,
    org_id: lembagaId,
    kind: 'kepengurusan',
    label: DEFAULT_PERIOD_LABEL,
    name: `${org?.name ?? 'Lembaga'} ${DEFAULT_PERIOD_LABEL}`,
    start_date: new Date('2025-08-01T00:00:00+07:00'),
    status: 'On going',
  });
  return periodId;
}

/** Apakah periode punya penempatan sama sekali (dipakai sebelum menghapus periode). */
export async function periodHasMembers(
  db: Db,
  periodId: string,
): Promise<boolean> {
  const members = periodMembersSq(db, periodId);
  const [row] = await db
    .select({ userId: members.userId })
    .from(members)
    .limit(1);
  return row !== undefined;
}

/** Baris anggota sebuah periode untuk satu orang; null bila bukan anggota. */
export async function periodMemberOf(db: Db, periodId: string, userId: string) {
  const members = periodMembersSq(db, periodId);
  const [row] = await db
    .select()
    .from(members)
    .where(eq(members.userId, userId))
    .limit(1);
  return row ?? null;
}

/** Id semua anggota sebuah periode. */
export async function periodMemberIds(
  db: Db,
  periodId: string,
): Promise<string[]> {
  const members = periodMembersSq(db, periodId);
  const rows = await db.select({ userId: members.userId }).from(members);
  return rows.map((r) => r.userId);
}

/** Id semua anggota aktif sebuah lembaga. */
export async function lembagaMemberIds(
  db: Db,
  lembagaId: string,
): Promise<string[]> {
  const rows = await db
    .select({ userId: lembagaMembership.userId })
    .from(lembagaMembership)
    .where(
      and(
        eq(lembagaMembership.lembagaId, lembagaId),
        eq(lembagaMembership.status, 'aktif'),
      ),
    );
  return rows.map((r) => r.userId);
}

/**
 * Nama bagian dan jabatan yang sudah ada di organogram sebuah periode, untuk
 * pilihan di form (menggantikan nilai teks yang dikumpulkan dari anggota).
 */
export async function periodTextOptions(
  db: Db,
  periodId: string | null,
): Promise<{ divisions: string[]; positions: string[] }> {
  if (periodId === null) return { divisions: [], positions: [] };
  const rows = await db
    .select({
      division: organizationUnit.name,
      position: organizationPosition.title,
    })
    .from(organizationUnit)
    .innerJoin(
      organizationStructure,
      and(
        eq(organizationStructure.id, organizationUnit.structure_id),
        eq(organizationStructure.eventId, periodId),
        eq(organizationStructure.is_active, true),
      ),
    )
    .leftJoin(
      organizationPosition,
      eq(organizationPosition.unitId, organizationUnit.id),
    )
    .orderBy(
      asc(organizationUnit.sort_order),
      asc(organizationPosition.sort_order),
    );
  return {
    divisions: [...new Set(rows.map((r) => r.division))],
    positions: [
      ...new Set(
        rows.flatMap((r) => (r.position === null ? [] : [r.position])),
      ),
    ],
  };
}

/** Penempatan utama seorang pengguna di tiap periode yang dipegangnya (satu baris per periode). */
async function userPlacementRows(db: Db, userId: string) {
  return db
    .selectDistinctOn([events.id], {
      event: events,
      division: organizationUnit.name,
      position: organizationPosition.title,
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
    .innerJoin(
      organizationStructure,
      and(
        eq(organizationStructure.id, organizationUnit.structure_id),
        eq(organizationStructure.is_active, true),
      ),
    )
    .innerJoin(events, eq(events.id, organizationStructure.eventId))
    .where(eq(placement.userId, userId))
    .orderBy(
      events.id,
      rankOrder,
      asc(organizationUnit.sort_order),
      asc(organizationPosition.sort_order),
    );
}

/**
 * Kegiatan yang diikuti seorang pengguna, terbaru dulu, beserta lembaga
 * penyelenggara dan bagian/jabatannya. Termasuk kepengurusan lembaga
 * Kepanitiaan (`isListedAsKegiatan`). Pengganti join keanggotaan.
 */
export async function userKegiatanMemberships(db: Db, userId: string) {
  const rows = await userPlacementRows(db, userId);
  const orgIds = [
    ...new Set(rows.flatMap((r) => (r.event.org_id ? [r.event.org_id] : []))),
  ];
  if (orgIds.length === 0) return [];
  const orgs = await db
    .select({ lembaga, user: users })
    .from(lembaga)
    .innerJoin(users, eq(lembaga.userId, users.id))
    .where(inArray(lembaga.id, orgIds));
  const orgById = new Map(orgs.map((o) => [o.lembaga.id, o]));
  return rows
    .flatMap((r) => {
      const org = r.event.org_id ? orgById.get(r.event.org_id) : undefined;
      return org && isListedAsKegiatan(r.event.kind, org.lembaga.type)
        ? [
            {
              event: r.event,
              lembaga: org.lembaga,
              user: org.user,
              division: r.division,
              position: r.position,
            },
          ]
        : [];
    })
    .sort(
      (a, b) => b.event.start_date.getTime() - a.event.start_date.getTime(),
    );
}

/**
 * Lembaga tempat seorang pengguna menjadi anggota aktif, urut nama lembaga,
 * dengan bagian/jabatan dari periode kepengurusan yang berlaku ("-" bila belum
 * ditempatkan). Pengganti join kehimpunan.
 */
export async function userLembagaMemberships(db: Db, userId: string) {
  const memberships = await db
    .select({ lembaga, user: users })
    .from(lembagaMembership)
    .innerJoin(lembaga, eq(lembagaMembership.lembagaId, lembaga.id))
    .innerJoin(users, eq(lembaga.userId, users.id))
    .where(
      and(
        eq(lembagaMembership.userId, userId),
        eq(lembagaMembership.status, 'aktif'),
      ),
    )
    .orderBy(asc(lembaga.name));
  if (memberships.length === 0) return [];
  const placements = (await userPlacementRows(db, userId)).filter(
    (r) => r.event.kind === 'kepengurusan',
  );
  const best = new Map<string, (typeof placements)[number]>();
  for (const row of placements) {
    const orgId = row.event.org_id;
    if (!orgId) continue;
    const current = best.get(orgId);
    const better =
      !current ||
      (row.event.status === 'On going' &&
        current.event.status !== 'On going') ||
      (row.event.status === current.event.status &&
        row.event.start_date > current.event.start_date);
    if (better) best.set(orgId, row);
  }
  return memberships.map((m) => ({
    lembaga: m.lembaga,
    user: m.user,
    division: best.get(m.lembaga.id)?.division ?? '-',
    position: best.get(m.lembaga.id)?.position ?? '-',
  }));
}

/** Anggota aktif sebuah lembaga dengan bagian/jabatannya sekarang; null bila bukan anggota. */
export async function lembagaMemberOf(
  db: Db,
  lembagaId: string,
  userId: string,
) {
  const members = await lembagaMembersSq(db, lembagaId);
  const [row] = await db
    .select()
    .from(members)
    .where(eq(members.userId, userId))
    .limit(1);
  if (!row) return null;
  const [membership] = await db
    .select({ joinedAt: lembagaMembership.joinedAt })
    .from(lembagaMembership)
    .where(
      and(
        eq(lembagaMembership.lembagaId, lembagaId),
        eq(lembagaMembership.userId, userId),
        eq(lembagaMembership.status, 'aktif'),
      ),
    )
    .limit(1);
  return { ...row, joinedAt: membership?.joinedAt ?? null };
}

const hasText = (division: string, position: string) =>
  !(isBlank(division) && isBlank(position));

/**
 * Menambah anggota lembaga: keanggotaan aktif, dan bila bagian/jabatan diisi,
 * penempatan di periode kepengurusan yang berlaku (dibuat bila belum ada).
 * Mengembalikan false bila orang itu sudah menjadi anggota aktif.
 */
export async function addLembagaMember(
  db: Db,
  input: {
    lembagaId: string;
    userId: string;
    division: string;
    position: string;
    actorId: string;
  },
): Promise<boolean> {
  if (await isLembagaMember(db, input.lembagaId, input.userId)) return false;
  await ensureMembership(db, input.lembagaId, input.userId);
  if (hasText(input.division, input.position)) {
    const periodId = await ensureCurrentPeriod(db, input.lembagaId);
    await upsertPlacementByText(db, {
      periodId,
      userId: input.userId,
      division: input.division,
      position: input.position,
      createdBy: input.actorId,
    });
  }
  return true;
}

/**
 * Mengubah bagian/jabatan seorang anggota lembaga, urutannya dipertahankan.
 * Teks kosong atau "-" melepas penempatannya (tetap anggota). False bila bukan anggota.
 */
export async function editLembagaMember(
  db: Db,
  input: {
    lembagaId: string;
    userId: string;
    division: string;
    position: string;
    actorId: string;
  },
): Promise<boolean> {
  if (!(await isLembagaMember(db, input.lembagaId, input.userId))) return false;
  const periodId = await currentLembagaPeriodId(db, input.lembagaId);
  if (!hasText(input.division, input.position)) {
    if (periodId) await removeFromPeriod(db, periodId, input.userId);
    return true;
  }
  const ensured = periodId ?? (await ensureCurrentPeriod(db, input.lembagaId));
  const current = await periodMemberOf(db, ensured, input.userId);
  await upsertPlacementByText(db, {
    periodId: ensured,
    userId: input.userId,
    division: input.division,
    position: input.position,
    createdBy: input.actorId,
    sortOrder: current?.index,
  });
  return true;
}

/** Mengeluarkan anggota: keanggotaan berakhir dan penempatan di periode kepengurusan dilepas. */
export async function removeLembagaMember(
  db: Db,
  lembagaId: string,
  userId: string,
): Promise<void> {
  await endMembership(db, lembagaId, userId);
  const periodId = await currentLembagaPeriodId(db, lembagaId);
  if (periodId) await removeFromPeriod(db, periodId, userId);
}

/** Menyimpan urutan anggota sebuah periode sesuai urutan `userIds` (indeks 0, 1, ...). */
export async function reorderPeriodMembers(
  db: Db,
  periodId: string,
  userIds: string[],
): Promise<void> {
  for (const [index, userId] of userIds.entries()) {
    const owned = await db
      .select({ id: placement.id })
      .from(placement)
      .innerJoin(
        organizationPosition,
        eq(placement.positionId, organizationPosition.id),
      )
      .innerJoin(
        organizationUnit,
        eq(organizationPosition.unitId, organizationUnit.id),
      )
      .innerJoin(
        organizationStructure,
        and(
          eq(organizationStructure.id, organizationUnit.structure_id),
          eq(organizationStructure.eventId, periodId),
          eq(organizationStructure.is_active, true),
        ),
      )
      .where(eq(placement.userId, userId));
    if (owned.length === 0) continue;
    await db
      .update(placement)
      .set({ sortOrder: index })
      .where(
        inArray(
          placement.id,
          owned.map((r) => r.id),
        ),
      );
  }
}
