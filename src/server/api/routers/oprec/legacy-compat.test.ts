/**
 * Kompatibilitas dengan data dan alur yang sudah ada sebelum status oprec dan
 * formulir disatukan: migrasi 0053 pada data lama, formulir biasa, dan oprec
 * yang sudah berada di masa banding.
 */
import { eq, sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '~/server/db/schema';
import {
  type OprecFixture,
  applyToOprec,
  callerFor,
  choicesOf,
  codeOf,
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

const DAY = 24 * 60 * 60 * 1000;

const MIGRATION = readFileSync(
  path.resolve(process.cwd(), 'drizzle', '0053_oprec_status_sync.sql'),
  'utf8',
);

/** Menjalankan ulang pernyataan migrasi 0053 terhadap data uji. */
async function runStatusSync() {
  for (const statement of MIGRATION.split('--> statement-breakpoint')) {
    if (statement.trim()) await db.execute(sql.raw(statement));
  }
}

const setForm = (
  fx: OprecFixture,
  values: Partial<typeof schema.form.$inferInsert>,
) => db.update(schema.form).set(values).where(eq(schema.form.id, fx.formId));

const setRecruitment = (
  fx: OprecFixture,
  values: Partial<typeof schema.recruitment.$inferInsert>,
) =>
  db
    .update(schema.recruitment)
    .set(values)
    .where(eq(schema.recruitment.id, fx.recruitmentId));

async function statusOf(fx: OprecFixture) {
  const [row] = await db
    .select({
      oprec: schema.recruitment.status,
      placementState: schema.recruitment.placementState,
      form: schema.form.status,
    })
    .from(schema.recruitment)
    .innerJoin(schema.form, eq(schema.form.id, schema.recruitment.formId))
    .where(eq(schema.recruitment.id, fx.recruitmentId));
  return row!;
}

async function acceptFirstChoice(fx: OprecFixture, division: string) {
  const a = await applyToOprec(db, fx, [division]);
  const [choice] = await choicesOf(db, a.applicationId);
  await callerFor(db, fx.divisions[division]!.kadiv).oprec.decide({
    recruitmentId: fx.recruitmentId,
    choiceId: choice!.id,
    decision: 'terima',
  });
  return choice!.id;
}

async function decisionTrail(choiceId: string) {
  const decisions = await db
    .select({ decision: schema.placementDecision.decision })
    .from(schema.placementDecision)
    .where(eq(schema.placementDecision.choiceId, choiceId));
  const placements = await db
    .select({ positionId: schema.placement.positionId })
    .from(schema.placement)
    .where(eq(schema.placement.applicationChoiceId, choiceId));
  return { decisions, placements };
}

describe('migrasi 0053 pada data lama', () => {
  it('menyelaraskan yang berselisih dan tidak menyentuh oprec yang sudah sinkron', async () => {
    // A. Oprec dibuka, formulirnya ditutup dari editor Forms lama.
    const a = await createOprecFixture(db);
    await setForm(a, { status: 'Closed' });
    // B. Oprec berjalan normal dengan pendaftar yang sudah diterima.
    const b = await createOprecFixture(db);
    const acceptedB = await acceptFirstChoice(b, 'Acara');
    const trailB = await decisionTrail(acceptedB);
    // C. Oprec draf yang formulirnya terbit tanpa jawaban.
    const c = await createOprecFixture(db, { open: false });
    await setForm(c, { status: 'Published', publishedAt: new Date() });
    // D. Oprec dibuka dengan formulir draf dan tanpa pendaftar.
    const d = await createOprecFixture(db);
    await setForm(d, { status: 'Draft' });
    // E. Oprec draf tanpa pendaftar yang penempatannya sudah dimajukan.
    const e = await createOprecFixture(db, { open: false });
    await setRecruitment(e, { placementState: 'masa_banding' });
    // F. Oprec ditutup dengan benar dan punya keputusan.
    const f = await createOprecFixture(db);
    const acceptedF = await acceptFirstChoice(f, 'Humas');
    await callerFor(db, f.owner).oprec.setStatus({
      recruitmentId: f.recruitmentId,
      status: 'closed',
    });

    const expectSynced = async () => {
      expect(await statusOf(a)).toMatchObject({
        oprec: 'closed',
        form: 'Closed',
      });
      expect(await statusOf(b)).toEqual({
        oprec: 'open',
        form: 'Published',
        placementState: 'berjalan',
      });
      expect(await statusOf(c)).toMatchObject({
        oprec: 'draft',
        form: 'Draft',
      });
      expect(await statusOf(d)).toMatchObject({
        oprec: 'draft',
        form: 'Draft',
      });
      expect(await statusOf(e)).toMatchObject({
        oprec: 'draft',
        placementState: 'berjalan',
      });
      expect(await statusOf(f)).toMatchObject({
        oprec: 'closed',
        form: 'Closed',
      });
      // Keputusan dan penempatan organogram yang sudah ada tetap utuh.
      expect(await decisionTrail(acceptedB)).toEqual(trailB);
      expect((await decisionTrail(acceptedF)).placements).toHaveLength(1);
    };

    await runStatusSync();
    await expectSynced();
    // Aman dijalankan ulang: tidak ada perubahan kedua.
    await runStatusSync();
    await expectSynced();
  });
});

describe('formulir biasa (bukan oprec)', () => {
  it('status dan tenggat bekerja seperti sebelumnya', async () => {
    const fx = await createOprecFixture(db, { open: false });
    const [plain] = await db
      .insert(schema.form)
      .values({
        eventId: fx.eventId,
        title: 'Survei biasa',
        createdBy: fx.owner.id,
      })
      .returning();
    const [section] = await db
      .insert(schema.formSection)
      .values({ formId: plain!.id, title: 'Bagian 1', sortOrder: 0 })
      .returning();
    await db.insert(schema.formField).values({
      formId: plain!.id,
      sectionId: section!.id,
      type: 'short_text',
      label: 'Nama panggilan',
      config: {},
      sortOrder: 0,
    });

    const owner = callerFor(db, fx.owner);
    const set = async (status: 'Draft' | 'Published' | 'Closed') =>
      (await owner.form.setStatus({ formId: plain!.id, status })).status;
    expect(await set('Published')).toBe('Published');
    expect(await set('Closed')).toBe('Closed');
    expect(await set('Published')).toBe('Published');
    expect(await set('Draft')).toBe('Draft');

    await db
      .update(schema.form)
      .set({ closesAt: new Date(Date.now() - DAY) })
      .where(eq(schema.form.id, plain!.id));
    expect(
      await codeOf(
        owner.form.update({
          formId: plain!.id,
          closesAt: new Date(Date.now() + DAY),
        }),
      ),
    ).toBe('OK');

    // Oprec di kegiatan yang sama tidak ikut berubah.
    expect(await statusOf(fx)).toMatchObject({ oprec: 'draft', form: 'Draft' });
  });
});

describe('oprec lama yang sudah di masa banding', () => {
  it('bisa difinalkan setelah pendaftaran ditutup, tanpa kehilangan keputusan', async () => {
    const fx = await createOprecFixture(db);
    const accepted = await acceptFirstChoice(fx, 'Acara');
    // Data lama: masuk masa banding saat pendaftaran belum pernah ditutup.
    await setRecruitment(fx, { placementState: 'masa_banding' });
    const owner = callerFor(db, fx.owner);
    const toFinal = () =>
      owner.oprec.setPlacementState({
        recruitmentId: fx.recruitmentId,
        state: 'final',
      });

    await expect(toFinal()).rejects.toThrow('sebelum menetapkan final');
    await owner.oprec.setStatus({
      recruitmentId: fx.recruitmentId,
      status: 'closed',
    });
    expect(await toFinal()).toMatchObject({ success: true });

    const trail = await decisionTrail(accepted);
    expect(trail.decisions).toEqual([{ decision: 'terima' }]);
    expect(trail.placements).toEqual([
      { positionId: fx.divisions.Acara!.positionId },
    ]);
  });
});
