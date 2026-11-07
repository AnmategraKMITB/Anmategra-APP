type FieldType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'date'
  | 'single_choice'
  | 'multiple_choice'
  | 'checkbox'
  | 'text_block'
  | 'link'
  | 'matrix'
  | 'scale'
  | 'file';

export type SummaryField = {
  id: string;
  type: FieldType;
  label: string;
  archived: boolean;
  options: { id: string; label: string }[];
  config: Record<string, unknown>;
};

export type SummaryAnswer = {
  fieldId: string;
  value: unknown;
  submittedAt: Date;
};

type Base = { fieldId: string; label: string; archived: boolean };

export type ChoiceSummary = Base & {
  type: 'choice';
  answered: number;
  options: {
    id: string;
    label: string;
    count: number;
    percent: number;
    archived: boolean;
  }[];
};
export type NumberSummary = Base & {
  type: 'number';
  count: number;
  min: number | null;
  max: number | null;
  average: number | null;
};
export type ScaleSummary = Base & {
  type: 'scale';
  count: number;
  average: number;
  distribution: { value: number; count: number }[];
};
export type TextSummary = Base & {
  type: 'text';
  count: number;
  latest: string[];
};
export type CheckboxSummary = Base & {
  type: 'checkbox';
  yes: number;
  no: number;
};
export type MatrixSummary = Base & {
  type: 'matrix';
  count: number;
  rows: {
    rowId: string;
    label: string;
    cells: { columnId: string; label: string; count: number }[];
  }[];
};

export type FieldSummary =
  | ChoiceSummary
  | NumberSummary
  | ScaleSummary
  | TextSummary
  | CheckboxSummary
  | MatrixSummary;

