import { MAX_YEAR, MIN_YEAR, isValidDateInput } from '~/lib/date-input';
import {
  ELIGIBILITY_ATTRIBUTE_LABELS,
  type EligibilityAttribute,
  type EligibilityOperator,
} from '~/lib/oprec/eligibility';
import { waveOverlapMessage } from '~/lib/oprec/waves';
import { type RouterInputs, type RouterOutputs } from '~/trpc/react';

export type SetupOptions = RouterOutputs['oprec']['setupOptions'];
export type SetupTree = NonNullable<SetupOptions['tree']>;
export type CreateFromSetupInput = RouterInputs['oprec']['createFromSetup'];

export type RuleDraft = {
  attribute: EligibilityAttribute;
  op: EligibilityOperator;
  /** Teks mentah dari kolom isian; daftar dipisah koma. */
  value: string;
};

export type CriterionDraft = {
  name: string;
  /** `gugur_otomatis` ditunda sampai wizard mengumpulkan `gateRule` (keputusan #345). */
  kind: WizardCriterionKind;
  weight: number;
};

export const WIZARD_CRITERION_KINDS = ['skor', 'gugur_manual'] as const;
export type WizardCriterionKind = (typeof WIZARD_CRITERION_KINDS)[number];

/**
 * Memulihkan kriteria dari jawaban yang tersimpan. Jenis yang tidak lagi
 * ditawarkan (mis. `gugur_otomatis` dari draf lama) dipetakan ke
 * `gugur_manual` dan dihitung, supaya antarmuka dapat memberi tahu pengguna.
 */
