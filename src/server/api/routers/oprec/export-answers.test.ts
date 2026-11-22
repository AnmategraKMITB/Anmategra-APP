import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import {
  application,
  applicationChoice,
  formAnswer,
  formField,
  formSection,
  formSubmission,
  recruitment,
  recruitmentDivision,
  recruitmentSectionBinding,
} from '~/server/db/schema';
import { createOprecWorld as baseWorld, placeAt } from '~/test/oprec-fixtures';
import {
  createMahasiswa,
  createTestDb,
  createUser,
  resetDb,
} from '~/test/test-db';

import { oprecRouter } from '.';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

const appRouter = createTRPCRouter({ oprec: oprecRouter });

type Actor = { id: string; role: string; lembagaId: string | null };

function callerFor(actor: Actor) {
  return createCallerFactory(appRouter)({
    db,
    session: { user: { ...actor }, expires: '' },
    headers: new Headers(),
  } as never);
}

/**
 * Oprec Logistik + IT, tiap divisi punya Kadiv. Bagian "Data diri" umum
 * (MBTI, kontak darurat) dan bagian "Khusus Logistik" yang terikat ke
 * Logistik. Dua pendaftar: X memilih Logistik lalu IT, Y hanya IT.
 */
async function setup() {
  const w = await baseWorld(db, ['Logistik', 'IT']);
  const heads: Actor[] = [];
  for (const u of w.units) {
    const head: Actor = {
      id: (await createUser(db)).id,
      role: 'mahasiswa',
      lembagaId: null,
    };
    await placeAt(db, u.headPositionId, head.id);
    heads.push(head);
  }
  const admin = callerFor(w.owner);
  const { recruitmentId } = await admin.oprec.createFromSetup({
    eventId: w.eventId,
    name: 'Oprec Ekspor Uji',
    form: { mode: 'template' as const },
    divisions: w.units.map((u) => ({
      unitId: u.unitId,
      positionId: u.staffPositionId,
    })),
    minChoices: 1,
    maxChoices: 2,
    allowRedirect: false,
  });
  const [logistik, it_] = (await db
    .select({ id: recruitmentDivision.id })
    .from(recruitmentDivision)
    .where(eq(recruitmentDivision.recruitmentId, recruitmentId))
    .orderBy(asc(recruitmentDivision.sortOrder))) as [
    { id: string },
    { id: string },
  ];
  const [rec] = await db
    .select({ formId: recruitment.formId })
    .from(recruitment)
    .where(eq(recruitment.id, recruitmentId));
  const formId = rec!.formId;

  const [umum] = await db
    .insert(formSection)
    .values({ formId, title: 'Data diri uji', sortOrder: 90 })
    .returning();
  const [khusus] = await db
    .insert(formSection)
    .values({ formId, title: 'Khusus Logistik uji', sortOrder: 91 })
    .returning();
  await db.insert(recruitmentSectionBinding).values({
    recruitmentId,
    formSectionId: khusus!.id,
    divisionId: logistik.id,
  });
  const field = async (
    sectionId: string,
    label: string,
    type: 'short_text' | 'number' = 'short_text',
  ) =>
    (
      await db
        .insert(formField)
        .values({ formId, sectionId, type, label, sortOrder: 0 })
        .returning()
    )[0]!;
  const mbti = await field(umum!.id, 'MBTI uji');
  const darurat = await field(umum!.id, 'Kontak darurat uji');
  const alat = await field(khusus!.id, 'Alat yang dikuasai uji');

  const apply = async (divisionIds: string[], answers: [string, string][]) => {
    const user = await createUser(db);
    await createMahasiswa(db, user.id, { nama: `P ${user.id.slice(0, 4)}` });
    const now = new Date();
    const [sub] = await db
      .insert(formSubmission)
      .values({ formId, userId: user.id, submittedAt: now, updatedAt: now })
      .returning();
    const [app] = await db
      .insert(application)
      .values({
        recruitmentId,
        userId: user.id,
        source: 'form',
        submittedAt: now,
        formSubmissionId: sub!.id,
      })
      .returning();
    await db.insert(applicationChoice).values(
      divisionIds.map((divisionId, i) => ({
        applicationId: app!.id,
        divisionId,
        rank: i + 1,
        origin: 'dipilih' as const,
      })),
    );
    await db.insert(formAnswer).values(
      answers.map(([fieldId, value]) => ({
        submissionId: sub!.id,
        fieldId,
        fieldLabel: 'uji',
        fieldType: 'short_text' as const,
        value,
      })),
    );
    return app!.id;
  };
  const x = await apply(
    [logistik.id, it_.id],
    [
      [mbti.id, 'INTJ'],
      [darurat.id, '0812 (Ibu)'],
      [alat.id, 'Forklift'],
    ],
  );
  const y = await apply([it_.id], [[mbti.id, 'ENFP']]);

  return {
    recruitmentId,
    admin,
    kadivLogistik: callerFor(heads[0]!),
    kadivIt: callerFor(heads[1]!),
    logistik,
    it: it_,
    fields: { mbti, darurat, alat },
    apps: { x, y },
  };
}

