import * as schema from '~/server/db/schema';

import { type TestDb, createEvent, createLembaga, createUser } from './test-db';

/**
 * Periode lembaga dengan organogram aktif berisi `unitNames.length` tujuan,
 * masing-masing punya jabatan ketua (`head`) dan staf. Pemilik lembaga
 * otomatis boleh mengelola oprec.
 */
export async function createOprecWorld(
  db: TestDb,
  unitNames: string[] = ['Divisi A', 'Divisi B'],
) {
  const owner = await createUser(db, { role: 'lembaga' });
  const lembaga = await createLembaga(db, owner.id);
  const event = await createEvent(db, lembaga.id);
  const [structure] = await db
    .insert(schema.organizationStructure)
    .values({ eventId: event.id, name: 'Struktur Uji', is_active: true })
    .returning();
  const units: {
    unitId: string;
    headPositionId: string;
    staffPositionId: string;
  }[] = [];
  for (const [i, name] of unitNames.entries()) {
    const [unit] = await db
      .insert(schema.organizationUnit)
      .values({
        structure_id: structure!.id,
        name,
        level: 1,
        sort_order: i,
      })
      .returning();
    const [head] = await db
      .insert(schema.organizationPosition)
      .values({
        unitId: unit!.id,
        title: 'Ketua',
        rank: 'head',
        kind: 'struktural',
      })
      .returning();
    const [staff] = await db
      .insert(schema.organizationPosition)
      .values({
        unitId: unit!.id,
        title: 'Staf',
        rank: 'staff',
        kind: 'nonstruktural',
      })
      .returning();
    units.push({
      unitId: unit!.id,
      headPositionId: head!.id,
      staffPositionId: staff!.id,
    });
  }
  return {
    owner: { id: owner.id, role: 'lembaga' as const, lembagaId: lembaga.id },
    lembagaId: lembaga.id,
    eventId: event.id,
    units,
  };
}

/** Menempatkan pengguna pada jabatan organogram. */
export async function placeAt(db: TestDb, positionId: string, userId: string) {
  await db
    .insert(schema.placement)
    .values({ positionId, userId, source: 'manual' });
}
