import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '~/server/db/schema';
import {
  addMembership,
  createEvent,
  createLembaga,
  createMahasiswa,
  createTestDb,
  createUser,
  placeInEvent,
  resetDb,
} from '~/test/test-db';

import {
  GabungAkunError,
  adoptTpbPlaceholder,
  findTpbCandidates,
  linkTpbFromMicrosoft,
  mergeUsers,
  rebadgePlaceholder,
  tpbNimFromProxyAddresses,
} from './gabung-akun';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

/** Akun yang dipakai login Microsoft (punya baris account). */
async function loggedIn(nim: number, name: string) {
  const user = await createUser(db, {
    email: `${nim}@mahasiswa.itb.ac.id`,
    name,
  });
  await createMahasiswa(db, user.id, { nim, nama: name });
  await db.insert(schema.accounts).values({
    userId: user.id,
    type: 'oauth',
    provider: 'azure-ad',
    providerAccountId: `oid-${nim}`,
  });
  return user;
}

/** Akun hasil impor yang belum pernah login. */
async function placeholder(nim: number, name: string) {
  const user = await createUser(db, {
    email: `${nim}@mahasiswa.itb.ac.id`,
    name,
  });
  await createMahasiswa(db, user.id, { nim, nama: name });
  return user;
}

const userExists = async (id: string) =>
  (await db.select().from(schema.users).where(eq(schema.users.id, id))).length >
  0;

describe('mergeUsers', () => {
  it('memindahkan jabatan dan keanggotaan, mencatat nim_tpb, menghapus placeholder', async () => {
    const tpb = await placeholder(19625221, 'Faiz Fadhillah');
    const real = await loggedIn(18225020, 'Faiz Fadhillah');
    const owner = await createUser(db, { role: 'lembaga' });
    const lembaga = await createLembaga(db, owner.id);
    const event = await createEvent(db, lembaga.id);
    await placeInEvent(db, event.id, tpb.id);
    await addMembership(db, lembaga.id, tpb.id);
    await addMembership(db, lembaga.id, real.id);

    const report = await db.transaction((tx) =>
      mergeUsers(tx, tpb.id, real.id),
    );

    expect(report.moved['anmategra_placement.user_id']).toBe(1);
    // Keanggotaan ganda di lembaga yang sama: satu dibuang.
    expect(report.dropped['anmategra_lembaga_membership.user_id']).toBe(1);
    expect(await userExists(tpb.id)).toBe(false);
    const placements = await db
      .select()
      .from(schema.placement)
      .where(eq(schema.placement.userId, real.id));
    expect(placements).toHaveLength(1);
    const [mhs] = await db
      .select()
      .from(schema.mahasiswa)
      .where(eq(schema.mahasiswa.userId, real.id));
    expect(mhs).toMatchObject({ nim: 18225020, nimTpb: 19625221 });
  });

  it('menolak menggabung akun yang pernah login', async () => {
    const a = await loggedIn(18225020, 'A');
    const b = await loggedIn(13525096, 'B');
    await expect(
      db.transaction((tx) => mergeUsers(tx, a.id, b.id)),
    ).rejects.toBeInstanceOf(GabungAkunError);
    expect(await userExists(a.id)).toBe(true);
  });
});

describe('rebadgePlaceholder', () => {
  it('mengganti identitas placeholder ke NIM jurusan', async () => {
    const tpb = await placeholder(16325024, 'Kenzo');
    await db.transaction((tx) => rebadgePlaceholder(tx, tpb.id, 12025048));
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, tpb.id));
    expect(user?.email).toBe('12025048@mahasiswa.itb.ac.id');
    const [mhs] = await db
      .select()
      .from(schema.mahasiswa)
      .where(eq(schema.mahasiswa.userId, tpb.id));
    expect(mhs).toMatchObject({
      nim: 12025048,
      nimTpb: 16325024,
      angkatan: 2025,
    });
  });

  it('menolak bila akun NIM jurusan sudah ada', async () => {
    const tpb = await placeholder(19625221, 'Faiz');
    await loggedIn(18225020, 'Faiz');
    await expect(
      db.transaction((tx) => rebadgePlaceholder(tx, tpb.id, 18225020)),
    ).rejects.toBeInstanceOf(GabungAkunError);
  });
});

