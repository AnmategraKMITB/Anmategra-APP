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
import {
  createMahasiswa,
  createTestDb,
  createUser,
  resetDb,
} from '~/test/test-db';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

const recruitmentOf = async (id: string) =>
  (
    await db
      .select()
      .from(schema.recruitment)
      .where(eq(schema.recruitment.id, id))
  )[0]!;

describe('createFromSetup', () => {
  it('membuat oprec draf dengan divisi, form templat, dan kriteria', async () => {
    const fx = await createOprecFixture(db, {
      open: false,
      criteria: [
        { scope: 'umum', name: 'Motivasi', kind: 'skor', weight: 100 },
        { scope: 'Acara', name: 'Portofolio', kind: 'gugur_manual' },
      ],
    });

    expect(await recruitmentOf(fx.recruitmentId)).toMatchObject({
      status: 'draft',
      placementState: 'berjalan',
      formId: fx.formId,
    });
    expect(Object.keys(fx.divisions)).toEqual(['Acara', 'Humas']);

    const criteria = await db
      .select()
      .from(schema.criterion)
      .where(eq(schema.criterion.recruitmentId, fx.recruitmentId));
    const byName = Object.fromEntries(criteria.map((c) => [c.name, c]));
    expect(byName.Motivasi).toMatchObject({
      kind: 'skor',
      divisionId: null,
      weight: 100,
    });
    expect(byName.Portofolio).toMatchObject({
      kind: 'gugur_manual',
      divisionId: fx.divisions.Acara!.id,
      weight: null,
    });

    // Formulir oprec dikunci: satu respons per akun, tanpa edit, tanpa kuota.
    const [form] = await db
      .select()
      .from(schema.form)
      .where(eq(schema.form.id, fx.formId));
    expect(form).toMatchObject({
      allowMultipleSubmissions: false,
      allowEditAfterSubmit: false,
      maxResponses: null,
    });
  });

  // Karakterisasi K-02: server belum menerima gugur otomatis dari wizard.
  // PR 3 mengubahnya menjadi draf aturan.
  it('kriteria gugur otomatis belum diterima server', async () => {
    const fx = await createOprecFixture(db, { open: false });
    const code = await codeOf(
      callerFor(db, fx.owner).oprec.createFromSetup({
        eventId: fx.eventId,
        name: 'Oprec Kedua',
        form: { mode: 'template' },
        divisions: [
          {
            unitId: fx.divisions.Acara!.unitId,
            positionId: fx.divisions.Acara!.positionId,
          },
        ],
        minChoices: 1,
        maxChoices: 1,
        criteria: [
          {
            scope: 'umum',
            name: 'Bersedia',
            kind: 'gugur_otomatis' as 'gugur_manual',
          },
        ],
      }),
    );
    expect(code).toBe('BAD_REQUEST');
  });

  it('hanya pengelola oprec yang bisa membuat oprec', async () => {
    const fx = await createOprecFixture(db, { open: false });
    const stranger = await createUser(db, { role: 'mahasiswa' });
    const code = await codeOf(
      callerFor(db, {
        id: stranger.id,
        role: 'mahasiswa',
      }).oprec.createFromSetup({
        eventId: fx.eventId,
        name: 'Oprec Liar',
        form: { mode: 'template' },
        divisions: [
          {
            unitId: fx.divisions.Acara!.unitId,
            positionId: fx.divisions.Acara!.positionId,
          },
        ],
        minChoices: 1,
        maxChoices: 1,
      }),
    );
    expect(code).toBe('FORBIDDEN');
  });
});

