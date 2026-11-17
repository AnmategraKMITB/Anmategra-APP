import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { periodMemberIds } from '~/server/api/routers/organization/membership';
import * as schema from '~/server/db/schema';
import {
  applyToOprec,
  callerFor,
  choicesOf,
  createOprecFixture,
} from '~/test/oprec-fixture';
import { createTestDb, resetDb } from '~/test/test-db';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

const HOUR = 3_600_000;

/** Oprec final dengan satu pendaftar yang sudah diterima di Acara. */
async function finalWorld() {
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
    .set({ placementState: 'final', resultsVisibleToApplicants: true })
    .where(eq(schema.recruitment.id, fx.recruitmentId));
  const owner = callerFor(db, fx.owner);
  const applicant = callerFor(db, a.actor);
  const placed = async () =>
    (await periodMemberIds(db, fx.eventId)).includes(a.userId);
  return { fx, a, owner, applicant, placed };
}

describe('gerbang tayang hasil oprec', () => {
  it('rilis tanpa jadwal langsung tayang', async () => {
    const { fx, owner, applicant, placed } = await finalWorld();
    expect(await placed()).toBe(false);
    await owner.oprec.resultsRelease({ recruitmentId: fx.recruitmentId });
    expect(await placed()).toBe(true);
    const mine = await applicant.oprec.myResult({
      recruitmentId: fx.recruitmentId,
    });
    expect(mine.released).toBe(true);
  });

  it('rilis dengan jadwal di masa depan belum tayang', async () => {
    const { fx, owner, applicant, placed } = await finalWorld();
    const publishAt = new Date(Date.now() + HOUR);
    await owner.oprec.resultsRelease({
      recruitmentId: fx.recruitmentId,
      publishAt,
    });
    expect(await placed()).toBe(false);
    const mine = await applicant.oprec.myResult({
      recruitmentId: fx.recruitmentId,
    });
    expect(mine.released).toBe(false);
  });

  it('jadwal yang sudah lewat tayang tanpa cron', async () => {
    const { fx, owner, applicant, placed } = await finalWorld();
    await owner.oprec.resultsRelease({
      recruitmentId: fx.recruitmentId,
      publishAt: new Date(Date.now() + HOUR),
    });
    await db
      .update(schema.recruitment)
      .set({ resultsPublishAt: new Date(Date.now() - 1000) })
      .where(eq(schema.recruitment.id, fx.recruitmentId));
    expect(await placed()).toBe(true);
    const mine = await applicant.oprec.myResult({
      recruitmentId: fx.recruitmentId,
    });
    expect(mine.released).toBe(true);
  });

  it('menolak jadwal yang sudah lewat', async () => {
    const { fx, owner } = await finalWorld();
    await expect(
      owner.oprec.resultsRelease({
        recruitmentId: fx.recruitmentId,
        publishAt: new Date(Date.now() - HOUR),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('tarik rilis mengosongkan jadwal dan menyembunyikan lagi', async () => {
    const { fx, owner, applicant, placed } = await finalWorld();
    await owner.oprec.resultsRelease({ recruitmentId: fx.recruitmentId });
    await owner.oprec.resultsWithdraw({
      recruitmentId: fx.recruitmentId,
      reason: 'Salah data',
    });
    const [row] = await db
      .select()
      .from(schema.recruitment)
      .where(eq(schema.recruitment.id, fx.recruitmentId));
    expect(row!.resultsReleasedAt).toBeNull();
    expect(row!.resultsPublishAt).toBeNull();
    expect(await placed()).toBe(false);
    expect(
      (await applicant.oprec.myResult({ recruitmentId: fx.recruitmentId }))
        .released,
    ).toBe(false);
  });

  it('rilis ulang setelah ditarik berhasil', async () => {
    const { fx, owner, placed } = await finalWorld();
    await owner.oprec.resultsRelease({ recruitmentId: fx.recruitmentId });
    await owner.oprec.resultsWithdraw({
      recruitmentId: fx.recruitmentId,
      reason: 'Salah data',
    });
    await owner.oprec.resultsRelease({ recruitmentId: fx.recruitmentId });
    expect(await placed()).toBe(true);
  });
});
