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
  raceWithCommittedUpdate,
  requestEventAssociation,
  requestLembagaAssociation,
  resetDb,
} from '~/test/test-db';

import { lembagaRouter } from './lembaga';
import { isLembagaMember, isPeriodMember } from './organization/membership';
import { userRouter } from './user';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

type Actor = { id: string; role: 'mahasiswa' | 'lembaga'; lembagaId?: string };

function ctxFor(actor: Actor) {
  return {
    db,
    session: { user: { ...actor }, expires: '' },
    headers: new Headers(),
  } as never;
}
const lembagaCaller = (a: Actor) =>
  createCallerFactory(lembagaRouter)(ctxFor(a));
const userCaller = (a: Actor) => createCallerFactory(userRouter)(ctxFor(a));

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
    return 'OK';
  } catch (error) {
    return (error as { code?: string }).code ?? 'ERROR';
  }
}

async function world() {
  const ownerUser = await createUser(db, { role: 'lembaga' });
  const l = await createLembaga(db, ownerUser.id);
  const event = await createEvent(db, l.id);
  const student = await createUser(db);
  const owner: Actor = { id: ownerUser.id, role: 'lembaga', lembagaId: l.id };
  return { lembagaId: l.id, eventId: event.id, student, owner };
}

const body = { division: 'Acara', position: 'Staf' };

describe('permintaan asosiasi lembaga', () => {
  it('mengubah permintaan yang sudah diterima tidak mengembalikannya ke Pending', async () => {
    const w = await world();
    await requestLembagaAssociation(db, w.lembagaId, w.student.id, 'Accepted');

    const code = await codeOf(
      userCaller({
        id: w.student.id,
        role: 'mahasiswa',
      }).editRequestAssociationLembaga({ lembaga_id: w.lembagaId, ...body }),
    );

    expect(code).toBe('NOT_FOUND');
    const [row] = await db
      .select()
      .from(associationRequestsLembaga)
      .where(eq(associationRequestsLembaga.user_id, w.student.id));
    expect(row!.status).toBe('Accepted');
  });

  it('menerima permintaan yang baru saja ditolak gagal dan tidak menambah anggota', async () => {
    const w = await world();
    await requestLembagaAssociation(db, w.lembagaId, w.student.id);

    const code = await raceWithCommittedUpdate(
      (tx) =>
        tx`update anmategra_association_request_lembaga set status = 'Declined' where user_id = ${w.student.id}`,
      () =>
        codeOf(
          lembagaCaller(w.owner).acceptRequestAssociationLembaga({
            lembagaId: w.lembagaId,
            user_id: w.student.id,
            ...body,
          }),
        ),
    );

    expect(code).toBe('CONFLICT');
    const [row] = await db
      .select()
      .from(associationRequestsLembaga)
      .where(eq(associationRequestsLembaga.user_id, w.student.id));
    expect(row!.status).toBe('Declined');
    expect(await isLembagaMember(db, w.lembagaId, w.student.id)).toBe(false);
  });

  it('menolak permintaan yang baru saja diterima gagal', async () => {
    const w = await world();
    await requestLembagaAssociation(db, w.lembagaId, w.student.id);

    const code = await raceWithCommittedUpdate(
      (tx) =>
        tx`update anmategra_association_request_lembaga set status = 'Accepted' where user_id = ${w.student.id}`,
      () =>
        codeOf(
          lembagaCaller(w.owner).declineRequestAssociationLembaga({
            lembagaId: w.lembagaId,
            user_id: w.student.id,
            ...body,
          }),
        ),
    );

    expect(code).toBe('CONFLICT');
    const [row] = await db
      .select()
      .from(associationRequestsLembaga)
      .where(eq(associationRequestsLembaga.user_id, w.student.id));
    expect(row!.status).toBe('Accepted');
  });
});

describe('permintaan asosiasi kegiatan', () => {
  const requestOf = (eventId: string, userId: string) =>
    db
      .select()
      .from(associationRequests)
      .where(
        and(
          eq(associationRequests.event_id, eventId),
          eq(associationRequests.user_id, userId),
        ),
      );

  it('menerima permintaan yang baru saja ditolak gagal dan tidak menempatkan', async () => {
    const w = await world();
    await requestEventAssociation(db, w.eventId, w.student.id);

    const code = await raceWithCommittedUpdate(
      (tx) =>
        tx`update anmategra_association_request set status = 'Declined' where user_id = ${w.student.id}`,
      () =>
        codeOf(
          lembagaCaller(w.owner).acceptRequestAssociation({
            lembagaId: w.lembagaId,
            event_id: w.eventId,
            user_id: w.student.id,
            ...body,
          }),
        ),
    );

    expect(code).toBe('CONFLICT');
    const [row] = await requestOf(w.eventId, w.student.id);
    expect(row!.status).toBe('Declined');
    expect(await isPeriodMember(db, w.eventId, w.student.id)).toBe(false);
  });

  it('menolak permintaan yang baru saja diterima gagal', async () => {
    const w = await world();
    await requestEventAssociation(db, w.eventId, w.student.id);

    const code = await raceWithCommittedUpdate(
      (tx) =>
        tx`update anmategra_association_request set status = 'Accepted' where user_id = ${w.student.id}`,
      () =>
        codeOf(
          lembagaCaller(w.owner).declineRequestAssociation({
            lembagaId: w.lembagaId,
            event_id: w.eventId,
            user_id: w.student.id,
          }),
        ),
    );

    expect(code).toBe('CONFLICT');
    const [row] = await requestOf(w.eventId, w.student.id);
    expect(row!.status).toBe('Accepted');
  });
});