describe('pendaftaran lewat form oprec', () => {
  it('menyimpan pilihan berurutan beserta kesediaan dipindahkan', async () => {
    const fx = await createOprecFixture(db, { allowRedirect: true });
    const a = await applyToOprec(db, fx, ['Humas', 'Acara'], {
      willingToMove: true,
    });

    const choices = await choicesOf(db, a.applicationId);
    expect(choices.map((c) => [c.divisionId, c.rank, c.origin])).toEqual([
      [fx.divisions.Humas!.id, 1, 'dipilih'],
      [fx.divisions.Acara!.id, 2, 'dipilih'],
    ]);
    const [app] = await db
      .select()
      .from(schema.application)
      .where(eq(schema.application.id, a.applicationId));
    expect(app).toMatchObject({ source: 'form', willingToMove: true });
    expect(app!.formSubmissionId).not.toBeNull();
  });

  it('oprec draf menolak pendaftaran walau formnya sudah terbit (H-01)', async () => {
    const fx = await createOprecFixture(db, { open: false });
    await callerFor(db, fx.owner).form.setStatus({
      formId: fx.formId,
      status: 'Published',
    });

    expect(await codeOf(applyToOprec(db, fx, ['Acara']))).toBe('FORBIDDEN');
    expect(
      await db
        .select()
        .from(schema.application)
        .where(eq(schema.application.recruitmentId, fx.recruitmentId)),
    ).toHaveLength(0);
  });

  it('satu akun hanya bisa mendaftar sekali', async () => {
    const fx = await createOprecFixture(db);
    const a = await applyToOprec(db, fx, ['Acara']);
    const again = callerFor(db, a.actor).form.submit({
      formId: fx.formId,
      answers: [
        { fieldId: fx.unitChoiceFieldId, value: [fx.divisions.Humas!.id] },
      ],
    });
    expect(await codeOf(again)).toBe('CONFLICT');
  });

  it('jumlah pilihan di luar batas ditolak', async () => {
    const fx = await createOprecFixture(db, {
      divisions: [{ name: 'Acara' }, { name: 'Humas' }, { name: 'Logistik' }],
      maxChoices: 2,
    });
    expect(
      await codeOf(applyToOprec(db, fx, ['Acara', 'Humas', 'Logistik'])),
    ).toBe('BAD_REQUEST');
  });

  it('akun yang bukan mahasiswa aktif ditolak', async () => {
    const fx = await createOprecFixture(db);
    const alumni = await createUser(db, { role: 'mahasiswa' });
    await createMahasiswa(db, alumni.id, { status: 'alumni' });
    const code = await codeOf(
      callerFor(db, { id: alumni.id, role: 'mahasiswa' }).form.submit({
        formId: fx.formId,
        answers: [
          { fieldId: fx.unitChoiceFieldId, value: [fx.divisions.Acara!.id] },
        ],
      }),
    );
    expect(code).toBe('FORBIDDEN');
  });
});