export function normalizeCriteria(raw: unknown): {
  criteria: Record<string, CriterionDraft[]>;
  remapped: number;
} {
  const criteria: Record<string, CriterionDraft[]> = {};
  let remapped = 0;
  if (typeof raw !== 'object' || raw === null) return { criteria, remapped };
  for (const [slot, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    criteria[slot] = list.flatMap((item: unknown) => {
      if (typeof item !== 'object' || item === null) return [];
      const k = item as Record<string, unknown>;
      let kind: WizardCriterionKind;
      if (k.kind === 'skor') kind = 'skor';
      else if (k.kind === 'gugur_manual') kind = 'gugur_manual';
      else {
        kind = 'gugur_manual';
        remapped += 1;
      }
      return [
        {
          name: typeof k.name === 'string' ? k.name : '',
          kind,
          weight: typeof k.weight === 'number' ? k.weight : 0,
        },
      ];
    });
  }
  return { criteria, remapped };
}

/** Lingkup kriteria yang sedang ditampilkan: 'umum' dan/atau tiap tujuan, sesuai rubrik. */
export function criteriaSlots(s: WizardState): string[] {
  return [
    ...(s.rubrics !== 'divisi' ? ['umum'] : []),
    ...(s.rubrics !== 'umum' ? Object.keys(s.divisions) : []),
  ];
}

export type PresetId = 'besar' | 'ami' | 'himpunan' | 'custom';

export type WizardState = {
  /** Preset awal yang dipakai, atau "custom". */
  preset: PresetId | null;
  /** S1 */
  name: string;
  /** S2: periode sumber organogram, termasuk periode sendiri. */
  sourcePeriodIds: string[];
  /** S3: unitId → jabatan tujuan dan periode sumbernya. */
  divisions: Record<string, { positionId: string; sourcePeriodId: string }>;
  /** S4 */
  useWaves: boolean;
  waves: { label: string; startsAt: string; endsAt: string }[];
  /** S5 */
  eligibility: { enabled: boolean; match: 'all' | 'any'; rules: RuleDraft[] };
  /** S6 */
  minChoices: number;
  maxChoices: number;
  /** S7 */
  allowRedirect: boolean;
  /** S8 */
  attachments: string[];
  /** S9 */
  grouping: 'per_divisi' | 'satu_bagian';
  /** S10 */
  formMode: 'template' | 'existing';
  formTitle: string;
  existingFormId: string | null;
  /** S11 */
  rubrics: 'keduanya' | 'divisi' | 'umum';
  /** S12, S12a, S12b */
  scoringMode: 'skor' | 'keputusan_langsung';
  statusMethod: 'ambang' | 'peringkat_kuota' | 'peringkat_kuota_minimum';
  scoreSource: 'umum' | 'divisi' | 'gabungan';
  /** S13, S14 */
  assessors: 'ketua' | 'umum' | 'keduanya';
  generalAssessorUnitId: string | null;
  /** S15, S16 */
  hasGugur: boolean;
  veto: boolean;
  /** S17 */
  managers: 'saya' | 'orang' | 'level' | 'ketua';
  managerIdentifiers: string[];
  managerUnitId: string | null;
  /** S18, S19 */
  staged: boolean;
  visibility: 'tidak' | 'ya';
  /** S20, S21, S22 */
  resultsAccess: 'admin' | 'admin_ketua' | 'semua';
  releaseToApplicants: boolean;
  closerec: boolean;
  /** S23: 'umum' atau unitId → kriteria. */
  criteria: Record<string, CriterionDraft[]>;
};

export const ATTACHMENT_PRESETS = [
  'Twibbon',
  'Nilai asesmen',
  'Portofolio',
  'CV',
  'Transkrip',
  'Surat izin',
] as const;

export function defaultState(
  eventName: string,
  ownPeriodId: string,
): WizardState {
  return {
    preset: null,
    name: `Oprec ${eventName}`,
    sourcePeriodIds: [ownPeriodId],
    divisions: {},
    useWaves: false,
    waves: [],
    eligibility: { enabled: false, match: 'all', rules: [] },
    minChoices: 1,
    maxChoices: 3,
    allowRedirect: false,
    attachments: [],
    grouping: 'per_divisi',
    formMode: 'template',
    formTitle: '',
    existingFormId: null,
    rubrics: 'keduanya',
    scoringMode: 'skor',
    statusMethod: 'peringkat_kuota_minimum',
    scoreSource: 'gabungan',
    assessors: 'ketua',
    generalAssessorUnitId: null,
    hasGugur: false,
    veto: true,
    managers: 'saya',
    managerIdentifiers: [],
    managerUnitId: null,
    staged: true,
    visibility: 'tidak',
    resultsAccess: 'admin_ketua',
    releaseToApplicants: true,
    closerec: true,
    criteria: {},
  };
}

export type WizardCtx = {
  eventId: string;
  eventName: string;
  lembagaId: string | null;
  /** Nama level 1 dan 2 dari organogram. */
  labels: [string, string];
  hasOrganogram: boolean;
  forms: SetupOptions['forms'];
  divisionCount: number;
  /** Nama bagian lintas sumber, untuk ringkasan. */
  unitName: (unitId: string) => string;
  /** Bagian punya penempat / penempat di posisi ketua, dari organogram. */
  hasPeople: (unitId: string) => boolean;
  hasHead: (unitId: string) => boolean;
};

export const STEP_IDS = [
  'S1',
  'S2',
  'S3',
  'S4',
  'S5',
  'S6',
  'S7',
  'S8',
  'S9',
  'S10',
  'S11',
  'S12',
  'S12a',
  'S12b',
  'S13',
  'S14',
  'S15',
  'S23',
  'S16',
  'S17',
  'S18',
  'S19',
  'S20',
  'S21',
  'S22',
] as const;
export type StepId = (typeof STEP_IDS)[number];

export const GROUP_OF: Record<StepId, string> = {
  S1: 'Dasar',
  S2: 'Dasar',
  S3: 'Dasar',
  S4: 'Dasar',
  S5: 'Siapa yang mendaftar',
  S6: 'Isi form',
  S7: 'Isi form',
  S8: 'Isi form',
  S9: 'Isi form',
  S10: 'Form',
  S11: 'Penilaian',
  S12: 'Penilaian',
  S12a: 'Penilaian',
  S12b: 'Penilaian',
  S13: 'Penilaian',
  S14: 'Penilaian',
  S15: 'Penilaian',
  S23: 'Penilaian',
  S16: 'Keputusan dan akses',
  S17: 'Keputusan dan akses',
  S18: 'Penempatan',
  S19: 'Penempatan',
  S20: 'Hasil',
  S21: 'Hasil',
  S22: 'Closerec',
};

/** Langkah yang tampil, mengikuti kolom "muncul bila" di draf setup. */
export function visibleSteps(
  s: WizardState,
  c: { hasMultipleSources: boolean },
): StepId[] {
  return STEP_IDS.filter((id) => {
    switch (id) {
      case 'S2':
        return c.hasMultipleSources;
      case 'S12a':
        return s.scoringMode === 'skor';
      case 'S12b':
        return s.scoringMode === 'skor' && s.rubrics === 'keduanya';
      case 'S14':
        return s.assessors !== 'ketua';
      default:
        return true;
    }
  });
}

// ---------------------------------------------------------------------------
// Isian syarat pendaftar
// ---------------------------------------------------------------------------

export const ATTRIBUTE_OPS: Record<
  EligibilityAttribute,
  { ops: EligibilityOperator[]; kind: 'number' | 'text' | 'status' | 'lembaga' }
> = {
  angkatan_kuliah: {
    ops: ['eq', 'gte', 'lte', 'between', 'in'],
    kind: 'number',
  },
  prodi: { ops: ['eq', 'neq', 'in', 'not_in', 'contains'], kind: 'text' },
  fakultas: { ops: ['eq', 'neq', 'in'], kind: 'text' },
  status_mahasiswa: { ops: ['eq', 'neq'], kind: 'status' },
  keanggotaan_lembaga: { ops: ['eq', 'neq'], kind: 'lembaga' },
  angkatan_lembaga: {
    ops: ['eq', 'gte', 'lte', 'between', 'in'],
    kind: 'number',
  },
};

export const OP_LABELS: Record<EligibilityOperator, string> = {
  eq: 'sama dengan',
  neq: 'bukan',
  in: 'salah satu dari',
  not_in: 'bukan salah satu dari',
  gt: 'lebih dari',
  gte: 'minimal',
  lt: 'kurang dari',
  lte: 'maksimal',
  between: 'antara',
  contains: 'mengandung',
};

export const ATTRIBUTE_CHOICES = (
  Object.keys(ATTRIBUTE_OPS) as EligibilityAttribute[]
).map((a) => ({ value: a, label: ELIGIBILITY_ATTRIBUTE_LABELS[a] }));

const isListOp = (op: EligibilityOperator) =>
  op === 'in' || op === 'not_in' || op === 'between';

/** Nilai rule untuk API, atau pesan masalah bila isiannya belum sah. */
export function ruleValue(
  rule: RuleDraft,
  lembagaId: string | null,
):
  | { ok: true; value: string | number | (string | number)[] }
  | { ok: false; message: string } {
  const kind = ATTRIBUTE_OPS[rule.attribute].kind;
  const raw = kind === 'lembaga' ? (lembagaId ?? '') : rule.value.trim();
  if (raw === '') return { ok: false, message: 'Isi nilai syaratnya.' };
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const convert = (p: string) => {
    if (kind !== 'number') return p;
    const n = Number(p);
    return Number.isFinite(n) ? n : NaN;
  };
  if (!isListOp(rule.op) && raw.includes(',')) {
    return {
      ok: false,
      message:
        'Syarat ini butuh satu nilai. Untuk beberapa nilai, pilih "salah satu dari".',
    };
  }
  if (isListOp(rule.op)) {
    const list = parts.map(convert);
    if (
      list.length === 0 ||
      list.some((v) => typeof v === 'number' && Number.isNaN(v))
    ) {
      return { ok: false, message: 'Isi daftar nilai yang sah, dipisah koma.' };
    }
    if (rule.op === 'between' && list.length !== 2) {
      return {
        ok: false,
        message: 'Rentang butuh tepat dua nilai, mis. 2023, 2025.',
      };
    }
    return { ok: true, value: list };
  }
  const single = convert(raw);
  if (typeof single === 'number' && Number.isNaN(single)) {
    return { ok: false, message: 'Isi angka yang sah.' };
  }
  return { ok: true, value: single };
}

// ---------------------------------------------------------------------------
// Validasi per langkah dan keluaran ke API
// ---------------------------------------------------------------------------

/** Pesan bila langkah belum boleh dilewati, atau null. */
export function stepProblem(
  id: StepId,
  s: WizardState,
  c: WizardCtx,
): string | null {
  switch (id) {
    case 'S1':
      return s.name.trim() === '' ? 'Beri nama oprec ini.' : null;
    case 'S3':
      if (!c.hasOrganogram) return 'Periode ini belum punya organogram.';
      return c.divisionCount === 0
        ? `Pilih minimal satu ${c.labels[1].toLowerCase()}.`
        : null;
    case 'S4': {
      if (!s.useWaves) return null;
      if (s.waves.length === 0) return 'Tambahkan minimal satu gelombang.';
      for (const w of s.waves) {
        if (!w.label.trim() || !w.startsAt || !w.endsAt) {
          return 'Lengkapi nama dan tanggal tiap gelombang.';
        }
        if (!isValidDateInput(w.startsAt) || !isValidDateInput(w.endsAt)) {
          return `Tanggal gelombang harus bertahun ${MIN_YEAR} sampai ${MAX_YEAR}.`;
        }
        if (new Date(w.endsAt) <= new Date(w.startsAt)) {
          return 'Tanggal berakhir harus setelah tanggal mulai.';
        }
      }
      return waveOverlapMessage(
        s.waves.map((w) => ({
          label: w.label,
          startsAt: new Date(w.startsAt),
          endsAt: new Date(w.endsAt),
        })),
      );
    }
    case 'S5': {
      if (!s.eligibility.enabled) return null;
      if (s.eligibility.rules.length === 0)
        return 'Tambahkan minimal satu syarat.';
      for (const r of s.eligibility.rules) {
        const v = ruleValue(r, c.lembagaId);
        if (!v.ok) return v.message;
      }
      return null;
    }
    case 'S6':
      if (s.minChoices < 1 || s.minChoices > s.maxChoices) {
        return 'Batas minimum tidak boleh melebihi maksimum.';
      }
      return s.maxChoices > c.divisionCount
        ? `Jumlah pilihan melebihi jumlah ${c.labels[1].toLowerCase()} yang dibuka (${c.divisionCount}).`
        : null;
    case 'S23':
      for (const slot of criteriaSlots(s)) {
        for (const k of s.criteria[slot] ?? []) {
          if (!k.name.trim())
            return 'Beri nama setiap kriteria atau hapus barisnya.';
          if (
            k.kind === 'skor' &&
            (!Number.isInteger(k.weight) || k.weight < 0 || k.weight > 100)
          ) {
            return 'Bobot kriteria berupa bilangan bulat 0 sampai 100.';
          }
        }
      }
      return null;
    case 'S10':
      if (s.formMode === 'existing' && !s.existingFormId)
        return 'Pilih formnya.';
      return null;
    case 'S14':
      return s.generalAssessorUnitId ? null : 'Pilih bagian penilai umum.';
    case 'S17':
      if (s.managers === 'orang' && s.managerIdentifiers.length === 0) {
        return 'Tambahkan minimal satu orang (email atau NIM).';
      }
      if (s.managers === 'level' && !s.managerUnitId) return 'Pilih bagiannya.';
      return null;
    default:
      return null;
  }
}

/**
 * Peringatan: tidak menghalangi pembuatan oprec, tetapi akan menghalangi Buka
 * pendaftaran (#385). Syarat yang menghalangi pembuatan ada di `stepProblem`.
 */
export function openWarnings(
  steps: StepId[],
  s: WizardState,
  c: WizardCtx,
): { id: StepId; message: string }[] {
  const out: { id: StepId; message: string }[] = [];
  if (
    steps.includes('S14') &&
    s.assessors !== 'ketua' &&
    s.generalAssessorUnitId &&
    !c.hasPeople(s.generalAssessorUnitId)
  ) {
    out.push({
      id: 'S14',
      message: `Bagian "${c.unitName(s.generalAssessorUnitId)}" belum punya anggota, jadi tidak bisa menjadi penilai umum. Isi bagian itu di organogram atau pilih bagian lain.`,
    });
  }
  if (steps.includes('S3') && (s.assessors !== 'umum' || s.veto)) {
    const names = Object.keys(s.divisions)
      .filter((u) => !c.hasHead(u))
      .map((u) => `"${c.unitName(u)}"`);
    if (names.length > 0) {
      out.push({
        id: 'S3',
        message: `${names.join(', ')} belum punya ketua. Isi ketua di organogram, atau pilih penilai umum dan matikan veto ketua.`,
      });
    }
  }
  if (steps.includes('S10') && s.formMode === 'existing') {
    const f = c.forms.find((x) => x.id === s.existingFormId);
    if (f && !f.hasUnitChoice) {
      out.push({
        id: 'S10',
        message:
          'Formulir ini belum punya blok Pilihan tujuan, jadi pendaftaran belum bisa dibuka. Tambahkan blok itu di formulir atau pilih templat oprec.',
      });
    }
  }
  return out;
}

/**
 * Langkah pertama (urut tampil) yang masih bermasalah, termasuk yang dilewati
 * lewat "Pakai bawaan untuk sisanya". Null bila semua langkah lolos.
 */
export function firstInvalidStep(
  steps: StepId[],
  s: WizardState,
  c: WizardCtx,
): { id: StepId; problem: string } | null {
  for (const id of steps) {
    const problem = stepProblem(id, s, c);
    if (problem) return { id, problem };
  }
  return null;
}

/** Memulihkan state dari draf server di atas bawaan; kriteria dinormalkan. */
/** Opsi pengelola yang belum berlaku di server; tidak boleh dipilih. */
export const UNAVAILABLE_MANAGERS: readonly WizardState['managers'][] = [
  'level',
  'ketua',
];

/** Jepit jumlah pilihan ke jumlah divisi terpilih (minimal 1). */
export function clampChoices(s: WizardState): WizardState {
  const cap = Math.max(1, Object.keys(s.divisions).length);
  const max = Math.min(s.maxChoices, cap);
  const min = Math.min(s.minChoices, max);
  return max === s.maxChoices && min === s.minChoices
    ? s
    : { ...s, minChoices: min, maxChoices: max };
}

export function restoreState(
  base: WizardState,
  saved: Record<string, unknown>,
): { state: WizardState; remapped: number } {
  const { criteria, remapped } = normalizeCriteria(saved.criteria);
  const merged = { ...base, ...(saved as Partial<WizardState>), criteria };
  // Draf lama bisa memuat opsi yang kini tak berlaku.
  if (UNAVAILABLE_MANAGERS.includes(merged.managers)) merged.managers = 'saya';
  return {
    state: merged,
    remapped,
  };
}

export function buildInput(s: WizardState, c: WizardCtx): CreateFromSetupInput {
  const rules = s.eligibility.enabled
    ? s.eligibility.rules.map((r) => {
        const v = ruleValue(r, c.lembagaId);
        return {
          attribute: r.attribute,
          op: r.op,
          value: v.ok ? v.value : '',
        };
      })
    : [];
  return {
    eventId: c.eventId,
    name: s.name.trim(),
    form:
      s.formMode === 'existing' && s.existingFormId
        ? { mode: 'existing', formId: s.existingFormId }
        : {
            mode: 'template',
            ...(s.formTitle.trim() ? { title: s.formTitle.trim() } : {}),
          },
    divisions: Object.entries(s.divisions).map(([unitId, d]) => ({
      unitId,
      positionId: d.positionId,
    })),
    minChoices: s.minChoices,
    maxChoices: s.maxChoices,
    allowRedirect: s.allowRedirect,
    grouping: s.grouping,
    attachments: s.attachments,
    waves: s.useWaves
      ? s.waves.map((w) => ({
          label: w.label.trim(),
          startsAt: new Date(w.startsAt),
          endsAt: new Date(w.endsAt),
        }))
      : [],
    eligibility: {
      match: s.eligibility.match,
      rules,
    } as CreateFromSetupInput['eligibility'],
    managers: s.managers === 'orang' ? s.managerIdentifiers : [],
    criteria: criteriaSlots(s).flatMap((scope) =>
      (s.criteria[scope] ?? []).map((k) => ({
        scope,
        name: k.name.trim(),
        kind: k.kind,
        ...(k.kind === 'skor' ? { weight: k.weight } : {}),
      })),
    ),
    settings: {
      scoringMode: s.scoringMode,
      statusMethod: s.statusMethod,
      scoreSource:
        s.rubrics === 'keduanya'
          ? s.scoreSource
          : s.rubrics === 'divisi'
            ? 'divisi'
            : 'umum',
      visibilityDefault: s.visibility === 'ya',
      resultsVisibleToApplicants: s.releaseToApplicants,
      assessorMode: s.assessors,
      hasGugur: s.hasGugur,
      headDecides: s.veto,
      stagedPlacement: s.staged,
      resultsAccess: s.resultsAccess,
      closerecEnabled: s.closerec,
    },
    generalAssessorUnitId:
      s.assessors === 'ketua' ? null : s.generalAssessorUnitId,
    // Jawaban mentah untuk riwayat; daftar akun yang diberi akses tidak ikut disimpan.
    answers: JSON.parse(
      JSON.stringify({
        ...s,
        managerIdentifiers: s.managerIdentifiers.length,
        answeredAt: new Date().toISOString(),
      }),
    ) as Record<string, unknown>,
  };
}
