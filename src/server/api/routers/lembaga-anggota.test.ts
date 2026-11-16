import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createCallerFactory } from '~/server/api/trpc';
import { lembagaMembership, mahasiswa } from '~/server/db/schema';
import {
  createLembaga,
  createTestDb,
  createUser,
  grantAccess,
  resetDb,
} from '~/test/test-db';

import { lembagaRouter } from './lembaga';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

type Actor = {
  id: string;
  role: 'mahasiswa' | 'lembaga' | 'admin';
  lembagaId?: string;
} | null;

/** Pemanggil router lembaga dengan sesi buatan; basis data uji asli. */
function callerFor(actor: Actor) {
  const session = actor
    ? { user: { ...actor, lembagaId: actor.lembagaId }, expires: '' }
    : null;
  return createCallerFactory(lembagaRouter)({
    db,
    session,
    headers: new Headers(),
  } as never);
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
    return 'OK';
  } catch (error) {
    return (error as { code?: string }).code ?? 'ERROR';
  }
}

async function makeLembaga(name: string) {
  const owner = await createUser(db, { role: 'lembaga' });
  const l = await createLembaga(db, owner.id, { name });
  return {
    lembaga: l,
    owner: { id: owner.id, role: 'lembaga', lembagaId: l.id } as const,
  };
}

let nim = 13523000;
async function makeStudent() {
  const user = await createUser(db);
  nim += 1;
  await db
    .insert(mahasiswa)
    .values({ userId: user.id, nim, jurusan: 'Teknik Informatika', angkatan: 2023 });
  return user;
}

const isMember = async (lembagaId: string, userId: string) =>
  (
    await db
      .select({ id: lembagaMembership.userId })
      .from(lembagaMembership)
      .where(
        and(
          eq(lembagaMembership.lembagaId, lembagaId),
          eq(lembagaMembership.userId, userId),
          eq(lembagaMembership.status, 'aktif'),
        ),
      )
  ).length > 0;

describe('addAnggota: siapa boleh menambah anggota lembaga', () => {
  it('Owner menambah anggota ke lembaganya sendiri', async () => {
    const a = await makeLembaga('A');
    const student = await makeStudent();
    const result = await callerFor(a.owner).addAnggota({
      lembagaId: a.lembaga.id,
      user_id: student.id,
      division: 'Acara',
      position: 'Staf',
    });
    expect(result.success).toBe(true);
    expect(await isMember(a.lembaga.id, student.id)).toBe(true);
  });

  it('Owner tidak dapat menambah anggota ke lembaga lain', async () => {
    const a = await makeLembaga('A');
    const b = await makeLembaga('B');
    const student = await makeStudent();
    const code = await codeOf(
      callerFor(a.owner).addAnggota({
        lembagaId: b.lembaga.id,
        user_id: student.id,
        division: 'Acara',
        position: 'Staf',
      }),
    );
    expect(code).toBe('FORBIDDEN');
    expect(await isMember(b.lembaga.id, student.id)).toBe(false);
  });

  it('Admin Lembaga menambah ke lembaga yang dihibahkan, bukan lembaga lain', async () => {
    const a = await makeLembaga('A');
    const b = await makeLembaga('B');
    const admin = await createUser(db);
    await grantAccess(db, { userId: admin.id, lembagaId: a.lembaga.id });
    const student = await makeStudent();
    const caller = callerFor({ id: admin.id, role: 'mahasiswa' });

    const ok = await caller.addAnggota({
      lembagaId: a.lembaga.id,
      user_id: student.id,
      division: 'Acara',
      position: 'Staf',
    });
    expect(ok.success).toBe(true);
    expect(await isMember(a.lembaga.id, student.id)).toBe(true);

    expect(
      await codeOf(
        caller.addAnggota({
          lembagaId: b.lembaga.id,
          user_id: student.id,
          division: 'Acara',
          position: 'Staf',
        }),
      ),
    ).toBe('FORBIDDEN');
    expect(await isMember(b.lembaga.id, student.id)).toBe(false);
  });

  it('Grant terbatas (bukan admin) ditolak', async () => {
    const a = await makeLembaga('A');
    const limited = await createUser(db);
    await grantAccess(db, {
      userId: limited.id,
      lembagaId: a.lembaga.id,
      features: ['oprec'],
    });
    const student = await makeStudent();
    expect(
      await codeOf(
        callerFor({ id: limited.id, role: 'mahasiswa' }).addAnggota({
          lembagaId: a.lembaga.id,
          user_id: student.id,
          division: 'Acara',
          position: 'Staf',
        }),
      ),
    ).toBe('FORBIDDEN');
  });

  it('mahasiswa tanpa Grant ditolak, anonim 401, tanpa lembagaId 400', async () => {
    const a = await makeLembaga('A');
    const student = await makeStudent();
    const outsider = await createUser(db);
    const input = {
      lembagaId: a.lembaga.id,
      user_id: student.id,
      division: 'Acara',
      position: 'Staf',
    };
    expect(
      await codeOf(
        callerFor({ id: outsider.id, role: 'mahasiswa' }).addAnggota(input),
      ),
    ).toBe('FORBIDDEN');
    expect(await codeOf(callerFor(null).addAnggota(input))).toBe(
      'UNAUTHORIZED',
    );
    expect(
      await codeOf(
        callerFor(a.owner).addAnggota({ ...input, lembagaId: '' }),
      ),
    ).toBe('BAD_REQUEST');
  });
});

