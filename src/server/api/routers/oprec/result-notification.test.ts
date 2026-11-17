import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '~/server/db/schema';
import {
  applyToOprec,
  callerFor,
  choicesOf,
  createOprecFixture,
} from '~/test/oprec-fixture';
import { createMahasiswa, createTestDb, createUser, resetDb } from '~/test/test-db';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

async function world() {
  const fx = await createOprecFixture(db);
  const accepted = await applyToOprec(db, fx, ['Acara']);
  const rejected = await applyToOprec(db, fx, ['Acara']);
  const kadiv = callerFor(db, fx.divisions.Acara!.kadiv);
  const [c1] = await choicesOf(db, accepted.applicationId);
  const [c2] = await choicesOf(db, rejected.applicationId);
  await kadiv.oprec.decide({
    recruitmentId: fx.recruitmentId,
    choiceId: c1!.id,
    decision: 'terima',
  });
  await kadiv.oprec.decide({
    recruitmentId: fx.recruitmentId,
    choiceId: c2!.id,
    decision: 'tolak',
  });
  await db
    .update(schema.recruitment)
    .set({ placementState: 'final', resultsVisibleToApplicants: true })
    .where(eq(schema.recruitment.id, fx.recruitmentId));

  // Draf (belum terkirim): tidak diberi tahu.
  const draftUser = await createUser(db, { role: 'mahasiswa' });
  await createMahasiswa(db, draftUser.id);
  await db.insert(schema.application).values({
    recruitmentId: fx.recruitmentId,
    userId: draftUser.id,
    source: 'form',
    submittedAt: null,
  });
  // Closerec: ikut diberi tahu walau tanpa pengiriman form.
  const closerecUser = await createUser(db, { role: 'mahasiswa' });
  await createMahasiswa(db, closerecUser.id);
  await db.insert(schema.application).values({
    recruitmentId: fx.recruitmentId,
    userId: closerecUser.id,
    source: 'closerec',
    submittedAt: null,
  });

  return { fx, accepted, rejected, draftUser, closerecUser, owner: callerFor(db, fx.owner) };
}

const forUser = (userId: string) =>
  db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.user_id, userId));

describe('pemberitahuan hasil oprec', () => {
  it('rilis memberi tahu pendaftar terkirim dan closerec, bukan draf, dengan pesan seragam', async () => {
    const w = await world();
    await w.owner.oprec.resultsRelease({ recruitmentId: w.fx.recruitmentId });

    const [a] = await forUser(w.accepted.userId);
    const [r] = await forUser(w.rejected.userId);
    expect(a).toBeDefined();
    expect(a!.title).toBe(r!.title);
    expect(a!.content).toBe(r!.content);
    expect(a!.title).toContain('Oprec Uji');
    expect(a!.links).toEqual([
      { label: 'Lihat hasil saya', href: `/forms/${w.fx.formId}` },
      {
        label: 'Lihat daftar pengumuman',
        href: `/pengumuman/${w.fx.recruitmentId}`,
      },
    ]);
    expect(await forUser(w.closerecUser.id)).toHaveLength(1);
    expect(await forUser(w.draftUser.id)).toHaveLength(0);
  });

  it('tarik lalu rilis ulang tidak menggandakan pemberitahuan', async () => {
    const w = await world();
    await w.owner.oprec.resultsRelease({ recruitmentId: w.fx.recruitmentId });
    await w.owner.oprec.resultsWithdraw({
      recruitmentId: w.fx.recruitmentId,
      reason: 'Salah data',
    });
    await w.owner.oprec.resultsRelease({ recruitmentId: w.fx.recruitmentId });
    expect(await forUser(w.accepted.userId)).toHaveLength(1);
  });

  it('rilis batal bila pembuatan pemberitahuan gagal', async () => {
    const w = await world();
    await db.execute(sql`CREATE OR REPLACE FUNCTION fail_notif() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'gagal uji'; END; $$ LANGUAGE plpgsql`);
    await db.execute(sql`CREATE TRIGGER fail_notif_trg BEFORE INSERT ON anmategra_notification
      FOR EACH ROW EXECUTE FUNCTION fail_notif()`);
    try {
      await expect(
        w.owner.oprec.resultsRelease({ recruitmentId: w.fx.recruitmentId }),
      ).rejects.toBeDefined();
    } finally {
      await db.execute(sql`DROP TRIGGER fail_notif_trg ON anmategra_notification`);
      await db.execute(sql`DROP FUNCTION fail_notif()`);
    }
    const [row] = await db
      .select()
      .from(schema.recruitment)
      .where(eq(schema.recruitment.id, w.fx.recruitmentId));
    expect(row!.resultsReleasedAt).toBeNull();
  });

  it('Inbox menyaring pemberitahuan dengan gerbang tayang', async () => {
    const w = await world();
    const me = callerFor(db, w.accepted.actor);
    await w.owner.oprec.resultsRelease({
      recruitmentId: w.fx.recruitmentId,
      publishAt: new Date(Date.now() + 3_600_000),
    });
    expect(await me.oprec.myResultNotifications()).toHaveLength(0);

    await db
      .update(schema.recruitment)
      .set({ resultsPublishAt: new Date(Date.now() - 1000) })
      .where(eq(schema.recruitment.id, w.fx.recruitmentId));
    const items = await me.oprec.myResultNotifications();
    expect(items).toHaveLength(1);
    expect(items[0]!.read).toBe(false);

    await me.oprec.markResultNotificationRead({ id: items[0]!.id });
    expect((await me.oprec.myResultNotifications())[0]!.read).toBe(true);
  });

  it('pengguna lain tidak bisa menandai pemberitahuan orang lain', async () => {
    const w = await world();
    await w.owner.oprec.resultsRelease({ recruitmentId: w.fx.recruitmentId });
    const [n] = await forUser(w.accepted.userId);
    await callerFor(db, w.rejected.actor).oprec.markResultNotificationRead({
      id: n!.id,
    });
    const [after] = await db
      .select()
      .from(schema.notifications)
      .where(and(eq(schema.notifications.id, n!.id)));
    expect(after!.read).toBe(false);
  });
});