const labels = (columns: { label: string }[]) =>
  columns.map((c) => c.label).filter((l) => l.endsWith(' uji'));

describe('ekspor jawaban formulir oprec', () => {
  it('admin melihat semua pertanyaan dan semua pendaftar', async () => {
    const s = await setup();
    const data = await s.admin.oprec.exportAnswers({
      recruitmentId: s.recruitmentId,
    });
    expect(labels(data.columns)).toEqual([
      'MBTI uji',
      'Kontak darurat uji',
      'Alat yang dikuasai uji',
    ]);
    expect(
      data.columns.find((c) => c.fieldId === s.fields.alat.id)?.divisionIds,
    ).toEqual([s.logistik.id]);
    expect(data.columns.some((c) => c.type === 'unit_choice')).toBe(false);
    expect(new Set(data.rows.map((r) => r.applicationId))).toEqual(
      new Set([s.apps.x, s.apps.y]),
    );
  });

  it('pengurus divisi hanya melihat pertanyaan umum dan bagian divisinya, untuk pendaftar divisinya', async () => {
    const s = await setup();
    const it = await s.kadivIt.oprec.exportAnswers({
      recruitmentId: s.recruitmentId,
    });
    expect(labels(it.columns)).toEqual(['MBTI uji', 'Kontak darurat uji']);
    expect(new Set(it.rows.map((r) => r.applicationId))).toEqual(
      new Set([s.apps.x, s.apps.y]),
    );

    const logistik = await s.kadivLogistik.oprec.exportAnswers({
      recruitmentId: s.recruitmentId,
    });
    expect(labels(logistik.columns)).toContain('Alat yang dikuasai uji');
    expect(logistik.rows.map((r) => r.applicationId)).toEqual([s.apps.x]);
    expect(logistik.rows[0]!.answers[s.fields.alat.id]).toBe('Forklift');
  });

  it('fieldIds membatasi kolom, dan id di luar hak akses diabaikan', async () => {
    const s = await setup();
    const data = await s.kadivIt.oprec.exportAnswers({
      recruitmentId: s.recruitmentId,
      fieldIds: [s.fields.mbti.id, s.fields.alat.id],
    });
    expect(data.columns.map((c) => c.fieldId)).toEqual([s.fields.mbti.id]);
    const y = data.rows.find((r) => r.applicationId === s.apps.y);
    expect(y?.answers).toEqual({ [s.fields.mbti.id]: 'ENFP' });

    const none = await s.admin.oprec.exportAnswers({
      recruitmentId: s.recruitmentId,
      fieldIds: [],
    });
    expect(none).toMatchObject({ columns: [], rows: [] });
  });
});

describe('preset ekspor', () => {
  it('admin menyimpan preset bersama; nama sama menimpa', async () => {
    const s = await setup();
    const { mbti, darurat, alat } = s.fields;
    await s.admin.oprec.exportPresetSave({
      recruitmentId: s.recruitmentId,
      name: 'Data diri',
      fieldIds: [mbti.id, 'bukan-pertanyaan'],
    });
    await s.admin.oprec.exportPresetSave({
      recruitmentId: s.recruitmentId,
      name: 'Data diri',
      fieldIds: [mbti.id, darurat.id, alat.id],
    });
    const admin = await s.admin.oprec.exportOptions({
      recruitmentId: s.recruitmentId,
    });
    expect(admin.canSavePresets).toBe(true);
    expect(admin.presets).toMatchObject([
      { name: 'Data diri', fieldIds: [mbti.id, darurat.id, alat.id] },
    ]);
    expect(
      admin.fields.find((f) => f.fieldId === alat.id)?.divisions,
    ).toEqual(['Logistik']);

    // Kadiv IT memakai preset yang sama, tanpa pertanyaan khusus Logistik.
    const it = await s.kadivIt.oprec.exportOptions({
      recruitmentId: s.recruitmentId,
    });
    expect(it.canSavePresets).toBe(false);
    expect(it.presets[0]!.fieldIds).toEqual([mbti.id, darurat.id]);
  });

  it('hanya admin yang boleh menyimpan atau menghapus preset', async () => {
    const s = await setup();
    await expect(
      s.kadivIt.oprec.exportPresetSave({
        recruitmentId: s.recruitmentId,
        name: 'Punyaku',
        fieldIds: [s.fields.mbti.id],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const saved = await s.admin.oprec.exportPresetSave({
      recruitmentId: s.recruitmentId,
      name: 'Kontak',
      fieldIds: [s.fields.darurat.id],
    });
    await expect(
      s.kadivIt.oprec.exportPresetDelete({
        recruitmentId: s.recruitmentId,
        presetId: saved.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await s.admin.oprec.exportPresetDelete({
      recruitmentId: s.recruitmentId,
      presetId: saved.id,
    });
    const after = await s.admin.oprec.exportOptions({
      recruitmentId: s.recruitmentId,
    });
    expect(after.presets).toEqual([]);
  });
});
