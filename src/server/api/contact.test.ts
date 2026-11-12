import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  addMembership,
  createEvent,
  createLembaga,
  createMahasiswa,
  createOperator,
  createTestDb,
  createUser,
  grantAccess,
  placeInEvent,
  requestEventAssociation,
  requestLembagaAssociation,
  resetDb,
} from '~/test/test-db';

import {
  type ContactToggles,
  type ContactViewer,
  canViewContact,
  canViewHiddenAccount,
  contactAccess,
} from './contact';

const { db, close } = createTestDb();
const database = db as unknown as Parameters<typeof contactAccess>[0];

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

const HIDDEN = { whatsapp: false, line: false, email: false };
const SHOWN = { whatsapp: true, line: true, email: true };

/** Mahasiswa sasaran dengan ketiga toggle mati (bawaan). */
async function makeTarget(over: Partial<ContactToggles> = {}) {
  const user = await createUser(db);
  await createMahasiswa(db, user.id);
  const toggles: ContactToggles = {
    userId: user.id,
    showWhatsapp: false,
    showLine: false,
    showEmail: false,
    ...over,
  };
  return { user, toggles };
}

/** Owner (Account Role lembaga) dengan lembaganya. */
async function makeOwner() {
  const user = await createUser(db, { role: 'lembaga' });
  const l = await createLembaga(db, user.id);
  const viewer: ContactViewer = {
    id: user.id,
    role: 'lembaga',
    lembagaId: l.id,
  };
  return { user, lembaga: l, viewer };
}

async function stranger(): Promise<ContactViewer> {
  const u = await createUser(db);
  return { id: u.id, role: 'mahasiswa', lembagaId: null };
}

describe('contactAccess: penonton biasa', () => {
  it('bawaan: semua kontak tersembunyi dari mahasiswa lain', async () => {
    const { toggles } = await makeTarget();
    expect(await contactAccess(database, await stranger(), toggles)).toEqual(
      HIDDEN,
    );
  });

  it('toggle menyalakan tepat satu bidang', async () => {
    const viewer = await stranger();
    const { toggles } = await makeTarget({ showWhatsapp: true });
    expect(await contactAccess(database, viewer, toggles)).toEqual({
      whatsapp: true,
      line: false,
      email: false,
    });
    const line = await makeTarget({ showLine: true });
    expect(await contactAccess(database, viewer, line.toggles)).toEqual({
      whatsapp: false,
      line: true,
      email: false,
    });
    const email = await makeTarget({ showEmail: true });
    expect(await contactAccess(database, viewer, email.toggles)).toEqual({
      whatsapp: false,
      line: false,
      email: true,
    });
  });

  it('semua toggle menyala: terlihat oleh siapa pun', async () => {
    const { toggles } = await makeTarget({
      showWhatsapp: true,
      showLine: true,
      showEmail: true,
    });
    expect(await contactAccess(database, await stranger(), toggles)).toEqual(
      SHOWN,
    );
  });

  it('canViewContact membaca bidang yang diminta', async () => {
    const viewer = await stranger();
    const { toggles } = await makeTarget({ showLine: true });
    expect(await canViewContact(database, viewer, toggles, 'line')).toBe(true);
    expect(await canViewContact(database, viewer, toggles, 'whatsapp')).toBe(
      false,
    );
  });
});

describe('contactAccess: selalu boleh melihat', () => {
  it('pemilik akun', async () => {
    const { user, toggles } = await makeTarget();
    const self: ContactViewer = { id: user.id, role: 'mahasiswa' };
    expect(await contactAccess(database, self, toggles)).toEqual(SHOWN);
  });

  it('Superadmin', async () => {
    const { toggles } = await makeTarget();
    const admin = await createUser(db, { role: 'admin' });
    expect(
      await contactAccess(
        database,
        { id: admin.id, role: 'admin' },
        toggles,
      ),
    ).toEqual(SHOWN);
  });

  it('Operator dengan izin accounts.read', async () => {
    const { toggles } = await makeTarget();
    const op = await createUser(db);
    await createOperator(db, op.id, ['accounts.read']);
    expect(
      await contactAccess(database, { id: op.id, role: 'mahasiswa' }, toggles),
    ).toEqual(SHOWN);
  });

  it('Operator tanpa izin accounts.read, kedaluwarsa, atau dicabut tidak', async () => {
    const { toggles } = await makeTarget();
    const other = await createUser(db);
    await createOperator(db, other.id, ['reports.read']);
    const expired = await createUser(db);
    await createOperator(db, expired.id, ['accounts.read'], {
      expiresAt: new Date(Date.now() - 60_000),
    });
    const revoked = await createUser(db);
    await createOperator(db, revoked.id, ['accounts.read'], {
      revokedAt: new Date(),
    });
    for (const u of [other, expired, revoked]) {
      expect(
        await contactAccess(
          database,
          { id: u.id, role: 'mahasiswa' },
          toggles,
        ),
      ).toEqual(HIDDEN);
    }
  });
});

