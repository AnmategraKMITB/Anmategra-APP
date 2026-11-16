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

async function acceptedApplicant() {
  const fx = await createOprecFixture(db);
  const a = await applyToOprec(db, fx, ['Acara']);
  const [first] = await choicesOf(db, a.applicationId);
  await callerFor(db, fx.divisions.Acara!.kadiv).oprec.decide({
    recruitmentId: fx.recruitmentId,
    choiceId: first!.id,
    decision: 'terima',
  });
  const setRecruitment = (values: Partial<typeof schema.recruitment.$inferInsert>) =>
    db
      .update(schema.recruitment)
      .set(values)
      .where(eq(schema.recruitment.id, fx.recruitmentId));
  return { fx, userId: a.userId, setRecruitment };
}

describe('penempatan oprec sebelum hasil dirilis', () => {
  it('tidak terhitung anggota periode sampai hasilnya dirilis', async () => {
    const { fx, userId, setRecruitment } = await acceptedApplicant();
    const kadiv = fx.divisions.Acara!.kadiv!.id;
    await setRecruitment({ resultsVisibleToApplicants: true });

    const before = await periodMemberIds(db, fx.eventId);
    expect(before).toContain(kadiv);
    expect(before).not.toContain(userId);

    await setRecruitment({ placementState: 'final' });
    expect(await periodMemberIds(db, fx.eventId)).not.toContain(userId);

    await setRecruitment({ resultsReleasedAt: new Date() });
    expect(await periodMemberIds(db, fx.eventId)).toContain(userId);
  });

  it('oprec yang diumumkan di luar Anmategra berlaku begitu final', async () => {
    const { fx, userId, setRecruitment } = await acceptedApplicant();
    await setRecruitment({ resultsVisibleToApplicants: false });
    expect(await periodMemberIds(db, fx.eventId)).not.toContain(userId);

    await setRecruitment({ placementState: 'final' });
    expect(await periodMemberIds(db, fx.eventId)).toContain(userId);
  });
});
