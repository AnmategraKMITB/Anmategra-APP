import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/env', () => ({
  env: { SUPERADMIN_EMAILS: [], APP_ENV: 'development' },
}));

import { createCallerFactory } from '~/server/api/trpc';
import { altLoginRouter } from '~/server/api/routers/alt-login';
import { altLoginClaim, mahasiswa, users } from '~/server/db/schema';
import { createTestDb, createUser, resetDb } from '~/test/test-db';

import {
  AltClaimError,
  approveAltClaim,
  createAltClaim,
  resolveAltAccess,
  revokeAltClaimsForUser,
  verifyClaimSecret,
} from './alt-login';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

const ktm = { itemId: 'x', name: 'ktm.jpg' };
const base = { ktm, ip: '1.1.1.1' };

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
    return 'OK';
  } catch (error) {
    return error instanceof AltClaimError ? error.code : 'ERROR';
  }
}

const claimFor = (nim: string, contactEmail = 'a@gmail.com', ownClaimId?: string) =>
  createAltClaim({ ...base, contactEmail, nim, ownClaimId }, db);

describe('klaim akses alternatif', () => {
  it('NIM baru dibuatkan akun dengan email kanonik, tanpa emailVerified', async () => {
    const { claim } = await claimFor('13522001', 'Budi@gmail.com');
    const [user] = await db.select().from(users).where(eq(users.id, claim.userId));
    expect(user?.email).toBe('13522001@mahasiswa.itb.ac.id');
    expect(user?.emailVerified).toBeNull();
    const [m] = await db.select().from(mahasiswa).where(eq(mahasiswa.userId, claim.userId));
    expect(m?.nim).toBe(13522001);
    expect(claim.contactEmail).toBe('budi@gmail.com');
    expect((await resolveAltAccess(claim.id, db)).kind).toBe('claim');
  });

  it('memakai akun mahasiswa yang sudah ada berdasarkan NIM', async () => {
    const existing = await createUser(db, { role: 'mahasiswa' });
    await db.insert(mahasiswa).values({
      userId: existing.id,
      nim: 13522002,
      jurusan: 'TPB',
      angkatan: 2022,
    });
    const { claim } = await claimFor('13522002');
    expect(claim.userId).toBe(existing.id);
  });

  it('menolak akun admin atau lembaga', async () => {
    const admin = await createUser(db, { role: 'admin' });
    await db.insert(mahasiswa).values({
      userId: admin.id,
      nim: 13522003,
      jurusan: 'TPB',
      angkatan: 2022,
    });
    expect(await errorCode(claimFor('13522003'))).toBe('akun_khusus');
  });

  it('validasi NIM dan KTM', async () => {
    expect(await errorCode(claimFor('123'))).toBe('nim_invalid');
    expect(
      await errorCode(
        createAltClaim({ ...base, ktm: null, contactEmail: 'a@gmail.com', nim: '13522004' }, db),
      ),
    ).toBe('ktm_missing');
  });
});

describe('rahasia klaim', () => {
  it('hanya pemegang rahasia yang bisa masuk; hash tersimpan, bukan rahasianya', async () => {
    const { claim, secret } = await claimFor('13522030');
    expect(claim.secretHash).not.toContain(secret);
    expect(await verifyClaimSecret(claim.id, secret, db)).not.toBeNull();
    expect(await verifyClaimSecret(claim.id, 'salah', db)).toBeNull();
    expect(await verifyClaimSecret(claim.id, '', db)).toBeNull();
    expect(await verifyClaimSecret('tidak-ada', secret, db)).toBeNull();
  });

  it('email yang sama tidak mewarisi akses klaim orang lain', async () => {
    const { claim } = await claimFor('13522031', 'korban@gmail.com');
    // Penyerang mengetik email yang sama, tetapi tidak punya rahasia klaim.
    const attacker = await claimFor('13522032', 'korban@gmail.com');
    expect(attacker.claim.id).not.toBe(claim.id);
    expect(await verifyClaimSecret(claim.id, attacker.secret, db)).toBeNull();
  });

  it('klaim yang dicabut tidak bisa dipakai masuk', async () => {
    const { claim, secret } = await claimFor('13522033');
    await revokeAltClaimsForUser(claim.userId, 'login-microsoft', db);
    expect(await verifyClaimSecret(claim.id, secret, db)).toBeNull();
    expect((await resolveAltAccess(claim.id, db)).kind).toBe('guest');
  });
});

