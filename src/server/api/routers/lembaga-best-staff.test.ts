import { count } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCallerFactory } from '~/server/api/trpc';
import { bestStaffKegiatan, mahasiswa } from '~/server/db/schema';
import {
  createEvent,
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

function callerFor(actor: Actor) {
  const session = actor ? { user: { ...actor }, expires: '' } : null;
  return createCallerFactory(lembagaRouter)({
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
    owner: { id: owner.id, role: 'lembaga', lembagaId: l.id } as const,
  };
}

const PERIOD = {
  start_date: '2026-01-01T00:00:00.000Z',
  end_date: '2026-02-01T00:00:00.000Z',
};

/** Kegiatan nyata milik `lid`; `lid` kosong (uji 400) tidak membuat baris. */
async function eventIdFor(lid: string) {
  return lid ? (await createEvent(db, lid)).id : 'tidak-ada';
}

const OPS: Record<string, (c: Caller, lid: string) => Promise<unknown>> = {
  getAllLembagaDivision: (c, lid) =>
    c.getAllLembagaDivision({ lembagaId: lid }),
  getBestStaffLembagaOptions: (c, lid) =>
    c.getBestStaffLembagaOptions({ lembagaId: lid, division: 'Acara' }),
  chooseBestStaffLembaga: (c, lid) =>
    c.chooseBestStaffLembaga({
      lembagaId: lid,
      ...PERIOD,
      best_staff_list: [],
    }),
  getAllKegiatanDivision: async (c, lid) =>
    c.getAllKegiatanDivision({
      lembagaId: lid,
      event_id: await eventIdFor(lid),
    }),
  getBestStaffOptions: async (c, lid) =>
    c.getBestStaffOptions({
      lembagaId: lid,
      event_id: await eventIdFor(lid),
      division: 'Acara',
    }),
  chooseBestStaffKegiatan: async (c, lid) =>
    c.chooseBestStaffKegiatan({
      lembagaId: lid,
      event_id: await eventIdFor(lid),
      ...PERIOD,
      best_staff_list: [],
    }),
  deleteBestStaffPeriode: async (c, lid) =>
    c.deleteBestStaffPeriode({
      lembagaId: lid,
      event_id: await eventIdFor(lid),
      ...PERIOD,
    }),
};

// Lolos otorisasi = bukan 401/403/400. Mutasi pada permintaan yang tidak ada
// boleh berakhir NOT_FOUND; yang diuji di sini adalah gerbang Scope.
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

describe('data milik lembaga lain', () => {
  it('menghapus periode Best Staff kegiatan lembaga A lewat Scope B ditolak', async () => {
    const a = await makeLembaga('A');
    const b = await makeLembaga('B');
    const event = await createEvent(db, a.lembaga.id);
    const student = await createUser(db);
    await db.insert(mahasiswa).values({
      userId: student.id,
      nim: 13523999,
      jurusan: 'Teknik Informatika',
      angkatan: 2023,
    });
    await db.insert(bestStaffKegiatan).values({
      eventId: event.id,
      mahasiswaId: student.id,
      division: 'Acara',
      startDate: new Date(PERIOD.start_date),
      endDate: new Date(PERIOD.end_date),
    });
    const before = await db.select({ n: count() }).from(bestStaffKegiatan);

    expect(
      await codeOf(
        callerFor(b.owner).deleteBestStaffPeriode({
          lembagaId: b.lembaga.id,
          event_id: event.id,
          ...PERIOD,
        }),
      ),
    ).toBe('FORBIDDEN');
    const after = await db.select({ n: count() }).from(bestStaffKegiatan);
    expect(before[0]?.n).toBe(1);
    expect(after[0]?.n).toBe(1);
  });

  it('memilih Best Staff kegiatan A lewat Scope B ditolak', async () => {
    const a = await makeLembaga('A');
    const b = await makeLembaga('B');
    const event = await createEvent(db, a.lembaga.id);
    expect(
      await codeOf(
        callerFor(b.owner).chooseBestStaffKegiatan({
          lembagaId: b.lembaga.id,
          event_id: event.id,
          ...PERIOD,
          best_staff_list: [],
        }),
      ),
    ).toBe('FORBIDDEN');
  });
});
