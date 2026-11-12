import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '~/server/db/schema';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:password@localhost:5432/anmategra_test';

/**
 * Tes mengosongkan tabel sebelum tiap kasus. Karena itu nama database wajib
 * memuat "test", supaya `TEST_DATABASE_URL` yang salah diisi dengan database
 * pengembangan atau produksi ditolak sebelum ada data yang terhapus.
 */
export function assertTestDatabaseName(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/^[a-z0-9_]*test[a-z0-9_]*$/i.test(name)) {
    throw new Error(
      `TEST_DATABASE_URL harus menunjuk database yang namanya memuat "test" (ditemukan "${name}").`,
    );
  }
  return name;
}

export type TestDb = ReturnType<typeof createTestDb>['db'];

/** Membisukan NOTICE PostgreSQL (mis. nama constraint dipotong) agar keluaran tes tetap bersih. */
export const silentNotice = () => undefined;

export function createTestDb() {
  assertTestDatabaseName(TEST_DATABASE_URL);
  const client = postgres(TEST_DATABASE_URL, {
    max: 1,
    onnotice: silentNotice,
  });
  const db = drizzle(client, { schema });
  return { db, close: () => client.end() };
}

/** Mengosongkan semua tabel yang bergantung pada `users` (termasuk lembaga dan kegiatan). */
export async function resetDb(db: TestDb) {
  await db.execute(sql`TRUNCATE TABLE ${schema.users} CASCADE`);
}

// ---------------------------------------------------------------------------
// Pabrik data. Semua bernilai bawaan yang valid; timpa seperlunya.
// ---------------------------------------------------------------------------

export async function createUser(
  db: TestDb,
  over: Partial<typeof schema.users.$inferInsert> = {},
) {
  const [row] = await db
    .insert(schema.users)
    .values({
      email: `${crypto.randomUUID()}@test.local`,
      role: 'mahasiswa',
      ...over,
    })
    .returning();
  return row!;
}

export async function createLembaga(
  db: TestDb,
  ownerId: string,
  over: Partial<typeof schema.lembaga.$inferInsert> = {},
) {
  const [row] = await db
    .insert(schema.lembaga)
    .values({ userId: ownerId, name: 'Lembaga Uji', ...over })
    .returning();
  return row!;
}

export async function createEvent(
  db: TestDb,
  orgId: string | null,
  over: Partial<typeof schema.events.$inferInsert> = {},
) {
  const [row] = await db
    .insert(schema.events)
    .values({
      id: crypto.randomUUID(),
      org_id: orgId,
      name: 'Kegiatan Uji',
      start_date: new Date('2026-01-01T00:00:00Z'),
      status: 'On going',
      ...over,
    })
    .returning();
  return row!;
}

export async function grantAccess(
  db: TestDb,
  grant: {
    userId: string;
    lembagaId?: string;
    periodId?: string;
    features?: string[];
    propagate?: boolean;
    status?: 'active' | 'revoked';
  },
) {
  const [row] = await db
    .insert(schema.accessGrant)
    .values({
      userId: grant.userId,
      lembagaId: grant.lembagaId ?? null,
      periodId: grant.periodId ?? null,
      features: grant.features ?? ['admin'],
      propagate: grant.propagate ?? false,
      status: grant.status ?? 'active',
    })
    .returning();
  return row!;
}

export async function createOperator(
  db: TestDb,
  userId: string,
  permissions: string[],
  over: Partial<typeof schema.adminPermission.$inferInsert> = {},
) {
  const [row] = await db
    .insert(schema.adminPermission)
    .values({ userId, permissions, ...over })
    .returning();
  return row!;
}

// ---------------------------------------------------------------------------
// Pabrik data untuk profil mahasiswa dan keterlibatannya.
// ---------------------------------------------------------------------------

let nimCounter = 0;

export async function createMahasiswa(
  db: TestDb,
  userId: string,
  over: Partial<typeof schema.mahasiswa.$inferInsert> = {},
) {
  nimCounter += 1;
  const [row] = await db
    .insert(schema.mahasiswa)
    .values({
      userId,
      nim: 13523000 + nimCounter,
      jurusan: 'Teknik Informatika',
      angkatan: 2023,
      lineId: 'line-rahasia',
      whatsapp: '081200000000',
      ...over,
    })
    .returning();
  return row!;
}

export async function addMembership(
  db: TestDb,
  lembagaId: string,
  userId: string,
  status: 'aktif' | 'keluar' = 'aktif',
) {
  await db
    .insert(schema.lembagaMembership)
    .values({ lembagaId, userId, status, source: 'manual' });
}

export async function requestEventAssociation(
  db: TestDb,
  eventId: string,
  userId: string,
  status: 'Pending' | 'Accepted' | 'Declined' = 'Pending',
) {
  await db.insert(schema.associationRequests).values({
    id: crypto.randomUUID(),
    event_id: eventId,
    user_id: userId,
    division: 'Acara',
    position: 'Staf',
    status,
  });
}

export async function requestLembagaAssociation(
  db: TestDb,
  lembagaId: string,
  userId: string,
  status: 'Pending' | 'Accepted' | 'Declined' = 'Pending',
) {
  await db.insert(schema.associationRequestsLembaga).values({
    id: crypto.randomUUID(),
    lembagaId,
    user_id: userId,
    division: 'Acara',
    position: 'Staf',
    status,
  });
}

/** Menempatkan pengguna pada satu jabatan di struktur aktif sebuah kegiatan. */
export async function placeInEvent(
  db: TestDb,
  eventId: string,
  userId: string,
) {
  const [structure] = await db
    .insert(schema.organizationStructure)
    .values({ eventId, name: 'Struktur Uji', is_active: true })
    .returning();
  const [unit] = await db
    .insert(schema.organizationUnit)
    .values({ structure_id: structure!.id, name: 'Acara', level: 1 })
    .returning();
  const [position] = await db
    .insert(schema.organizationPosition)
    .values({
      unitId: unit!.id,
      title: 'Staf',
      rank: 'staff',
      kind: 'nonstruktural',
    })
    .returning();
  await db
    .insert(schema.placement)
    .values({ positionId: position!.id, userId, source: 'manual' });
}
