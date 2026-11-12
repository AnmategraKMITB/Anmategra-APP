import { describe, expect, it } from 'vitest';

import {
  type AssessmentInput,
  type CriterionInput,
  type CriterionResult,
  type ScopeScore,
  aggregateCriterion,
  assessmentOpen,
  autoGateTriggered,
  blindCode,
  choiceScore,
  effectiveStatus,
  normalizeRating,
  overrideNeedsReview,
  preStatus,
  rankCandidates,
  scopeScore,
} from './scoring';

const SCALE = { ratingMin: 1, ratingMax: 5 };

const rating = (assessorId: string, value: number | null): AssessmentInput => ({
  criterionId: 'k1',
  assessorId,
  rating: value,
  gateState: null,
});

const gate = (
  assessorId: string,
  state: AssessmentInput['gateState'],
): AssessmentInput => ({
  criterionId: 'k1',
  assessorId,
  rating: null,
  gateState: state,
});

const skor = (id: string, weight: number | null): CriterionInput => ({
  id,
  divisionId: null,
  kind: 'skor',
  weight,
  gateRule: null,
});

const result = (score: number | null): CriterionResult => ({
  score,
  gate: null,
  ratingSpread: 0,
  reviewers: score === null ? 0 : 1,
});

const scope = (
  score: number | null,
  opts: Partial<ScopeScore> = {},
): ScopeScore => ({
  applicable: true,
  complete: score !== null,
  score,
  weightSum: 100,
  ...opts,
});

const NOT_APPLICABLE: ScopeScore = {
  applicable: false,
  complete: true,
  score: null,
  weightSum: 0,
};

describe('normalizeRating', () => {
  it('memetakan skala penilai ke 0-100', () => {
    expect(normalizeRating(1, 1, 5)).toBe(0);
    expect(normalizeRating(3, 1, 5)).toBe(50);
    expect(normalizeRating(5, 1, 5)).toBe(100);
  });

  it('menjepit rating di luar skala', () => {
    expect(normalizeRating(0, 1, 5)).toBe(0);
    expect(normalizeRating(9, 1, 5)).toBe(100);
  });

  it('skala yang tidak sah menghasilkan 0', () => {
    expect(normalizeRating(3, 5, 5)).toBe(0);
    expect(normalizeRating(3, 5, 1)).toBe(0);
  });
});

describe('aggregateCriterion', () => {
  it('merata-rata penilai setelah dinormalkan', () => {
    const r = aggregateCriterion([rating('a', 4), rating('b', 2)], {
      ...SCALE,
      minReviewers: 2,
    });
    expect(r.score).toBe(50);
    expect(r.ratingSpread).toBe(2);
    expect(r.reviewers).toBe(2);
  });

  it('nilai kosong bila penilai belum mencapai minReviewers', () => {
    const r = aggregateCriterion([rating('a', 5)], {
      ...SCALE,
      minReviewers: 2,
    });
    expect(r.score).toBeNull();
    expect(r.reviewers).toBe(1);
  });

  it('minReviewers di bawah 1 diperlakukan sebagai 1', () => {
    const r = aggregateCriterion([rating('a', 5)], {
      ...SCALE,
      minReviewers: 0,
    });
    expect(r.score).toBe(100);
  });

  it('gate yang sama dari semua penilai dipakai apa adanya', () => {
    const r = aggregateCriterion(
      [gate('a', 'memenuhi'), gate('b', 'memenuhi')],
      {
        ...SCALE,
        minReviewers: 2,
      },
    );
    expect(r.gate).toBe('memenuhi');
  });

  it('gate yang berbeda antar penilai menjadi "ditinjau"', () => {
    const r = aggregateCriterion([gate('a', 'memenuhi'), gate('b', 'tidak')], {
      ...SCALE,
      minReviewers: 1,
    });
    expect(r.gate).toBe('ditinjau');
  });

  it('gate kosong bila belum ada atau belum cukup penilai', () => {
    expect(
      aggregateCriterion([], { ...SCALE, minReviewers: 1 }).gate,
    ).toBeNull();
    expect(
      aggregateCriterion([gate('a', 'tidak')], { ...SCALE, minReviewers: 2 })
        .gate,
    ).toBeNull();
  });
});

