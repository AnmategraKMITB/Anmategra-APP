import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '~/server/db/schema';
import {
  applyToOprec,
  callerFor,
  choicesOf,
  codeOf,
  createOprecFixture,
} from '~/test/oprec-fixture';
import { createTestDb, raceWithCommittedUpdate, resetDb } from '~/test/test-db';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

/** Pendaftar diterima di Acara, masa banding, satu permintaan pindah ke Humas. */
async function openRequest() {
  const fx = await createOprecFixture(db);
  const a = await applyToOprec(db, fx, ['Acara']);
  const [first] = await choicesOf(db, a.applicationId);
  await callerFor(db, fx.divisions.Acara!.kadiv).oprec.decide({
    recruitmentId: fx.recruitmentId,
    choiceId: first!.id,
    decision: 'terima',
  });
  await db
    .update(schema.recruitment)
    .set({ placementState: 'masa_banding' })
    .where(eq(schema.recruitment.id, fx.recruitmentId));
  const [request] = await db
    .insert(schema.transferRequest)
    .values({
      recruitmentId: fx.recruitmentId,
      applicationId: a.applicationId,
      fromDivisionId: fx.divisions.Acara!.id,
      toDivisionId: fx.divisions.Humas!.id,
      reason: 'Lebih cocok di Humas.',
      requestedBy: fx.owner.id,
    })
    .returning();
  const statusOf = async () => {
    const [row] = await db
      .select({ status: schema.transferRequest.status })
      .from(schema.transferRequest)
      .where(eq(schema.transferRequest.id, request!.id));
    return row!.status;
  };
  return {
    fx,
    a,
    requestId: request!.id,
    owner: callerFor(db, fx.owner),
    statusOf,
  };
}

describe('transferCancel', () => {
  it('tidak menimpa permintaan yang baru saja disetujui', async () => {
    const { fx, requestId, owner, statusOf } = await openRequest();

    const code = await raceWithCommittedUpdate(
      (tx) =>
        tx`update anmategra_transfer_request set status = 'disetujui' where id = ${requestId}`,
      () =>
        codeOf(
          owner.oprec.transferCancel({
            recruitmentId: fx.recruitmentId,
            requestId,
          }),
        ),
    );

    expect(code).toBe('BAD_REQUEST');
    expect(await statusOf()).toBe('disetujui');
  });
});

describe('transferResolve', () => {
  it('menolak menandai permintaan ditolak', async () => {
    const { fx, requestId, owner, statusOf } = await openRequest();
    await owner.oprec.transferResolve({
      recruitmentId: fx.recruitmentId,
      requestId,
      resolution: 'tolak',
    });
    expect(await statusOf()).toBe('ditolak');
  });

  it('menyetujui menandai permintaan disetujui', async () => {
    const { fx, requestId, owner, statusOf } = await openRequest();
    await owner.oprec.transferResolve({
      recruitmentId: fx.recruitmentId,
      requestId,
      resolution: 'setuju',
    });
    expect(await statusOf()).toBe('disetujui');
  });

  it('permintaan yang sudah diputuskan tidak bisa diputuskan lagi', async () => {
    const { fx, requestId, owner, statusOf } = await openRequest();
    await owner.oprec.transferResolve({
      recruitmentId: fx.recruitmentId,
      requestId,
      resolution: 'tolak',
    });
    expect(
      await codeOf(
        owner.oprec.transferResolve({
          recruitmentId: fx.recruitmentId,
          requestId,
          resolution: 'setuju',
        }),
      ),
    ).toBe('BAD_REQUEST');
    expect(await statusOf()).toBe('ditolak');
  });
});
