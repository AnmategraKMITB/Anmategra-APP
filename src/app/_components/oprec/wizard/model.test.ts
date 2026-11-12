import { describe, expect, it } from 'vitest';

import {
  type StepId,
  type WizardCtx,
  buildInput,
  defaultState,
  firstInvalidStep,
  normalizeCriteria,
  openWarnings,
  restoreState,
  stepProblem,
  visibleSteps,
} from './model';

const ctx: WizardCtx = {
  eventId: 'ev-1',
  eventName: 'Kegiatan',
  lembagaId: 'lem-1',
  labels: ['Bidang', 'Divisi'],
  hasOrganogram: true,
  forms: [],
  divisionCount: 2,
  unitName: (id) => id,
};

function stateWithDivisions() {
  const s = defaultState('Kegiatan', 'ev-1');
  s.divisions = {
    u1: { positionId: 'p1', sourcePeriodId: 'ev-1' },
    u2: { positionId: 'p2', sourcePeriodId: 'ev-1' },
  };
  return s;
}

describe('buildInput: kriteria', () => {
  it('mengirim kriteria umum dan per tujuan dengan jenis serta bobot', () => {
    const s = stateWithDivisions();
    s.criteria = {
      umum: [{ name: ' Motivasi ', kind: 'skor', weight: 70 }],
      u1: [
        { name: 'Twibbon', kind: 'gugur_manual', weight: 55 },
        { name: 'Teknis', kind: 'skor', weight: 30 },
      ],
    };
    expect(buildInput(s, ctx).criteria).toEqual([
      { scope: 'umum', name: 'Motivasi', kind: 'skor', weight: 70 },
      { scope: 'u1', name: 'Twibbon', kind: 'gugur_manual' },
      { scope: 'u1', name: 'Teknis', kind: 'skor', weight: 30 },
    ]);
  });

  it('melewatkan slot yang tidak ditampilkan menurut rubrik atau tujuan yang dibatalkan', () => {
    const s = stateWithDivisions();
    s.rubrics = 'umum';
    s.criteria = {
      umum: [{ name: 'Motivasi', kind: 'skor', weight: 100 }],
      u1: [{ name: 'Sisa', kind: 'skor', weight: 10 }],
    };
    expect((buildInput(s, ctx).criteria ?? []).map((k) => k.name)).toEqual([
      'Motivasi',
    ]);

    s.rubrics = 'keduanya';
    delete s.divisions.u1;
    s.criteria = { u1: [{ name: 'Sisa', kind: 'skor', weight: 10 }] };
    expect(buildInput(s, ctx).criteria).toEqual([]);
  });
});

describe('stepProblem S23', () => {
  it('menolak nama kosong dan bobot di luar 0-100', () => {
    const s = stateWithDivisions();
    s.criteria = { umum: [{ name: ' ', kind: 'skor', weight: 10 }] };
    expect(stepProblem('S23', s, ctx)).toMatch(/nama/i);
    s.criteria = { umum: [{ name: 'A', kind: 'skor', weight: 101 }] };
    expect(stepProblem('S23', s, ctx)).toMatch(/0 sampai 100/);
    s.criteria = { umum: [{ name: 'A', kind: 'skor', weight: 2.5 }] };
    expect(stepProblem('S23', s, ctx)).toMatch(/bulat/);
    s.criteria = { umum: [{ name: 'A', kind: 'gugur_manual', weight: 999 }] };
    expect(stepProblem('S23', s, ctx)).toBeNull();
  });
});

describe('normalizeCriteria: draf lama', () => {
  it('memetakan gugur_otomatis ke gugur_manual tanpa kehilangan kriteria', () => {
    const { criteria, remapped } = normalizeCriteria({
      umum: [
        { name: 'Bersedia', kind: 'gugur_otomatis', weight: 0 },
        { name: 'Motivasi', kind: 'skor', weight: 50 },
      ],
      u1: 'rusak',
    });
    expect(remapped).toBe(1);
    expect(criteria.umum).toEqual([
      { name: 'Bersedia', kind: 'gugur_manual', weight: 0 },
      { name: 'Motivasi', kind: 'skor', weight: 50 },
    ]);
    expect(criteria.u1).toBeUndefined();
  });

  it('menerima masukan bukan objek', () => {
    expect(normalizeCriteria(null)).toEqual({ criteria: {}, remapped: 0 });
  });
});

