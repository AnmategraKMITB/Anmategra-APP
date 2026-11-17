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
import { createTestDb, createUser, resetDb } from '~/test/test-db';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

/** Dua pendaftar di Acara; yang pertama diterima. Humas kosong. */
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
  const publish = async () => {
    await db
      .update(schema.recruitment)
      .set({
        placementState: 'final',
        resultsVisibleToApplicants: true,
        resultsReleasedAt: new Date(),
      })
      .where(eq(schema.recruitment.id, fx.recruitmentId));
  };
  const viewer = callerFor(db, (await mahasiswaActor()) as never);
  return { fx, accepted, rejected, kadiv, c1: c1!, publish, viewer };
}

async function mahasiswaActor() {
  const u = await createUser(db, { role: 'mahasiswa' });
  return { id: u.id, role: 'mahasiswa' as const };
}

describe('oprec.announcement', () => {
  it('menolak pengunjung yang belum login', async () => {
    const { fx } = await world();
    expect(
      await codeOf(
        callerFor(db, null).oprec.announcement({
          recruitmentId: fx.recruitmentId,
        }),
      ),
    ).toBe('UNAUTHORIZED');
  });

  it('sebelum tayang tidak memuat baris, tetapi memuat jadwal bila ada', async () => {
    const { fx, viewer } = await world();
    const before = await viewer.oprec.announcement({
      recruitmentId: fx.recruitmentId,
    });
    expect(before).toEqual({
      published: false,
      name: 'Oprec Uji',
      publishAt: null,
    });

    const at = new Date(Date.now() + 3_600_000);
    await db
      .update(schema.recruitment)
      .set({ resultsReleasedAt: new Date(), resultsPublishAt: at })
      .where(eq(schema.recruitment.id, fx.recruitmentId));
    const scheduled = await viewer.oprec.announcement({
      recruitmentId: fx.recruitmentId,
    });
    expect(scheduled).toMatchObject({ published: false, publishAt: at });
    expect(JSON.stringify(scheduled)).not.toContain('sections');
  });

  it('hanya memuat yang diterima, dengan kolom terbatas dan divisi kosong tetap ada', async () => {
    const { fx, viewer, publish } = await world();
    await publish();
    const result = await viewer.oprec.announcement({
      recruitmentId: fx.recruitmentId,
    });
    if (!result.published) throw new Error('harus tayang');
    expect(result.sections).toHaveLength(1);
    const [acara, humas] = result.sections[0]!.divisions;
    expect(acara!.label).toBe('Acara');
    expect(acara!.rows).toHaveLength(1);
    expect(Object.keys(acara!.rows[0]!).sort()).toEqual([
      'angkatan',
      'name',
      'nim',
      'prodi',
    ]);
    expect(humas!.label).toBe('Humas');
    expect(humas!.rows).toEqual([]);
  });

  it('menyembunyikan akun dengan hidden_at tetapi menyertakan yang menyembunyikan hasil pribadi', async () => {
    const { fx, accepted, viewer, publish } = await world();
    await publish();
    await db
      .update(schema.mahasiswa)
      .set({ raporVisible: false })
      .where(eq(schema.mahasiswa.userId, accepted.userId));
    const count = async () => {
      const r = await viewer.oprec.announcement({
        recruitmentId: fx.recruitmentId,
      });
      if (!r.published) throw new Error('harus tayang');
      return r.sections[0]!.divisions[0]!.rows.length;
    };
    expect(await count()).toBe(1);
    await db
      .update(schema.users)
      .set({ hiddenAt: new Date() })
      .where(eq(schema.users.id, accepted.userId));
    expect(await count()).toBe(0);
  });

  it('pengelompokan per bidang mengikuti unit induk', async () => {
    const { fx, viewer, publish } = await world();
    const [bidang] = await db
      .insert(schema.organizationUnit)
      .values({
        structure_id: (
          await db
            .select()
            .from(schema.organizationUnit)
            .where(eq(schema.organizationUnit.id, fx.divisions.Acara!.unitId))
        )[0]!.structure_id,
        name: 'Bidang Inti',
        level: 1,
        sort_order: 9,
      })
      .returning();
    await db
      .update(schema.organizationUnit)
      .set({ parent_id: bidang!.id, level: 2 })
      .where(eq(schema.organizationUnit.id, fx.divisions.Acara!.unitId));
    await publish();
    const r = await viewer.oprec.announcement({
      recruitmentId: fx.recruitmentId,
    });
    if (!r.published) throw new Error('harus tayang');
    expect(r.sections.map((s) => s.label)).toEqual([
      'Bidang Inti',
      'Tanpa bidang',
    ]);
  });

  it('batal penerimaan menghilangkan baris dari daftar', async () => {
    const { fx, kadiv, c1, viewer, publish } = await world();
    await kadiv.oprec.decide({
      recruitmentId: fx.recruitmentId,
      choiceId: c1.id,
      decision: 'tolak',
    });
    await publish();
    const r = await viewer.oprec.announcement({
      recruitmentId: fx.recruitmentId,
    });
    if (!r.published) throw new Error('harus tayang');
    expect(
      r.sections.flatMap((s) => s.divisions).flatMap((d) => d.rows),
    ).toEqual([]);
  });

  it('tidak tayang bila hasil tidak diumumkan lewat Anmategra', async () => {
    const { fx, viewer, publish } = await world();
    await publish();
    await db
      .update(schema.recruitment)
      .set({ resultsVisibleToApplicants: false })
      .where(eq(schema.recruitment.id, fx.recruitmentId));
    const r = await viewer.oprec.announcement({
      recruitmentId: fx.recruitmentId,
    });
    expect(r.published).toBe(false);
  });

  it('satu orang dengan dua penempatan di divisi sama tampil sekali', async () => {
    const { fx, accepted, viewer, publish } = await world();
    await publish();
    await db
      .insert(schema.placement)
      .values({
        positionId: fx.divisions.Acara!.positionId,
        userId: accepted.userId,
        source: 'oprec',
        applicationChoiceId: (await choicesOf(db, accepted.applicationId))[0]!
          .id,
      })
      .onConflictDoNothing();
    const r = await viewer.oprec.announcement({
      recruitmentId: fx.recruitmentId,
    });
    if (!r.published) throw new Error('harus tayang');
    expect(r.sections[0]!.divisions[0]!.rows).toHaveLength(1);
  });
});

describe('oprec.lembagaAnnouncements', () => {
  it('daftar hanya oprec yang sudah tayang milik lembaga itu', async () => {
    const w = await world();
    const [ev] = await db
      .select()
      .from(schema.events)
      .where(
        eq(
          schema.events.id,
          (await db.select().from(schema.recruitment))[0]!.periodId,
        ),
      );
    const input = { lembagaId: ev!.org_id! };
    expect(await w.viewer.oprec.lembagaAnnouncements(input)).toEqual([]);
    await w.publish();
    const list = await w.viewer.oprec.lembagaAnnouncements(input);
    expect(list.map((x) => x.id)).toEqual([w.fx.recruitmentId]);
    expect(
      await w.viewer.oprec.lembagaAnnouncements({
        ...input,
        periodId: ev!.id,
      }),
    ).toHaveLength(1);
    expect(
      await w.viewer.oprec.lembagaAnnouncements({ ...input, periodId: 'lain' }),
    ).toEqual([]);
    expect(
      await w.viewer.oprec.lembagaAnnouncements({ lembagaId: 'lain' }),
    ).toEqual([]);
  });
});
