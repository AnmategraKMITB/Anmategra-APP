import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hasManagedScope, listHandledOprecs } from '~/server/api/managed-scope';
import * as schema from '~/server/db/schema';
import {
  type OprecFixture,
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

import { isAboveStaff, pengurusOfUnits } from './pengurus';
import { assertDivisionsHaveHead } from './services';

const { db, close } = createTestDb();
const database = db as unknown as Parameters<typeof listHandledOprecs>[0];

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

describe('isAboveStaff', () => {
  it('memakai urutan rank bawaan bila struktur belum menyusunnya', () => {
    expect(isAboveStaff('head', null)).toBe(true);
    expect(isAboveStaff('vice', null)).toBe(true);
    expect(isAboveStaff('coordinator', null)).toBe(true);
    expect(isAboveStaff('staff', null)).toBe(false);
    expect(isAboveStaff('tidak-dikenal', null)).toBe(false);
  });

  it('rank tambahan di atas Staf ikut; tanpa rank staff, yang paling junior tidak', () => {
    const custom = [
      { id: 'head', label: 'Ketua' },
      { id: 'sekretaris', label: 'Sekretaris' },
      { id: 'staff', label: 'Staf' },
      { id: 'magang', label: 'Magang' },
    ];
    expect(isAboveStaff('sekretaris', custom)).toBe(true);
    expect(isAboveStaff('magang', custom)).toBe(false);

    const noStaff = [
      { id: 'ketua', label: 'Ketua' },
      { id: 'anggota', label: 'Anggota' },
    ];
    expect(isAboveStaff('ketua', noStaff)).toBe(true);
    expect(isAboveStaff('anggota', noStaff)).toBe(false);
  });
});

describe('pengurusOfUnits', () => {
  it('pengurus di bagian itu dan leluhurnya; Staf dan cabang lain tidak', () => {
    const units = [
      { id: 'akar', parentId: null },
      { id: 'bidang', parentId: 'akar' },
      { id: 'divisi', parentId: 'bidang' },
      { id: 'bidang-lain', parentId: 'akar' },
    ];
    const holders = [
      { userId: 'ketua', unitId: 'akar', rank: 'head' },
      { userId: 'wakabid', unitId: 'bidang', rank: 'vice' },
      { userId: 'staf', unitId: 'divisi', rank: 'staff' },
      { userId: 'kabid-lain', unitId: 'bidang-lain', rank: 'head' },
    ];
    const result = pengurusOfUnits(['divisi'], units, holders, () => null);
    expect(result.map((r) => r.userId).sort()).toEqual(['ketua', 'wakabid']);
  });
});

/**
 * Fixture standar (Akar > Acara, Humas; masing-masing punya Kadiv) disusun
 * ulang: Akar > Bidang Kegiatan > Acara, dan Akar > Humas. Bidang berisi Kabid,
 * Wakabid, dan Staf; akar (kedalaman 0) berisi Ketua.
 */
async function withHierarchy(fx: OprecFixture) {
  const [acara] = await db
    .select()
    .from(schema.organizationUnit)
    .where(eq(schema.organizationUnit.id, fx.divisions.Acara!.unitId));
  const structureId = acara!.structure_id;

  const unit = async (name: string, parentId: string | null, level: number) =>
    (
      await db
        .insert(schema.organizationUnit)
        .values({ structure_id: structureId, parent_id: parentId, name, level })
        .returning()
    )[0]!;
  const place = async (unitId: string, rank: string) => {
    const [position] = await db
      .insert(schema.organizationPosition)
      .values({ unitId, title: rank, rank, kind: 'struktural' })
      .returning();
    const user = await createUser(db, { role: 'mahasiswa' });
    await createMahasiswa(db, user.id);
    await db
      .insert(schema.placement)
      .values({ positionId: position!.id, userId: user.id, source: 'manual' });
    return { id: user.id, role: 'mahasiswa' as const };
  };

  const akar = { id: acara!.parent_id! };
  const bidang = await unit('Bidang Kegiatan', akar.id, 1);
  await db
    .update(schema.organizationUnit)
    .set({ parent_id: bidang.id, level: 2 })
    .where(eq(schema.organizationUnit.id, fx.divisions.Acara!.unitId));

  return {
    ketua: await place(akar.id, 'head'),
    kabid: await place(bidang.id, 'head'),
    wakabid: await place(bidang.id, 'vice'),
    stafBidang: await place(bidang.id, 'staff'),
    wakadivAcara: await place(fx.divisions.Acara!.unitId, 'vice'),
    bidangId: bidang.id,
  };
}

describe('hak pengurus atas oprec', () => {
  it('Kabid, Wakabid, Wakadiv, dan Ketua memutuskan divisi di bawahnya', async () => {
    // Kuota staf tanpa batas: tiap pengurus menerima satu pendaftar.
    const fx = await createOprecFixture(db, {
      divisions: [
        { name: 'Acara', quota: 0 },
        { name: 'Humas', quota: 0 },
      ],
    });
    const h = await withHierarchy(fx);
    for (const actor of [h.kabid, h.wakabid, h.wakadivAcara, h.ketua]) {
      const a = await applyToOprec(db, fx, ['Acara']);
      const [first] = await choicesOf(db, a.applicationId);
      const res = await callerFor(db, actor).oprec.decide({
        recruitmentId: fx.recruitmentId,
        choiceId: first!.id,
        decision: 'terima',
      });
      expect(res).toMatchObject({ success: true });
    }
  });

  it('Kabid tidak menangani divisi di luar bidangnya, Staf tidak menangani apa pun', async () => {
    const fx = await createOprecFixture(db);
    const h = await withHierarchy(fx);
    const humas = await applyToOprec(db, fx, ['Humas']);
    const [humasChoice] = await choicesOf(db, humas.applicationId);
    expect(
      await codeOf(
        callerFor(db, h.kabid).oprec.decide({
          recruitmentId: fx.recruitmentId,
          choiceId: humasChoice!.id,
          decision: 'terima',
        }),
      ),
    ).toBe('FORBIDDEN');

    const acara = await applyToOprec(db, fx, ['Acara']);
    const [acaraChoice] = await choicesOf(db, acara.applicationId);
    expect(
      await codeOf(
        callerFor(db, h.stafBidang).oprec.decide({
          recruitmentId: fx.recruitmentId,
          choiceId: acaraChoice!.id,
          decision: 'terima',
        }),
      ),
    ).toBe('FORBIDDEN');
  });

  it('Kelola menampilkan oprec bagi pengurus, tidak bagi Staf', async () => {
    const fx = await createOprecFixture(db);
    const h = await withHierarchy(fx);

    const kabid = await listHandledOprecs(database, h.kabid);
    expect(kabid).toMatchObject([
      {
        recruitmentId: fx.recruitmentId,
        periodId: fx.eventId,
        tab: 'nilai',
        divisionCount: 1,
        canDecide: true,
      },
    ]);
    expect((await listHandledOprecs(database, h.ketua))[0]?.divisionCount).toBe(
      2,
    );
    expect(await listHandledOprecs(database, h.stafBidang)).toEqual([]);

    expect(await hasManagedScope(database, h.kabid)).toBe(true);
    expect(await hasManagedScope(database, h.stafBidang)).toBe(false);
  });

  it('oprec draf tidak muncul di Kelola', async () => {
    const fx = await createOprecFixture(db, { open: false });
    const h = await withHierarchy(fx);
    expect(await listHandledOprecs(database, h.kabid)).toEqual([]);
  });

  it('pengaturan menampilkan pengurus turunan organogram per divisi', async () => {
    const fx = await createOprecFixture(db);
    const h = await withHierarchy(fx);
    const derived = await callerFor(db, fx.owner).oprec.assessorDerived({
      recruitmentId: fx.recruitmentId,
    });
    const acara = derived
      .filter((d) => d.divisionId === fx.divisions.Acara!.id)
      .map((d) => d.userId)
      .sort();
    expect(acara).toEqual(
      [
        fx.divisions.Acara!.kadiv!.id,
        h.ketua.id,
        h.kabid.id,
        h.wakabid.id,
        h.wakadivAcara.id,
      ].sort(),
    );
  });
});

describe('assertDivisionsHaveHead', () => {
  it('divisi tanpa Kadiv lolos bila ada pengurus di atasnya', async () => {
    const fx = await createOprecFixture(db);
    // Kadiv Acara dikosongkan; tanpa pengurus di atasnya, Acara ditolak.
    await db
      .delete(schema.placement)
      .where(eq(schema.placement.userId, fx.divisions.Acara!.kadiv!.id));
    await expect(
      assertDivisionsHaveHead(db as never, [fx.divisions.Acara!.unitId]),
    ).rejects.toThrow(/belum punya pengurus/);

    await withHierarchy(fx);
    await expect(
      assertDivisionsHaveHead(db as never, [fx.divisions.Acara!.unitId]),
    ).resolves.toBeUndefined();
  });
});