describe('removeAnggota', () => {
  it('Admin Lembaga menghapus anggota lembaganya, tidak lembaga lain', async () => {
    const a = await makeLembaga('A');
    const b = await makeLembaga('B');
    const student = await makeStudent();
    await callerFor(a.owner).addAnggota({
      lembagaId: a.lembaga.id,
      user_id: student.id,
      division: 'Acara',
      position: 'Staf',
    });
    await callerFor(b.owner).addAnggota({
      lembagaId: b.lembaga.id,
      user_id: student.id,
      division: 'Acara',
      position: 'Staf',
    });

    const admin = await createUser(db);
    await grantAccess(db, { userId: admin.id, lembagaId: a.lembaga.id });
    const caller = callerFor({ id: admin.id, role: 'mahasiswa' });

    expect(
      await codeOf(
        caller.removeAnggota({ lembagaId: b.lembaga.id, user_id: student.id }),
      ),
    ).toBe('FORBIDDEN');
    expect(await isMember(b.lembaga.id, student.id)).toBe(true);

    await caller.removeAnggota({
      lembagaId: a.lembaga.id,
      user_id: student.id,
    });
    expect(await isMember(a.lembaga.id, student.id)).toBe(false);
    expect(await isMember(b.lembaga.id, student.id)).toBe(true);
  });
});

describe('editAnggota, getPosisiBidangOptions, reorderAnggotaLembaga', () => {
  it('lolos pemeriksaan akses untuk pengelola, ditolak untuk orang lain', async () => {
    const a = await makeLembaga('A');
    const outsider = await createUser(db);
    const stranger = callerFor({ id: outsider.id, role: 'mahasiswa' });
    const owner = callerFor(a.owner);

    // Pengelola melewati guard: anggota yang tidak ada → NOT_FOUND, bukan FORBIDDEN.
    expect(
      await codeOf(
        owner.editAnggota({
          lembagaId: a.lembaga.id,
          user_id: outsider.id,
          division: 'Acara',
          position: 'Staf',
        }),
      ),
    ).toBe('NOT_FOUND');
    expect(
      await codeOf(
        stranger.editAnggota({
          lembagaId: a.lembaga.id,
          user_id: outsider.id,
          division: 'Acara',
          position: 'Staf',
        }),
      ),
    ).toBe('FORBIDDEN');

    expect(
      await codeOf(owner.getPosisiBidangOptions({ lembagaId: a.lembaga.id })),
    ).toBe('OK');
    expect(
      await codeOf(
        stranger.getPosisiBidangOptions({ lembagaId: a.lembaga.id }),
      ),
    ).toBe('FORBIDDEN');

    expect(
      await codeOf(
        owner.reorderAnggotaLembaga({ lembagaId: a.lembaga.id, user_ids: [] }),
      ),
    ).toBe('OK');
    expect(
      await codeOf(
        stranger.reorderAnggotaLembaga({
          lembagaId: a.lembaga.id,
          user_ids: [],
        }),
      ),
    ).toBe('FORBIDDEN');
  });
});
