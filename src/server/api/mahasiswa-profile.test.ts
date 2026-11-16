import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { MahasiswaProfileSchema } from '~/server/api/types/mahasiswa-profile.type';
import {
  addMembership,
  createLembaga,
  createMahasiswa,
  createOperator,
  createTestDb,
  createUser,
  resetDb,
} from '~/test/test-db';

import { type ContactViewer } from './contact';
import {
  byNim,
  byUserId,
  loadMahasiswaProfile,
} from './mahasiswa-profile';

const { db, close } = createTestDb();
const database = db as unknown as Parameters<typeof loadMahasiswaProfile>[0];

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

async function makeStudent(
  over: Parameters<typeof createMahasiswa>[2] = {},
  userOver: Parameters<typeof createUser>[1] = {},
) {
  const user = await createUser(db, { name: 'Budi', ...userOver });
  const m = await createMahasiswa(db, user.id, {
    lineId: 'budi-line',
    whatsapp: '081211112222',
    ...over,
  });
  return { user, m };
}

async function stranger(): Promise<ContactViewer> {
  const u = await createUser(db);
  return { id: u.id, role: 'mahasiswa', lembagaId: null };
}

describe('loadMahasiswaProfile: isi respons', () => {
  it('tidak membawa kolom internal akun dan memenuhi skema keluaran', async () => {
    const { user } = await makeStudent(
      {},
      { role: 'mahasiswa', isDemo: true },
    );
    const profile = await loadMahasiswaProfile(
      database,
      await stranger(),
      byUserId(user.id),
    );
    expect(profile).not.toBeNull();
    expect(Object.keys(profile!.user).sort()).toEqual([
      'email',
      'id',
      'image',
      'name',
    ]);
    const serialized = JSON.stringify(profile);
    for (const leaked of ['isDemo', 'hiddenAt', '"role"', 'emailVerified']) {
      expect(serialized).not.toContain(leaked);
    }
    // Sama dengan yang divalidasi tRPC sebelum dikirim ke klien.
    expect(() => MahasiswaProfileSchema.parse(profile)).not.toThrow();
  });

  it('menyembunyikan kontak dari mahasiswa lain secara bawaan', async () => {
    const { user } = await makeStudent();
    const profile = await loadMahasiswaProfile(
      database,
      await stranger(),
      byUserId(user.id),
    );
    expect(profile!.mahasiswa.whatsapp).toBeNull();
    expect(profile!.mahasiswa.lineId).toBeNull();
    expect(profile!.user.email).toBeNull();
    const serialized = JSON.stringify(profile);
    expect(serialized).not.toContain('081211112222');
    expect(serialized).not.toContain('budi-line');
    expect(serialized).not.toContain(user.email);
  });

  it('menampilkan hanya bidang yang dinyalakan pemiliknya', async () => {
    const { user } = await makeStudent({ showWhatsapp: true });
    const profile = await loadMahasiswaProfile(
      database,
      await stranger(),
      byUserId(user.id),
    );
    expect(profile!.mahasiswa.whatsapp).toBe('081211112222');
    expect(profile!.mahasiswa.lineId).toBeNull();
    expect(profile!.user.email).toBeNull();
  });

  it('pemilik melihat semua kontaknya dan nilai togglenya', async () => {
    const { user } = await makeStudent();
    const profile = await loadMahasiswaProfile(
      database,
      { id: user.id, role: 'mahasiswa' },
      byUserId(user.id),
    );
    expect(profile!.mahasiswa.whatsapp).toBe('081211112222');
    expect(profile!.mahasiswa.lineId).toBe('budi-line');
    expect(profile!.user.email).toBe(user.email);
    expect(profile!.mahasiswa.showWhatsapp).toBe(false);
  });

  it('Owner yang mengelola lembaga tempat mahasiswa aktif melihat kontak', async () => {
    const owner = await createUser(db, { role: 'lembaga' });
    const l = await createLembaga(db, owner.id);
    const { user } = await makeStudent();
    await addMembership(db, l.id, user.id, 'aktif');
    const profile = await loadMahasiswaProfile(
      database,
      { id: owner.id, role: 'lembaga', lembagaId: l.id },
      byUserId(user.id),
    );
    expect(profile!.mahasiswa.whatsapp).toBe('081211112222');
  });
});

describe('loadMahasiswaProfile: pencarian', () => {
  it('menemukan lewat NIM tanpa membocorkan kontak', async () => {
    const { m } = await makeStudent();
    const profile = await loadMahasiswaProfile(
      database,
      await stranger(),
      byNim(m.nim),
    );
    expect(profile!.mahasiswa.nim).toBe(m.nim);
    expect(profile!.mahasiswa.whatsapp).toBeNull();
  });

  it('mengembalikan null bila tidak ada', async () => {
    expect(
      await loadMahasiswaProfile(database, await stranger(), byNim(99999999)),
    ).toBeNull();
  });
});

describe('loadMahasiswaProfile: akun tersembunyi', () => {
  async function hiddenStudent() {
    return makeStudent({}, { hiddenAt: new Date() });
  }

  it('tidak ditemukan oleh mahasiswa lain, sama seperti akun yang tidak ada', async () => {
    const { user, m } = await hiddenStudent();
    const viewer = await stranger();
    expect(
      await loadMahasiswaProfile(database, viewer, byUserId(user.id)),
    ).toBeNull();
    expect(
      await loadMahasiswaProfile(database, viewer, byNim(m.nim)),
    ).toBeNull();
  });

  it('tetap terlihat oleh pemilik, Superadmin, dan Operator accounts.read', async () => {
    const { user } = await hiddenStudent();
    const admin = await createUser(db, { role: 'admin' });
    const op = await createUser(db);
    await createOperator(db, op.id, ['accounts.read']);

    for (const viewer of [
      { id: user.id, role: 'mahasiswa' },
      { id: admin.id, role: 'admin' },
      { id: op.id, role: 'mahasiswa' },
    ] satisfies ContactViewer[]) {
      expect(
        await loadMahasiswaProfile(database, viewer, byUserId(user.id)),
      ).not.toBeNull();
    }
  });

  it('Owner lembaga tidak otomatis melihat akun tersembunyi', async () => {
    const owner = await createUser(db, { role: 'lembaga' });
    const l = await createLembaga(db, owner.id);
    const { user } = await hiddenStudent();
    await addMembership(db, l.id, user.id, 'aktif');
    expect(
      await loadMahasiswaProfile(
        database,
        { id: owner.id, role: 'lembaga', lembagaId: l.id },
        byUserId(user.id),
      ),
    ).toBeNull();
  });
});
