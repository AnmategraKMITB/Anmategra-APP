/**
 * Penghitungan nilai dan status pilihan oprec: modul murni tanpa I/O, dipakai
 * server (cache di `application_choice`) dan diuji tanpa basis data.
 *
 * Alur: nilai tiap kriteria (rata-rata penilai) -> nilai lingkup (umum atau
 * divisi) -> nilai pilihan menurut `score_source` -> status per pilihan.
 * Metode peringkat membutuhkan semua pilihan satu divisi sekaligus.
 */
import { type Rule, evaluateRule } from '~/lib/forms/conditions';

export type CriterionKind = 'skor' | 'gugur_otomatis' | 'gugur_manual';
export type GateState = 'memenuhi' | 'ditinjau' | 'tidak';
export type ComputedStatus =
  | 'belum_lengkap'
  | 'perlu_ditinjau'
  | 'lolos'
  | 'tidak_lolos';
export type OverrideStatus = 'lolos' | 'tidak_lolos';

export type CriterionInput = {
  id: string;
  /** Null = kriteria umum. */
  divisionId: string | null;
  kind: CriterionKind;
  weight: number | null;
  /** Hanya untuk gugur_otomatis: gugur bila aturan terpenuhi. */
  gateRule: {
    fieldId: string;
    op: string;
    nilai?: unknown;
    nilai2?: unknown;
  } | null;
};

export type AssessmentInput = {
  criterionId: string;
  assessorId: string;
  rating: number | null;
  gateState: GateState | null;
};

export type ScoringSettings = {
  ratingMin: number;
  ratingMax: number;
  minReviewers: number;
  scoringMode: 'skor' | 'keputusan_langsung';
  statusMethod: 'ambang' | 'peringkat_kuota' | 'peringkat_kuota_minimum';
  statusMinScore: number;
  scoreSource: 'umum' | 'divisi' | 'gabungan';
  /** Bobot nilai umum (0-100) untuk sumber gabungan; sisanya nilai divisi. */
  weightUmum: number;
};

/** Skala penilai dinormalkan ke 0-100. */
export function normalizeRating(
  rating: number,
  min: number,
  max: number,
): number {
  if (max <= min) return 0;
  const clamped = Math.min(Math.max(rating, min), max);
  return ((clamped - min) / (max - min)) * 100;
}

// ---------------------------------------------------------------------------
// Gabungan beberapa penilai
// ---------------------------------------------------------------------------

export type CriterionResult = {
  /** Rata-rata penilai dalam skala 0-100; null bila belum cukup penilai. */
  score: number | null;
  /** Gate hasil gabungan; null bila belum ada. */
  gate: GateState | null;
  /** Selisih rating terbesar antar penilai pada skala asli (untuk penanda). */
  ratingSpread: number;
  reviewers: number;
};

/**
 * Menggabungkan penilaian satu kriteria dari beberapa penilai. Skor dirata-rata
 * bila jumlah penilai mencapai `minReviewers`. Gate: bila semua sama dipakai
 * apa adanya; bila berbeda menjadi "ditinjau".
 */
export function aggregateCriterion(
  assessments: AssessmentInput[],
  s: Pick<ScoringSettings, 'ratingMin' | 'ratingMax' | 'minReviewers'>,
): CriterionResult {
  const rated = assessments.filter((a) => a.rating !== null);
  const gated = assessments.filter((a) => a.gateState !== null);
  const ratings = rated.map((a) => a.rating!);
  const enough = rated.length >= Math.max(1, s.minReviewers);
  const score = enough
    ? ratings
        .map((r) => normalizeRating(r, s.ratingMin, s.ratingMax))
        .reduce((n, v) => n + v, 0) / ratings.length
    : null;
  const states = new Set(gated.map((a) => a.gateState));
  const gate: GateState | null =
    gated.length === 0
      ? null
      : gated.length < Math.max(1, s.minReviewers)
        ? null
        : states.size === 1
          ? [...states][0]!
          : 'ditinjau';
  return {
    score,
    gate,
    ratingSpread:
      ratings.length > 1 ? Math.max(...ratings) - Math.min(...ratings) : 0,
    reviewers: Math.max(rated.length, gated.length),
  };
}

// ---------------------------------------------------------------------------
// Gate otomatis
// ---------------------------------------------------------------------------

