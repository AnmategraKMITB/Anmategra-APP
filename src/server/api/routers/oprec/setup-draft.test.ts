import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import { recruitmentSetupDraft } from '~/server/db/schema';
import { createOprecWorld, placeAt } from '~/test/oprec-fixtures';
import { createTestDb, createUser, grantAccess, resetDb } from '~/test/test-db';

import { oprecRouter } from '.';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

const appRouter = createTRPCRouter({ oprec: oprecRouter });
type World = Awaited<ReturnType<typeof createOprecWorld>>;

function callerFor(actor: World['owner']) {
  return createCallerFactory(appRouter)({
    db,
    session: { user: { ...actor }, expires: '' },
    headers: new Headers(),
  } as never);
}

describe('draf wizard (H-08, K-04)', () => {
  it('menyimpan, memuat, menimpa (upsert), dan membuang draf', async () => {
    const w = await createOprecWorld(db);
    const caller = callerFor(w.owner);

    expect(await caller.oprec.setupDraftGet({ eventId: w.eventId })).toBeNull();

    await caller.oprec.setupDraftSave({
      eventId: w.eventId,
      state: { name: 'A' },
      step: 'S3',
      phase: 'steps',
    });
    await caller.oprec.setupDraftSave({
      eventId: w.eventId,
      state: { name: 'B' },
      step: 'S12a',
      phase: 'summary',
    });

    const draft = await caller.oprec.setupDraftGet({ eventId: w.eventId });
    expect(draft).toMatchObject({
      state: { name: 'B' },
      step: 'S12a',
      phase: 'summary',
    });
    expect(await db.select().from(recruitmentSetupDraft)).toHaveLength(1);

    await caller.oprec.setupDraftDiscard({ eventId: w.eventId });
    expect(await caller.oprec.setupDraftGet({ eventId: w.eventId })).toBeNull();
  });

  it('draf terpisah per pengguna', async () => {
    const w = await createOprecWorld(db);
    const other = await createUser(db);
    await grantAccess(db, {
      userId: other.id,
      periodId: w.eventId,
      features: ['oprec'],
    });
    await callerFor(w.owner).oprec.setupDraftSave({
      eventId: w.eventId,
      state: { name: 'milik owner' },
      step: 'S2',
      phase: 'steps',
    });
    const otherCaller = callerFor(other as unknown as World['owner']);
    expect(
      await otherCaller.oprec.setupDraftGet({ eventId: w.eventId }),
    ).toBeNull();
  });

  it('draf hilang setelah createFromSetup berhasil', async () => {
    const w = await createOprecWorld(db);
    await placeAt(db, w.units[0]!.headPositionId, (await createUser(db)).id);
    const caller = callerFor(w.owner);
    await caller.oprec.setupDraftSave({
      eventId: w.eventId,
      state: { name: 'x' },
      step: 'S1',
      phase: 'steps',
    });
    await caller.oprec.createFromSetup({
      eventId: w.eventId,
      name: 'Oprec Uji',
      form: { mode: 'template' },
      divisions: w.units.slice(0, 1).map((u) => ({
        unitId: u.unitId,
        positionId: u.staffPositionId,
      })),
      minChoices: 1,
      maxChoices: 1,
      settings: { assessorMode: 'ketua' },
    } as never);
    const rows = await db
      .select()
      .from(recruitmentSetupDraft)
      .where(and(eq(recruitmentSetupDraft.periodId, w.eventId)));
    expect(rows).toHaveLength(0);
  });
});
