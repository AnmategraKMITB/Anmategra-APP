import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '~/server/db/schema';
import {
  type OprecFixture,
  callerFor,
  codeOf,
  createOprecFixture,
} from '~/test/oprec-fixture';
import {
  createMahasiswa,
  createTestDb,
  createUser,
  resetDb,
} from '~/test/test-db';

import { canEditDivision, resolveDivisionScope } from './division-scope';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

describe('resolveDivisionScope', () => {
  const base = {
    isAdmin: false,
    assessorMode: 'keduanya' as const,
    placementState: 'berjalan' as const,
    pengurusDivisionIds: ['acara'],
  };

  it('pengurus hanya mencakup divisinya; Umum hanya admin', () => {
    const scope = resolveDivisionScope(base)!;
    expect(canEditDivision(scope, 'acara')).toBe(true);
    expect(canEditDivision(scope, 'humas')).toBe(false);
    expect(canEditDivision(scope, null)).toBe(false);
    const admin = resolveDivisionScope({ ...base, isAdmin: true })!;
    expect(canEditDivision(admin, null)).toBe(true);
  });

  it('pengurus tanpa hak saat tidak ikut menilai, sesudah Final, atau tanpa divisi', () => {
    expect(resolveDivisionScope({ ...base, assessorMode: 'umum' })).toBeNull();
    expect(
      resolveDivisionScope({ ...base, placementState: 'final' }),
    ).toBeNull();
    expect(
      resolveDivisionScope({ ...base, pengurusDivisionIds: [] }),
    ).toBeNull();
    // Kriteria tetap bisa diubah di tengah penilaian dan masa banding.
    expect(
      resolveDivisionScope({ ...base, placementState: 'masa_banding' }),
    ).not.toBeNull();
    expect(
      resolveDivisionScope({
        ...base,
        isAdmin: true,
        assessorMode: 'umum',
        placementState: 'final',
      }),
    ).toEqual({ isAdmin: true });
  });
});

async function criterionId(fx: OprecFixture, name: string) {
  const all = await db
    .select({ id: schema.criterion.id, name: schema.criterion.name })
    .from(schema.criterion)
    .where(eq(schema.criterion.recruitmentId, fx.recruitmentId));
  return all.find((c) => c.name === name)!.id;
}

async function setup() {
  const fx = await createOprecFixture(db, {
    criteria: [
      { scope: 'umum', name: 'Motivasi', kind: 'skor', weight: 100 },
      { scope: 'Acara', name: 'Ide acara', kind: 'skor', weight: 100 },
      { scope: 'Humas', name: 'Desain', kind: 'skor', weight: 100 },
    ],
  });
  return { fx, kadivAcara: fx.divisions.Acara!.kadiv! };
}

const save = (fx: OprecFixture, scope: string, name: string, id?: string) => ({
  recruitmentId: fx.recruitmentId,
  criterionId: id,
  scope,
  name,
  kind: 'skor' as const,
  weight: 50,
  fieldIds: [],
});