describe('contactAccess: pengelola lembaga atau kegiatan', () => {
  it('Owner melihat anggota aktif lembaganya', async () => {
    const { lembaga: l, viewer } = await makeOwner();
    const { user, toggles } = await makeTarget();
    await addMembership(db, l.id, user.id, 'aktif');
    expect(await contactAccess(database, viewer, toggles)).toEqual(SHOWN);
  });

  it('Owner tidak melihat anggota yang sudah keluar', async () => {
    const { lembaga: l, viewer } = await makeOwner();
    const { user, toggles } = await makeTarget();
    await addMembership(db, l.id, user.id, 'keluar');
    expect(await contactAccess(database, viewer, toggles)).toEqual(HIDDEN);
  });

  it('Owner lembaga lain tidak melihat', async () => {
    const a = await makeOwner();
    const b = await makeOwner();
    const { user, toggles } = await makeTarget();
    await addMembership(db, a.lembaga.id, user.id, 'aktif');
    expect(await contactAccess(database, b.viewer, toggles)).toEqual(HIDDEN);
  });

  it('Owner melihat panitia kegiatan yang belum selesai', async () => {
    const { lembaga: l, viewer } = await makeOwner();
    const e = await createEvent(db, l.id, { status: 'On going' });
    const { user, toggles } = await makeTarget();
    await placeInEvent(db, e.id, user.id);
    expect(await contactAccess(database, viewer, toggles)).toEqual(SHOWN);
  });

  it('kegiatan yang sudah selesai tidak lagi membuka kontak panitianya', async () => {
    const { lembaga: l, viewer } = await makeOwner();
    const e = await createEvent(db, l.id, { status: 'Ended' });
    const { user, toggles } = await makeTarget();
    await placeInEvent(db, e.id, user.id);
    expect(await contactAccess(database, viewer, toggles)).toEqual(HIDDEN);
  });

  it('pengaju asosiasi yang masih diproses terlihat, yang sudah diputus tidak', async () => {
    const { lembaga: l, viewer } = await makeOwner();
    const e = await createEvent(db, l.id);

    const pendingEvent = await makeTarget();
    await requestEventAssociation(db, e.id, pendingEvent.user.id, 'Pending');
    expect(
      await contactAccess(database, viewer, pendingEvent.toggles),
    ).toEqual(SHOWN);

    const pendingLembaga = await makeTarget();
    await requestLembagaAssociation(
      db,
      l.id,
      pendingLembaga.user.id,
      'Pending',
    );
    expect(
      await contactAccess(database, viewer, pendingLembaga.toggles),
    ).toEqual(SHOWN);

    const declined = await makeTarget();
    await requestEventAssociation(db, e.id, declined.user.id, 'Declined');
    expect(await contactAccess(database, viewer, declined.toggles)).toEqual(
      HIDDEN,
    );
    const accepted = await makeTarget();
    await requestEventAssociation(db, e.id, accepted.user.id, 'Accepted');
    expect(await contactAccess(database, viewer, accepted.toggles)).toEqual(
      HIDDEN,
    );
  });

  it('Admin Lembaga penuh melihat, Grant terbatas tidak', async () => {
    const { lembaga: l } = await makeOwner();
    const { user, toggles } = await makeTarget();
    await addMembership(db, l.id, user.id, 'aktif');

    const full = await createUser(db);
    await grantAccess(db, { userId: full.id, lembagaId: l.id });
    expect(
      await contactAccess(
        database,
        { id: full.id, role: 'mahasiswa' },
        toggles,
      ),
    ).toEqual(SHOWN);

    const limited = await createUser(db);
    await grantAccess(db, {
      userId: limited.id,
      lembagaId: l.id,
      features: ['oprec'],
    });
    expect(
      await contactAccess(
        database,
        { id: limited.id, role: 'mahasiswa' },
        toggles,
      ),
    ).toEqual(HIDDEN);
  });

  it('Admin Kegiatan melihat panitia kegiatannya saja', async () => {
    const { lembaga: l } = await makeOwner();
    const e1 = await createEvent(db, l.id, { name: 'E1' });
    const e2 = await createEvent(db, l.id, { name: 'E2' });
    const { user, toggles } = await makeTarget();
    await placeInEvent(db, e1.id, user.id);

    const adminE1 = await createUser(db);
    await grantAccess(db, { userId: adminE1.id, periodId: e1.id });
    const adminE2 = await createUser(db);
    await grantAccess(db, { userId: adminE2.id, periodId: e2.id });

    expect(
      await contactAccess(
        database,
        { id: adminE1.id, role: 'mahasiswa' },
        toggles,
      ),
    ).toEqual(SHOWN);
    expect(
      await contactAccess(
        database,
        { id: adminE2.id, role: 'mahasiswa' },
        toggles,
      ),
    ).toEqual(HIDDEN);
  });

  it('Grant yang dicabut tidak membuka kontak', async () => {
    const { lembaga: l } = await makeOwner();
    const { user, toggles } = await makeTarget();
    await addMembership(db, l.id, user.id, 'aktif');
    const former = await createUser(db);
    await grantAccess(db, {
      userId: former.id,
      lembagaId: l.id,
      status: 'revoked',
    });
    expect(
      await contactAccess(
        database,
        { id: former.id, role: 'mahasiswa' },
        toggles,
      ),
    ).toEqual(HIDDEN);
  });
});

describe('canViewHiddenAccount', () => {
  it('hanya pemilik, Superadmin, dan Operator accounts.read', async () => {
    const target = await createUser(db);
    const admin = await createUser(db, { role: 'admin' });
    const op = await createUser(db);
    await createOperator(db, op.id, ['accounts.read']);
    const other = await createUser(db);

    expect(
      await canViewHiddenAccount(
        database,
        { id: target.id, role: 'mahasiswa' },
        target.id,
      ),
    ).toBe(true);
    expect(
      await canViewHiddenAccount(
        database,
        { id: admin.id, role: 'admin' },
        target.id,
      ),
    ).toBe(true);
    expect(
      await canViewHiddenAccount(
        database,
        { id: op.id, role: 'mahasiswa' },
        target.id,
      ),
    ).toBe(true);
    expect(
      await canViewHiddenAccount(
        database,
        { id: other.id, role: 'mahasiswa' },
        target.id,
      ),
    ).toBe(false);
  });
});
