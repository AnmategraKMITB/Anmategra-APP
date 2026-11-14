import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { formRouter } from '~/server/api/routers/form';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import { form, recruitment } from '~/server/db/schema';
import { createOprecWorld as baseWorld, placeAt } from '~/test/oprec-fixtures';
import { createTestDb, createUser, resetDb } from '~/test/test-db';

import { oprecRouter } from '.';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

const appRouter = createTRPCRouter({ oprec: oprecRouter, form: formRouter });

/** Dunia uji dengan satu ketua di tiap divisi (syarat wizard, #383). */
async function createOprecWorld(...args: Parameters<typeof baseWorld>) {
  const w = await baseWorld(...args);
  for (const u of w.units) {
    await placeAt(db, u.headPositionId, (await createUser(db)).id);
  }
  return w;
}

type World = Awaited<ReturnType<typeof createOprecWorld>>;

function callerFor(actor: World['owner']) {
  return createCallerFactory(appRouter)({
    db,
    session: { user: { ...actor }, expires: '' },
    headers: new Headers(),
  } as never);
}

async function setup(w: World) {
  const { recruitmentId, formId } = await callerFor(
    w.owner,
  ).oprec.createFromSetup({
    eventId: w.eventId,
    name: 'Oprec Uji',
    form: { mode: 'template' as const },
    divisions: w.units.map((u) => ({
      unitId: u.unitId,
      positionId: u.staffPositionId,
    })),
    minChoices: 1,
    maxChoices: 2,
  });
  return { recruitmentId, formId };
}

const statusOf = async (recruitmentId: string, formId: string) => ({
  oprec: (
    await db
      .select({ s: recruitment.status })
      .from(recruitment)
      .where(eq(recruitment.id, recruitmentId))
  )[0]!.s,
  form: (
    await db.select({ s: form.status }).from(form).where(eq(form.id, formId))
  )[0]!.s,
});

describe('Pengaturan oprec setelah dibuat', () => {
  it('menutup lalu membuka lagi pendaftaran (perpanjangan)', async () => {
    const w = await createOprecWorld(db);
    const { recruitmentId, formId } = await setup(w);
    const caller = callerFor(w.owner);
    await caller.oprec.setStatus({ recruitmentId, status: 'open' });
    await caller.oprec.setStatus({ recruitmentId, status: 'closed' });
    expect(await statusOf(recruitmentId, formId)).toEqual({
      oprec: 'closed',
      form: 'Closed',
    });
    await caller.oprec.setStatus({ recruitmentId, status: 'open' });
    expect(await statusOf(recruitmentId, formId)).toEqual({
      oprec: 'open',
      form: 'Published',
    });
  });

  it('memperpanjang gelombang tanpa menghapus yang lama, dan menambah gelombang baru', async () => {
    const w = await createOprecWorld(db);
    const { recruitmentId } = await setup(w);
    const caller = callerFor(w.owner);
    await caller.oprec.replaceWaves({
      recruitmentId,
      waves: [
        {
          label: '1',
          startsAt: new Date('2026-01-01T00:00:00Z'),
          endsAt: new Date('2026-01-10T00:00:00Z'),
        },
      ],
    });
    const [first] = (await caller.oprec.get({ recruitmentId })).waves;
    await caller.oprec.replaceWaves({
      recruitmentId,
      waves: [
        {
          id: first!.id,
          label: '1',
          startsAt: first!.startsAt,
          endsAt: new Date('2026-01-15T00:00:00Z'),
        },
        {
          label: '2',
          startsAt: new Date('2026-01-20T00:00:00Z'),
          endsAt: new Date('2026-01-30T00:00:00Z'),
        },
      ],
    });
    const waves = (await caller.oprec.get({ recruitmentId })).waves;
    expect(waves.map((x) => x.label)).toEqual(['1', '2']);
    expect(waves[0]!.id).toBe(first!.id);
    expect(waves[0]!.endsAt).toEqual(new Date('2026-01-15T00:00:00Z'));
  });

  it('menyimpan pengaturan penilaian dan penilaian lebih awal', async () => {
    const w = await createOprecWorld(db);
    const { recruitmentId } = await setup(w);
    const caller = callerFor(w.owner);
    await caller.oprec.update({
      recruitmentId,
      settings: {
        statusMethod: 'ambang',
        statusMinScore: 70,
        minReviewers: 2,
        allowEarlyAssessment: true,
      },
    });
    const d = await caller.oprec.get({ recruitmentId });
    expect(d).toMatchObject({
      statusMethod: 'ambang',
      statusMinScore: 70,
      minReviewers: 2,
      allowEarlyAssessment: true,
    });
  });
});
