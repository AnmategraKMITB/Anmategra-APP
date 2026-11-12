import { describe, expect, it } from 'vitest';

import {
  type AutofillChoice,
  type StageInput,
  acceptedChoiceId,
  acceptedCount,
  deriveChoiceStage,
  planAutofill,
  remainingQuota,
} from './allocation';

const choice = (
  id: string,
  rank: number | null,
  opts: Partial<StageInput> = {},
): StageInput => ({ id, rank, status: 'lolos', decision: null, ...opts });

const stagesOf = (choices: StageInput[]) =>
  Object.fromEntries(deriveChoiceStage(choices));

describe('deriveChoiceStage', () => {
  it('tanpa keputusan: pilihan pertama aktif, sisanya menunggu', () => {
    expect(
      stagesOf([choice('c3', 3), choice('c1', 1), choice('c2', 2)]),
    ).toEqual({
      c1: { stage: 'aktif', reason: 'siap' },
      c2: { stage: 'menunggu', reason: 'menunggu_pilihan_sebelumnya' },
      c3: { stage: 'menunggu', reason: 'menunggu_pilihan_sebelumnya' },
    });
  });

  it('pilihan yang ditolak menutup diri dan mengaktifkan pilihan berikutnya', () => {
    expect(
      stagesOf([
        choice('c1', 1, { decision: 'tolak' }),
        choice('c2', 2),
        choice('c3', 3),
      ]),
    ).toEqual({
      c1: { stage: 'tertutup', reason: 'ditolak' },
      c2: { stage: 'aktif', reason: 'siap' },
      c3: { stage: 'menunggu', reason: 'menunggu_pilihan_sebelumnya' },
    });
  });

  it('pilihan berstatus tidak lolos dilewati tanpa keputusan', () => {
    expect(
      stagesOf([choice('c1', 1, { status: 'tidak_lolos' }), choice('c2', 2)]),
    ).toEqual({
      c1: { stage: 'tertutup', reason: 'tidak_lolos' },
      c2: { stage: 'aktif', reason: 'siap' },
    });
  });

  it('status yang belum final tidak menutup pilihan', () => {
    expect(
      stagesOf([choice('c1', 1, { status: 'belum_lengkap' }), choice('c2', 2)]),
    ).toEqual({
      c1: { stage: 'aktif', reason: 'siap' },
      c2: { stage: 'menunggu', reason: 'menunggu_pilihan_sebelumnya' },
    });
  });

  it('penerimaan di satu pilihan menutup semua pilihan lain', () => {
    expect(
      stagesOf([
        choice('c1', 1),
        choice('c2', 2, { decision: 'terima' }),
        choice('c3', 3),
      ]),
    ).toEqual({
      c1: { stage: 'tertutup', reason: 'diterima_di_lain' },
      c2: { stage: 'aktif', reason: 'siap' },
      c3: { stage: 'tertutup', reason: 'diterima_di_lain' },
    });
  });

  it('pilihan tanpa rank (dialihkan) diproses setelah pilihan bernomor', () => {
    expect(
      stagesOf([choice('x', null), choice('c1', 1, { decision: 'tolak' })]),
    ).toEqual({
      c1: { stage: 'tertutup', reason: 'ditolak' },
      x: { stage: 'aktif', reason: 'siap' },
    });
  });

  it('semua pilihan ditolak berarti tidak ada yang aktif', () => {
    const stages = stagesOf([
      choice('c1', 1, { decision: 'tolak' }),
      choice('c2', 2, { status: 'tidak_lolos' }),
    ]);
    expect(Object.values(stages).every((s) => s.stage === 'tertutup')).toBe(
      true,
    );
  });
});

describe('bantuan kuota', () => {
  it('acceptedChoiceId mengembalikan pilihan yang diterima', () => {
    expect(
      acceptedChoiceId([
        choice('a', 1),
        choice('b', 2, { decision: 'terima' }),
      ]),
    ).toBe('b');
    expect(
      acceptedChoiceId([choice('a', 1, { decision: 'tolak' })]),
    ).toBeNull();
  });

  it('acceptedCount tidak menghitung closerec ke kuota', () => {
    const rows = [
      { divisionId: 'A', decision: 'terima' as const, origin: 'dipilih' },
      { divisionId: 'A', decision: 'terima' as const, origin: 'closerec' },
      { divisionId: 'A', decision: 'tolak' as const, origin: 'dipilih' },
      { divisionId: 'B', decision: 'terima' as const, origin: 'dipilih' },
    ];
    expect(acceptedCount(rows, 'A')).toBe(1);
  });

  it('remainingQuota: 0 berarti tanpa batas, negatif berarti melewati kuota', () => {
    expect(remainingQuota(0, 5)).toBeNull();
    expect(remainingQuota(3, 1)).toBe(2);
    expect(remainingQuota(2, 3)).toBe(-1);
  });
});

