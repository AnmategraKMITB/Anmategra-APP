import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import { lembaga, profilKM, profilLembaga, users } from '~/server/db/schema';
import {
  createLembaga,
  createTestDb,
  createUser,
  grantAccess,
  resetDb,
} from '~/test/test-db';

import { lembagaRouter } from './lembaga';
import { profileLembagaRouter } from './profil/lembaga';
import { raporRouter } from './rapor';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
  await db
    .insert(profilKM)
    .values({ id: 'km-1', description: 'Profil KM 1' })
    .onConflictDoNothing();
});
afterAll(async () => {
  await close();
});

const appRouter = createTRPCRouter({
  lembaga: lembagaRouter,
  rapor: raporRouter,
  profil: profileLembagaRouter,
});

type Actor = {
  id: string;
  role: 'mahasiswa' | 'lembaga' | 'admin';
  lembagaId?: string;
} | null;

function callerFor(actor: Actor) {
  const session = actor ? { user: { ...actor }, expires: '' } : null;
  return createCallerFactory(appRouter)({
    db,
    session,
    headers: new Headers(),
  } as never);
}
type Caller = ReturnType<typeof callerFor>;

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
    ownerId: owner.id,
    owner: { id: owner.id, role: 'lembaga', lembagaId: l.id } as const,
  };
}

async function makeProfil(lembagaId: string) {
  const [row] = await db
    .insert(profilLembaga)
    .values({ lembagaId, name: 'Profil', description: 'Deskripsi' })
    .returning();
  return row!;
}

/** Id profil nyata untuk `lid`; `lid` kosong (uji 400) tidak membuat baris. */
async function profilIdFor(lid: string) {
  return lid ? (await makeProfil(lid)).id : 'tidak-ada';
}

/** Setiap prosedur kelompok 2, dipanggil terhadap `lid` (Scope yang diuji). */
const OPS: Record<string, (c: Caller, lid: string) => Promise<unknown>> = {
  createProfilLembaga: (c, lid) =>
    c.profil.createProfilLembaga({
      lembagaId: lid,
      name: 'Baru',
      description: 'Deskripsi baru',
      profil_km_id: ['km-1'],
    }),
  deleteProfilLembaga: async (c, lid) =>
    c.profil.deleteProfilLembaga({
      lembagaId: lid,
      profil_id: await profilIdFor(lid),
    }),
  editProfilLembaga: async (c, lid) =>
    c.profil.editProfilLembaga({
      lembagaId: lid,
      profil_id: await profilIdFor(lid),
      name: 'Ubah',
      description: 'Ubah',
      profil_km_id: ['km-1'],
    }),
  getAllNilaiProfilLembaga: (c, lid) =>
    c.rapor.getAllNilaiProfilLembaga({ lembagaId: lid }),
  upsertNilaiMahasiswaLembaga: (c, lid) =>
    c.rapor.upsertNilaiMahasiswaLembaga({ lembagaId: lid, mahasiswa: [] }),
  toggleRaporVisibility: (c, lid) =>
    c.lembaga.toggleRaporVisibility({ lembagaId: lid, rapor_visible: true }),
  editProfil: (c, lid) =>
    c.lembaga.editProfil({ lembagaId: lid, nama: 'Nama Baru' }),
};

describe.each(Object.entries(OPS))('%s: isolasi antarlembaga', (_n, op) => {
  it('Owner lolos di lembaganya, ditolak di lembaga lain', async () => {
    const a = await makeLembaga('A');
    const b = await makeLembaga('B');
    expect(await codeOf(op(callerFor(a.owner), a.lembaga.id))).toBe('OK');
    expect(await codeOf(op(callerFor(a.owner), b.lembaga.id))).toBe(
      'FORBIDDEN',
    );
  });

  it('Admin Lembaga lolos di lembaga yang dihibahkan, ditolak di lembaga lain', async () => {
    const a = await makeLembaga('A');
    const b = await makeLembaga('B');
    const admin = await createUser(db);
    await grantAccess(db, { userId: admin.id, lembagaId: a.lembaga.id });
    const caller = callerFor({ id: admin.id, role: 'mahasiswa' });
    expect(await codeOf(op(caller, a.lembaga.id))).toBe('OK');
    expect(await codeOf(op(caller, b.lembaga.id))).toBe('FORBIDDEN');
  });

  it('Grant terbatas dan mahasiswa tanpa Grant ditolak; anonim 401; tanpa lembagaId 400', async () => {
    const a = await makeLembaga('A');
    const limited = await createUser(db);
    await grantAccess(db, {
      userId: limited.id,
      lembagaId: a.lembaga.id,
      features: ['oprec'],
    });
    const outsider = await createUser(db);
    expect(
      await codeOf(
        op(callerFor({ id: limited.id, role: 'mahasiswa' }), a.lembaga.id),
      ),
    ).toBe('FORBIDDEN');
    expect(
      await codeOf(
        op(callerFor({ id: outsider.id, role: 'mahasiswa' }), a.lembaga.id),
      ),
    ).toBe('FORBIDDEN');
    expect(await codeOf(op(callerFor(null), a.lembaga.id))).toBe(
      'UNAUTHORIZED',
    );
    expect(await codeOf(op(callerFor(a.owner), ''))).toBe('BAD_REQUEST');
  });
});

