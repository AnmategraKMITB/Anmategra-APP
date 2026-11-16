import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import { events, profilKM, profilKegiatan } from '~/server/db/schema';
import {
  createEvent,
  createLembaga,
  createTestDb,
  createUser,
  grantAccess,
  resetDb,
} from '~/test/test-db';

import { eventRouter } from './event';
import { kegiatanRouter } from './kegiatan';
import { lembagaRouter } from './lembaga';
import { profilKegiatanRouter } from './profil/kegiatan';
import { raporRouter } from './rapor';
import { userRouter } from './user';

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
  profil: profilKegiatanRouter,
  event: eventRouter,
  kegiatan: kegiatanRouter,
  users: userRouter,
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

async function eventIdFor(lid: string) {
  return lid ? (await createEvent(db, lid)).id : 'tidak-ada';
}

async function profilIdFor(lid: string) {
  if (!lid) return 'tidak-ada';
  const [row] = await db
    .insert(profilKegiatan)
    .values({
      eventId: await eventIdFor(lid),
      name: 'Profil',
      description: 'Deskripsi',
    })
    .returning();
  return row!.id;
}

const NEW_EVENT = {
  name: 'Kegiatan Baru',
  description: 'Deskripsi kegiatan baru',
  image: 'https://x.test/a.png',
  start_date: '2026-03-01T00:00:00.000Z',
  status: 'Coming Soon' as const,
};

/** Setiap prosedur kelompok 5, dipanggil terhadap `lid` (Scope yang diuji). */
const OPS: Record<string, (c: Caller, lid: string) => Promise<unknown>> = {
  'event.create': (c, lid) => c.event.create({ lembagaId: lid, ...NEW_EVENT }),
  'event.update': async (c, lid) =>
    c.event.update({
      lembagaId: lid,
      id: await eventIdFor(lid),
      name: 'Ubah',
    }),
  'event.delete': async (c, lid) =>
    c.event.delete({ lembagaId: lid, id: await eventIdFor(lid) }),
  'event.addNewPanitia': async (c, lid) =>
    c.event.addNewPanitia({
      lembagaId: lid,
      event_id: await eventIdFor(lid),
      user_id: 'tidak-ada',
      position: 'Staf',
      division: 'Acara',
    }),
  'event.addNewPanitiaManual': async (c, lid) =>
    c.event.addNewPanitiaManual({
      lembagaId: lid,
      event_id: await eventIdFor(lid),
      name: 'Nama',
      nim: '13523001',
      position: 'Staf',
      division: 'Acara',
    }),
  'event.removePanitia': async (c, lid) =>
    c.event.removePanitia({
      lembagaId: lid,
      event_id: await eventIdFor(lid),
      id: 'tidak-ada',
    }),
  'event.editPanitia': async (c, lid) =>
    c.event.editPanitia({
      lembagaId: lid,
      event_id: await eventIdFor(lid),
      user_id: 'tidak-ada',
      position: 'Staf',
      division: 'Acara',
    }),
  'event.toggleHighlight': async (c, lid) =>
    c.event.toggleHighlight({
      lembagaId: lid,
      id: await eventIdFor(lid),
      is_highlighted: true,
    }),
  'event.toggleRaporVisibility': async (c, lid) =>
    c.event.toggleRaporVisibility({
      lembagaId: lid,
      id: await eventIdFor(lid),
      rapor_visible: true,
    }),
  'kegiatan.getAllByLembaga': (c, lid) =>
    c.kegiatan.getAllByLembaga({ lembagaId: lid }),
  'kegiatan.getPosisiBidangOptions': async (c, lid) =>
    c.kegiatan.getPosisiBidangOptions({
      lembagaId: lid,
      event_id: await eventIdFor(lid),
    }),
  'lembaga.reorderAnggotaKegiatan': async (c, lid) =>
    c.lembaga.reorderAnggotaKegiatan({
      lembagaId: lid,
      event_id: await eventIdFor(lid),
      user_ids: [],
    }),
  'users.getTambahAnggotaLembagaOptions': (c, lid) =>
    c.users.getTambahAnggotaLembagaOptions({ lembagaId: lid }),
  'users.getTambahAnggotaKegiatanOptions': async (c, lid) =>
    c.users.getTambahAnggotaKegiatanOptions({
      lembagaId: lid,
      kegiatanId: await eventIdFor(lid),
    }),
  'rapor.getAllNilaiProfilKegiatan': async (c, lid) =>
    c.rapor.getAllNilaiProfilKegiatan({
      lembagaId: lid,
      event_id: await eventIdFor(lid),
    }),
  'rapor.getNilaiKegiatanIndividu': async (c, lid) =>
    c.rapor.getNilaiKegiatanIndividu({
      lembagaId: lid,
      event_id: await eventIdFor(lid),
      mahasiswa_id: 'tidak-ada',
    }),
  'rapor.upsertNilaiMahasiswaKegiatan': async (c, lid) =>
    c.rapor.upsertNilaiMahasiswaKegiatan({
      lembagaId: lid,
      event_id: await eventIdFor(lid),
      mahasiswa: [],
    }),
  'profil.createProfilKegiatan': async (c, lid) =>
    c.profil.createProfilKegiatan({
      lembagaId: lid,
      event_id: await eventIdFor(lid),
      name: 'Baru',
      description: 'Deskripsi baru',
      profil_km_id: ['km-1'],
    }),
  'profil.deleteProfilKegiatan': async (c, lid) =>
    c.profil.deleteProfilKegiatan({
      lembagaId: lid,
      profil_id: await profilIdFor(lid),
    }),
  'profil.editProfilKegiatan': async (c, lid) =>
    c.profil.editProfilKegiatan({
      lembagaId: lid,
      profil_id: await profilIdFor(lid),
      name: 'Ubah',
      description: 'Ubah',
      profil_km_id: ['km-1'],
    }),
};

