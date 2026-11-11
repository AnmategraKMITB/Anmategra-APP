/**
 * Mesin kondisi "tampil jika": modul murni yang dipakai klien (renderer,
 * builder) dan server (submit, validasi builder). Tanpa I/O.
 */
export type Rule = {
  jenis: 'jawaban';
  fieldId: string;
  op: string;
  nilai?: unknown;
  nilai2?: unknown;
};

export type Condition = {
  cocok: 'semua' | 'salah-satu';
  aturan: Rule[];
};

export type CondField = {
  id: string;
  type: string;
  sectionId: string | null;
  condition: unknown;
};

export type CondSection = {
  id: string;
  condition: unknown;
};

export type CondEnding = {
  id: string;
  sortOrder: number;
  condition: unknown;
};

export type Visibility = {
  fields: Set<string>;
  sections: Set<string>;
};

export type TargetKind = 'field' | 'section' | 'ending';

export const MAX_RULES = 10;

export const OPERATORS_BY_TYPE: Record<string, string[]> = {
  single_choice: ['adalah', 'bukan', 'salah_satu'],
  multiple_choice: ['memuat', 'tidak_memuat', 'memuat_salah_satu', 'kosong'],
  short_text: ['sama_dengan', 'mengandung', 'kosong', 'tidak_kosong'],
  long_text: ['sama_dengan', 'mengandung', 'kosong', 'tidak_kosong'],
  number: ['=', '!=', '>', '>=', '<', '<=', 'antara'],
  scale: ['=', '!=', '>', '>=', '<', '<=', 'antara'],
  date: ['sebelum', 'sesudah', 'pada', 'antara'],
  checkbox: ['dicentang', 'tidak_dicentang'],
  // nilai = id divisi oprec; jawabannya daftar id berurutan (pilihan ke-1..N).
  unit_choice: ['memilih', 'tidak_memilih', 'pilihan_ke'],
};

const NO_VALUE_OPERATORS = new Set<string>([
  'kosong',
  'tidak_kosong',
  'dicentang',
  'tidak_dicentang',
]);

