import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import {
  criterion,
  recruitment,
  recruitmentDivision,
} from '~/server/db/schema';
import { createOprecWorld } from '~/test/oprec-fixtures';
import { createTestDb, resetDb } from '~/test/test-db';

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

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
    return 'OK';
  } catch (error) {
    return (error as { code?: string }).code ?? 'ERROR';
  }
}

/** Masukan minimum yang sah untuk `createFromSetup`. */
function baseInput(w: World) {
  return {
    eventId: w.eventId,
    name: 'Oprec Uji',
    form: { mode: 'template' as const },
    divisions: w.units.map((u) => ({
      unitId: u.unitId,
      positionId: u.staffPositionId,
    })),
    minChoices: 1,
    maxChoices: 2,
  };
}

describe('createFromSetup: kriteria (K-01, K-02)', () => {
  it('menyimpan kriteria umum dan per tujuan dalam transaksi yang sama', async () => {
    const w = await createOprecWorld(db);
    const [a, b] = w.units;
    const caller = callerFor(w.owner);

    const { recruitmentId } = await caller.oprec.createFromSetup({
      ...baseInput(w),
      criteria: [
        { scope: 'umum', name: 'Motivasi', kind: 'skor', weight: 60 },
        { scope: 'umum', name: 'Komitmen', kind: 'skor', weight: 40 },
        { scope: a!.unitId, name: 'Twibbon', kind: 'gugur_manual' },
        { scope: b!.unitId, name: 'Teknis', kind: 'skor', weight: 100 },
      ],
    });

    const divisions = await db
      .select()
      .from(recruitmentDivision)
      .where(eq(recruitmentDivision.recruitmentId, recruitmentId));
    const divisionOf = (unitId: string) =>
      divisions.find((d) => d.unitId === unitId)!.id;
    const rows = await db
      .select()
      .from(criterion)
      .where(eq(criterion.recruitmentId, recruitmentId));
    const pick = (name: string) => rows.find((r) => r.name === name)!;

    expect(rows).toHaveLength(4);
    expect(pick('Motivasi')).toMatchObject({
      divisionId: null,
      kind: 'skor',
      weight: 60,
      sortOrder: 0,
    });
    expect(pick('Komitmen')).toMatchObject({ divisionId: null, sortOrder: 1 });
    expect(pick('Twibbon')).toMatchObject({
      divisionId: divisionOf(a!.unitId),
      kind: 'gugur_manual',
      weight: null,
    });
    expect(pick('Teknis')).toMatchObject({
      divisionId: divisionOf(b!.unitId),
      weight: 100,
    });
  });

  it('menolak jenis gugur_otomatis', async () => {
    const w = await createOprecWorld(db);
    const code = await codeOf(
      callerFor(w.owner).oprec.createFromSetup({
        ...baseInput(w),
        criteria: [
          { scope: 'umum', name: 'Bersedia', kind: 'gugur_otomatis' },
        ] as never,
      }),
    );
    expect(code).toBe('BAD_REQUEST');
    expect(await db.select().from(recruitment)).toHaveLength(0);
  });

  it('membatalkan seluruh pembuatan bila kriteria menyebut tujuan yang tidak dibuka', async () => {
    const w = await createOprecWorld(db);
    const code = await codeOf(
      callerFor(w.owner).oprec.createFromSetup({
        ...baseInput(w),
        criteria: [
          { scope: 'umum', name: 'Motivasi', kind: 'skor', weight: 100 },
          { scope: 'tidak-ada', name: 'X', kind: 'skor', weight: 10 },
        ],
      }),
    );
    expect(code).toBe('BAD_REQUEST');
    expect(await db.select().from(recruitment)).toHaveLength(0);
    expect(await db.select().from(criterion)).toHaveLength(0);
  });
});
