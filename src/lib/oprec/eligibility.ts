/**
 * Syarat pendaftar oprec: modul murni yang dipakai server (cek saat form
 * dibuka dan saat kirim) dan dapat dipakai klien untuk pratinjau. Tanpa I/O.
 */
export type EligibilityAttribute =
  | 'angkatan_kuliah'
  | 'fakultas'
  | 'prodi'
  | 'status_mahasiswa'
  | 'keanggotaan_lembaga'
  | 'angkatan_lembaga';

export type EligibilityOperator =
  | 'eq'
  | 'neq'
  | 'in'
  | 'not_in'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'contains';

export type EligibilityRule = {
  attribute: EligibilityAttribute;
  op: EligibilityOperator;
  value: unknown;
};

/**
 * Nilai tiap atribut milik pendaftar. `null` = tidak diketahui (mis. fakultas
 * belum tersimpan); aturan atas atribut itu dianggap tidak terpenuhi.
 */
export type ApplicantProfile = Record<
  EligibilityAttribute,
  (string | number)[] | null
>;

export const ELIGIBILITY_ATTRIBUTE_LABELS: Record<
  EligibilityAttribute,
  string
> = {
  angkatan_kuliah: 'angkatan kuliah',
  fakultas: 'fakultas',
  prodi: 'program studi',
  status_mahasiswa: 'status mahasiswa',
  keanggotaan_lembaga: 'keanggotaan lembaga',
  angkatan_lembaga: 'angkatan di lembaga',
};

const NEGATIVE: ReadonlySet<EligibilityOperator> = new Set(['neq', 'not_in']);

function norm(v: unknown): string | number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    return t === '' ? null : t;
  }
  return null;
}

function compare(a: string | number, b: string | number): number | null {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) ? na - nb : null;
}

/** Apakah satu nilai `have` memenuhi operator positif terhadap `want`. */
function matches(
  op: EligibilityOperator,
  have: string | number,
  want: unknown,
): boolean {
  const list = Array.isArray(want) ? want.map(norm) : [norm(want)];
  const first = list[0] ?? null;
  switch (op) {
    case 'eq':
    case 'neq':
      return first !== null && String(have) === String(first);
    case 'in':
    case 'not_in':
      return list.some((w) => w !== null && String(have) === String(w));
    case 'contains':
      return (
        first !== null && String(have).includes(String(first)) // sama-sama huruf kecil
      );
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (first === null) return false;
      const d = compare(have, first);
      if (d === null) return false;
      return op === 'gt'
        ? d > 0
        : op === 'gte'
          ? d >= 0
          : op === 'lt'
            ? d < 0
            : d <= 0;
    }
    case 'between': {
      const [lo, hi] = list;
      if (lo == null || hi == null) return false;
      const a = compare(have, lo);
      const b = compare(have, hi);
      return a !== null && b !== null && a >= 0 && b <= 0;
    }
  }
}

export function evaluateRule(
  rule: EligibilityRule,
  profile: ApplicantProfile,
): boolean {
  const raw = profile[rule.attribute];
  if (raw === null) return false;
  const have = raw.flatMap((v) => {
    const n = norm(v);
    return n === null ? [] : [n];
  });
  if (NEGATIVE.has(rule.op)) {
    // Tidak ada satu pun nilai milik pendaftar yang cocok dengan versi positifnya.
    return !have.some((h) => matches(rule.op, h, rule.value));
  }
  return have.some((h) => matches(rule.op, h, rule.value));
}

export type EligibilityResult = {
  eligible: boolean;
  /** Atribut yang syaratnya tidak terpenuhi (tanpa nilai yang disyaratkan). */
  failed: EligibilityAttribute[];
};

export function evaluateEligibility(
  match: 'all' | 'any',
  rules: EligibilityRule[],
  profile: ApplicantProfile,
): EligibilityResult {
  if (rules.length === 0) return { eligible: true, failed: [] };
  const failed = rules.filter((r) => !evaluateRule(r, profile));
  const eligible =
    match === 'all' ? failed.length === 0 : failed.length < rules.length;
  return {
    eligible,
    failed: eligible ? [] : [...new Set(failed.map((r) => r.attribute))],
  };
}

export function eligibilityMessage(failed: EligibilityAttribute[]): string {
  if (failed.length === 0) return '';
  const names = failed.map((a) => ELIGIBILITY_ATTRIBUTE_LABELS[a]);
  return `Kamu belum memenuhi syarat pendaftar (${names.join(', ')}).`;
}