/**
 * Apakah aturan gugur otomatis terpenuhi oleh jawaban pendaftar.
 * `answers` berisi jawaban mentah per fieldId; `fieldTypes` memetakan fieldId
 * ke tipe pertanyaan. Pertanyaan yang tidak dijawab tidak menggugurkan.
 */
export function autoGateTriggered(
  rule: NonNullable<CriterionInput['gateRule']>,
  answers: Record<string, unknown>,
  fieldTypes: Record<string, string>,
): boolean {
  const type = fieldTypes[rule.fieldId];
  if (!type) return false;
  const full: Rule = {
    jenis: 'jawaban',
    fieldId: rule.fieldId,
    op: rule.op,
    nilai: rule.nilai,
    nilai2: rule.nilai2,
  };
  return evaluateRule(full, type, answers[rule.fieldId]);
}

// ---------------------------------------------------------------------------
// Nilai lingkup dan nilai pilihan
// ---------------------------------------------------------------------------

export type ScopeScore = {
  /** Kriteria skor di lingkup ini. */
  applicable: boolean;
  /** Semua kriteria skor sudah ada nilainya. */
  complete: boolean;
  score: number | null;
  /** Jumlah bobot kriteria skor (untuk peringatan di UI). */
  weightSum: number;
};

/** Σ(bobot × nilai) / Σ(bobot); tanpa bobot sama sekali, semua kriteria setara. */
export function scopeScore(
  criteria: CriterionInput[],
  results: Map<string, CriterionResult>,
): ScopeScore {
  const scored = criteria.filter((c) => c.kind === 'skor');
  if (scored.length === 0) {
    return { applicable: false, complete: true, score: null, weightSum: 0 };
  }
  const weights = scored.map((c) => c.weight ?? 0);
  const allZero = weights.every((w) => w === 0);
  const effective = allZero ? scored.map(() => 1) : weights;
  const weightSum = weights.reduce((n, w) => n + w, 0);
  const values = scored.map((c) => results.get(c.id)?.score ?? null);
  if (values.some((v) => v === null)) {
    return { applicable: true, complete: false, score: null, weightSum };
  }
  const total = effective.reduce((n, w) => n + w, 0);
  const score =
    scored.reduce((n, _c, i) => n + effective[i]! * values[i]!, 0) / total;
  return { applicable: true, complete: true, score, weightSum };
}

