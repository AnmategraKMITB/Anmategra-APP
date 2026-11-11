import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { lembaga } from '~/server/db/schema';
import {
  type TestDb,
  createEvent,
  createLembaga,
  createOperator,
  createTestDb,
  createUser,
  grantAccess,
  resetDb,
} from '~/test/test-db';

import { canManageEvent, canManageLembaga } from './access';

const { db, close } = createTestDb();
// Tipe database sama dengan yang diterima fungsi produksi; yang berbeda hanya koneksinya.
const database = db as unknown as Parameters<typeof canManageLembaga>[0];

beforeAll(async () => {
  await resetDb(db);
});
beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

/** Satu lembaga lengkap dengan akun pemiliknya (Account Role `lembaga`). */
async function makeLembaga(
  d: TestDb,
  over: Parameters<typeof createLembaga>[2] = {},
) {
  const owner = await createUser(d, { role: 'lembaga' });
  const l = await createLembaga(d, owner.id, over);
  return { owner, lembaga: l };
}

describe('canManageLembaga', () => {
  it('Superadmin (role admin) selalu lolos', async () => {
    const { lembaga: l } = await makeLembaga(db);
    const admin = await createUser(db, { role: 'admin' });
    expect(
      await canManageLembaga(database, admin.id, 'admin', null, l.id),
    ).toBe('admin');
  });

  it('Owner mengelola lembaganya sendiri', async () => {
    const { owner, lembaga: l } = await makeLembaga(db);
    expect(
      await canManageLembaga(database, owner.id, 'lembaga', l.id, l.id),
    ).toBe('owner');
  });

  it('Owner lembaga lain tidak mengelola lembaga ini', async () => {
    const a = await makeLembaga(db);
    const b = await makeLembaga(db);
    expect(
      await canManageLembaga(
        database,
        a.owner.id,
        'lembaga',
        a.lembaga.id,
        b.lembaga.id,
      ),
    ).toBeNull();
  });

  it('mahasiswa tanpa Grant ditolak', async () => {
    const { lembaga: l } = await makeLembaga(db);
    const student = await createUser(db);
    expect(
      await canManageLembaga(database, student.id, 'mahasiswa', null, l.id),
    ).toBeNull();
  });

  describe('Grant pada Scope lembaga', () => {
    it('Grant admin aktif memberi akses ke semua fitur', async () => {
      const { lembaga: l } = await makeLembaga(db);
      const student = await createUser(db);
      await grantAccess(db, { userId: student.id, lembagaId: l.id });
      for (const feature of [
        'admin',
        'oprec',
        'forms',
        'events',
        'organization',
      ] as const) {
        expect(
          await canManageLembaga(
            database,
            student.id,
            'mahasiswa',
            null,
            l.id,
            feature,
          ),
        ).toBe('admin');
      }
    });

    it('Grant terbatas hanya berlaku untuk fiturnya', async () => {
      const { lembaga: l } = await makeLembaga(db);
      const student = await createUser(db);
      await grantAccess(db, {
        userId: student.id,
        lembagaId: l.id,
        features: ['oprec'],
      });
      const check = (feature: 'admin' | 'oprec' | 'forms') =>
        canManageLembaga(database, student.id, 'mahasiswa', null, l.id, feature);
      expect(await check('oprec')).toBe('admin');
      expect(await check('forms')).toBeNull();
      expect(await check('admin')).toBeNull();
    });

    it('Grant yang dicabut tidak memberi akses', async () => {
      const { lembaga: l } = await makeLembaga(db);
      const student = await createUser(db);
      await grantAccess(db, {
        userId: student.id,
        lembagaId: l.id,
        status: 'revoked',
      });
      expect(
        await canManageLembaga(database, student.id, 'mahasiswa', null, l.id),
      ).toBeNull();
    });

    it('Grant satu lembaga tidak berlaku di lembaga lain (isolasi)', async () => {
      const a = await makeLembaga(db);
      const b = await makeLembaga(db);
      const student = await createUser(db);
      await grantAccess(db, { userId: student.id, lembagaId: a.lembaga.id });
      expect(
        await canManageLembaga(
          database,
          student.id,
          'mahasiswa',
          null,
          a.lembaga.id,
        ),
      ).toBe('admin');
      expect(
        await canManageLembaga(
          database,
          student.id,
          'mahasiswa',
          null,
          b.lembaga.id,
        ),
      ).toBeNull();
    });

    it('Grant milik akun lain tidak ikut berlaku', async () => {
      const { lembaga: l } = await makeLembaga(db);
      const holder = await createUser(db);
      const other = await createUser(db);
      await grantAccess(db, { userId: holder.id, lembagaId: l.id });
      expect(
        await canManageLembaga(database, other.id, 'mahasiswa', null, l.id),
      ).toBeNull();
    });
  });

  describe('propagasi ke sub-lembaga', () => {
    async function tree() {
      const owner = await createUser(db, { role: 'lembaga' });
      const parent = await createLembaga(db, owner.id, { name: 'Induk' });
      const child = await createLembaga(db, owner.id, {
        name: 'Anak',
        parentId: parent.id,
      });
      const grandchild = await createLembaga(db, owner.id, {
        name: 'Cucu',
        parentId: child.id,
      });
      return { parent, child, grandchild };
    }

    it('propagate=true menjangkau anak dan cucu', async () => {
      const { parent, child, grandchild } = await tree();
      const student = await createUser(db);
      await grantAccess(db, {
        userId: student.id,
        lembagaId: parent.id,
        propagate: true,
      });
      for (const target of [parent, child, grandchild]) {
        expect(
          await canManageLembaga(
            database,
            student.id,
            'mahasiswa',
            null,
            target.id,
          ),
        ).toBe('admin');
      }
    });

    it('propagate=false tidak menjangkau anak', async () => {
      const { parent, child } = await tree();
      const student = await createUser(db);
      await grantAccess(db, { userId: student.id, lembagaId: parent.id });
      expect(
        await canManageLembaga(
          database,
          student.id,
          'mahasiswa',
          null,
          child.id,
        ),
      ).toBeNull();
    });

    it('Grant pada anak tidak naik ke induk', async () => {
      const { parent, child } = await tree();
      const student = await createUser(db);
      await grantAccess(db, {
        userId: student.id,
        lembagaId: child.id,
        propagate: true,
      });
      expect(
        await canManageLembaga(
          database,
          student.id,
          'mahasiswa',
          null,
          parent.id,
        ),
      ).toBeNull();
    });

    it('siklus induk-anak tidak membuat penelusuran berputar tanpa henti', async () => {
      const owner = await createUser(db, { role: 'lembaga' });
      const a = await createLembaga(db, owner.id, { name: 'A' });
      const b = await createLembaga(db, owner.id, {
        name: 'B',
        parentId: a.id,
      });
      await db
        .update(lembaga)
        .set({ parentId: b.id })
        .where(eq(lembaga.id, a.id));
      const unrelated = await createLembaga(db, owner.id, { name: 'X' });
      const student = await createUser(db);
      await grantAccess(db, {
        userId: student.id,
        lembagaId: unrelated.id,
        propagate: true,
      });
      expect(
        await canManageLembaga(database, student.id, 'mahasiswa', null, a.id),
      ).toBeNull();
    });

    it('rantai yang lebih dalam dari batas penelusuran tidak terjangkau', async () => {
      const owner = await createUser(db, { role: 'lembaga' });
      const chain = [await createLembaga(db, owner.id, { name: 'L0' })];
      for (let i = 1; i <= 20; i++) {
        chain.push(
          await createLembaga(db, owner.id, {
            name: `L${i}`,
            parentId: chain[i - 1]!.id,
          }),
        );
      }
      const student = await createUser(db);
      await grantAccess(db, {
        userId: student.id,
        lembagaId: chain[0]!.id,
        propagate: true,
      });
      expect(
        await canManageLembaga(
          database,
          student.id,
          'mahasiswa',
          null,
          chain[5]!.id,
        ),
      ).toBe('admin');
      expect(
        await canManageLembaga(
          database,
          student.id,
          'mahasiswa',
          null,
          chain[20]!.id,
        ),
      ).toBeNull();
    });
  });

  describe('Operator (izin admin_permission)', () => {
    it('izin lembaga.organization berlaku untuk fitur organization di lembaga mana pun', async () => {
      const { lembaga: l } = await makeLembaga(db);
      const op = await createUser(db);
      await createOperator(db, op.id, ['lembaga.organization']);
      const check = (feature: 'organization' | 'events' | 'oprec' | 'admin') =>
        canManageLembaga(database, op.id, 'mahasiswa', null, l.id, feature);
      expect(await check('organization')).toBe('admin');
      expect(await check('events')).toBeNull();
      expect(await check('oprec')).toBeNull();
      expect(await check('admin')).toBeNull();
    });

    it('izin "*" hanya mencakup fitur organization dan events', async () => {
      const { lembaga: l } = await makeLembaga(db);
      const op = await createUser(db);
      await createOperator(db, op.id, ['*']);
      const check = (feature: 'organization' | 'events' | 'oprec' | 'forms') =>
        canManageLembaga(database, op.id, 'mahasiswa', null, l.id, feature);
      expect(await check('organization')).toBe('admin');
      expect(await check('events')).toBe('admin');
      // Perilaku saat ini: fitur lain tidak punya izin operator yang terpetakan.
      expect(await check('oprec')).toBeNull();
      expect(await check('forms')).toBeNull();
    });

    it('izin yang kedaluwarsa atau dicabut tidak berlaku', async () => {
      const { lembaga: l } = await makeLembaga(db);
      const expired = await createUser(db);
      await createOperator(db, expired.id, ['lembaga.organization'], {
        expiresAt: new Date(Date.now() - 60_000),
      });
      const revoked = await createUser(db);
      await createOperator(db, revoked.id, ['lembaga.organization'], {
        revokedAt: new Date(),
      });
      for (const u of [expired, revoked]) {
        expect(
          await canManageLembaga(
            database,
            u.id,
            'mahasiswa',
            null,
            l.id,
            'organization',
          ),
        ).toBeNull();
      }
    });

    it('izin yang belum kedaluwarsa tetap berlaku', async () => {
      const { lembaga: l } = await makeLembaga(db);
      const op = await createUser(db);
      await createOperator(db, op.id, ['lembaga.organization'], {
        expiresAt: new Date(Date.now() + 3_600_000),
      });
      expect(
        await canManageLembaga(
          database,
          op.id,
          'mahasiswa',
          null,
          l.id,
          'organization',
        ),
      ).toBe('admin');
    });

    it('akun ber-role lembaga tidak memakai jalur izin operator', async () => {
      const a = await makeLembaga(db);
      const b = await makeLembaga(db);
      await createOperator(db, a.owner.id, ['lembaga.organization']);
      expect(
        await canManageLembaga(
          database,
          a.owner.id,
          'lembaga',
          a.lembaga.id,
          b.lembaga.id,
          'organization',
        ),
      ).toBeNull();
    });
  });
});