describe('planAutofill', () => {
  const pick = (
    id: string,
    applicationId: string,
    divisionId: string,
    rank: number | null,
    opts: Partial<AutofillChoice> = {},
  ): AutofillChoice => ({
    id,
    applicationId,
    divisionId,
    rank,
    status: 'lolos',
    decision: null,
    score: null,
    ...opts,
  });
  const sorted = (ids: string[]) => [...ids].sort();

  it('lolos menjadi terima, tidak lolos menjadi tolak, sisanya dilewati', () => {
    const plan = planAutofill({
      choices: [
        pick('a1A', 'app1', 'A', 1),
        pick('a2A', 'app2', 'A', 1, { status: 'tidak_lolos' }),
        pick('a2B', 'app2', 'B', 2),
        pick('a3A', 'app3', 'A', 1, { status: 'belum_lengkap' }),
      ],
      quotaByDivision: new Map([
        ['A', 2],
        ['B', 0],
      ]),
      acceptedByDivision: new Map(),
    });
    expect(sorted(plan.terima)).toEqual(['a1A', 'a2B']);
    expect(plan.tolak).toEqual(['a2A']);
    expect(plan.dilewati).toEqual(['a3A']);
    expect(plan.overQuotaApplied).toBe(0);
    expect(plan.perDivision).toEqual([
      { divisionId: 'A', terima: 1, tolak: 1, dilewati: 1, remaining: 2 },
      { divisionId: 'B', terima: 1, tolak: 0, dilewati: 0, remaining: null },
    ]);
  });

  it('keputusan yang sudah ada tidak ditimpa', () => {
    const plan = planAutofill({
      choices: [
        pick('b1A', 'app1', 'A', 1, { decision: 'terima' }),
        pick('b1B', 'app1', 'B', 2, { status: 'tidak_lolos' }),
      ],
      quotaByDivision: new Map([['A', 2]]),
      acceptedByDivision: new Map([['A', 1]]),
      existing: new Map([['b1A', 'terima']]),
    });
    expect(plan.terima).toEqual([]);
    // Pilihan yang tertutup karena diterima di tempat lain tidak ditulis sebagai tolak.
    expect(plan.tolak).toEqual([]);
    expect(sorted(plan.dilewati)).toEqual(['b1A', 'b1B']);
  });

  it('melebihi kuota: yang skornya terendah ditolak', () => {
    const plan = planAutofill({
      choices: [
        pick('c1', 'app1', 'A', 1, { score: 70 }),
        pick('c2', 'app2', 'A', 1, { score: 90 }),
      ],
      quotaByDivision: new Map([['A', 2]]),
      acceptedByDivision: new Map([['A', 1]]),
    });
    expect(plan.terima).toEqual(['c2']);
    expect(plan.tolak).toEqual(['c1']);
    expect(plan.perDivision[0]).toMatchObject({
      terima: 1,
      tolak: 1,
      remaining: 1,
    });
  });

  it('melebihi kuota dengan "masukkan" menerima semuanya dan mencatat kelebihannya', () => {
    const plan = planAutofill({
      choices: [
        pick('c1', 'app1', 'A', 1, { score: 70 }),
        pick('c2', 'app2', 'A', 1, { score: 90 }),
      ],
      quotaByDivision: new Map([['A', 2]]),
      acceptedByDivision: new Map([['A', 1]]),
      overQuota: 'masukkan',
    });
    expect(sorted(plan.terima)).toEqual(['c1', 'c2']);
    expect(plan.overQuotaApplied).toBe(1);
  });

  it('skor sama di batas kuota: rank yang lebih tinggi didahulukan', () => {
    const plan = planAutofill({
      choices: [
        pick('z1', 'app1', 'A', 1, { score: 80 }),
        pick('x2', 'app2', 'B', 1, { decision: 'tolak' }),
        pick('a2', 'app2', 'A', 2, { score: 80 }),
      ],
      quotaByDivision: new Map([['A', 1]]),
      acceptedByDivision: new Map(),
      existing: new Map([['x2', 'tolak']]),
    });
    expect(plan.terima).toEqual(['z1']);
    expect(plan.tolak).toEqual(['a2']);
  });

  it('kuota 0 tidak membatasi penerimaan', () => {
    const plan = planAutofill({
      choices: [
        pick('d1', 'app1', 'A', 1),
        pick('d2', 'app2', 'A', 1),
        pick('d3', 'app3', 'A', 1),
      ],
      quotaByDivision: new Map([['A', 0]]),
      acceptedByDivision: new Map([['A', 10]]),
    });
    expect(sorted(plan.terima)).toEqual(['d1', 'd2', 'd3']);
    expect(plan.perDivision[0]?.remaining).toBeNull();
  });
});
