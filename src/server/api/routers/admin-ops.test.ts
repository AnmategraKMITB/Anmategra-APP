import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Daftar email darurat dibuat tetap agar tes tidak bergantung pada .env.
vi.mock('~/env', () => ({
  env: { SUPERADMIN_EMAILS: ['darurat@test.local'], APP_ENV: 'development' },
}));

import { createCallerFactory } from '~/server/api/trpc';
import {
  adminAudit,
  adminPermission,
  alumniPending,
  lembaga,
  mahasiswa,
  users,
  verifiedUsers,
} from '~/server/db/schema';
import { createTestDb, createUser, resetDb } from '~/test/test-db';

import { adminRouter } from './admin';
import { adminConsoleRouter } from './admin-console';
import { adminOpsRouter } from './admin-ops';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
  await db.execute(sql`TRUNCATE TABLE ${verifiedUsers}, ${alumniPending}`);
});
afterAll(async () => {
  await close();
});

type Role = 'mahasiswa' | 'lembaga' | 'admin';

function ctxFor(actor: { id: string; role: Role } | null) {
  return {
    db,
    session: actor ? { user: { ...actor }, expires: '' } : null,
    headers: new Headers(),
  } as never;
}
const ops = (actor: { id: string; role: Role } | null) =>
  createCallerFactory(adminOpsRouter)(ctxFor(actor));
const console_ = (actor: { id: string; role: Role } | null) =>
  createCallerFactory(adminConsoleRouter)(ctxFor(actor));
const legacy = (actor: { id: string; role: Role } | null) =>
  createCallerFactory(adminRouter)(ctxFor(actor));

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
    return 'OK';
  } catch (error) {
    return (error as { code?: string }).code ?? 'ERROR';
  }
}

async function makeSuperadmin(email?: string) {
  const user = await createUser(db, { role: 'admin', ...(email ? { email } : {}) });
  return { id: user.id, role: 'admin' as const, email: user.email };
}

async function makeOperator(permissions: string[]) {
  const user = await createUser(db, { role: 'mahasiswa' });
  await db.insert(adminPermission).values({ userId: user.id, permissions });
  return { id: user.id, role: 'mahasiswa' as const };
}

async function auditActions() {
  const rows = await db.select({ action: adminAudit.action }).from(adminAudit);
  return rows.map((row) => row.action);
}

describe('otorisasi kelola Superadmin', () => {
  it('Operator dengan semua izin tetap ditolak', async () => {
    const op = await makeOperator(['accounts.write', 'accounts.roles', 'access.write']);
    const target = await createUser(db);
    expect(await codeOf(ops(op).superadminList())).toBe('FORBIDDEN');
    expect(
      await codeOf(
        ops(op).superadminAdd({ identifier: target.email, confirmEmail: target.email }),
      ),
    ).toBe('FORBIDDEN');
  });

  it('anonim ditolak 401, lembaga dan mahasiswa 403', async () => {
    expect(await codeOf(ops(null).superadminList())).toBe('UNAUTHORIZED');
    const user = await createUser(db, { role: 'lembaga' });
    expect(await codeOf(ops({ id: user.id, role: 'lembaga' }).superadminList())).toBe(
      'FORBIDDEN',
    );
  });

  it('token admin lama ditolak bila peran di basis data sudah diturunkan', async () => {
    const stale = await createUser(db, { role: 'mahasiswa' });
    expect(await codeOf(ops({ id: stale.id, role: 'admin' }).superadminList())).toBe(
      'FORBIDDEN',
    );
  });

  it('Superadmin berhasil menambah, tercatat di audit', async () => {
    const actor = await makeSuperadmin();
    const target = await createUser(db);
    expect(
      await codeOf(
        ops(actor).superadminAdd({ identifier: target.email, confirmEmail: target.email }),
      ),
    ).toBe('OK');
    const [row] = await db.select().from(users).where(eq(users.id, target.id));
    expect(row?.role).toBe('admin');
    expect(await auditActions()).toContain('superadmin_add');
  });

  it('menambah tanpa mengetik ulang email yang benar ditolak', async () => {
    const actor = await makeSuperadmin();
    const target = await createUser(db);
    expect(
      await codeOf(ops(actor).superadminAdd({ identifier: target.email, confirmEmail: 'salah@x.id' })),
    ).toBe('BAD_REQUEST');
    const [row] = await db.select().from(users).where(eq(users.id, target.id));
    expect(row?.role).toBe('mahasiswa');
  });
});

