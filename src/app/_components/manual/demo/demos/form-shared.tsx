'use client';

// Model form mini yang dipakai bersama oleh simulasi Forms: jenis pertanyaan,
// aturan "Tampil jika", dan kontrol isian untuk pratinjau.

// Library Import
import { Star } from 'lucide-react';

import { cn } from '~/lib/utils';

import { inputClass } from '../ui';

export const FIELD_KINDS = [
  ['short_text', 'Teks pendek'],
  ['long_text', 'Teks panjang'],
  ['number', 'Angka'],
  ['date', 'Tanggal'],
  ['single_choice', 'Pilihan tunggal'],
  ['dropdown', 'Dropdown'],
  ['multiple_choice', 'Pilihan ganda'],
  ['checkbox', 'Kotak centang'],
  ['scale', 'Skala'],
  ['link', 'Tautan'],
  ['text_block', 'Blok teks'],
] as const;

export type FieldKind = (typeof FIELD_KINDS)[number][0];

export type Condition = {
  fieldId: string;
  op: 'sama_dengan' | 'bukan';
  value: string;
};

export type DemoField = {
  id: string;
  kind: FieldKind;
  label: string;
  required: boolean;
  options: string[];
  condition?: Condition;
};

export type AnswerValue = string | string[] | boolean | number | undefined;
export type Answers = Record<string, AnswerValue>;

export const kindLabel = (kind: FieldKind) =>
  FIELD_KINDS.find(([id]) => id === kind)?.[1] ?? kind;

export const hasOptions = (kind: FieldKind) =>
  kind === 'single_choice' || kind === 'dropdown' || kind === 'multiple_choice';

/** Pertanyaan tanpa aturan selalu tampil; yang beraturan menunggu acuannya. */
export function isVisible(field: DemoField, answers: Answers): boolean {
  if (!field.condition) return true;
  const answer = answers[field.condition.fieldId];
  const matches = answer === field.condition.value;
  return field.condition.op === 'sama_dengan' ? matches : !matches;
}

export function isAnswered(value: AnswerValue): boolean {
  if (value === undefined || value === false) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function showAnswer(value: AnswerValue): string {
  if (!isAnswered(value)) return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (value === true) return 'Ya';
  return String(value);
}

/** Kontrol isian satu pertanyaan, mengikuti jenisnya. */
export function FieldInput({
  field,
  value,
  onChange,
  inputId,
  className,
}: {
  field: DemoField;
  value: AnswerValue;
  onChange: (next: AnswerValue) => void;
  inputId: string;
  className?: string;
}) {
  switch (field.kind) {
    case 'long_text':
      return (
        <textarea
          id={inputId}
          rows={2}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, 'h-auto py-2', className)}
        />
      );
    case 'single_choice':
      return (
        <div role="radiogroup" aria-labelledby={`${inputId}-label`} className={cn('space-y-1', className)}>
          {field.options.map((option) => (
            <label key={option} className="flex items-center gap-2">
              <input
                type="radio"
                name={inputId}
                checked={value === option}
                onChange={() => onChange(option)}
                className="size-4 accent-[#2B6282]"
              />
              {option}
            </label>
          ))}
        </div>
      );
    case 'multiple_choice': {
      const picked = Array.isArray(value) ? value : [];
      return (
        <div role="group" aria-labelledby={`${inputId}-label`} className={cn('space-y-1', className)}>
          {field.options.map((option) => (
            <label key={option} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={picked.includes(option)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...picked, option]
                      : picked.filter((item) => item !== option),
                  )
                }
                className="size-4 accent-[#2B6282]"
              />
              {option}
            </label>
          ))}
        </div>
      );
    }
    case 'dropdown':
      return (
        <select
          id={inputId}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, className)}
        >
          <option value="">Pilih salah satu</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case 'checkbox':
      return (
        <label className={cn('flex items-center gap-2', className)}>
          <input
            id={inputId}
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked ? true : undefined)}
            className="size-4 accent-[#2B6282]"
          />
          Ya
        </label>
      );
    case 'scale':
      return (
        <div role="radiogroup" aria-labelledby={`${inputId}-label`} className={cn('flex gap-1', className)}>
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={value === score}
              aria-label={`${score} dari 5`}
              onClick={() => onChange(score)}
              className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <Star
                className={cn(
                  'size-6',
                  typeof value === 'number' && score <= value
                    ? 'fill-saffron text-neutral-700'
                    : 'text-neutral-500',
                )}
              />
            </button>
          ))}
        </div>
      );
    case 'text_block':
      return null;
    default:
      return (
        <input
          id={inputId}
          type={
            field.kind === 'number'
              ? 'number'
              : field.kind === 'date'
                ? 'date'
                : field.kind === 'link'
                  ? 'url'
                  : 'text'
          }
          placeholder={field.kind === 'link' ? 'https://' : undefined}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, className)}
        />
      );
  }
}

/** Satu pertanyaan lengkap dengan nomor, tanda wajib, dan pesan galat. */
export function Question({
  field,
  number,
  value,
  onChange,
  error,
  inputClassName,
}: {
  field: DemoField;
  number?: number;
  value: AnswerValue;
  onChange: (next: AnswerValue) => void;
  error?: string;
  inputClassName?: string;
}) {
  const inputId = `demo-q-${field.id}`;
  if (field.kind === 'text_block') {
    return (
      <p className="rounded-lg bg-neutral-100 p-3 text-neutral-800">
        {field.label}
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      <label
        id={`${inputId}-label`}
        htmlFor={inputId}
        className="block font-semibold text-neutral-1000"
      >
        {number ? `${number}. ` : ''}
        {field.label || 'Pertanyaan tanpa judul'}
        {field.required ? <span className="text-danger-dark"> *</span> : null}
      </label>
      <FieldInput
        field={field}
        value={value}
        onChange={onChange}
        inputId={inputId}
        className={inputClassName}
      />
      {error ? (
        <p role="alert" className="text-xs font-semibold text-danger-dark">
          {error}
        </p>
      ) : null}
    </div>
  );
}
