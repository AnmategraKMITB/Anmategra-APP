/**
 * Sambungan jawaban wizard ke server: draf aturan gugur otomatis (K-02) dan
 * bagian penilai umum (S14, H-03).
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '~/server/db/schema';
import {
  applyToOprec,
  callerFor,
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

const criteriaOf = (recruitmentId: string) =>
  db
    .select()
    .from(schema.criterion)
    .where(eq(schema.criterion.recruitmentId, recruitmentId));

describe('draf aturan gugur otomatis', () => {
  it('memblokir pembukaan pendaftaran sampai aturannya diisi', async () => {
    const fx = await createOprecFixture(db, {
      open: false,
      criteria: [
        { scope: 'umum', name: 'Bersedia hadir', kind: 'gugur_otomatis' },
      ],
    });
    const owner = callerFor(db, fx.owner);
    const open = () =>
      owner.oprec.setStatus({
        recruitmentId: fx.recruitmentId,
        status: 'open',
      });

    await expect(open()).rejects.toThrow('Bersedia hadir');

    const [draft] = await criteriaOf(fx.recruitmentId);
    await owner.oprec.criterionSave({
      recruitmentId: fx.recruitmentId,
      criterionId: draft!.id,
      scope: 'umum',
      name: 'Bersedia hadir',
      kind: 'gugur_otomatis',
      gateRule: {
        fieldId: fx.unitChoiceFieldId,
        op: 'tidak_memilih',
        nilai: fx.divisions.Acara!.id,
      },
      fieldIds: [],
    });
    expect(await codeOf(open())).toBe('OK');
  });

  it('aturan kosong boleh disimpan saat draf, ditolak setelah pendaftaran dibuka', async () => {
    const fx = await createOprecFixture(db, { open: false });
    const owner = callerFor(db, fx.owner);
    const save = () =>
      owner.oprec.criterionSave({
        recruitmentId: fx.recruitmentId,
        scope: 'umum',
        name: 'Bersedia',
        kind: 'gugur_otomatis',
        gateRule: null,
        fieldIds: [],
      });

    expect(await codeOf(save())).toBe('OK');
    // Draf aturan tadi akan memblokir pembukaan; hapus dulu.
    await db
      .delete(schema.criterion)
      .where(eq(schema.criterion.recruitmentId, fx.recruitmentId));
    await owner.oprec.setStatus({
      recruitmentId: fx.recruitmentId,
      status: 'open',
    });
    expect(await codeOf(save())).toBe('BAD_REQUEST');
  });
});

describe('penilai umum dari wizard (S14)', () => {
  it('orang di bagian penilai umum menjadi penilai umum dan bisa menilai', async () => {
    const fx = await createOprecFixture(db, {
      generalAssessorUnit: 'Humas',
      settings: { allowEarlyAssessment: true },
      criteria: [
        { scope: 'umum', name: 'Motivasi', kind: 'skor', weight: 100 },
      ],
    });
    const assessors = await db
      .select()
      .from(schema.recruitmentAssessor)
      .where(eq(schema.recruitmentAssessor.recruitmentId, fx.recruitmentId));
    expect(assessors.map((r) => [r.userId, r.divisionId])).toEqual([
      [fx.divisions.Humas!.kadiv!.id, null],
    ]);

    // Kadiv Humas dulu hanya bisa menilai divisinya; kini juga kriteria umum.
    const a = await applyToOprec(db, fx, ['Acara']);
    const [criterion] = await criteriaOf(fx.recruitmentId);
    const code = await codeOf(
      callerFor(db, fx.divisions.Humas!.kadiv).oprec.assessSave({
        recruitmentId: fx.recruitmentId,
        applicationId: a.applicationId,
        criterionId: criterion!.id,
        rating: 4,
      }),
    );
    expect(code).toBe('OK');
  });

  it('bagian tanpa orang ditolak', async () => {
    const code = await codeOf(
      createOprecFixture(db, {
        divisions: [
          { name: 'Acara', quota: 2 },
          { name: 'Sekretariat', withHead: false },
        ],
        generalAssessorUnit: 'Sekretariat',
      }),
    );
    expect(code).toBe('BAD_REQUEST');
  });

  it('bagian dari organogram lembaga lain ditolak', async () => {
    const other = await createOprecFixture(db, { open: false });
    const code = await codeOf(
      createOprecFixture(db, {
        generalAssessorUnitId: other.divisions.Acara!.unitId,
      }),
    );
    expect(code).toBe('BAD_REQUEST');
  });
});