describe('sengketa', () => {
  it('NIM yang sama diajukan lagi: semua pihak ditahan sampai admin memutuskan', async () => {
    const first = await claimFor('13522005', 'first@gmail.com');
    expect((await resolveAltAccess(first.claim.id, db)).kind).toBe('claim');

    const second = await claimFor('13522005', 'second@gmail.com');
    expect(second.claim.disputed).toBe(true);
    expect((await resolveAltAccess(first.claim.id, db)).kind).toBe('pending');
    expect((await resolveAltAccess(second.claim.id, db)).kind).toBe('pending');

    const admin = await createUser(db, { role: 'admin' });
    expect(await approveAltClaim(second.claim.id, admin.id, db)).not.toBeNull();
    const winner = await resolveAltAccess(second.claim.id, db);
    expect(winner.kind).toBe('claim');
    // masa 6 jam dihitung ulang sejak disetujui
    expect(
      winner.kind === 'claim' && winner.expiresAt.getTime() - Date.now(),
    ).toBeGreaterThan(5.9 * 3600_000);
    expect((await resolveAltAccess(first.claim.id, db)).kind).toBe('guest');
    // sudah diputuskan: tidak bisa disetujui dua kali
    expect(await approveAltClaim(second.claim.id, admin.id, db)).toBeNull();
  });

  it('mengetik email yang sama tidak menghindari deteksi sengketa', async () => {
    await claimFor('13522040', 'sama@gmail.com');
    const again = await claimFor('13522040', 'sama@gmail.com');
    expect(again.claim.disputed).toBe(true);
  });

  it('perpanjangan oleh pemegang klaim lama tidak dianggap sengketa', async () => {
    const first = await claimFor('13522041', 'a@gmail.com');
    await db
      .update(altLoginClaim)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(altLoginClaim.id, first.claim.id));
    const renewed = await claimFor('13522041', 'a@gmail.com', first.claim.id);
    expect(renewed.claim.disputed).toBe(false);
    expect((await resolveAltAccess(renewed.claim.id, db)).kind).toBe('claim');
  });

  it('klaim biasa tidak bisa disetujui lewat jalur sengketa', async () => {
    const { claim } = await claimFor('13522020');
    const admin = await createUser(db, { role: 'admin' });
    expect(await approveAltClaim(claim.id, admin.id, db)).toBeNull();
  });
});

describe('batas dan masa berlaku', () => {
  it('membatasi 3 pengajuan per email per hari', async () => {
    for (const nim of ['13522010', '13522011', '13522012']) {
      await claimFor(nim, 'a@gmail.com');
    }
    expect(await errorCode(claimFor('13522013', 'a@gmail.com'))).toBe('rate_email');
  });

  it('klaim kedaluwarsa tidak berlaku', async () => {
    const { claim } = await claimFor('13522008');
    await db
      .update(altLoginClaim)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(altLoginClaim.id, claim.id));
    expect((await resolveAltAccess(claim.id, db)).kind).toBe('guest');
  });

  it('login Microsoft mencabut klaim aktif', async () => {
    const { claim } = await claimFor('13522009');
    await revokeAltClaimsForUser(claim.userId, 'login-microsoft', db);
    expect((await resolveAltAccess(claim.id, db)).kind).toBe('guest');
  });
});

describe('tRPC', () => {
  const callerFor = (alt: 'guest' | 'claim') =>
    createCallerFactory(altLoginRouter)({
      db,
      session: {
        user: { id: 'u', role: 'mahasiswa', email: 'a@gmail.com', alt },
        expires: '',
      },
      headers: new Headers(),
    } as never);

  it('sesi alternatif ditolak di prosedur tanpa penanda alt', async () => {
    for (const alt of ['guest', 'claim'] as const) {
      await expect(
        callerFor(alt).adminList({ onlyActive: false, limit: 10 }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });

  it('claim bisa dipanggil tanpa login dan mengembalikan rahasia', async () => {
    const caller = createCallerFactory(altLoginRouter)({
      db,
      session: null,
      headers: new Headers({ 'x-forwarded-for': '9.9.9.9' }),
    } as never);
    const result = await caller.claim({
      email: 'Orang@Gmail.com',
      nim: '13522050',
      declaration: true,
      ktm: {
        itemId: 'x',
        driveId: 'google-drive',
        name: 'ktm.jpg',
        size: 1000,
        mime: 'image/jpeg',
        url: 'https://drive.google.com/file/d/abc/view',
        scope: 'anyone',
      },
    });
    expect(await verifyClaimSecret(result.claimId, result.secret, db)).not.toBeNull();
    const [row] = await db.select().from(altLoginClaim).where(eq(altLoginClaim.id, result.claimId));
    expect(row?.contactEmail).toBe('orang@gmail.com');
    expect(row?.ip).toBe('9.9.9.9');
  });
});