describe('autoGateTriggered', () => {
  const rule = { fieldId: 'f1', op: 'adalah', nilai: 'Tidak' };
  const types = { f1: 'single_choice' };

  it('gugur bila jawaban cocok dengan aturan', () => {
    expect(autoGateTriggered(rule, { f1: 'Tidak' }, types)).toBe(true);
    expect(autoGateTriggered(rule, { f1: 'Ya' }, types)).toBe(false);
  });

  it('pertanyaan yang tidak dikenal tidak menggugurkan', () => {
    expect(autoGateTriggered(rule, { f1: 'Tidak' }, {})).toBe(false);
  });

  it('pertanyaan "adalah" yang tidak dijawab tidak menggugurkan', () => {
    expect(autoGateTriggered(rule, {}, types)).toBe(false);
  });

  // Temuan N-6: operator negatif (bukan, !=, tidak_memuat, kosong) bernilai
  // true untuk jawaban kosong, sehingga pertanyaan tersembunyi atau pendaftar
  // closerec (tanpa jawaban) ikut gugur. Bertentangan dengan docstring.
  it.todo(
    'operator negatif pada pertanyaan yang tidak dijawab tidak menggugurkan',
  );
});

describe('scopeScore', () => {
  it('menghitung rata-rata berbobot kriteria skor', () => {
    const s = scopeScore(
      [skor('a', 40), skor('b', 60)],
      new Map([
        ['a', result(50)],
        ['b', result(100)],
      ]),
    );
    expect(s).toEqual({
      applicable: true,
      complete: true,
      score: 80,
      weightSum: 100,
    });
  });

  it('tanpa bobot sama sekali, semua kriteria setara', () => {
    const s = scopeScore(
      [skor('a', null), skor('b', 0)],
      new Map([
        ['a', result(50)],
        ['b', result(100)],
      ]),
    );
    expect(s.score).toBe(75);
    expect(s.weightSum).toBe(0);
  });

  it('bobot yang totalnya bukan 100 tetap dinormalkan', () => {
    const s = scopeScore(
      [skor('a', 30), skor('b', 30)],
      new Map([
        ['a', result(50)],
        ['b', result(100)],
      ]),
    );
    expect(s.score).toBe(75);
    expect(s.weightSum).toBe(60);
  });

  it('belum lengkap bila ada kriteria yang belum bernilai', () => {
    const s = scopeScore(
      [skor('a', 50), skor('b', 50)],
      new Map([['a', result(80)]]),
    );
    expect(s).toEqual({
      applicable: true,
      complete: false,
      score: null,
      weightSum: 100,
    });
  });

  it('lingkup tanpa kriteria skor tidak berlaku', () => {
    const gugur: CriterionInput = { ...skor('g', null), kind: 'gugur_manual' };
    expect(scopeScore([gugur], new Map())).toEqual(NOT_APPLICABLE);
  });
});

describe('choiceScore', () => {
  it('gabungan memakai bobot umum', () => {
    expect(choiceScore(scope(80), scope(60), 'gabungan', 50).score).toBe(70);
    expect(choiceScore(scope(80), scope(60), 'gabungan', 30).score).toBeCloseTo(
      66,
    );
  });

  it('gabungan memakai satu-satunya lingkup yang berlaku', () => {
    const r = choiceScore(NOT_APPLICABLE, scope(60), 'gabungan', 50);
    expect(r).toEqual({ score: 60, complete: true, applicable: true });
  });

  it('gabungan belum lengkap bila salah satu lingkup belum lengkap', () => {
    const r = choiceScore(scope(null), scope(60), 'gabungan', 50);
    expect(r).toEqual({ score: null, complete: false, applicable: true });
  });

  it('bobot umum dijepit ke 0-100', () => {
    expect(choiceScore(scope(80), scope(60), 'gabungan', 150).score).toBe(80);
    expect(choiceScore(scope(80), scope(60), 'gabungan', -10).score).toBe(60);
  });

  it('sumber tunggal mengabaikan lingkup lain', () => {
    expect(choiceScore(scope(80), scope(60), 'umum', 50).score).toBe(80);
    expect(choiceScore(scope(80), scope(60), 'divisi', 50).score).toBe(60);
  });

  it('sumber tunggal yang tidak berlaku menghasilkan nilai kosong', () => {
    expect(choiceScore(NOT_APPLICABLE, scope(60), 'umum', 50)).toEqual({
      score: null,
      complete: true,
      applicable: false,
    });
  });
});

