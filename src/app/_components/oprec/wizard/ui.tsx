'use client';

import { Check } from 'lucide-react';
import { type ReactNode, createContext, useContext, useId } from 'react';
import { cn } from '~/lib/utils';

/**
 * true = langkah tampil ringkas (judul kecil, tanpa ilustrasi), dipakai saat
 * pertanyaan wizard ditampilkan ulang di tab Pengaturan.
 */
export const CompactSteps = createContext(false);

/** Kerangka satu layar pertanyaan: judul, petunjuk, ilustrasi, isi. */
export function StepFrame({
  title,
  hint,
  illustration,
  children,
}: {
  title: string;
  hint?: ReactNode;
  illustration?: ReactNode;
  children: ReactNode;
}) {
  const compact = useContext(CompactSteps);
  if (compact) {
    return (
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-neutral-1000">{title}</h3>
        {hint ? (
          <p className="mt-1 max-w-prose text-sm text-neutral-700">{hint}</p>
        ) : null}
        <div className="mt-4">{children}</div>
      </div>
    );
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-start">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold text-neutral-1000 sm:text-[28px] sm:leading-9">
          {title}
        </h2>
        {hint ? (
          <p className="mt-2 max-w-prose text-neutral-700">{hint}</p>
        ) : null}
        <div className="mt-6">{children}</div>
      </div>
      {illustration ? (
        <div
          aria-hidden
          className="hidden rounded-[24px] bg-primary-100 p-6 text-primary-400 lg:block"
        >
          {illustration}
        </div>
      ) : null}
    </div>
  );
}

export type Option<T extends string> = {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
};

/** Pilihan tunggal berupa kartu; `role="radiogroup"` dengan tombol berstatus. */
export function OptionCards<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 1,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  columns?: 1 | 2;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid gap-3', columns === 2 && 'sm:grid-cols-2')}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex items-start gap-3 rounded-[20px] border bg-neutral-50 p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50',
              selected
                ? 'border-primary-400 bg-primary-100'
                : 'border-neutral-400 hover:border-primary-300 hover:bg-neutral-100',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                selected
                  ? 'border-primary-400 bg-primary-400 text-neutral-50'
                  : 'border-neutral-500',
              )}
            >
              {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-neutral-1000">
                {o.label}
              </span>
              {o.description ? (
                <span className="mt-0.5 block text-sm text-neutral-700">
                  {o.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const fieldClass =
  'h-9 w-full rounded-lg border border-neutral-400 bg-neutral-50 px-3 text-sm text-neutral-1000 placeholder:text-neutral-500 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50';

export function Labeled({
  label,
  children,
  hint,
}: {
  label: string;
  children: (id: string) => ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-neutral-1000">
        {label}
      </label>
      {children(id)}
      {hint ? <p className="text-xs text-neutral-700">{hint}</p> : null}
    </div>
  );
}

/** Catatan kecil di bawah pertanyaan; `tone` hanya untuk makna (info/peringatan). */
export function Note({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn';
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        'mt-4 rounded-xl px-4 py-3 text-sm',
        tone === 'warn'
          ? 'bg-warning-light text-neutral-1000'
          : 'bg-neutral-200 text-neutral-700',
      )}
    >
      {children}
    </p>
  );
}