describe('canManageEvent', () => {
  it('Superadmin lolos', async () => {
    const admin = await createUser(db, { role: 'admin' });
    const { lembaga: l } = await makeLembaga(db);
    const e = await createEvent(db, l.id);
    expect(await canManageEvent(database, admin.id, 'admin', null, e.id)).toBe(
      'admin',
    );
  });

  it('kegiatan yang tidak ada ditolak untuk non-Superadmin', async () => {
    const student = await createUser(db);
    expect(
      await canManageEvent(
        database,
        student.id,
        'mahasiswa',
        null,
        crypto.randomUUID(),
      ),
    ).toBeNull();
  });

  it('Owner mengelola kegiatan milik lembaganya', async () => {
    const { owner, lembaga: l } = await makeLembaga(db);
    const e = await createEvent(db, l.id);
    expect(
      await canManageEvent(database, owner.id, 'lembaga', l.id, e.id),
    ).toBe('owner');
  });

  it('Owner tidak mengelola kegiatan lembaga lain', async () => {
    const a = await makeLembaga(db);
    const b = await makeLembaga(db);
    const e = await createEvent(db, b.lembaga.id);
    expect(
      await canManageEvent(database, a.owner.id, 'lembaga', a.lembaga.id, e.id),
    ).toBeNull();
  });

  it('Grant admin pada lembaga berlaku untuk kegiatan di bawahnya', async () => {
    const { lembaga: l } = await makeLembaga(db);
    const e = await createEvent(db, l.id);
    const student = await createUser(db);
    await grantAccess(db, { userId: student.id, lembagaId: l.id });
    expect(
      await canManageEvent(database, student.id, 'mahasiswa', null, e.id),
    ).toBe('admin');
  });

  it('Grant lembaga terbatas hanya berlaku untuk fiturnya', async () => {
    const { lembaga: l } = await makeLembaga(db);
    const e = await createEvent(db, l.id);
    const student = await createUser(db);
    await grantAccess(db, {
      userId: student.id,
      lembagaId: l.id,
      features: ['oprec'],
    });
    expect(
      await canManageEvent(database, student.id, 'mahasiswa', null, e.id, 'oprec'),
    ).toBe('admin');
    expect(
      await canManageEvent(database, student.id, 'mahasiswa', null, e.id, 'forms'),
    ).toBeNull();
  });

  describe('Grant pada Scope kegiatan', () => {
    it('Grant terbatas hanya berlaku untuk fitur dan kegiatannya', async () => {
      const { lembaga: l } = await makeLembaga(db);
      const e1 = await createEvent(db, l.id, { name: 'E1' });
      const e2 = await createEvent(db, l.id, { name: 'E2' });
      const student = await createUser(db);
      await grantAccess(db, {
        userId: student.id,
        periodId: e1.id,
        features: ['oprec'],
      });
      const check = (
        eventId: string,
        feature: 'oprec' | 'forms' | 'admin',
      ) =>
        canManageEvent(database, student.id, 'mahasiswa', null, eventId, feature);
      expect(await check(e1.id, 'oprec')).toBe('admin');
      expect(await check(e1.id, 'forms')).toBeNull();
      expect(await check(e1.id, 'admin')).toBeNull();
      expect(await check(e2.id, 'oprec')).toBeNull();
    });

    it('Grant admin kegiatan mencakup semua fitur kegiatan itu saja', async () => {
      const { lembaga: l } = await makeLembaga(db);
      const e1 = await createEvent(db, l.id, { name: 'E1' });
      const e2 = await createEvent(db, l.id, { name: 'E2' });
      const student = await createUser(db);
      await grantAccess(db, { userId: student.id, periodId: e1.id });
      expect(
        await canManageEvent(database, student.id, 'mahasiswa', null, e1.id, 'forms'),
      ).toBe('admin');
      expect(
        await canManageEvent(database, student.id, 'mahasiswa', null, e2.id, 'forms'),
      ).toBeNull();
    });

    it('Grant kegiatan tidak memberi akses ke lembaganya', async () => {
      const { lembaga: l } = await makeLembaga(db);
      const e = await createEvent(db, l.id);
      const student = await createUser(db);
      await grantAccess(db, { userId: student.id, periodId: e.id });
      expect(
        await canManageLembaga(database, student.id, 'mahasiswa', null, l.id),
      ).toBeNull();
    });

    it('Grant yang dicabut tidak memberi akses', async () => {
      const { lembaga: l } = await makeLembaga(db);
      const e = await createEvent(db, l.id);
      const student = await createUser(db);
      await grantAccess(db, {
        userId: student.id,
        periodId: e.id,
        status: 'revoked',
      });
      expect(
        await canManageEvent(database, student.id, 'mahasiswa', null, e.id),
      ).toBeNull();
    });

    it('kegiatan tanpa lembaga hanya dikelola pemegang Grant kegiatan', async () => {
      const e = await createEvent(db, null);
      const holder = await createUser(db);
      const other = await createUser(db);
      await grantAccess(db, { userId: holder.id, periodId: e.id });
      expect(
        await canManageEvent(database, holder.id, 'mahasiswa', null, e.id),
      ).toBe('admin');
      expect(
        await canManageEvent(database, other.id, 'mahasiswa', null, e.id),
      ).toBeNull();
    });
  });

  it('Operator dengan izin lembaga.events mengelola fitur events kegiatan', async () => {
    const { lembaga: l } = await makeLembaga(db);
    const e = await createEvent(db, l.id);
    const op = await createUser(db);
    await createOperator(db, op.id, ['lembaga.events']);
    expect(
      await canManageEvent(database, op.id, 'mahasiswa', null, e.id, 'events'),
    ).toBe('admin');
    expect(
      await canManageEvent(database, op.id, 'mahasiswa', null, e.id, 'oprec'),
    ).toBeNull();
  });
});