describe('Pengaturan divisi oleh pengurus', () => {
  it('Kadiv mengubah kriteria divisinya, tidak divisi lain atau Umum', async () => {
    const { fx, kadivAcara } = await setup();
    const kadiv = callerFor(db, kadivAcara).oprec;
    const acara = fx.divisions.Acara!.id;
    const humas = fx.divisions.Humas!.id;

    expect(
      await codeOf(kadiv.criterionSave(save(fx, acara, 'Kreativitas'))),
    ).toBe('OK');
    expect(
      await codeOf(kadiv.criterionSave(save(fx, humas, 'Copywriting'))),
    ).toBe('FORBIDDEN');
    expect(
      await codeOf(kadiv.criterionSave(save(fx, 'umum', 'Komitmen'))),
    ).toBe('FORBIDDEN');

    // Mengubah dan menghapus kriteria divisinya tetap boleh di tengah penilaian.
    const ide = await criterionId(fx, 'Ide acara');
    expect(
      await codeOf(kadiv.criterionSave(save(fx, acara, 'Ide acara baru', ide))),
    ).toBe('OK');
    expect(
      await codeOf(
        kadiv.criteriaReorder({
          recruitmentId: fx.recruitmentId,
          scope: acara,
          criterionIds: [await criterionId(fx, 'Kreativitas'), ide],
        }),
      ),
    ).toBe('OK');
    expect(
      await codeOf(
        kadiv.criterionDelete({
          recruitmentId: fx.recruitmentId,
          criterionId: ide,
        }),
      ),
    ).toBe('OK');
  });

  it('Kadiv tidak bisa menarik, mengubah, atau menghapus kriteria divisi lain', async () => {
    const { fx, kadivAcara } = await setup();
    const kadiv = callerFor(db, kadivAcara).oprec;
    const desain = await criterionId(fx, 'Desain');
    const motivasi = await criterionId(fx, 'Motivasi');

    expect(
      await codeOf(
        kadiv.criterionSave(save(fx, fx.divisions.Acara!.id, 'Desain', desain)),
      ),
    ).toBe('FORBIDDEN');
    expect(
      await codeOf(
        kadiv.criterionSave(
          save(fx, fx.divisions.Acara!.id, 'Motivasi', motivasi),
        ),
      ),
    ).toBe('FORBIDDEN');
    expect(
      await codeOf(
        kadiv.criterionDelete({
          recruitmentId: fx.recruitmentId,
          criterionId: desain,
        }),
      ),
    ).toBe('FORBIDDEN');

    const [stillThere] = await db
      .select({ divisionId: schema.criterion.divisionId })
      .from(schema.criterion)
      .where(eq(schema.criterion.id, desain));
    expect(stillThere?.divisionId).toBe(fx.divisions.Humas!.id);
  });

  it('criteriaList menandai slot yang bisa diubah', async () => {
    const { fx, kadivAcara } = await setup();
    const list = await callerFor(db, kadivAcara).oprec.criteriaList({
      recruitmentId: fx.recruitmentId,
    });
    const editable = Object.fromEntries(
      list.slots.map((slot) => [slot.label, slot.editable]),
    );
    expect(editable).toEqual({ Umum: false, Acara: true, Humas: false });

    const owner = await callerFor(db, fx.owner).oprec.criteriaList({
      recruitmentId: fx.recruitmentId,
    });
    expect(owner.slots.every((slot) => slot.editable)).toBe(true);
  });

  it('Kadiv mengurus penilai tambahan divisinya saja', async () => {
    const { fx, kadivAcara } = await setup();
    const kadiv = callerFor(db, kadivAcara).oprec;
    const owner = callerFor(db, fx.owner).oprec;
    const person = async () => {
      const user = await createUser(db, { role: 'mahasiswa' });
      return String((await createMahasiswa(db, user.id)).nim);
    };

    const add = (divisionId: string | null, identifier: string) => ({
      recruitmentId: fx.recruitmentId,
      identifier,
      divisionId,
    });
    expect(
      await codeOf(
        kadiv.assessorAdd(add(fx.divisions.Acara!.id, await person())),
      ),
    ).toBe('OK');
    expect(
      await codeOf(
        kadiv.assessorAdd(add(fx.divisions.Humas!.id, await person())),
      ),
    ).toBe('FORBIDDEN');
    expect(await codeOf(kadiv.assessorAdd(add(null, await person())))).toBe(
      'FORBIDDEN',
    );

    const humas = await owner.assessorAdd(
      add(fx.divisions.Humas!.id, await person()),
    );
    expect(
      await codeOf(
        kadiv.assessorRemove({
          recruitmentId: fx.recruitmentId,
          assessorId: humas.id,
        }),
      ),
    ).toBe('FORBIDDEN');

    const seen = await kadiv.assessorList({ recruitmentId: fx.recruitmentId });
    expect(seen.map((row) => row.divisionId)).toEqual([fx.divisions.Acara!.id]);
    expect(
      (await owner.assessorList({ recruitmentId: fx.recruitmentId })).length,
    ).toBe(2);
  });

  it('pengurus kehilangan akses sesudah penempatan Final', async () => {
    const { fx, kadivAcara } = await setup();
    const kadiv = callerFor(db, kadivAcara).oprec;
    const owner = callerFor(db, fx.owner).oprec;
    const input = { recruitmentId: fx.recruitmentId };
    expect(await codeOf(kadiv.divisionSettings(input))).toBe('OK');

    await owner.setPlacementState({ ...input, state: 'masa_banding' });
    expect(await codeOf(kadiv.divisionSettings(input))).toBe('OK');
    await owner.setPlacementState({ ...input, state: 'final' });
    expect(await codeOf(kadiv.divisionSettings(input))).toBe('FORBIDDEN');
    expect(
      await codeOf(kadiv.criterionSave(save(fx, fx.divisions.Acara!.id, 'X'))),
    ).toBe('FORBIDDEN');
    expect(await codeOf(owner.divisionSettings(input))).toBe('OK');
  });

  it('pengurus kehilangan akses bila hanya penilai umum yang menilai', async () => {
    const { fx, kadivAcara } = await setup();
    const kadiv = callerFor(db, kadivAcara).oprec;
    const input = { recruitmentId: fx.recruitmentId };
    await callerFor(db, fx.owner).oprec.update({
      ...input,
      settings: { assessorMode: 'umum' },
    });
    expect(await codeOf(kadiv.criteriaList(input))).toBe('FORBIDDEN');
    expect(await codeOf(kadiv.assessorList(input))).toBe('FORBIDDEN');
    expect(
      await codeOf(kadiv.criterionSave(save(fx, fx.divisions.Acara!.id, 'X'))),
    ).toBe('FORBIDDEN');
  });

  it('divisionSettings hanya memuat divisi yang dipegang', async () => {
    const { fx, kadivAcara } = await setup();
    const result = await callerFor(db, kadivAcara).oprec.divisionSettings({
      recruitmentId: fx.recruitmentId,
    });
    expect(result.isAdmin).toBe(false);
    expect(result.divisions.map((d) => d.label)).toEqual(['Acara']);
    expect(result.divisions[0]!.assessedCount).toBe(0);
  });
});