describe('preStatus', () => {
  const ready = { score: 70, complete: true, applicable: true };

  it('gugur otomatis atau gate "tidak" langsung tidak lolos', () => {
    expect(
      preStatus({
        autoTriggered: [true],
        manualGates: ['ditinjau'],
        score: ready,
      }),
    ).toEqual({ kind: 'final', status: 'tidak_lolos', score: 70 });
    expect(
      preStatus({ autoTriggered: [], manualGates: ['tidak'], score: ready }),
    ).toEqual({ kind: 'final', status: 'tidak_lolos', score: 70 });
  });

  it('gate "ditinjau" didahulukan atas kelengkapan', () => {
    expect(
      preStatus({
        autoTriggered: [],
        manualGates: ['ditinjau', null],
        score: ready,
      }),
    ).toMatchObject({ kind: 'final', status: 'perlu_ditinjau' });
  });

  it('gate kosong atau nilai belum lengkap berarti belum lengkap', () => {
    expect(
      preStatus({ autoTriggered: [], manualGates: [null], score: ready }),
    ).toMatchObject({ status: 'belum_lengkap' });
    expect(
      preStatus({
        autoTriggered: [],
        manualGates: [],
        score: { score: null, complete: false, applicable: true },
      }),
    ).toMatchObject({ status: 'belum_lengkap' });
  });

  it('lolos semua gate menjadi kandidat peringkat', () => {
    expect(
      preStatus({
        autoTriggered: [false],
        manualGates: ['memenuhi'],
        score: ready,
      }),
    ).toEqual({ kind: 'candidate', score: 70 });
  });
});

describe('rankCandidates', () => {
  const c = (id: string, score: number | null) => ({ id, score });
  const statuses = (m: Map<string, string>) => Object.fromEntries(m);

  it('ambang: nilai sama dengan ambang lolos', () => {
    const r = rankCandidates([c('a', 60), c('b', 59.9)], 'ambang', 60, 1);
    expect(statuses(r)).toEqual({ a: 'lolos', b: 'tidak_lolos' });
  });

  it('peringkat dalam kuota meloloskan sebanyak kuota', () => {
    const r = rankCandidates(
      [c('a', 70), c('b', 90), c('c', 80)],
      'peringkat_kuota',
      0,
      2,
    );
    expect(statuses(r)).toEqual({ a: 'tidak_lolos', b: 'lolos', c: 'lolos' });
  });

  it('nilai seri di batas kuota yang melebihi kuota menjadi perlu ditinjau', () => {
    const r = rankCandidates(
      [c('a', 90), c('b', 80), c('c', 80)],
      'peringkat_kuota',
      0,
      2,
    );
    expect(statuses(r)).toEqual({
      a: 'lolos',
      b: 'perlu_ditinjau',
      c: 'perlu_ditinjau',
    });
  });

  it('nilai seri di batas kuota yang masih muat semuanya lolos', () => {
    const r = rankCandidates(
      [c('a', 90), c('b', 80), c('c', 80), c('d', 70)],
      'peringkat_kuota',
      0,
      3,
    );
    expect(statuses(r)).toEqual({
      a: 'lolos',
      b: 'lolos',
      c: 'lolos',
      d: 'tidak_lolos',
    });
  });

  it('kuota 0 berarti tanpa batas', () => {
    const r = rankCandidates([c('a', 10), c('b', 20)], 'peringkat_kuota', 0, 0);
    expect(statuses(r)).toEqual({ a: 'lolos', b: 'lolos' });
  });

  it('peringkat dengan nilai minimum menyaring sebelum diperingkat', () => {
    const r = rankCandidates(
      [c('a', 95), c('b', 85), c('c', 55)],
      'peringkat_kuota_minimum',
      60,
      1,
    );
    expect(statuses(r)).toEqual({
      a: 'lolos',
      b: 'tidak_lolos',
      c: 'tidak_lolos',
    });
  });

  it('peringkat dengan nilai minimum dan kuota 0 hanya memakai ambang', () => {
    const r = rankCandidates(
      [c('a', 50), c('b', 70)],
      'peringkat_kuota_minimum',
      60,
      0,
    );
    expect(statuses(r)).toEqual({ a: 'tidak_lolos', b: 'lolos' });
  });

  it('kandidat tanpa nilai (oprec tanpa kriteria skor) lolos', () => {
    const r = rankCandidates(
      [c('a', null), c('b', 90)],
      'peringkat_kuota',
      0,
      1,
    );
    expect(statuses(r)).toEqual({ a: 'lolos', b: 'lolos' });
  });
});