describe('findTpbCandidates', () => {
  it('mencocokkan nama, angkatan, dan fakultas yang unik', async () => {
    const tpb = await placeholder(19625221, 'Muhammad Faiz  Fadhillah');
    const real = await loggedIn(18225020, 'MUHAMMAD FAIZ FADHILLAH');
    // Fakultas berbeda (TPB FTTM vs STI): tidak dicocokkan.
    await placeholder(16425001, 'Raka Pratama');
    await loggedIn(18225099, 'Raka Pratama');

    const { pairs } = await findTpbCandidates(db);
    expect(pairs).toEqual([
      expect.objectContaining({
        placeholder: expect.objectContaining({ userId: tpb.id }),
        target: expect.objectContaining({ userId: real.id }),
        reason: 'nama',
      }),
    ]);
  });

  it('nama kembar dianggap ambigu, tidak dipasangkan', async () => {
    await placeholder(19625001, 'Budi Santoso');
    await placeholder(19625002, 'Budi Santoso');
    await loggedIn(18225003, 'Budi Santoso');
    const { pairs, ambiguous } = await findTpbCandidates(db);
    expect(pairs).toHaveLength(0);
    expect(ambiguous).toHaveLength(2);
  });
});

describe('adoptTpbPlaceholder', () => {
  it('menggabung placeholder yang tercatat sebagai nim_tpb saat login', async () => {
    const tpb = await placeholder(19625221, 'Faiz');
    const real = await loggedIn(18225020, 'Faiz');
    await db
      .update(schema.mahasiswa)
      .set({ nimTpb: 19625221 })
      .where(eq(schema.mahasiswa.userId, real.id));

    const report = await adoptTpbPlaceholder(db as never, real.id);
    expect(report?.fromUserId).toBe(tpb.id);
    expect(await userExists(tpb.id)).toBe(false);
  });

  it('tanpa nim_tpb tidak melakukan apa pun', async () => {
    const tpb = await placeholder(19625221, 'Faiz');
    const real = await loggedIn(18225020, 'Faiz');
    expect(await adoptTpbPlaceholder(db as never, real.id)).toBeNull();
    expect(await userExists(tpb.id)).toBe(true);
  });
});

describe('tpbNimFromProxyAddresses', () => {
  it('membaca NIM TPB dari alias email Microsoft', () => {
    expect(
      tpbNimFromProxyAddresses(
        [
          'smtp:19625221@mahasiswa.itb.ac.id',
          'SMTP:18225020@mahasiswa.itb.ac.id',
          'smtp:19625221@itbdsti.onmicrosoft.com',
        ],
        18225020,
      ),
    ).toBe(19625221);
  });

  it('mengabaikan alias non-TPB, NIM sendiri, dan alias ganda yang berbeda', () => {
    expect(
      tpbNimFromProxyAddresses(['smtp:13525096@mahasiswa.itb.ac.id'], 18225020),
    ).toBeNull();
    expect(
      tpbNimFromProxyAddresses(['SMTP:18225020@mahasiswa.itb.ac.id'], 18225020),
    ).toBeNull();
    expect(
      tpbNimFromProxyAddresses(
        [
          'smtp:19625221@mahasiswa.itb.ac.id',
          'smtp:16325024@mahasiswa.itb.ac.id',
        ],
        18225020,
      ),
    ).toBeNull();
    expect(tpbNimFromProxyAddresses(null, 18225020)).toBeNull();
  });
});

describe('linkTpbFromMicrosoft', () => {
  it('mencatat nim_tpb dari alias lalu menggabung placeholder TPB', async () => {
    const tpb = await placeholder(19625221, 'Faiz');
    const real = await loggedIn(18225020, 'Faiz');

    const report = await linkTpbFromMicrosoft(db as never, real.id, [
      'smtp:19625221@mahasiswa.itb.ac.id',
      'SMTP:18225020@mahasiswa.itb.ac.id',
    ]);

    expect(report?.fromUserId).toBe(tpb.id);
    expect(await userExists(tpb.id)).toBe(false);
    const [mhs] = await db
      .select()
      .from(schema.mahasiswa)
      .where(eq(schema.mahasiswa.userId, real.id));
    expect(mhs?.nimTpb).toBe(19625221);
  });

  it('tanpa alias TPB tidak mengubah apa pun', async () => {
    const tpb = await placeholder(19625221, 'Faiz');
    const real = await loggedIn(18225020, 'Faiz');
    expect(await linkTpbFromMicrosoft(db as never, real.id, null)).toBeNull();
    expect(await userExists(tpb.id)).toBe(true);
  });
});
