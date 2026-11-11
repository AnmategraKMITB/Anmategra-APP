'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { cn } from '~/lib/utils';

import { FileInput, type UploadContext } from './file-input';
import type { AnswerValue, RendererField } from './form-validate';

type Option = RendererField['options'][number];

/** Nilai sentinel Select; id opsi asli berupa uuid. */
const CLEAR_SELECT = '__kosongkan__';

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Opsi dalam urutan tampil; diacak sekali per kemunculan bila diminta. */
function useOptionOrder(options: Option[], shuffle: boolean): Option[] {
  const [order] = useState(() => (shuffle ? shuffled(options) : options));
  // Bila opsi berubah (di builder), pakai daftar terbaru tanpa mengacaknya ulang.
  return order.length === options.length &&
    order.every((o) => options.some((p) => p.id === o.id))
    ? order.map((o) => options.find((p) => p.id === o.id)!)
    : options;
}

const choiceRow =
  'flex items-center gap-3 rounded-xl border border-neutral-400 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-1000 transition-colors duration-150 hover:bg-neutral-200 has-[:checked]:border-[var(--form-accent)] has-[:checked]:bg-neutral-100 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--form-accent)]';

export type AnswerInputProps = {
  field: RendererField;
  value: unknown;
  onChange: (value: AnswerValue | undefined) => void;
  invalid: boolean;
  describedBy?: string;
  shuffleOptions: boolean;
  upload?: UploadContext;
};

