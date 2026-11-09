import { fileRuleProblem, isFileAnswerList } from '~/lib/forms/file-answer';
import {
  LINK_MAX_LENGTH,
  LONG_TEXT_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  TEXT_PATTERN_RULES,
} from '~/server/api/types/form.constants';

import type { FieldOut } from './model';
import { richTextToPlain } from './rich-text';

/** The part of a field the answer rules need. */
export type RendererField = Pick<
  FieldOut,
  'id' | 'type' | 'label' | 'required' | 'config' | 'options'
>;

/**
 * Answer shapes, as sent to `form.submit`: text, number, boolean, a list of
 * option ids, or `{ [rowId]: columnId | columnId[] }` for a matrix.
 */
export type AnswerValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, string | string[]>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** Same notion of "nothing answered" as the server. */
export function isEmptyAnswer(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0)
  );
}

/**
 * The message for the first problem with `value`, or `null` when it is fine.
 * The rules mirror `validateAnswers` on the server (the server stays the
 * authority; this only saves a round trip and points at the question early).
 */
export function validateAnswer(
  field: RendererField,
  value: unknown,
): string | null {
  if (field.type === 'text_block') return null;
  const label = `"${richTextToPlain(field.label)}"`;
  const c = field.config;

  if (field.type === 'checkbox') {
    if (value !== undefined && typeof value !== 'boolean') {
      return `${label} harus bernilai ya atau tidak.`;
    }
    if (field.required && value !== true) return `${label} wajib dicentang.`;
    return null;
  }

  if (isEmptyAnswer(value))
    return field.required ? `${label} wajib diisi.` : null;

  switch (field.type) {
    case 'short_text':
    case 'long_text': {
      if (typeof value !== 'string') return `${label} harus berupa teks.`;
      const text = value.trim();
      const cap =
        field.type === 'short_text'
          ? SHORT_TEXT_MAX_LENGTH
          : LONG_TEXT_MAX_LENGTH;
      const maxLength = Math.min(c.maxLength ?? cap, cap);
      if (text.length > maxLength)
        return `${label} maksimal ${maxLength} karakter.`;
      if (c.minLength !== undefined && text.length < c.minLength) {
        return `${label} minimal ${c.minLength} karakter.`;
      }
      const rule = c.pattern ? TEXT_PATTERN_RULES[c.pattern] : undefined;
      if (rule && !rule.regex.test(text))
        return `${label} harus berupa ${rule.description}.`;
      return null;
    }

    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return `${label} harus berupa angka.`;
      }
      if (c.min !== undefined && value < c.min)
        return `${label} minimal ${c.min}.`;
      if (c.max !== undefined && value > c.max)
        return `${label} maksimal ${c.max}.`;
      return null;
    }

    case 'date':
      return typeof value === 'string' && isValidIsoDate(value)
        ? null
        : `${label} harus berupa tanggal (YYYY-MM-DD).`;

    case 'single_choice':
      return typeof value === 'string' &&
        field.options.some((o) => o.id === value)
        ? null
        : `Pilihan pada ${label} tidak valid.`;

    case 'multiple_choice': {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        return `Pilihan pada ${label} tidak valid.`;
      }
      const ids = value as string[];
      if (new Set(ids).size !== ids.length)
        return `Pilihan pada ${label} tidak boleh duplikat.`;
      if (ids.some((id) => !field.options.some((o) => o.id === id))) {
        return `Pilihan pada ${label} tidak valid.`;
      }
      if (c.minSelections !== undefined && ids.length < c.minSelections) {
        return `${label} minimal ${c.minSelections} pilihan.`;
      }
      if (c.maxSelections !== undefined && ids.length > c.maxSelections) {
        return `${label} maksimal ${c.maxSelections} pilihan.`;
      }
      return null;
    }

    case 'link': {
      const text = typeof value === 'string' ? value.trim() : undefined;
      if (text !== undefined && text.length > LINK_MAX_LENGTH) {
        return `Tautan maksimal ${LINK_MAX_LENGTH} karakter.`;
      }
      return text !== undefined && isHttpUrl(text)
        ? null
        : 'Tautan harus berupa URL http atau https yang valid.';
    }

    case 'unit_choice': {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        return `${label} harus berupa daftar pilihan.`;
      }
      const min = c.minChoices ?? 1;
      const max = c.maxChoices ?? min;
      if (value.length < min) {
        return min === 1
          ? `${label} wajib diisi.`
          : `${label} minimal ${min} pilihan.`;
      }
      return value.length > max ? `${label} maksimal ${max} pilihan.` : null;
    }

    case 'file': {
      if (!isFileAnswerList(value)) return `Berkas pada ${label} tidak valid.`;
      return fileRuleProblem(value, c);
    }

    case 'scale': {
      const min = c.min ?? 0;
      const max = c.max ?? 10;
      return typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= min &&
        value <= max
        ? null
        : `Nilai harus bilangan bulat antara ${min} dan ${max}.`;
    }

    case 'matrix': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return 'Pilihan jawaban tidak sesuai.';
      }
      const rows = c.rows ?? [];
      const columnIds = new Set((c.columns ?? []).map((col) => col.id));
      const rowIds = new Set(rows.map((r) => r.id));
      let answered = 0;
      for (const [rowId, cell] of Object.entries(value)) {
        if (!rowIds.has(rowId))
          return 'Baris atau kolom jawaban tidak dikenal.';
        const ids = c.multiple ? cell : [cell];
        if (
          !Array.isArray(ids) ||
          ids.some((v) => typeof v !== 'string') ||
          (c.multiple && !Array.isArray(cell)) ||
          new Set(ids).size !== ids.length
        ) {
          return 'Pilihan jawaban tidak sesuai.';
        }
        if ((ids as string[]).some((id) => !columnIds.has(id))) {
          return 'Baris atau kolom jawaban tidak dikenal.';
        }
        if (ids.length > 0) answered++;
      }
      if (answered === 0)
        return field.required ? `${label} wajib diisi.` : null;
      if (field.required && answered < rows.length)
        return 'Semua baris wajib dijawab.';
      return null;
    }
  }
}

/** Problems of one page of questions, by field id. */
export function validatePage(
  fields: RendererField[],
  answers: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const message = validateAnswer(field, answers[field.id]);
    if (message) errors[field.id] = message;
  }
  return errors;
}
