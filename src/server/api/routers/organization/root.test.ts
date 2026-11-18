import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import * as schema from '~/server/db/schema';
import {
  createEvent,
  createLembaga,
  createTestDb,
  createUser,
  resetDb,
} from '~/test/test-db';

import { organizationRouter } from '.';
import { upsertPlacementByText } from './membership';
import { ensureRootUnit, rootTypeLabel } from './root';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

const router = createTRPCRouter({ organization: organizationRouter });

async function setup(
  type: 'Himpunan' | 'Kepanitiaan',
  kind: 'kegiatan' | 'kepengurusan',
) {
  const owner = await createUser(db, { role: 'lembaga' });
  const lembaga = await createLembaga(db, owner.id, { type });
  const period = await createEvent(db, lembaga.id, {
    kind,
    name: 'Aku Masuk ITB 2027',
  });
  const caller = createCallerFactory(router)({
    db,
    session: {
      user: { id: owner.id, role: 'lembaga', lembagaId: lembaga.id },
      expires: '',
    },
    headers: new Headers(),
  } as never);
  return { owner, lembaga, period, caller };
}

const unitsOf = (structureId: string) =>
  db
    .select()
    .from(schema.organizationUnit)
    .where(eq(schema.organizationUnit.structure_id, structureId));

describe('rootTypeLabel', () => {
  it('kegiatan menjadi Kepanitiaan, kepengurusan memakai jenis lembaga', () => {
    expect(rootTypeLabel('kegiatan', 'Himpunan')).toBe('Kepanitiaan');
    expect(rootTypeLabel('kepengurusan', 'Himpunan')).toBe('Himpunan');
    expect(rootTypeLabel('kepengurusan', null)).toBeNull();
  });
});

describe('akar organogram', () => {
  it('organogram baru langsung punya satu akar di kedalaman 0', async () => {
    const { period, caller } = await setup('Kepanitiaan', 'kepengurusan');
    const { id } = await caller.organization.structure.create({
      periodId: period.id,
    });

    expect(await unitsOf(id)).toMatchObject([
      {
        parent_id: null,
        level: 0,
        name: 'Aku Masuk ITB 2027',
        typeLabel: 'Kepanitiaan',
      },
    ]);
  });

  it('ensureRootUnit memakai akar yang sudah ada', async () => {
    const { period, caller } = await setup('Himpunan', 'kegiatan');
    const { id } = await caller.organization.structure.create({
      periodId: period.id,
    });
    const [root] = await unitsOf(id);

    expect(await ensureRootUnit(db as never, id, period.id)).toBe(root!.id);
    expect(await unitsOf(id)).toHaveLength(1);
  });

  it('penempatan dari teks lama membuat bagian di bawah akar, bukan akar baru', async () => {
    const { period, owner } = await setup('Himpunan', 'kepengurusan');
    const member = await createUser(db);
    await upsertPlacementByText(db as never, {
      periodId: period.id,
      userId: member.id,
      division: 'Divisi Acara',
      position: 'Staf',
      createdBy: owner.id,
    });

    const [structure] = await db
      .select()
      .from(schema.organizationStructure)
      .where(eq(schema.organizationStructure.eventId, period.id));
    const roots = await db
      .select()
      .from(schema.organizationUnit)
      .where(
        and(
          eq(schema.organizationUnit.structure_id, structure!.id),
          isNull(schema.organizationUnit.parent_id),
        ),
      );
    expect(roots).toMatchObject([{ level: 0, typeLabel: 'Himpunan' }]);
    const acara = (await unitsOf(structure!.id)).find(
      (u) => u.name === 'Divisi Acara',
    );
    expect(acara).toMatchObject({ parent_id: roots[0]!.id, level: 1 });
  });

  it('database menolak akar yang tidak di kedalaman 0', async () => {
    const { period, caller } = await setup('Kepanitiaan', 'kepengurusan');
    const { id } = await caller.organization.structure.create({
      periodId: period.id,
    });
    await expect(
      db
        .insert(schema.organizationUnit)
        .values({ structure_id: id, name: 'Akar kedua', level: 1 }),
    ).rejects.toThrow();
  });
});
