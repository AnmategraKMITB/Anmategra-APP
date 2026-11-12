import { describe, expect, it } from 'vitest';

import {
  type WizardCtx,
  type WizardState,
  buildInput,
  defaultState,
  stepProblem,
  summaryWarnings,
  wizardCriteria,
} from './model';

const NAMES: Record<string, string> = { u1: 'Acara', u2: 'Humas', u3: 'HR' };

const ctx = (over: Partial<WizardCtx> = {}): WizardCtx => ({
  eventId: 'ev',
  eventName: 'Kegiatan',
  lembagaId: 'lb',
  labels: ['Bidang', 'Divisi'],
  hasOrganogram: true,
  forms: [],
  divisionCount: 2,
  unitName: (id) => NAMES[id] ?? 'Bagian',
  holdersInUnit: (id) => (id === 'u3' ? 2 : 0),
  unitHasHead: (id) => id === 'u1',
  ...over,
});

const state = (over: Partial<WizardState> = {}): WizardState => ({
  ...defaultState('Kegiatan', 'ev'),
  name: 'Oprec Uji',
  divisions: {
    u1: { positionId: 'p1', sourcePeriodId: 'ev' },
    u2: { positionId: 'p2', sourcePeriodId: 'ev' },
  },
  ...over,
});

describe('wizardCriteria', () => {
  const criteria: WizardState['criteria'] = {
    umum: [
      { name: 'Motivasi', kind: 'skor', weight: 60 },
      { name: '   ', kind: 'skor', weight: 0 },
    ],
    u1: [{ name: 'Portofolio', kind: 'gugur_manual', weight: 30 }],
    // Bagian yang batal dicentang: kriterianya tidak ikut dikirim.
    u9: [{ name: 'Lama', kind: 'skor', weight: 100 }],
  };

  it('mengirim slot yang berlaku tanpa baris kosong', () => {
    expect(wizardCriteria(state({ criteria, rubrics: 'keduanya' }))).toEqual([
      { scope: 'umum', name: 'Motivasi', kind: 'skor', weight: 60 },
      { scope: 'u1', name: 'Portofolio', kind: 'gugur_manual', weight: null },
    ]);
  });

  it('rubrik umum saja atau divisi saja membuang slot lainnya', () => {
    expect(
      wizardCriteria(state({ criteria, rubrics: 'umum' })).map((k) => k.scope),
    ).toEqual(['umum']);
    expect(
      wizardCriteria(state({ criteria, rubrics: 'divisi' })).map(
        (k) => k.scope,
      ),
    ).toEqual(['u1']);
  });
});

describe('buildInput', () => {
  it('mengirim kriteria dengan bobot dibulatkan', () => {
    const input = buildInput(
      state({
        criteria: { umum: [{ name: 'Motivasi', kind: 'skor', weight: 60.4 }] },
      }),
      ctx(),
    );
    expect(input.criteria).toEqual([
      { scope: 'umum', name: 'Motivasi', kind: 'skor', weight: 60 },
    ]);
  });

  it('bagian penilai umum hanya dikirim bila penilai umum dipakai', () => {
    expect(
      buildInput(
        state({ assessors: 'ketua', generalAssessorUnitId: 'u3' }),
        ctx(),
      ).generalAssessorUnitId,
    ).toBeNull();
    expect(
      buildInput(
        state({ assessors: 'umum', generalAssessorUnitId: 'u3' }),
        ctx(),
      ).generalAssessorUnitId,
    ).toBe('u3');
  });
});

describe('stepProblem', () => {
  it('S14: bagian penilai umum harus punya orang', () => {
    const c = ctx();
    expect(
      stepProblem(
        'S14',
        state({ assessors: 'umum', generalAssessorUnitId: 'u2' }),
        c,
      ),
    ).toMatch('belum punya orang');
    expect(
      stepProblem(
        'S14',
        state({ assessors: 'umum', generalAssessorUnitId: 'u3' }),
        c,
      ),
    ).toBeNull();
  });

  it('S23: bobot kriteria skor harus bilangan bulat 0-100', () => {
    const withWeight = (weight: number) =>
      state({
        criteria: { umum: [{ name: 'Motivasi', kind: 'skor', weight }] },
      });
    expect(stepProblem('S23', withWeight(150), ctx())).toMatch('0–100');
    expect(stepProblem('S23', withWeight(50.5), ctx())).toMatch('0–100');
    expect(stepProblem('S23', withWeight(50), ctx())).toBeNull();
  });
});

describe('summaryWarnings', () => {
  it('menyebut bagian tanpa ketua bila penilai ketua atau veto dipakai', () => {
    const warnings = summaryWarnings(state({ assessors: 'ketua' }), ctx());
    expect(
      warnings.some((w) => w.includes('Humas') && !w.includes('Acara')),
    ).toBe(true);
  });

  it('tidak memperingatkan ketua bila hanya penilai umum dan tanpa veto', () => {
    const warnings = summaryWarnings(
      state({ assessors: 'umum', veto: false }),
      ctx(),
    );
    expect(warnings.some((w) => w.includes('ketua'))).toBe(false);
  });

  it('syarat gugur tanpa kriteria gugur dan draf aturan gugur otomatis', () => {
    expect(
      summaryWarnings(
        state({ assessors: 'umum', veto: false, hasGugur: true }),
        ctx(),
      ),
    ).toEqual([expect.stringContaining('Syarat gugur')]);
    expect(
      summaryWarnings(
        state({
          assessors: 'umum',
          veto: false,
          criteria: {
            umum: [{ name: 'Bersedia', kind: 'gugur_otomatis', weight: 0 }],
          },
        }),
        ctx(),
      ),
    ).toEqual([expect.stringContaining('Bersedia')]);
  });
});