/** Nilai pilihan menurut `score_source`. Lingkup tanpa kriteria skor diabaikan. */
export function choiceScore(
  umum: ScopeScore,
  divisi: ScopeScore,
  source: ScoringSettings['scoreSource'],
  weightUmum: number,
): { score: number | null; complete: boolean; applicable: boolean } {
  const pick = (scopes: ScopeScore[]) => {
    const live = scopes.filter((x) => x.applicable);
    if (live.length === 0)
      return { score: null, complete: true, applicable: false };
    if (live.some((x) => !x.complete))
      return { score: null, complete: false, applicable: true };
    return { score: live[0]!.score, complete: true, applicable: true };
  };
  if (source === 'umum') return pick([umum]);
  if (source === 'divisi') return pick([divisi]);
  // Gabungan berbobot: bila hanya satu lingkup berlaku, pakai yang itu saja.
  const live = [umum, divisi].filter((x) => x.applicable);
  if (live.length === 0)
    return { score: null, complete: true, applicable: false };
  if (live.some((x) => !x.complete))
    return { score: null, complete: false, applicable: true };
  if (live.length === 1)
    return { score: live[0]!.score, complete: true, applicable: true };
  const w = Math.min(Math.max(weightUmum, 0), 100) / 100;
  return {
    score: umum.score! * w + divisi.score! * (1 - w),
    complete: true,
    applicable: true,
  };
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/** Hasil tahap pertama: gate dan kelengkapan, sebelum ambang atau peringkat. */
export type Pre =
  | { kind: 'final'; status: ComputedStatus; score: number | null }
  | { kind: 'candidate'; score: number | null };

/**
 * Tahap pertama status satu pilihan: gate otomatis dan manual, lalu
 * kelengkapan nilai. Urutan: gugur → perlu ditinjau → belum lengkap → kandidat.
 * `gates` memuat hasil gabungan semua kriteria gugur manual yang berlaku.
 */
export function preStatus(input: {
  autoTriggered: boolean[];
  manualGates: (GateState | null)[];
  score: { score: number | null; complete: boolean; applicable: boolean };
}): Pre {
  const { autoTriggered, manualGates, score } = input;
  if (autoTriggered.some(Boolean) || manualGates.some((g) => g === 'tidak')) {
    return { kind: 'final', status: 'tidak_lolos', score: score.score };
  }
  if (manualGates.some((g) => g === 'ditinjau')) {
    return { kind: 'final', status: 'perlu_ditinjau', score: score.score };
  }
  if (manualGates.some((g) => g === null) || !score.complete) {
    return { kind: 'final', status: 'belum_lengkap', score: score.score };
  }
  return { kind: 'candidate', score: score.score };
}

export type RankCandidate = { id: string; score: number | null };

/**
 * Status kandidat satu divisi menurut metode. Kandidat tanpa nilai (oprec tanpa
 * kriteria skor) lolos bila tidak gugur. Nilai sama di batas kuota menjadi
 * "perlu ditinjau" bila memasukkan semuanya melebihi kuota.
 */
export function rankCandidates(
  candidates: RankCandidate[],
  method: ScoringSettings['statusMethod'],
  minScore: number,
  quota: number,
): Map<string, ComputedStatus> {
  const out = new Map<string, ComputedStatus>();
  const scored = candidates.filter((c) => c.score !== null);
  for (const c of candidates) if (c.score === null) out.set(c.id, 'lolos');

  if (method === 'ambang') {
    for (const c of scored) {
      out.set(c.id, c.score! >= minScore ? 'lolos' : 'tidak_lolos');
    }
    return out;
  }

  let pool = scored;
  if (method === 'peringkat_kuota_minimum') {
    for (const c of scored)
      if (c.score! < minScore) out.set(c.id, 'tidak_lolos');
    pool = scored.filter((c) => c.score! >= minScore);
  }
  if (quota <= 0 || pool.length <= quota) {
    for (const c of pool) out.set(c.id, 'lolos');
    return out;
  }
  const sorted = [...pool].sort((a, b) => b.score! - a.score!);
  const cut = sorted[quota - 1]!.score!;
  const above = sorted.filter((c) => c.score! > cut);
  const tied = sorted.filter((c) => (c.score ?? Number.NaN) === cut);
  for (const c of above) out.set(c.id, 'lolos');
  const fits = above.length + tied.length <= quota;
  for (const c of tied) out.set(c.id, fits ? 'lolos' : 'perlu_ditinjau');
  for (const c of sorted.filter((x) => x.score! < cut))
    out.set(c.id, 'tidak_lolos');
  return out;
}

// ---------------------------------------------------------------------------
// Override
// ---------------------------------------------------------------------------

export type ActiveOverride = {
  status: OverrideStatus;
  computedStatusAtOverride: ComputedStatus | null;
  scoreAtOverride: number | null;
};

/** Status efektif: override aktif bila ada, bila tidak status hitungan. */
export function effectiveStatus(
  computed: ComputedStatus | null,
  override: ActiveOverride | null,
): ComputedStatus | null {
  return override ? override.status : computed;
}

/** Nilai atau status hitungan bergeser sejak override dibuat. */
export function overrideNeedsReview(
  override: ActiveOverride | null,
  computed: ComputedStatus | null,
  score: number | null,
): boolean {
  if (!override) return false;
  if (override.computedStatusAtOverride !== computed) return true;
  const before = override.scoreAtOverride;
  if (before === null || score === null) return before !== score;
  return Math.abs(before - score) > 0.005;
}

// ---------------------------------------------------------------------------
// Jendela penilaian dan mode blind
// ---------------------------------------------------------------------------

/**
 * Penilaian pendaftar dibuka setelah gelombangnya berakhir; `allowEarly`
 * membukanya lebih awal. Oprec tanpa gelombang dibuka saat oprec ditutup.
 */
export function assessmentOpen(input: {
  now: Date;
  allowEarly: boolean;
  recruitmentStatus: 'draft' | 'open' | 'closed';
  waveEndsAt: Date | null;
  hasWaves: boolean;
}): boolean {
  if (input.allowEarly) return true;
  if (input.hasWaves) {
    return input.waveEndsAt !== null && input.waveEndsAt <= input.now;
  }
  return input.recruitmentStatus === 'closed';
}

/** Kode tetap untuk pendaftar pada mode blind, mis. `P-4K2Z`. */
export function blindCode(applicationId: string): string {
  let h = 2166136261;
  for (let i = 0; i < applicationId.length; i++) {
    h ^= applicationId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `P-${h.toString(36).toUpperCase().padStart(4, '0').slice(-4)}`;
}