describe('buildInput: jawaban lanjutan', () => {
  it('mengirim penilai, veto, tahap, gugur, hasil, dan closerec sebagai pengaturan terstruktur', () => {
    const s = stateWithDivisions();
    s.assessors = 'keduanya';
    s.generalAssessorUnitId = 'hr';
    s.hasGugur = true;
    s.veto = false;
    s.staged = false;
    s.resultsAccess = 'semua';
    s.closerec = false;
    const input = buildInput(s, ctx);
    expect(input.settings).toMatchObject({
      assessorMode: 'keduanya',
      hasGugur: true,
      headDecides: false,
      stagedPlacement: false,
      resultsAccess: 'semua',
      closerecEnabled: false,
    });
    expect(input.generalAssessorUnitId).toBe('hr');
  });

  it('tidak mengirim bagian penilai umum bila penilainya hanya ketua', () => {
    const s = stateWithDivisions();
    s.assessors = 'ketua';
    s.generalAssessorUnitId = 'hr';
    expect(buildInput(s, ctx).generalAssessorUnitId).toBeNull();
  });
});

describe('buildInput: pengelola', () => {
  it('mengirim daftar email atau NIM hanya bila memilih orang tertentu', () => {
    const s = stateWithDivisions();
    s.managers = 'orang';
    s.managerIdentifiers = ['a@itb.ac.id', '13523001'];
    expect(buildInput(s, ctx).managers).toEqual(['a@itb.ac.id', '13523001']);
    s.managers = 'saya';
    expect(buildInput(s, ctx).managers).toEqual([]);
  });
});

describe('validasi ulang langkah yang dilewati (H-08, K-04)', () => {
  it('menemukan langkah bermasalah di depan langkah sekarang', () => {
    const s = stateWithDivisions();
    s.name = '';
    s.maxChoices = 2;
    const steps = visibleSteps(s, { hasMultipleSources: false });
    expect(firstInvalidStep(steps, s, ctx)?.id).toBe('S1');
    s.name = 'Oprec';
    s.rubrics = 'umum';
    s.criteria = { umum: [{ name: '', kind: 'skor', weight: 10 }] };
    const bad = firstInvalidStep(
      visibleSteps(s, { hasMultipleSources: false }),
      s,
      ctx,
    );
    expect(bad?.id).toBe('S23');
  });

  it('null bila semua langkah lolos', () => {
    const s = stateWithDivisions();
    s.criteria = {};
    s.maxChoices = 2;
    expect(
      firstInvalidStep(visibleSteps(s, { hasMultipleSources: false }), s, ctx),
    ).toBeNull();
  });

  it('restoreState menormalkan kriteria lama dan menghitungnya', () => {
    const base = defaultState('Kegiatan', 'ev-1');
    const { state, remapped } = restoreState(base, {
      name: 'Draf',
      criteria: { umum: [{ name: 'X', kind: 'gugur_otomatis' }] },
    });
    expect(state.name).toBe('Draf');
    expect(state.criteria.umum?.[0]?.kind).toBe('gugur_manual');
    expect(remapped).toBe(1);
  });
});

describe('stepProblem S4: gelombang tumpang tindih (#382)', () => {
  it('menolak dengan pesan yang menyebut kedua gelombang', () => {
    const s = stateWithDivisions();
    s.useWaves = true;
    s.waves = [
      {
        label: 'Gel 1',
        startsAt: '2030-01-01T08:00',
        endsAt: '2030-01-10T08:00',
      },
      {
        label: 'Gel 2',
        startsAt: '2030-01-05T08:00',
        endsAt: '2030-01-20T08:00',
      },
    ];
    const msg = stepProblem('S4', s, ctx);
    expect(msg).toContain('"Gel 1"');
    expect(msg).toContain('"Gel 2"');
    s.waves[1]!.startsAt = '2030-01-10T08:00';
    expect(stepProblem('S4', s, ctx)).toBeNull();
  });
});

describe('openWarnings (#385)', () => {
  const steps = ['S10'] as StepId[];
  const withForm = (hasUnitChoice: boolean) =>
    ({
      ...ctx,
      forms: [{ id: 'f1', title: 'F', status: 'Draft', hasUnitChoice }],
    }) as WizardCtx;

  it('memperingatkan form yang ada tanpa blok Pilihan tujuan', () => {
    const s = stateWithDivisions();
    s.formMode = 'existing';
    s.existingFormId = 'f1';
    const w = openWarnings(steps, s, withForm(false));
    expect(w).toHaveLength(1);
    expect(w[0]!.id).toBe('S10');
  });

  it('tanpa peringatan bila lengkap', () => {
    const s = stateWithDivisions();
    s.formMode = 'existing';
    s.existingFormId = 'f1';
    expect(openWarnings(steps, s, withForm(true))).toEqual([]);
    s.formMode = 'template';
    expect(openWarnings(steps, s, withForm(false))).toEqual([]);
  });
});