describe('decide', () => {
  it('Kadiv menerima pendaftar di divisinya dan penempatan organogram terbuat', async () => {
    const fx = await createOprecFixture(db);
    const a = await applyToOprec(db, fx, ['Acara', 'Humas']);
    const [first] = await choicesOf(db, a.applicationId);

    const res = await callerFor(db, fx.divisions.Acara!.kadiv).oprec.decide({
      recruitmentId: fx.recruitmentId,
      choiceId: first!.id,
      decision: 'terima',
    });
    expect(res).toMatchObject({ success: true });

    const placements = await db
      .select()
      .from(schema.placement)
      .where(eq(schema.placement.applicationChoiceId, first!.id));
    expect(placements).toHaveLength(1);
    expect(placements[0]).toMatchObject({
      positionId: fx.divisions.Acara!.positionId,
      userId: a.userId,
      source: 'oprec',
    });
  });

  it('Kadiv tidak bisa memutuskan divisi lain', async () => {
    const fx = await createOprecFixture(db);
    const a = await applyToOprec(db, fx, ['Acara']);
    const [first] = await choicesOf(db, a.applicationId);
    const code = await codeOf(
      callerFor(db, fx.divisions.Humas!.kadiv).oprec.decide({
        recruitmentId: fx.recruitmentId,
        choiceId: first!.id,
        decision: 'terima',
      }),
    );
    expect(code).toBe('FORBIDDEN');
  });

  it('pilihan kedua menunggu pilihan pertama diputuskan', async () => {
    const fx = await createOprecFixture(db);
    const a = await applyToOprec(db, fx, ['Acara', 'Humas']);
    const [first, second] = await choicesOf(db, a.applicationId);
    const humas = callerFor(db, fx.divisions.Humas!.kadiv);

    expect(
      await codeOf(
        humas.oprec.decide({
          recruitmentId: fx.recruitmentId,
          choiceId: second!.id,
          decision: 'terima',
        }),
      ),
    ).toBe('BAD_REQUEST');

    await callerFor(db, fx.divisions.Acara!.kadiv).oprec.decide({
      recruitmentId: fx.recruitmentId,
      choiceId: first!.id,
      decision: 'tolak',
    });
    expect(
      await humas.oprec.decide({
        recruitmentId: fx.recruitmentId,
        choiceId: second!.id,
        decision: 'terima',
      }),
    ).toMatchObject({ success: true });
  });

  it('menerima melebihi kuota meminta konfirmasi lalu dicatat', async () => {
    const fx = await createOprecFixture(db, {
      divisions: [{ name: 'Acara', quota: 1 }],
    });
    const kadiv = callerFor(db, fx.divisions.Acara!.kadiv);
    const a1 = await applyToOprec(db, fx, ['Acara']);
    const a2 = await applyToOprec(db, fx, ['Acara']);
    const [c1] = await choicesOf(db, a1.applicationId);
    const [c2] = await choicesOf(db, a2.applicationId);
    const decide = (choiceId: string, confirmOverQuota = false) =>
      kadiv.oprec.decide({
        recruitmentId: fx.recruitmentId,
        choiceId,
        decision: 'terima',
        confirmOverQuota,
      });

    expect(await decide(c1!.id)).toMatchObject({ success: true });
    expect(await decide(c2!.id)).toMatchObject({
      success: false,
      needsQuotaConfirm: true,
      accepted: 1,
      quota: 1,
    });
    expect(await decide(c2!.id, true)).toMatchObject({ success: true });

    const [decision] = await db
      .select()
      .from(schema.placementDecision)
      .where(eq(schema.placementDecision.choiceId, c2!.id));
    expect(decision).toMatchObject({
      decision: 'terima',
      overQuotaConfirmed: true,
    });
  });

  it.todo(
    'veto "tidak": Kadiv tetap menilai tetapi tidak bisa memutuskan (PR 4)',
  );
});

describe('penilaian', () => {
  const setup = async (settings: { allowEarlyAssessment?: boolean } = {}) => {
    const fx = await createOprecFixture(db, {
      settings,
      criteria: [
        { scope: 'umum', name: 'Motivasi', kind: 'skor', weight: 100 },
      ],
    });
    const a = await applyToOprec(db, fx, ['Acara']);
    const [criterion] = await db
      .select()
      .from(schema.criterion)
      .where(eq(schema.criterion.recruitmentId, fx.recruitmentId));
    const owner = callerFor(db, fx.owner);
    const save = () =>
      owner.oprec.assessSave({
        recruitmentId: fx.recruitmentId,
        applicationId: a.applicationId,
        criterionId: criterion!.id,
        rating: 4,
      });
    return { fx, owner, save };
  };

  it('tanpa gelombang: terkunci selama dibuka, terbuka setelah ditutup', async () => {
    const { fx, owner, save } = await setup();
    expect(await codeOf(save())).toBe('CONFLICT');

    await owner.oprec.setStatus({
      recruitmentId: fx.recruitmentId,
      status: 'closed',
    });
    expect(await codeOf(save())).toBe('OK');
  });

  it('allowEarlyAssessment membuka penilaian selama pendaftaran dibuka', async () => {
    const { save } = await setup({ allowEarlyAssessment: true });
    expect(await codeOf(save())).toBe('OK');
  });
});