describe('override', () => {
  const override = {
    status: 'lolos' as const,
    computedStatusAtOverride: 'tidak_lolos' as const,
    scoreAtOverride: 55,
  };

  it('status efektif memakai override aktif', () => {
    expect(effectiveStatus('tidak_lolos', override)).toBe('lolos');
    expect(effectiveStatus('tidak_lolos', null)).toBe('tidak_lolos');
  });

  it('tidak perlu ditinjau bila status dan nilai tidak bergeser', () => {
    expect(overrideNeedsReview(override, 'tidak_lolos', 55)).toBe(false);
    expect(overrideNeedsReview(override, 'tidak_lolos', 55.004)).toBe(false);
    expect(overrideNeedsReview(null, 'lolos', 90)).toBe(false);
  });

  it('perlu ditinjau bila status hitungan atau nilai bergeser', () => {
    expect(overrideNeedsReview(override, 'lolos', 55)).toBe(true);
    expect(overrideNeedsReview(override, 'tidak_lolos', 55.01)).toBe(true);
  });

  it('nilai kosong dibandingkan apa adanya', () => {
    const noScore = { ...override, scoreAtOverride: null };
    expect(overrideNeedsReview(noScore, 'tidak_lolos', null)).toBe(false);
    expect(overrideNeedsReview(noScore, 'tidak_lolos', 50)).toBe(true);
  });
});

describe('assessmentOpen', () => {
  const now = new Date('2026-11-20T10:00:00Z');
  const past = new Date('2026-11-19T10:00:00Z');
  const future = new Date('2026-11-21T10:00:00Z');
  const base = {
    now,
    allowEarly: false,
    recruitmentStatus: 'open' as const,
    waveEndsAt: null,
    hasWaves: false,
  };

  it('allowEarly selalu membuka penilaian', () => {
    expect(assessmentOpen({ ...base, allowEarly: true })).toBe(true);
  });

  it('bergelombang: terbuka setelah gelombang pendaftar berakhir', () => {
    expect(assessmentOpen({ ...base, hasWaves: true, waveEndsAt: past })).toBe(
      true,
    );
    expect(assessmentOpen({ ...base, hasWaves: true, waveEndsAt: now })).toBe(
      true,
    );
    expect(
      assessmentOpen({ ...base, hasWaves: true, waveEndsAt: future }),
    ).toBe(false);
  });

  it('bergelombang: pendaftar tanpa gelombang (closerec) tidak pernah terbuka', () => {
    expect(assessmentOpen({ ...base, hasWaves: true, waveEndsAt: null })).toBe(
      false,
    );
  });

  // Perilaku saat ini (N-1): tanpa gelombang, penilaian hanya terbuka bila
  // status oprec "closed", dan belum ada UI yang menutup oprec. PR 2 mengubahnya.
  it('tanpa gelombang: hanya terbuka bila oprec ditutup', () => {
    expect(assessmentOpen({ ...base, recruitmentStatus: 'closed' })).toBe(true);
    expect(assessmentOpen({ ...base, recruitmentStatus: 'open' })).toBe(false);
    expect(assessmentOpen({ ...base, recruitmentStatus: 'draft' })).toBe(false);
  });
});

describe('blindCode', () => {
  it('berbentuk P-XXXX dan stabil untuk id yang sama', () => {
    const code = blindCode('application-123');
    expect(code).toMatch(/^P-[0-9A-Z]{4}$/);
    expect(blindCode('application-123')).toBe(code);
  });

  it('id berbeda menghasilkan kode berbeda', () => {
    expect(blindCode('application-123')).not.toBe(blindCode('application-124'));
  });
});