// Lolos otorisasi = bukan 401/403. Prosedur boleh berakhir NOT_FOUND atau
// galat domain lain; yang diuji adalah gerbang Scope.
const denied = ['FORBIDDEN', 'UNAUTHORIZED', 'BAD_REQUEST'];

describe.each(Object.entries(OPS))('%s: isolasi antarlembaga', (_n, op) => {
  it('Owner lolos di lembaganya, ditolak di lembaga lain', async () => {
    const a = await makeLembaga('A');
    const b = await makeLembaga('B');
    expect(denied).not.toContain(
      await codeOf(op(callerFor(a.owner), a.lembaga.id)),
    );
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
    expect(denied).not.toContain(await codeOf(op(caller, a.lembaga.id)));
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

describe('kegiatan milik lembaga lain', () => {
  it('Scope B tidak dapat mengubah atau menghapus kegiatan lembaga A', async () => {
    const a = await makeLembaga('A');
    const b = await makeLembaga('B');
    const event = await createEvent(db, a.lembaga.id);
    const caller = callerFor(b.owner);

    expect(
      await codeOf(
        caller.event.update({
          lembagaId: b.lembaga.id,
          id: event.id,
          name: 'Dibajak',
        }),
      ),
    ).toBe('NOT_FOUND');
    expect(
      await codeOf(
        caller.event.delete({ lembagaId: b.lembaga.id, id: event.id }),
      ),
    ).toBe('NOT_FOUND');

    const [row] = await db.select().from(events).where(eq(events.id, event.id));
    expect(row?.name).toBe('Kegiatan Uji');
    expect(row?.org_id).toBe(a.lembaga.id);
  });

  it('Admin Lembaga membuat kegiatan langsung di lembaga yang dihibahkan', async () => {
    const a = await makeLembaga('A');
    const admin = await createUser(db);
    await grantAccess(db, { userId: admin.id, lembagaId: a.lembaga.id });
    const created = (await callerFor({
      id: admin.id,
      role: 'mahasiswa',
    }).event.create({ lembagaId: a.lembaga.id, ...NEW_EVENT })) as {
      org_id: string;
    };
    expect(created.org_id).toBe(a.lembaga.id);
  });
});