describe('menurunkan Superadmin', () => {
  it('tidak boleh menurunkan diri sendiri', async () => {
    const actor = await makeSuperadmin();
    expect(
      await codeOf(ops(actor).superadminRemove({ userId: actor.id, confirmEmail: actor.email })),
    ).toBe('BAD_REQUEST');
  });

  it('akun darurat tidak dapat diturunkan', async () => {
    const actor = await makeSuperadmin();
    const emergency = await makeSuperadmin('darurat@test.local');
    expect(
      await codeOf(
        ops(actor).superadminRemove({ userId: emergency.id, confirmEmail: emergency.email }),
      ),
    ).toBe('FORBIDDEN');
  });

  it('berhasil dengan konfirmasi benar dan tercatat', async () => {
    const actor = await makeSuperadmin();
    const target = await makeSuperadmin();
    expect(
      await codeOf(ops(actor).superadminRemove({ userId: target.id, confirmEmail: 'x@y.id' })),
    ).toBe('BAD_REQUEST');
    expect(
      await codeOf(
        ops(actor).superadminRemove({ userId: target.id, confirmEmail: target.email.toUpperCase() }),
      ),
    ).toBe('OK');
    const [row] = await db.select().from(users).where(eq(users.id, target.id));
    expect(row?.role).toBe('mahasiswa');
    expect(await auditActions()).toContain('superadmin_remove');
  });
});

describe('userUpdate tidak lagi membuka eskalasi ke Superadmin', () => {
  it('Operator accounts.roles tidak bisa menjadikan siapa pun Superadmin', async () => {
    const op = await makeOperator(['accounts.write', 'accounts.roles']);
    const target = await createUser(db);
    expect(
      await codeOf(
        console_(op).userUpdate({ userId: target.id, role: 'admin', confirmEmail: target.email }),
      ),
    ).toBe('FORBIDDEN');
    expect(
      await codeOf(
        console_(op).userUpdate({ userId: op.id, role: 'admin', confirmEmail: 'x@y.id' }),
      ),
    ).toBe('FORBIDDEN');
  });

  it('Operator tidak bisa mengubah email atau role Superadmin', async () => {
    const op = await makeOperator(['accounts.write', 'accounts.roles']);
    const admin = await makeSuperadmin();
    expect(
      await codeOf(console_(op).userUpdate({ userId: admin.id, email: 'ambil@alih.id' })),
    ).toBe('FORBIDDEN');
    expect(
      await codeOf(
        console_(op).userUpdate({ userId: admin.id, role: 'mahasiswa', confirmEmail: admin.email }),
      ),
    ).toBe('FORBIDDEN');
  });

  it('perubahan role wajib mengetik ulang email', async () => {
    const op = await makeOperator(['accounts.write', 'accounts.roles']);
    const target = await createUser(db);
    expect(
      await codeOf(console_(op).userUpdate({ userId: target.id, role: 'lembaga' })),
    ).toBe('BAD_REQUEST');
    expect(
      await codeOf(
        console_(op).userUpdate({ userId: target.id, role: 'lembaga', confirmEmail: target.email }),
      ),
    ).toBe('OK');
  });
});

