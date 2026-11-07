import {
  type Condition,
  OPERATORS_BY_TYPE,
  readCondition,
} from '~/lib/forms/conditions';

import { richTextToPlain } from './rich-text';

export const OPERATOR_LABELS: Record<string, string> = {
  adalah: 'adalah',
  bukan: 'bukan',
  salah_satu: 'salah satu dari',
  memuat: 'memuat',
  tidak_memuat: 'tidak memuat',
  memuat_salah_satu: 'memuat salah satu dari',
  kosong: 'kosong',
  tidak_kosong: 'tidak kosong',
  sama_dengan: 'sama dengan',
  mengandung: 'mengandung',
  '=': '=',
  '!=': '≠',
  '>': '>',
  '>=': '≥',
  '<': '<',
  '<=': '≤',
  antara: 'antara',
  sebelum: 'sebelum',
  sesudah: 'sesudah',
  pada: 'pada',
  dicentang: 'dicentang',
  tidak_dicentang: 'tidak dicentang',
};

/** Tipe yang boleh jadi sumber kondisi. */
export const isConditionSource = (type: string) => type in OPERATORS_BY_TYPE;

export const operatorNeedsValue = (op: string) =>
  !['kosong', 'tidak_kosong', 'dicentang', 'tidak_dicentang'].includes(op);

export const operatorIsSet = (op: string) =>
  op === 'salah_satu' || op === 'memuat_salah_satu';

type SourceLike = {
  id: string;
  type: string;
  label: string;
  options: { id: string; label: string }[];
};

/** Ringkasan kondisi dalam kalimat, mis. `Minat adalah Musik atau …`. */
export function describeCondition(
  value: unknown,
  sources: SourceLike[],
): string {
  const condition: Condition | null = readCondition(value);
  if (!condition || condition.aturan.length === 0) return '';
  const byId = new Map(sources.map((s) => [s.id, s]));
  const parts = condition.aturan.map((rule) => {
    const source = byId.get(rule.fieldId);
    const name = source ? richTextToPlain(source.label) : 'pertanyaan dihapus';
    const show = (v: unknown) => {
      const text =
        typeof v === 'string' || typeof v === 'number' ? String(v) : '';
      return source?.options.find((o) => o.id === text)?.label ?? text;
    };
    const op = OPERATOR_LABELS[rule.op] ?? rule.op;
    if (!operatorNeedsValue(rule.op)) return `${name} ${op}`;
    if (Array.isArray(rule.nilai)) {
      return `${name} ${op} ${(rule.nilai as unknown[]).map(show).join(', ')}`;
    }
    if (rule.op === 'antara') {
      return `${name} antara ${show(rule.nilai)} dan ${show(rule.nilai2)}`;
    }
    return `${name} ${op} ${show(rule.nilai)}`;
  });
  return parts.join(condition.cocok === 'semua' ? ' dan ' : ' atau ');
}