const SET_OPERATORS = new Set<string>(['salah_satu', 'memuat_salah_satu']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? (value as unknown[]) : null;
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function isRule(value: unknown): value is Rule {
  return (
    isRecord(value) &&
    value.jenis === 'jawaban' &&
    typeof value.fieldId === 'string' &&
    typeof value.op === 'string'
  );
}

/** Nilai `condition` dari DB tidak dipercaya: bentuk yang rusak dianggap tanpa kondisi. */
export function readCondition(value: unknown): Condition | null {
  if (!isRecord(value)) return null;
  const { cocok } = value;
  if (cocok !== 'semua' && cocok !== 'salah-satu') return null;
  const raw = asArray(value.aturan);
  if (raw === null) return null;

  const aturan: Rule[] = [];
  for (const item of raw) {
    if (!isRule(item)) return null;
    const rule: Rule = { jenis: 'jawaban', fieldId: item.fieldId, op: item.op };
    if ('nilai' in item) rule.nilai = item.nilai;
    if ('nilai2' in item) rule.nilai2 = item.nilai2;
    aturan.push(rule);
  }
  return { cocok, aturan };
}

function normalizeText(value: unknown): string {
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim().toLowerCase();
  }
  return '';
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Satu aturan terhadap jawaban sumber; tidak pernah melempar. */
export function evaluateRule(
  rule: Rule,
  sourceType: string,
  answer: unknown,
): boolean {
  if (rule.jenis !== 'jawaban') return false;
  const operators = OPERATORS_BY_TYPE[sourceType];
  if (!operators?.includes(rule.op)) return false;
  if (!NO_VALUE_OPERATORS.has(rule.op) && !hasValue(rule.nilai)) return false;
  if (rule.op === 'antara' && !hasValue(rule.nilai2)) return false;
  if (rule.op === 'pilihan_ke' && !hasValue(rule.nilai2)) return false;
  if (SET_OPERATORS.has(rule.op)) {
    const values = asArray(rule.nilai);
    if (!values?.length) return false;
  }

  const missing = answer === undefined || answer === null;

  switch (sourceType) {
    case 'single_choice': {
      if (rule.op === 'adalah') return answer === rule.nilai;
      if (rule.op === 'bukan') return answer !== rule.nilai;
      return asArray(rule.nilai)?.includes(answer) ?? false;
    }
    case 'multiple_choice': {
      const chosen = asArray(answer) ?? [];
      if (rule.op === 'kosong') return missing || chosen.length === 0;
      if (rule.op === 'memuat') return chosen.includes(rule.nilai);
      if (rule.op === 'tidak_memuat') return !chosen.includes(rule.nilai);
      return (asArray(rule.nilai) ?? []).some((v) => chosen.includes(v));
    }
    case 'short_text':
    case 'long_text': {
      const text = normalizeText(answer);
      if (rule.op === 'sama_dengan') return text === normalizeText(rule.nilai);
      if (rule.op === 'mengandung') {
        return text.includes(normalizeText(rule.nilai));
      }
      return rule.op === 'kosong' ? text === '' : text !== '';
    }
    case 'number':
    case 'scale': {
      if (rule.op === '!=' && missing) return true;
      const n = parseNumber(answer);
      const a = parseNumber(rule.nilai);
      if (n === null || a === null) return false;
      switch (rule.op) {
        case '=':
          return n === a;
        case '!=':
          return n !== a;
        case '>':
          return n > a;
        case '>=':
          return n >= a;
        case '<':
          return n < a;
        case '<=':
          return n <= a;
        default: {
          const b = parseNumber(rule.nilai2);
          return b !== null && n >= a && n <= b;
        }
      }
    }
    case 'date': {
      if (missing) return false;
      const d = asString(answer);
      const a = asString(rule.nilai);
      if (rule.op === 'sebelum') return d < a;
      if (rule.op === 'sesudah') return d > a;
      if (rule.op === 'pada') return d === a;
      return d >= a && d <= asString(rule.nilai2);
    }
    case 'checkbox':
      return rule.op === 'dicentang' ? answer === true : answer !== true;
    case 'unit_choice': {
      const chosen = asArray(answer) ?? [];
      if (rule.op === 'memilih') return chosen.includes(rule.nilai);
      if (rule.op === 'tidak_memilih') return !chosen.includes(rule.nilai);
      const rank = parseNumber(rule.nilai2);
      return rank !== null && chosen[rank - 1] === rule.nilai;
    }
    default:
      return false;
  }
}

function conditionMet(
  condition: Condition | null,
  visible: Set<string>,
  answers: Record<string, unknown>,
  byId: Map<string, CondField>,
): boolean {
  if (!condition || condition.aturan.length === 0) return true;
  const test = (rule: Rule) => {
    const source = byId.get(rule.fieldId);
    if (!source || !visible.has(rule.fieldId)) return false;
    return evaluateRule(rule, source.type, answers[rule.fieldId]);
  };
  return condition.cocok === 'salah-satu'
    ? condition.aturan.some(test)
    : condition.aturan.every(test);
}

function indexById(fields: CondField[]): Map<string, CondField> {
  const byId = new Map<string, CondField>();
  for (const f of fields) if (!byId.has(f.id)) byId.set(f.id, f);
  return byId;
}

/**
 * Pertanyaan dan section yang tampil. `fields` sudah dalam urutan form.
 * Sumber yang belum tampil (di belakang, tersembunyi, atau tak dikenal) membuat
 * aturannya salah; kondisi section dinilai saat pertanyaan pertamanya.
 */
export function computeVisibility(
  fields: CondField[],
  sections: CondSection[],
  answers: Record<string, unknown>,
): Visibility {
  const visibleFields = new Set<string>();
  const visibleSections = new Set<string>();
  const byId = indexById(fields);
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const sectionShown = new Map<string, boolean>();

  for (const field of fields) {
    let shown = true;
    if (field.sectionId !== null) {
      let cached = sectionShown.get(field.sectionId);
      if (cached === undefined) {
        const section = sectionById.get(field.sectionId);
        cached = conditionMet(
          readCondition(section?.condition),
          visibleFields,
          answers,
          byId,
        );
        sectionShown.set(field.sectionId, cached);
        if (cached && section) visibleSections.add(section.id);
      }
      shown = cached;
    }
    if (
      shown &&
      conditionMet(readCondition(field.condition), visibleFields, answers, byId)
    ) {
      visibleFields.add(field.id);
    }
  }

  for (const section of sections) {
    if (fields.some((f) => f.sectionId === section.id)) continue;
    if (
      conditionMet(
        readCondition(section.condition),
        visibleFields,
        answers,
        byId,
      )
    ) {
      visibleSections.add(section.id);
    }
  }

  return { fields: visibleFields, sections: visibleSections };
}

/**
 * Ending untuk jawaban ini: yang bersyarat dan terpenuhi (menurut sort_order)
 * lebih dulu, lalu yang pertama tanpa syarat, lalu `null` (ucapan standar).
 */
export function pickEnding(
  endings: CondEnding[],
  visibility: Visibility,
  answers: Record<string, unknown>,
  fields: CondField[],
): string | null {
  const byId = indexById(fields);
  let fallback: string | null = null;
  for (const ending of [...endings].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const condition = readCondition(ending.condition);
    if (!condition || condition.aturan.length === 0) {
      fallback ??= ending.id;
    } else if (conditionMet(condition, visibility.fields, answers, byId)) {
      return ending.id;
    }
  }
  return fallback;
}

export type ConditionIssue = {
  targetId: string;
  kind: TargetKind;
  message: string;
};

function checkCondition(
  value: unknown,
  byId: Map<string, CondField>,
  indexOf: Map<string, number>,
  isEarlier: (sourceIndex: number) => boolean,
): string | null {
  const condition = readCondition(value);
  if (!condition || condition.aturan.length === 0) return null;
  if (condition.aturan.length > MAX_RULES) {
    return `Maksimal ${MAX_RULES} aturan kondisi.`;
  }
  for (const rule of condition.aturan) {
    const source = byId.get(rule.fieldId);
    const at = indexOf.get(rule.fieldId);
    if (!source || at === undefined) {
      return 'Pertanyaan sumber kondisi tidak ditemukan.';
    }
    if (!isEarlier(at)) {
      return 'Pertanyaan sumber harus berada sebelum yang diberi kondisi.';
    }
    const operators = OPERATORS_BY_TYPE[source.type];
    if (!operators) {
      return 'Tipe pertanyaan sumber tidak bisa dipakai untuk kondisi.';
    }
    if (!operators.includes(rule.op)) {
      return 'Operator tidak sesuai dengan tipe pertanyaan sumber.';
    }
    if (!NO_VALUE_OPERATORS.has(rule.op) && !hasValue(rule.nilai)) {
      return 'Nilai kondisi wajib diisi.';
    }
    if (rule.op === 'antara' && !hasValue(rule.nilai2)) {
      return 'Nilai kedua wajib diisi untuk "antara".';
    }
    if (rule.op === 'pilihan_ke') {
      const rank = parseNumber(rule.nilai2);
      if (rank === null || !Number.isInteger(rank) || rank < 1) {
        return 'Urutan pilihan harus bilangan bulat mulai dari 1.';
      }
    }
    if (SET_OPERATORS.has(rule.op) && !asArray(rule.nilai)?.length) {
      return 'Pilih minimal satu nilai.';
    }
  }
  return null;
}

/** Memeriksa semua kondisi di form; satu masalah (yang pertama) per target. */
export function validateConditions(
  fields: CondField[],
  sections: CondSection[],
  endings: CondEnding[],
): ConditionIssue[] {
  const byId = indexById(fields);
  const indexOf = new Map<string, number>();
  const firstOfSection = new Map<string, number>();
  fields.forEach((f, i) => {
    if (!indexOf.has(f.id)) indexOf.set(f.id, i);
    if (f.sectionId !== null && !firstOfSection.has(f.sectionId)) {
      firstOfSection.set(f.sectionId, i);
    }
  });

  const issues: ConditionIssue[] = [];
  const add = (targetId: string, kind: TargetKind, message: string | null) => {
    if (message) issues.push({ targetId, kind, message });
  };

  fields.forEach((f, i) =>
    add(
      f.id,
      'field',
      checkCondition(f.condition, byId, indexOf, (s) => s < i),
    ),
  );
  for (const s of sections) {
    const start = firstOfSection.get(s.id) ?? fields.length;
    add(
      s.id,
      'section',
      checkCondition(s.condition, byId, indexOf, (i) => i < start),
    );
  }
  for (const e of endings) {
    add(
      e.id,
      'ending',
      checkCondition(e.condition, byId, indexOf, () => true),
    );
  }
  return issues;
}

/** Target yang kondisinya merujuk pertanyaan atau opsi ini. */
export function findDependents(
  fields: CondField[],
  sections: CondSection[],
  endings: CondEnding[],
  target: { fieldId: string } | { optionId: string },
): { targetId: string; kind: TargetKind }[] {
  const refers = (value: unknown) =>
    (readCondition(value)?.aturan ?? []).some((rule) => {
      if ('fieldId' in target) return rule.fieldId === target.fieldId;
      const values = asArray(rule.nilai) ?? [rule.nilai];
      return values.includes(target.optionId);
    });

  return [
    ...fields
      .filter((f) => refers(f.condition))
      .map((f) => ({ targetId: f.id, kind: 'field' as const })),
    ...sections
      .filter((s) => refers(s.condition))
      .map((s) => ({ targetId: s.id, kind: 'section' as const })),
    ...endings
      .filter((e) => refers(e.condition))
      .map((e) => ({ targetId: e.id, kind: 'ending' as const })),
  ];
}