export type SummaryResult = { total: number; fields: FieldSummary[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const round1 = (value: number) => Number(value.toFixed(1));
const round2 = (value: number) => Number(value.toFixed(2));

const base = (field: SummaryField): Base => ({
  fieldId: field.id,
  label: field.label,
  archived: field.archived,
});

/** Pilihan yang tersimpan di jawaban (snapshot `{ optionId, label }`). */
function readOption(value: unknown): { id: string; label: string } | null {
  if (!isRecord(value) || typeof value.optionId !== 'string') return null;
  return {
    id: value.optionId,
    label: typeof value.label === 'string' ? value.label : value.optionId,
  };
}

function summarizeChoice(
  field: SummaryField,
  answers: SummaryAnswer[],
): ChoiceSummary {
  const tally = new Map<
    string,
    { id: string; label: string; count: number; archived: boolean }
  >();
  for (const option of field.options) {
    tally.set(option.id, { ...option, count: 0, archived: false });
  }

  const add = (option: { id: string; label: string }) => {
    const existing = tally.get(option.id);
    if (existing) existing.count += 1;
    else tally.set(option.id, { ...option, count: 1, archived: true });
  };

  let answered = 0;
  for (const { value } of answers) {
    const picked = (Array.isArray(value) ? (value as unknown[]) : [value])
      .map(readOption)
      .filter((option) => option !== null);
    if (picked.length === 0) continue;
    answered += 1;
    // Pilihan tunggal: hanya satu; pilihan ganda: semua yang dipilih.
    for (const option of field.type === 'single_choice'
      ? picked.slice(0, 1)
      : picked) {
      add(option);
    }
  }

  return {
    ...base(field),
    type: 'choice',
    answered,
    options: [...tally.values()].map((option) => ({
      ...option,
      percent: answered > 0 ? round1((option.count / answered) * 100) : 0,
    })),
  };
}

function summarizeNumber(
  field: SummaryField,
  answers: SummaryAnswer[],
): NumberSummary {
  const values = answers.map((a) => a.value).filter(isFiniteNumber);
  if (values.length === 0) {
    return {
      ...base(field),
      type: 'number',
      count: 0,
      min: null,
      max: null,
      average: null,
    };
  }
  return {
    ...base(field),
    type: 'number',
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    average: round2(values.reduce((a, b) => a + b, 0) / values.length),
  };
}

function summarizeScale(
  field: SummaryField,
  answers: SummaryAnswer[],
): ScaleSummary {
  const read = (key: string, fallback: number) => {
    const value = field.config[key];
    return isFiniteNumber(value) ? Math.trunc(value) : fallback;
  };
  const a = read('min', 1);
  const b = read('max', 5);
  const min = Math.min(a, b);
  const max = Math.max(a, b);

  const distribution = Array.from({ length: max - min + 1 }, (_, i) => ({
    value: min + i,
    count: 0,
  }));

  let count = 0;
  let sum = 0;
  for (const { value } of answers) {
    if (!isFiniteNumber(value) || !Number.isInteger(value)) continue;
    const bucket = distribution[value - min];
    if (value < min || value > max || !bucket) continue;
    bucket.count += 1;
    count += 1;
    sum += value;
  }

  return {
    ...base(field),
    type: 'scale',
    count,
    average: count > 0 ? round2(sum / count) : 0,
    distribution,
  };
}

function summarizeText(
  field: SummaryField,
  answers: SummaryAnswer[],
): TextSummary {
  const filled = answers
    .filter(
      (a): a is SummaryAnswer & { value: string } =>
        typeof a.value === 'string' && a.value.trim() !== '',
    )
    .sort((x, y) => y.submittedAt.getTime() - x.submittedAt.getTime());

  return {
    ...base(field),
    type: 'text',
    count: filled.length,
    latest: filled.slice(0, 10).map((a) => a.value),
  };
}

/** Berkas: jumlah pengisi yang mengunggah dan nama berkas dari 10 terbaru. */
function summarizeFile(
  field: SummaryField,
  answers: SummaryAnswer[],
): TextSummary {
  const filled = answers
    .filter((a) => Array.isArray(a.value) && a.value.length > 0)
    .sort((x, y) => y.submittedAt.getTime() - x.submittedAt.getTime());
  const names = (value: unknown) =>
    (value as unknown[])
      .map((f) => (isRecord(f) && typeof f.name === 'string' ? f.name : ''))
      .filter(Boolean)
      .join(', ');
  return {
    ...base(field),
    type: 'text',
    count: filled.length,
    latest: filled.slice(0, 10).map((a) => names(a.value)),
  };
}

function summarizeCheckbox(
  field: SummaryField,
  answers: SummaryAnswer[],
): CheckboxSummary {
  return {
    ...base(field),
    type: 'checkbox',
    yes: answers.filter((a) => a.value === true).length,
    no: answers.filter((a) => a.value === false).length,
  };
}

function readIdLabels(raw: unknown): { id: string; label: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { id: string; label: string }[] = [];
  for (const item of raw as unknown[]) {
    if (isRecord(item) && typeof item.id === 'string') {
      out.push({
        id: item.id,
        label: typeof item.label === 'string' ? item.label : item.id,
      });
    }
  }
  return out;
}

/** Jawaban matriks tersimpan sebagai daftar `{ rowId, selected: [{ columnId }] }` atau peta `{ rowId: colId | colId[] }`. */
function matrixPicks(value: unknown): [string, string][] {
  const picks: [string, string][] = [];
  if (Array.isArray(value)) {
    for (const row of value as unknown[]) {
      if (!isRecord(row) || typeof row.rowId !== 'string') continue;
      if (!Array.isArray(row.selected)) continue;
      for (const sel of row.selected as unknown[]) {
        if (isRecord(sel) && typeof sel.columnId === 'string') {
          picks.push([row.rowId, sel.columnId]);
        }
      }
    }
  } else if (isRecord(value)) {
    for (const [rowId, cols] of Object.entries(value)) {
      for (const col of Array.isArray(cols) ? (cols as unknown[]) : [cols]) {
        if (typeof col === 'string') picks.push([rowId, col]);
      }
    }
  }
  return picks;
}

function summarizeMatrix(
  field: SummaryField,
  answers: SummaryAnswer[],
): MatrixSummary {
  const rows = readIdLabels(field.config.rows);
  const columns = readIdLabels(field.config.columns);
  const counts = new Map<string, number>();

  let count = 0;
  for (const { value } of answers) {
    const picks = matrixPicks(value);
    if (picks.length === 0) continue;
    count += 1;
    for (const [rowId, columnId] of picks) {
      const key = `${rowId}\u0000${columnId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return {
    ...base(field),
    type: 'matrix',
    count,
    rows: rows.map((row) => ({
      rowId: row.id,
      label: row.label,
      cells: columns.map((column) => ({
        columnId: column.id,
        label: column.label,
        count: counts.get(`${row.id}\u0000${column.id}`) ?? 0,
      })),
    })),
  };
}

/** Ringkasan jawaban per pertanyaan, dihitung murni dari data yang diberikan. */
export function buildSummary(
  fields: SummaryField[],
  answers: SummaryAnswer[],
  total: number,
): SummaryResult {
  const byField = new Map<string, SummaryAnswer[]>();
  for (const answer of answers) {
    const list = byField.get(answer.fieldId);
    if (list) list.push(answer);
    else byField.set(answer.fieldId, [answer]);
  }

  const summaries: FieldSummary[] = [];
  for (const field of fields) {
    const mine = byField.get(field.id) ?? [];
    switch (field.type) {
      case 'text_block':
        break;
      case 'single_choice':
      case 'multiple_choice':
        summaries.push(summarizeChoice(field, mine));
        break;
      case 'number':
        summaries.push(summarizeNumber(field, mine));
        break;
      case 'scale':
        summaries.push(summarizeScale(field, mine));
        break;
      case 'checkbox':
        summaries.push(summarizeCheckbox(field, mine));
        break;
      case 'matrix':
        summaries.push(summarizeMatrix(field, mine));
        break;
      case 'short_text':
      case 'long_text':
      case 'link':
      case 'date':
        summaries.push(summarizeText(field, mine));
        break;
      case 'file':
        summaries.push(summarizeFile(field, mine));
        break;
    }
  }

  return { total, fields: summaries };
}
