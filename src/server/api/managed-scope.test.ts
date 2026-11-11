import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createEvent,
  createLembaga,
  createTestDb,
  createUser,
  grantAccess,
  resetDb,
} from '~/test/test-db';

import {
  hasManagedScope,
  listManagedEvents,
  listManagedLembaga,
} from './managed-scope';

const { db, close } = createTestDb();
const database = db as unknown as Parameters<typeof listManagedLembaga>[0];

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

async function makeLembaga(name = 'Lembaga Uji', parentId?: string) {
  const owner = await createUser(db, { role: 'lembaga' });
  const l = await createLembaga(db, owner.id, { name, parentId });
  return { owner, lembaga: l };
}

const student = async () => {
  const u = await createUser(db);
  return { id: u.id, role: 'mahasiswa' as const };
};

describe('listManagedLembaga', () => {
  it('kosong bagi mahasiswa tanpa Grant', async () => {
    await makeLembaga();
    expect(await listManagedLembaga(database, await student())).toEqual([]);
  });

  it('Owner melihat lembaganya sendiri dengan fitur admin', async () => {
    const { owner, lembaga: l } = await makeLembaga('Himpunan A');
    const result = await listManagedLembaga(database, {
      id: owner.id,
      role: 'lembaga',
      lembagaId: l.id,
    });
    expect(result).toEqual([
      {
        lembagaId: l.id,
        lembagaNama: 'Himpunan A',
        access: 'owner',
        features: ['admin'],
      },
    ]);
  });

  it('Admin Lembaga melihat lembaga yang dihibahkan, lengkap dengan fiturnya', async () => {
    const { lembaga: l } = await makeLembaga('Himpunan B');
    const user = await student();
    await grantAccess(db, {
      userId: user.id,
      lembagaId: l.id,
      features: ['oprec'],
    });
    expect(await listManagedLembaga(database, user)).toEqual([
      {
        lembagaId: l.id,
        lembagaNama: 'Himpunan B',
        access: 'admin',
        features: ['oprec'],
      },
    ]);
  });

  it('Grant yang dicabut tidak muncul', async () => {
    const { lembaga: l } = await makeLembaga();
    const user = await student();
    await grantAccess(db, {
      userId: user.id,
      lembagaId: l.id,
      status: 'revoked',
    });
    expect(await listManagedLembaga(database, user)).toEqual([]);
  });

  it('propagate menyertakan semua turunan, tanpa propagate hanya induknya', async () => {
    const parent = await makeLembaga('Induk');
    const child = await makeLembaga('Anak', parent.lembaga.id);
    const grandchild = await makeLembaga('Cucu', child.lembaga.id);

    const withPropagate = await student();
    await grantAccess(db, {
      userId: withPropagate.id,
      lembagaId: parent.lembaga.id,
      propagate: true,
    });
    expect(
      (await listManagedLembaga(database, withPropagate)).map(
        (l) => l.lembagaNama,
      ),
    ).toEqual(['Anak', 'Cucu', 'Induk']);

    const without = await student();
    await grantAccess(db, {
      userId: without.id,
      lembagaId: parent.lembaga.id,
    });
    expect(
      (await listManagedLembaga(database, without)).map((l) => l.lembagaNama),
    ).toEqual(['Induk']);
    expect(grandchild.lembaga.parentId).toBe(child.lembaga.id);
  });
});

describe('listManagedEvents', () => {
  it('Owner melihat kegiatan lembaganya, bukan kepengurusan', async () => {
    const { owner, lembaga: l } = await makeLembaga('Himpunan C');
    const kegiatan = await createEvent(db, l.id, { name: 'Seminar' });
    await createEvent(db, l.id, { name: 'Periode 2026', kind: 'kepengurusan' });
    const result = await listManagedEvents(database, {
      id: owner.id,
      role: 'lembaga',
      lembagaId: l.id,
    });
    expect(result).toEqual([
      {
        eventId: kegiatan.id,
        eventNama: 'Seminar',
        lembagaId: l.id,
        lembagaNama: 'Himpunan C',
        access: 'owner',
        features: ['admin'],
      },
    ]);
  });

  it('Admin Lembaga mewarisi kegiatan lembaga dengan fitur Grant-nya', async () => {
    const { lembaga: l } = await makeLembaga();
    const e = await createEvent(db, l.id);
    const user = await student();
    await grantAccess(db, {
      userId: user.id,
      lembagaId: l.id,
      features: ['forms'],
    });
    const result = await listManagedEvents(database, user);
    expect(result.map((r) => [r.eventId, r.features])).toEqual([
      [e.id, ['forms']],
    ]);
  });

  it('Grant kegiatan langsung muncul tanpa membuka kegiatan lain', async () => {
    const { lembaga: l } = await makeLembaga('Lembaga D');
    const e1 = await createEvent(db, l.id, { name: 'E1' });
    await createEvent(db, l.id, { name: 'E2' });
    const user = await student();
    await grantAccess(db, {
      userId: user.id,
      periodId: e1.id,
      features: ['oprec'],
    });
    const result = await listManagedEvents(database, user);
    expect(result).toEqual([
      {
        eventId: e1.id,
        eventNama: 'E1',
        lembagaId: l.id,
        lembagaNama: 'Lembaga D',
        access: 'admin',
        features: ['oprec'],
      },
    ]);
  });

  it('Grant lembaga dan kegiatan pada kegiatan yang sama digabung', async () => {
    const { lembaga: l } = await makeLembaga();
    const e = await createEvent(db, l.id);
    const user = await student();
    await grantAccess(db, {
      userId: user.id,
      lembagaId: l.id,
      features: ['forms'],
    });
    await grantAccess(db, {
      userId: user.id,
      periodId: e.id,
      features: ['oprec'],
    });
    const result = await listManagedEvents(database, user);
    expect(result).toHaveLength(1);
    expect([...result[0]!.features].sort()).toEqual(['forms', 'oprec']);
  });

  it('kosong bagi mahasiswa tanpa Grant', async () => {
    const { lembaga: l } = await makeLembaga();
    await createEvent(db, l.id);
    expect(await listManagedEvents(database, await student())).toEqual([]);
  });
});

describe('hasManagedScope', () => {
  it('benar untuk Owner dan pemegang Grant aktif, salah selain itu', async () => {
    const { lembaga: l } = await makeLembaga();
    const holder = await student();
    await grantAccess(db, { userId: holder.id, lembagaId: l.id });
    const revoked = await student();
    await grantAccess(db, {
      userId: revoked.id,
      lembagaId: l.id,
      status: 'revoked',
    });
    const none = await student();
    const owner = await createUser(db, { role: 'lembaga' });

    expect(await hasManagedScope(database, holder)).toBe(true);
    expect(await hasManagedScope(database, revoked)).toBe(false);
    expect(await hasManagedScope(database, none)).toBe(false);
    expect(
      await hasManagedScope(database, { id: owner.id, role: 'lembaga' }),
    ).toBe(true);
  });
});
