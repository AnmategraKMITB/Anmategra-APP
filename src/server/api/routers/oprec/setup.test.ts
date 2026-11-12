import { eq, sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resolveAssessAccess } from '~/server/api/routers/oprec/assess-access';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import {
  accessGrant,
  application,
  criterion,
  organizationStructure,
  organizationUnit,
  recruitment,
  recruitmentAssessor,
  recruitmentDivision,
} from '~/server/db/schema';
import { createOprecWorld as baseWorld, placeAt } from '~/test/oprec-fixtures';
import {
  createMahasiswa,
  createTestDb,
  createUser,
  grantAccess,
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

/** Dunia uji dengan satu ketua di tiap divisi (syarat wizard, #383). */
async function createOprecWorld(...args: Parameters<typeof baseWorld>) {
  const w = await baseWorld(...args);
  for (const [i, u] of w.units.entries()) {
    if (args[1]?.[i] === 'HR') continue;
    await placeAt(db, u.headPositionId, (await createUser(db)).id);
  }
  return w;
}

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
    divisions: w.units.slice(0, 2).map((u) => ({
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

// ---------------------------------------------------------------------------
// Jawaban lanjutan (K-03)
// ---------------------------------------------------------------------------

async function worldWithGeneralUnit() {
  const w = await createOprecWorld(db, ['Divisi A', 'Divisi B', 'HR']);
  return { w, hr: w.units[2]! };
}

async function createWith(
  w: World,
  extra: Record<string, unknown>,
  settings: Record<string, unknown> = {},
) {
  return callerFor(w.owner).oprec.createFromSetup({
    ...baseInput(w),
    ...extra,
    settings,
  } as never);
}

async function asRecruitmentRow(recruitmentId: string) {
  const [row] = await db
    .select()
    .from(recruitment)
    .where(eq(recruitment.id, recruitmentId));
  return row!;
}

describe('createFromSetup: penilai (S13, S14)', () => {
  it('menjadikan pemegang jabatan di bagian penilai umum sebagai penilai umum', async () => {
    const { w, hr } = await worldWithGeneralUnit();
    const staff = await createUser(db);
    const head = await createUser(db);
    const outsider = await createUser(db);
    await placeAt(db, hr.staffPositionId, staff.id);
    await placeAt(db, hr.headPositionId, head.id);
    await placeAt(db, w.units[0]!.staffPositionId, outsider.id);

    const { recruitmentId } = await createWith(
      w,
      { generalAssessorUnitId: hr.unitId },
      { assessorMode: 'keduanya' },
    );

    const rows = await db
      .select()
      .from(recruitmentAssessor)
      .where(eq(recruitmentAssessor.recruitmentId, recruitmentId));
    expect(rows.map((r) => r.userId).sort()).toEqual(
      [staff.id, head.id].sort(),
    );
    expect(rows.every((r) => r.divisionId === null)).toBe(true);

    const rec = await asRecruitmentRow(recruitmentId);
    expect(rec).toMatchObject({
      assessorMode: 'keduanya',
      generalAssessorUnitId: hr.unitId,
    });
    const access = await resolveAssessAccess(
      db,
      { id: staff.id, role: 'mahasiswa', lembagaId: null },
      rec,
    );
    expect(access?.generalAssessor).toBe(true);
    const none = await resolveAssessAccess(
      db,
      { id: outsider.id, role: 'mahasiswa', lembagaId: null },
      rec,
    );
    expect(none).toBeNull();
  });

  it('tidak membuat penilai umum dan tidak menyimpan bagian bila penilai hanya ketua', async () => {
    const { w, hr } = await worldWithGeneralUnit();
    const staff = await createUser(db);
    await placeAt(db, hr.staffPositionId, staff.id);
    const { recruitmentId } = await createWith(
      w,
      { generalAssessorUnitId: hr.unitId },
      { assessorMode: 'ketua' },
    );
    expect(
      await db
        .select()
        .from(recruitmentAssessor)
        .where(eq(recruitmentAssessor.recruitmentId, recruitmentId)),
    ).toHaveLength(0);
    expect((await asRecruitmentRow(recruitmentId)).generalAssessorUnitId).toBe(
      null,
    );
  });

  it('menolak penilai umum tanpa bagian atau dengan bagian di luar lingkup', async () => {
    const { w } = await worldWithGeneralUnit();
    expect(await codeOf(createWith(w, {}, { assessorMode: 'umum' }))).toBe(
      'BAD_REQUEST',
    );

    const other = await createOprecWorld(db, ['Asing']);
    expect(
      await codeOf(
        createWith(
          w,
          { generalAssessorUnitId: other.units[0]!.unitId },
          { assessorMode: 'umum' },
        ),
      ),
    ).toBe('BAD_REQUEST');
    expect(await db.select().from(recruitment)).toHaveLength(0);
  });

  it('mode umum mencabut hak menilai ketua, tetapi hak memutuskannya tetap', async () => {
    const { w, hr } = await worldWithGeneralUnit();
    await placeAt(db, hr.staffPositionId, (await createUser(db)).id);
    const kadiv = await createUser(db);
    await placeAt(db, w.units[0]!.headPositionId, kadiv.id);
    const actor = { id: kadiv.id, role: 'mahasiswa', lembagaId: null };

    const umum = await asRecruitmentRow(
      (
        await createWith(
          w,
          { generalAssessorUnitId: hr.unitId },
          { assessorMode: 'umum' },
        )
      ).recruitmentId,
    );
    const access = await resolveAssessAccess(db, actor, umum);
    expect(access?.divisionIds.size).toBe(0);
    expect(access?.deciderDivisionIds.size).toBe(1);

    const ketua = await asRecruitmentRow(
      (
        await createWith(
          w,
          { form: { mode: 'template', title: 'F2' } },
          {
            assessorMode: 'ketua',
          },
        )
      ).recruitmentId,
    );
    const ketuaAccess = await resolveAssessAccess(db, actor, ketua);
    expect(ketuaAccess?.divisionIds.size).toBe(1);
  });
});

describe('createFromSetup: veto, gugur, closerec, hasil (S15, S16, S20, S22)', () => {
  it('tanpa veto, ketua tidak memegang keputusan dan tidak dapat akses sama sekali', async () => {
    const w = await createOprecWorld(db);
    const kadiv = await createUser(db);
    await placeAt(db, w.units[0]!.headPositionId, kadiv.id);
    const rec = await asRecruitmentRow(
      (await createWith(w, {}, { headDecides: false, assessorMode: 'ketua' }))
        .recruitmentId,
    );
    expect(rec.headDecides).toBe(false);
    const access = await resolveAssessAccess(
      db,
      { id: kadiv.id, role: 'mahasiswa', lembagaId: null },
      rec,
    );
    expect(access?.deciderDivisionIds.size).toBe(0);
    expect(access?.divisionIds.size).toBe(1);
  });

  it('syarat gugur dimatikan menolak kriteria gugur di wizard dan di halaman kriteria', async () => {
    const w = await createOprecWorld(db);
    expect(
      await codeOf(
        createWith(
          w,
          {
            criteria: [
              { scope: 'umum', name: 'Twibbon', kind: 'gugur_manual' },
            ],
          },
          { hasGugur: false },
        ),
      ),
    ).toBe('BAD_REQUEST');
    expect(await db.select().from(recruitment)).toHaveLength(0);

    const { recruitmentId } = await createWith(w, {}, { hasGugur: false });
    const caller = callerFor(w.owner);
    expect(
      await codeOf(
        caller.oprec.criterionSave({
          recruitmentId,
          scope: 'umum',
          name: 'Twibbon',
          kind: 'gugur_manual',
          fieldIds: [],
        }),
      ),
    ).toBe('BAD_REQUEST');
    expect(
      await codeOf(
        caller.oprec.criterionSave({
          recruitmentId,
          scope: 'umum',
          name: 'Motivasi',
          kind: 'skor',
          weight: 100,
          fieldIds: [],
        }),
      ),
    ).toBe('OK');
  });

  it('closerec dinonaktifkan menolak penambahan; aktif menerima', async () => {
    const w = await createOprecWorld(db);
    const target = await createUser(db, { email: 'calon@test.local' });
    const caller = callerFor(w.owner);

    const off = await createWith(w, {}, { closerecEnabled: false });
    const offDivision = (
      await db
        .select()
        .from(recruitmentDivision)
        .where(eq(recruitmentDivision.recruitmentId, off.recruitmentId))
    )[0]!;
    expect(
      await codeOf(
        caller.oprec.closerecAdd({
          recruitmentId: off.recruitmentId,
          identifier: 'calon@test.local',
          divisionId: offDivision.id,
        }),
      ),
    ).toBe('FORBIDDEN');
    expect(await db.select().from(application)).toHaveLength(0);

    const on = await createWith(
      w,
      { form: { mode: 'template', title: 'F2' } },
      { closerecEnabled: true },
    );
    const onDivision = (
      await db
        .select()
        .from(recruitmentDivision)
        .where(eq(recruitmentDivision.recruitmentId, on.recruitmentId))
    )[0]!;
    expect(
      await codeOf(
        caller.oprec.closerecAdd({
          recruitmentId: on.recruitmentId,
          identifier: 'calon@test.local',
          divisionId: onDivision.id,
        }),
      ),
    ).toBe('OK');
    const apps = await db.select().from(application);
    expect(apps.map((a) => a.userId)).toEqual([target.id]);
  });

  it('akses menu Hasil dibaca dari kolom results_access', async () => {
    const w = await createOprecWorld(db);
    const kadiv = await createUser(db);
    await placeAt(db, w.units[0]!.headPositionId, kadiv.id);
    const head = callerFor({
      id: kadiv.id,
      role: 'mahasiswa',
      lembagaId: undefined,
    } as never);

    const adminOnly = await createWith(w, {}, { resultsAccess: 'admin' });
    const withHead = await createWith(
      w,
      { form: { mode: 'template', title: 'F2' } },
      { resultsAccess: 'admin_ketua' },
    );
    expect(
      await codeOf(
        head.oprec.resultsOverview({ recruitmentId: adminOnly.recruitmentId }),
      ),
    ).toBe('FORBIDDEN');
    expect(
      await codeOf(
        head.oprec.resultsOverview({ recruitmentId: withHead.recruitmentId }),
      ),
    ).toBe('OK');
  });

  it('semua jawaban terbaca kembali lewat oprec.get dan setupAnswers tetap diarsipkan', async () => {
    const w = await createOprecWorld(db);
    const { recruitmentId } = await createWith(
      w,
      { answers: { name: 'arsip' } },
      {
        assessorMode: 'ketua',
        hasGugur: false,
        headDecides: false,
        stagedPlacement: false,
        resultsAccess: 'semua',
        closerecEnabled: false,
      },
    );
    const detail = await callerFor(w.owner).oprec.get({ recruitmentId });
    expect(detail).toMatchObject({
      assessorMode: 'ketua',
      hasGugur: false,
      headDecides: false,
      stagedPlacement: false,
      resultsAccess: 'semua',
      closerecEnabled: false,
      setupAnswers: { name: 'arsip' },
    });
  });
});

describe('migrasi 0053', () => {
  it('mengisi results_access dari setup_answers lama', async () => {
    const w = await createOprecWorld(db);
    const { recruitmentId } = await createWith(w, {
      answers: { resultsAccess: 'admin' },
    });
    await db
      .update(recruitment)
      .set({ resultsAccess: 'admin_ketua' })
      .where(eq(recruitment.id, recruitmentId));
    const file = readFileSync(
      path.resolve(process.cwd(), 'drizzle/0053_oprec_setup_structured.sql'),
      'utf8',
    );
    const update = file
      .split('--> statement-breakpoint')
      .map((part) => part.trim().replace(/;$/, ''))
      .find((part) => part.startsWith('UPDATE "anmategra_recruitment"'));
    expect(update).toBeDefined();
    await db.execute(sql.raw(update!));
    expect((await asRecruitmentRow(recruitmentId)).resultsAccess).toBe('admin');
  });
});

// ---------------------------------------------------------------------------
// Akses pengelola (K-07)
// ---------------------------------------------------------------------------

async function grantsOf(eventId: string) {
  return db.select().from(accessGrant).where(eq(accessGrant.periodId, eventId));
}

describe('createFromSetup: pengelola (S17)', () => {
  it('memberi akses oprec ke semua pengelola dalam transaksi yang sama', async () => {
    const w = await createOprecWorld(db);
    const byEmail = await createUser(db, { email: 'Satu@Test.Local' });
    const byNim = await createUser(db);
    const mhs = await createMahasiswa(db, byNim.id);

    const res = await createWith(w, {
      managers: ['satu@test.local', String(mhs.nim), ' SATU@test.local '],
    });

    expect(res.managers.map((m) => m.userId).sort()).toEqual(
      [byEmail.id, byNim.id].sort(),
    );
    const grants = await grantsOf(w.eventId);
    expect(grants).toHaveLength(2);
    expect(grants.every((g) => g.status === 'active')).toBe(true);
    expect(grants.every((g) => g.features.join() === 'oprec')).toBe(true);
    expect(await db.select().from(recruitment)).toHaveLength(1);
  });

  it('menggabungkan fitur yang sudah dimiliki dengan oprec, bukan menimpa', async () => {
    const w = await createOprecWorld(db);
    const user = await createUser(db);
    await grantAccess(db, {
      userId: user.id,
      periodId: w.eventId,
      features: ['events', 'oprec'],
    });
    const revoked = await createUser(db);
    await grantAccess(db, {
      userId: revoked.id,
      periodId: w.eventId,
      features: ['events'],
      status: 'revoked',
    });

    await createWith(w, { managers: [user.email, revoked.email] });

    const grants = await grantsOf(w.eventId);
    const of = (id: string) => grants.find((g) => g.userId === id)!;
    expect(of(user.id).features.sort()).toEqual(['events', 'oprec']);
    expect(of(user.id).status).toBe('active');
    // Hibah yang sudah dicabut dihidupkan lagi tanpa membawa fitur lamanya.
    expect(of(revoked.id)).toMatchObject({
      status: 'active',
      features: ['oprec'],
    });
  });

  it('identifier tak dikenal menggagalkan semuanya dan disebut di pesan', async () => {
    const w = await createOprecWorld(db);
    const known = await createUser(db);
    let message = '';
    try {
      await createWith(w, {
        managers: [known.email, 'hantu@test.local', '99999999'],
      });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('hantu@test.local');
    expect(message).toContain('99999999');
    expect(message).not.toContain(known.email);
    expect(await db.select().from(recruitment)).toHaveLength(0);
    expect(await grantsOf(w.eventId)).toHaveLength(0);
  });

  it('kegagalan di tengah membatalkan akses yang sudah diberikan', async () => {
    const w = await createOprecWorld(db);
    const first = await createWith(w, {});
    const manager = await createUser(db);

    // Formulir pertama sudah terikat oprec, jadi pembuatan kedua gagal setelah
    // akses diberikan di dalam transaksi.
    const code = await codeOf(
      createWith(w, {
        form: { mode: 'existing', formId: first.formId },
        managers: [manager.email],
      }),
    );
    expect(code).not.toBe('OK');
    expect(await db.select().from(recruitment)).toHaveLength(1);
    expect(await grantsOf(w.eventId)).toHaveLength(0);
  });

  it('penerima akses oprec saja tidak boleh memberi akses ke orang lain', async () => {
    const w = await createOprecWorld(db);
    const delegate = await createUser(db);
    await grantAccess(db, {
      userId: delegate.id,
      periodId: w.eventId,
      features: ['oprec'],
    });
    const target = await createUser(db);
    const caller = callerFor({
      id: delegate.id,
      role: 'mahasiswa',
      lembagaId: undefined,
    } as never);
    const input = { ...baseInput(w), settings: {}, managers: [target.email] };

    expect(await codeOf(caller.oprec.createFromSetup(input as never))).toBe(
      'FORBIDDEN',
    );
    expect(await db.select().from(recruitment)).toHaveLength(0);
    expect(
      await codeOf(
        caller.oprec.createFromSetup({ ...input, managers: [] } as never),
      ),
    ).toBe('OK');
  });
});

describe('createFromSetup: kelengkapan organogram (#383)', () => {
  it('menolak penilai umum dari bagian tanpa anggota dan menyebut namanya', async () => {
    const { w, hr } = await worldWithGeneralUnit();
    const [structure] = await db.select().from(organizationStructure);
    const [empty] = await db
      .insert(organizationUnit)
      .values({
        structure_id: structure!.id,
        name: 'Kosong',
        level: 1,
        sort_order: 9,
      })
      .returning();
    let message = '';
    try {
      await createWith(
        w,
        { generalAssessorUnitId: empty!.id },
        { assessorMode: 'umum', headDecides: false },
      );
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('"Kosong"');
    expect(hr.unitId).toBeTruthy();
  });

  it('menolak ketua menilai atau veto pada divisi tanpa ketua, menyebut divisinya', async () => {
    const w = await baseWorld(db, ['Divisi A', 'Divisi B', 'HR']);
    await placeAt(db, w.units[0]!.headPositionId, (await createUser(db)).id);
    await placeAt(db, w.units[2]!.staffPositionId, (await createUser(db)).id);
    const general = { generalAssessorUnitId: w.units[2]!.unitId };
    for (const settings of [
      { assessorMode: 'ketua' },
      { assessorMode: 'keduanya' },
      { assessorMode: 'umum', headDecides: true },
    ]) {
      let message = '';
      try {
        await createWith(w, general, settings);
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toContain('"Divisi B"');
      expect(message).not.toContain('"Divisi A"');
    }
    expect(await db.select().from(recruitment)).toHaveLength(0);
  });

  it('mengizinkan divisi tanpa ketua bila hanya penilai umum dan tanpa veto', async () => {
    const w = await baseWorld(db, ['Divisi A', 'Divisi B', 'HR']);
    await placeAt(db, w.units[2]!.staffPositionId, (await createUser(db)).id);
    await createWith(
      w,
      { generalAssessorUnitId: w.units[2]!.unitId },
      { assessorMode: 'umum', headDecides: false },
    );
    expect(await db.select().from(recruitment)).toHaveLength(1);
  });
});