/** Kolom jawaban untuk satu pertanyaan, sesuai jenisnya. */
export function AnswerInput({
  field,
  value,
  onChange,
  invalid,
  describedBy,
  shuffleOptions,
  upload,
}: AnswerInputProps) {
  const id = `fill-${field.id}`;
  const common = {
    id,
    'aria-invalid': invalid,
    'aria-describedby': describedBy,
  };
  const c = field.config;

  switch (field.type) {
    case 'short_text':
      return (
        <Input
          {...common}
          type="text"
          value={typeof value === 'string' ? value : ''}
          maxLength={c.maxLength ?? 500}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'long_text':
      return (
        <Textarea
          {...common}
          rows={4}
          value={typeof value === 'string' ? value : ''}
          maxLength={c.maxLength ?? 5000}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number':
      return (
        <Input
          {...common}
          type="number"
          inputMode="decimal"
          value={typeof value === 'number' ? value : ''}
          min={c.min}
          max={c.max}
          onChange={(e) =>
            onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)
          }
        />
      );
    case 'date':
      return (
        <Input
          {...common}
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );
    case 'link':
      return (
        <Input
          {...common}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={typeof value === 'string' ? value : ''}
          maxLength={2048}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'checkbox':
      return (
        <div className="grid gap-2">
          <label className={choiceRow}>
            <input
              id={id}
              type="checkbox"
              className="size-4 accent-[var(--form-accent)]"
              checked={value === true}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              onChange={(e) =>
                onChange(e.target.checked ? true : undefined)
              }
            />
            Ya
          </label>
          {value === true ? (
            <ClearChoice onClick={() => onChange(undefined)} />
          ) : null}
        </div>
      );
    case 'single_choice':
      return c.tampilan === 'dropdown' ? (
        <SingleDropdown
          field={field}
          value={value}
          onChange={onChange}
          invalid={invalid}
          shuffleOptions={shuffleOptions}
        />
      ) : (
        <SingleList
          field={field}
          value={value}
          onChange={onChange}
          describedBy={describedBy}
          shuffleOptions={shuffleOptions}
        />
      );
    case 'multiple_choice':
      return (
        <MultipleList
          field={field}
          value={value}
          onChange={onChange}
          describedBy={describedBy}
          shuffleOptions={shuffleOptions}
        />
      );
    case 'scale':
      return <ScaleInput field={field} value={value} onChange={onChange} />;
    case 'matrix':
      return <MatrixInput field={field} value={value} onChange={onChange} />;
    case 'file':
      return (
        <FileInput
          field={field}
          value={value}
          onChange={(v) => onChange(v as AnswerValue)}
          upload={upload}
          invalid={invalid}
          describedBy={describedBy}
        />
      );
    case 'unit_choice':
      return (
        <UnitChoiceInput
          field={field}
          value={value}
          onChange={onChange}
          invalid={invalid}
          describedBy={describedBy}
        />
      );
    case 'text_block':
      return null;
  }
}

const NONE = '__none';

/**
 * Pilihan tujuan oprec: satu daftar turun per urutan (Pilihan 1, 2, ...).
 * Pilihan berikutnya baru terbuka setelah yang sebelumnya terisi, dan tujuan
 * yang sudah dipilih tidak ditawarkan lagi di urutan lain.
 */
function UnitChoiceInput({
  field,
  value,
  onChange,
  invalid,
  describedBy,
}: Pick<
  AnswerInputProps,
  'field' | 'value' | 'onChange' | 'invalid' | 'describedBy'
>) {
  const chosen = Array.isArray(value)
    ? (value as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  const min = Math.max(1, field.config.minChoices ?? 1);
  const max = Math.max(min, field.config.maxChoices ?? 1);
  const groups = [...new Set(field.options.map((o) => o.group ?? ''))];
  const set = (index: number, id: string) => {
    const next =
      id === NONE ? chosen.slice(0, index) : [...chosen.slice(0, index), id];
    // Pilihan setelahnya tetap dipertahankan bila masih sah dan tidak ganda.
    const rest = chosen.slice(index + 1).filter((x) => x !== id);
    const merged = id === NONE ? next : [...next, ...rest];
    onChange(merged.length > 0 ? merged : undefined);
  };
  return (
    <div
      role="group"
      aria-labelledby={`label-${field.id}`}
      aria-describedby={describedBy}
      className="grid gap-3"
    >
      {Array.from({ length: max }, (_, i) => {
        const current = chosen[i];
        const locked = i > 0 && chosen[i - 1] === undefined;
        const taken = new Set(chosen.filter((_, j) => j !== i));
        return (
          <div key={i} className="grid gap-1.5">
            <label
              htmlFor={i === 0 ? `fill-${field.id}` : `fill-${field.id}-${i}`}
              className="text-sm font-medium text-neutral-1000"
            >
              Pilihan {i + 1}
              {i >= min ? (
                <span className="font-normal text-neutral-700">
                  {' '}
                  (opsional)
                </span>
              ) : null}
            </label>
            <Select
              value={current ?? ''}
              disabled={locked}
              onValueChange={(v) => set(i, v)}
            >
              <SelectTrigger
                id={i === 0 ? `fill-${field.id}` : `fill-${field.id}-${i}`}
                aria-invalid={invalid && i < min && current === undefined}
              >
                <SelectValue
                  placeholder={
                    locked ? 'Isi pilihan sebelumnya dulu' : 'Pilih tujuan'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {current !== undefined && i >= min ? (
                  <SelectItem value={NONE}>Kosongkan pilihan ini</SelectItem>
                ) : null}
                {groups.map((group) => {
                  const items = field.options.filter(
                    (o) => (o.group ?? '') === group && !taken.has(o.id),
                  );
                  if (items.length === 0) return null;
                  return (
                    <SelectGroup key={group || 'tanpa-kelompok'}>
                      {group ? <SelectLabel>{group}</SelectLabel> : null}
                      {items.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}

function SingleList({
  field,
  value,
  onChange,
  describedBy,
  shuffleOptions,
}: Pick<
  AnswerInputProps,
  'field' | 'value' | 'onChange' | 'describedBy' | 'shuffleOptions'
>) {
  const options = useOptionOrder(field.options, shuffleOptions);
  return (
    <div
      role="radiogroup"
      aria-labelledby={`label-${field.id}`}
      aria-describedby={describedBy}
      className="grid gap-2"
    >
      {options.map((o) => (
        <label key={o.id} className={choiceRow}>
          <input
            type="radio"
            name={`fill-${field.id}`}
            className="size-4 accent-[var(--form-accent)]"
            checked={value === o.id}
            onChange={() => onChange(o.id)}
          />
          {o.label}
        </label>
      ))}
      {typeof value === 'string' && value !== '' ? (
        <ClearChoice onClick={() => onChange(undefined)} />
      ) : null}
    </div>
  );
}

function ClearChoice({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-fit text-sm font-medium text-neutral-700 underline-offset-4 hover:text-danger-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
    >
      Kosongkan pilihan
    </button>
  );
}

function SingleDropdown({
  field,
  value,
  onChange,
  invalid,
  shuffleOptions,
}: Pick<
  AnswerInputProps,
  'field' | 'value' | 'onChange' | 'invalid' | 'shuffleOptions'
>) {
  const options = useOptionOrder(field.options, shuffleOptions);
  return (
    <Select
      value={typeof value === 'string' ? value : ''}
      onValueChange={(v) => onChange(v === CLEAR_SELECT ? undefined : v)}
    >
      <SelectTrigger id={`fill-${field.id}`} aria-invalid={invalid}>
        <SelectValue placeholder="Pilih salah satu" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={CLEAR_SELECT}>Kosongkan pilihan</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MultipleList({
  field,
  value,
  onChange,
  describedBy,
  shuffleOptions,
}: Pick<
  AnswerInputProps,
  'field' | 'value' | 'onChange' | 'describedBy' | 'shuffleOptions'
>) {
  const options = useOptionOrder(field.options, shuffleOptions);
  const selected = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div
      role="group"
      aria-labelledby={`label-${field.id}`}
      aria-describedby={describedBy}
      className="grid gap-2"
    >
      {options.map((o) => (
        <label key={o.id} className={choiceRow}>
          <input
            type="checkbox"
            className="size-4 accent-[var(--form-accent)]"
            checked={selected.includes(o.id)}
            onChange={(e) => {
              const next = e.target.checked
                ? [...selected, o.id]
                : selected.filter((id) => id !== o.id);
              onChange(next.length > 0 ? next : undefined);
            }}
          />
          {o.label}
        </label>
      ))}
      {selected.length > 0 ? (
        <ClearChoice onClick={() => onChange(undefined)} />
      ) : null}
    </div>
  );
}

function ScaleInput({
  field,
  value,
  onChange,
}: Pick<AnswerInputProps, 'field' | 'value' | 'onChange'>) {
  const c = field.config;
  const min = c.min ?? 1;
  const max = c.max ?? 5;
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const current = typeof value === 'number' ? value : undefined;
  const stars = c.tampilan === 'bintang';

  return (
    <div>
      <div
        role="radiogroup"
        aria-labelledby={`label-${field.id}`}
        className="flex flex-wrap gap-2"
      >
        {steps.map((n) => {
          const on =
            current !== undefined && (stars ? n <= current : n === current);
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={current === n}
              aria-label={`${n} dari ${max}`}
              onClick={() => onChange(n)}
              className={cn(
                'flex items-center justify-center rounded-xl border text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--form-accent)]',
                stars
                  ? 'size-10 border-transparent'
                  : 'size-10 border-neutral-400',
                !stars &&
                  on &&
                  'border-[var(--form-accent)] bg-[var(--form-accent)] text-white',
                !stars &&
                  !on &&
                  'bg-neutral-50 text-neutral-1000 hover:bg-neutral-200',
              )}
            >
              {stars ? (
                <Star
                  className={cn(
                    'size-7',
                    on ? 'fill-saffron text-neutral-700' : 'text-neutral-700',
                  )}
                />
              ) : (
                n
              )}
            </button>
          );
        })}
      </div>
      {c.minLabel || c.maxLabel ? (
        <div className="mt-2 flex justify-between text-sm text-neutral-700">
          <span>{c.minLabel}</span>
          <span>{c.maxLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function MatrixInput({
  field,
  value,
  onChange,
}: Pick<AnswerInputProps, 'field' | 'value' | 'onChange'>) {
  const c = field.config;
  const rows = c.rows ?? [];
  const columns = c.columns ?? [];
  const answer: Record<string, string | string[]> =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, string | string[]>)
      : {};

  const set = (rowId: string, columnId: string, checked: boolean) => {
    const current = answer[rowId];
    let next: string | string[] | undefined;
    if (c.multiple) {
      const list = Array.isArray(current) ? current : [];
      const updated = checked
        ? [...list, columnId]
        : list.filter((id) => id !== columnId);
      next = updated.length > 0 ? updated : undefined;
    } else {
      next = checked ? columnId : undefined;
    }
    const merged = { ...answer };
    if (next === undefined) delete merged[rowId];
    else merged[rowId] = next;
    onChange(Object.keys(merged).length > 0 ? merged : undefined);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-400">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-100">
            <td className="p-2" />
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className="p-2 text-center font-semibold text-neutral-1000"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const current = answer[row.id];
            return (
              <tr key={row.id} className="border-t border-neutral-400">
                <th
                  scope="row"
                  className="p-2 text-left font-medium text-neutral-1000"
                >
                  {row.label}
                </th>
                {columns.map((col) => {
                  const checked = Array.isArray(current)
                    ? current.includes(col.id)
                    : current === col.id;
                  return (
                    <td key={col.id} className="p-2 text-center">
                      <input
                        type={c.multiple ? 'checkbox' : 'radio'}
                        name={`m-${field.id}-${row.id}`}
                        aria-label={`${row.label}: ${col.label}`}
                        className="size-4 accent-[var(--form-accent)]"
                        checked={checked}
                        onChange={(e) =>
                          set(
                            row.id,
                            col.id,
                            c.multiple ? e.target.checked : true,
                          )
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