describe('profil milik lembaga lain', () => {
  it('edit/hapus profil lembaga B lewat Scope A ditolak dan data tak berubah', async () => {
    const a = await makeLembaga('A');
    const b = await makeLembaga('B');
    const profilB = await makeProfil(b.lembaga.id);
    const caller = callerFor(a.owner);

    expect(
      await codeOf(
        caller.profil.deleteProfilLembaga({
          lembagaId: a.lembaga.id,
          profil_id: profilB.id,
        }),
      ),
    ).toBe('FORBIDDEN');
    expect(
      await codeOf(
        caller.profil.editProfilLembaga({
          lembagaId: a.lembaga.id,
          profil_id: profilB.id,
          name: 'Dibajak',
          description: 'Dibajak',
          profil_km_id: ['km-1'],
        }),
      ),
    ).toBe('FORBIDDEN');

    const [after] = await db
      .select()
      .from(profilLembaga)
      .where(eq(profilLembaga.id, profilB.id));
    expect(after?.name).toBe('Profil');
  });

  it('upsert nilai dengan profil lembaga lain ditolak', async () => {
    const a = await makeLembaga('A');
    const b = await makeLembaga('B');
    const profilB = await makeProfil(b.lembaga.id);
    const student = await createUser(db);
    expect(
      await codeOf(
        callerFor(a.owner).rapor.upsertNilaiMahasiswaLembaga({
          lembagaId: a.lembaga.id,
          mahasiswa: [
            {
              user_id: student.id,
              nilai: [{ profil_id: profilB.id, nilai: 90 }],
            },
          ],
        }),
      ),
    ).toBe('BAD_REQUEST');
  });
});

describe('efek pada lembaga yang dikelola', () => {
  it('toggleRaporVisibility oleh Admin mengubah lembaga di URL, bukan lembaga sesi', async () => {
    const a = await makeLembaga('A');
    const admin = await createUser(db);
    await grantAccess(db, { userId: admin.id, lembagaId: a.lembaga.id });
    await callerFor({
      id: admin.id,
      role: 'mahasiswa',
    }).lembaga.toggleRaporVisibility({
      lembagaId: a.lembaga.id,
      rapor_visible: true,
    });
    const [row] = await db
      .select({ v: lembaga.raporVisible })
      .from(lembaga)
      .where(eq(lembaga.id, a.lembaga.id));
    expect(row?.v).toBe(true);
  });

  it('editProfil oleh Admin mengganti foto Owner, bukan foto Admin', async () => {
    const a = await makeLembaga('A');
    const admin = await createUser(db, { image: 'https://x.test/admin.png' });
    await grantAccess(db, { userId: admin.id, lembagaId: a.lembaga.id });
    await callerFor({ id: admin.id, role: 'mahasiswa' }).lembaga.editProfil({
      lembagaId: a.lembaga.id,
      nama: 'Nama Baru',
      gambar: 'https://x.test/lembaga.png',
    });
    const [owner] = await db
      .select({ image: users.image })
      .from(users)
      .where(eq(users.id, a.ownerId));
    const [adminRow] = await db
      .select({ image: users.image })
      .from(users)
      .where(eq(users.id, admin.id));
    expect(owner?.image).toBe('https://x.test/lembaga.png');
    expect(adminRow?.image).toBe('https://x.test/admin.png');
  });
});