describe('buat lembaga', () => {
  const input = { name: 'HMIF', type: 'Himpunan' as const, acronym: 'HMIF', email: 'hmif@gmail.com' };

  it('mahasiswa dan Operator tanpa lembaga.write ditolak', async () => {
    const student = await createUser(db);
    expect(await codeOf(ops({ id: student.id, role: 'mahasiswa' }).lembagaCreate(input))).toBe(
      'FORBIDDEN',
    );
    const op = await makeOperator(['accounts.write']);
    expect(await codeOf(ops(op).lembagaCreate(input))).toBe('FORBIDDEN');
  });

  it('Operator lembaga.write membuat akun, lembaga, dan email terverifikasi sekaligus', async () => {
    const op = await makeOperator(['lembaga.write']);
    const created = await ops(op).lembagaCreate(input);
    const [account] = await db.select().from(users).where(eq(users.email, input.email));
    expect(account?.role).toBe('lembaga');
    const [row] = await db.select().from(lembaga).where(eq(lembaga.id, created.id));
    expect(row?.userId).toBe(account?.id);
    const verified = await db.select().from(verifiedUsers).where(eq(verifiedUsers.email, input.email));
    expect(verified).toHaveLength(1);
    expect(await auditActions()).toContain('lembaga_create');
  });

  it('email yang sudah dipakai ditolak tanpa membuat data setengah jadi', async () => {
    const op = await makeOperator(['lembaga.write']);
    await ops(op).lembagaCreate(input);
    expect(await codeOf(ops(op).lembagaCreate(input))).toBe('CONFLICT');
    expect(await db.select().from(lembaga)).toHaveLength(1);
  });
});

describe('email terverifikasi', () => {
  it('butuh accounts.write', async () => {
    const op = await makeOperator(['accounts.read']);
    expect(await codeOf(ops(op).verifiedEmailAdd({ email: 'a@gmail.com' }))).toBe('FORBIDDEN');
    expect(await codeOf(ops(op).verifiedEmailList())).toBe('FORBIDDEN');
  });

  it('tambah, duplikat, hapus; akun pemilik email tidak ikut terhapus', async () => {
    const op = await makeOperator(['accounts.write']);
    const owner = await createUser(db, { email: 'owner@gmail.com' });
    await ops(op).verifiedEmailAdd({ email: 'Owner@Gmail.com' });
    expect(await codeOf(ops(op).verifiedEmailAdd({ email: 'owner@gmail.com' }))).toBe('CONFLICT');
    await ops(op).verifiedEmailRemove({ email: 'owner@gmail.com' });
    expect(await db.select().from(verifiedUsers)).toHaveLength(0);
    expect(await db.select().from(users).where(eq(users.id, owner.id))).toHaveLength(1);
    expect(await codeOf(ops(op).verifiedEmailRemove({ email: 'owner@gmail.com' }))).toBe('NOT_FOUND');
    expect(await auditActions()).toEqual(
      expect.arrayContaining(['verified_email_add', 'verified_email_remove']),
    );
  });
});

describe('impor alumni', () => {
  it('butuh alumni.write', async () => {
    const op = await makeOperator(['accounts.write']);
    expect(await codeOf(legacy(op).uploadAlumniCsv({ nims: [13523001] }))).toBe('FORBIDDEN');
    const student = await createUser(db);
    expect(
      await codeOf(legacy({ id: student.id, role: 'mahasiswa' }).uploadAlumniCsv({ nims: [13523001] })),
    ).toBe('FORBIDDEN');
  });

  it('Operator alumni.write menandai alumni, sisanya pending, dan tercatat', async () => {
    const op = await makeOperator(['alumni.write']);
    const student = await createUser(db);
    await db.insert(mahasiswa).values({
      userId: student.id,
      nim: 13523001,
      jurusan: 'Teknik Informatika',
      angkatan: 2023,
    });
    const result = await legacy(op).uploadAlumniCsv({ nims: [13523001, 13523002] });
    expect(result).toMatchObject({ updatedCount: 1, pendingCount: 1 });
    const [m] = await db.select().from(mahasiswa).where(eq(mahasiswa.userId, student.id));
    expect(m?.status).toBe('alumni');
    expect(await auditActions()).toContain('alumni_import');
  });

  it('NIM bukan 8 digit ditolak', async () => {
    const actor = await makeSuperadmin();
    expect(await codeOf(legacy(actor).uploadAlumniCsv({ nims: [123] }))).toBe('BAD_REQUEST');
  });
});
