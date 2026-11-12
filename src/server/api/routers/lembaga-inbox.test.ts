import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCallerFactory } from '~/server/api/trpc';
import {
  associationRequests,
  associationRequestsLembaga,
} from '~/server/db/schema';
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

const body = { division: 'Acara', position: 'Staf' };

/** Tiap prosedur inbox; `uid` dipakai untuk mutasi (permintaan tidak harus ada). */
const OPS: Record<
  string,
  (c: Caller, lid: string, uid: string) => Promise<unknown>
> = {
  getAllRequestAssociationSummary: (c, lid) =>
    c.getAllRequestAssociationSummary({ lembagaId: lid }),
  getAllRequestAssociation: (c, lid) =>
    c.getAllRequestAssociation({ lembagaId: lid, event_id: 'tidak-ada' }),
  acceptRequestAssociation: (c, lid, uid) =>
    c.acceptRequestAssociation({
      lembagaId: lid,
      event_id: 'tidak-ada',
      user_id: uid,
      ...body,
    }),
  declineRequestAssociation: (c, lid, uid) =>
    c.declineRequestAssociation({
      lembagaId: lid,
      event_id: 'tidak-ada',
      user_id: uid,
    }),
  getAllRequestAssociationLembaga: (c, lid) =>
    c.getAllRequestAssociationLembaga({ lembagaId: lid }),
  acceptRequestAssociationLembaga: (c, lid, uid) =>
    c.acceptRequestAssociationLembaga({
      lembagaId: lid,
      user_id: uid,
      ...body,
    }),
  declineRequestAssociationLembaga: (c, lid, uid) =>
    c.declineRequestAssociationLembaga({
      lembagaId: lid,
      user_id: uid,
      ...body,
    }),
};

// Lolos otorisasi = bukan 401/403/400. Mutasi pada permintaan yang tidak ada
// boleh berakhir NOT_FOUND; yang diuji di sini adalah gerbang Scope.
const denied = ['FORBIDDEN', 'UNAUTHORIZED', 'BAD_REQUEST'];

describe.each(Object.entries(OPS))('%s: isolasi antarlembaga', (_n, op) => {
  it('Owner lolos di lembaganya, ditolak di lembaga lain', async () => {
    const a = await makeLembaga('A');
    const b = await makeLembaga('B');
    const u = await createUser(db);
    expect(denied).not.toContain(
      await codeOf(op(callerFor(a.owner), a.lembaga.id, u.id)),
    );
    expect(await codeOf(op(callerFor(a.owner), b.lembaga.id, u.id))).toBe(
      'FORBIDDEN',
    );
  });

  it('Admin Lembaga lolos di lembaga yang dihibahkan, ditolak di lembaga lain', async () => {
    const a = await makeLembaga('A');
    const b = await makeLembaga('B');
    const admin = await createUser(db);
    await grantAccess(db, { userId: admin.id, lembagaId: a.lembaga.id });
    const u = await createUser(db);
    const caller = callerFor({ id: admin.id, role: 'mahasiswa' });
    expect(denied).not.toContain(await codeOf(op(caller, a.lembaga.id, u.id)));
    expect(await codeOf(op(caller, b.lembaga.id, u.id))).toBe('FORBIDDEN');
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
    const u = await createUser(db);
    expect(
      await codeOf(
        op(
          callerFor({ id: limited.id, role: 'mahasiswa' }),
          a.lembaga.id,
          u.id,
        ),
      ),
    ).toBe('FORBIDDEN');
    expect(
      await codeOf(
        op(
          callerFor({ id: outsider.id, role: 'mahasiswa' }),
          a.lembaga.id,
          u.id,
        ),
      ),
    ).toBe('FORBIDDEN');
    expect(await codeOf(op(callerFor(null), a.lembaga.id, u.id))).toBe(
      'UNAUTHORIZED',
    );
    expect(await codeOf(op(callerFor(a.owner), '', u.id))).toBe('BAD_REQUEST');
  });
});

describe('permintaan milik lembaga lain', () => {
  it('menolak/menerima permintaan lembaga A lewat Scope B tidak mengubah data', async () => {
    const a = await makeLembaga('A');
    const b = await makeLembaga('B');
    const student = await createUser(db);
    await db.insert(associationRequestsLembaga).values({
      id: crypto.randomUUID(),
      lembagaId: a.lembaga.id,
      user_id: student.id,
      ...body,
    });

    const caller = callerFor(b.owner);
    await codeOf(
      caller.declineRequestAssociationLembaga({
        lembagaId: b.lembaga.id,
        user_id: student.id,
        ...body,
      }),
    );
    await codeOf(
      caller.acceptRequestAssociationLembaga({
        lembagaId: b.lembaga.id,
        user_id: student.id,
        ...body,
      }),
    );

    const [row] = await db
      .select()
      .from(associationRequestsLembaga)
      .where(eq(associationRequestsLembaga.user_id, student.id));
    expect(row?.status).toBe('Pending');
  });

  it('permintaan kegiatan lembaga A tidak dapat diputuskan lewat Scope B', async () => {
    const a = await makeLembaga('A');
    const b = await makeLembaga('B');
    const event = await createEvent(db, a.lembaga.id);
    const student = await createUser(db);
    await db.insert(associationRequests).values({
      id: crypto.randomUUID(),
      event_id: event.id,
      user_id: student.id,
      ...body,
    });
    const caller = callerFor(b.owner);

    expect(
      await codeOf(
        caller.declineRequestAssociation({
          lembagaId: b.lembaga.id,
          event_id: event.id,
          user_id: student.id,
        }),
      ),
    ).toBe('NOT_FOUND');
    expect(
      await codeOf(
        caller.getAllRequestAssociation({
          lembagaId: b.lembaga.id,
          event_id: event.id,
        }),
      ),
    ).toBe('UNAUTHORIZED');

    const [row] = await db
      .select()
      .from(associationRequests)
      .where(
        and(
          eq(associationRequests.event_id, event.id),
          eq(associationRequests.user_id, student.id),
        ),
      );
    expect(row?.status).toBe('Pending');
  });
});
