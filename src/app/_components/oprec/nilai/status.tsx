'use client';

import { type RouterOutputs } from '~/trpc/react';

type DetailChoice = RouterOutputs['oprec']['assessGet']['choices'][number];
type Status = NonNullable<
  DetailChoice['computedStatus'] | DetailChoice['effectiveStatus']
>;
type FlagColor = RouterOutputs['oprec']['flagLabels'][number]['color'];

export const STATUS_LABEL: Record<Status, string> = {
  belum_lengkap: 'Belum lengkap',
  perlu_ditinjau: 'Perlu ditinjau',
  lolos: 'Lolos',
  tidak_lolos: 'Tidak lolos',
};

export const FLAG_STYLE: Record<FlagColor, string> = {
  teal: 'bg-secondary-100 text-primary-500',
  amber: 'bg-warning-light text-neutral-1000',
  blue: 'bg-primary-100 text-primary-500',
  red: 'bg-danger-light text-danger-dark',
};

type Syarat = 'lolos' | 'gugur' | 'perlu_ditinjau' | 'belum';

export const SYARAT_LABEL: Record<Syarat, string> = {
  lolos: 'Lolos',
  gugur: 'Gugur',
  perlu_ditinjau: 'Perlu ditinjau',
  belum: 'Belum',
};

const SYARAT_STYLE: Record<Syarat, string> = {
  lolos: 'bg-success-light text-success-dark',
  gugur: 'bg-danger-light text-danger-dark',
  perlu_ditinjau: 'bg-warning-light text-neutral-1000',
  belum: 'bg-neutral-200 text-neutral-700',
};

const STATUS_STYLE: Record<Status, string> = {
  lolos: 'bg-success-light text-success-dark',
  tidak_lolos: 'bg-danger-light text-danger-dark',
  perlu_ditinjau: 'bg-warning-light text-neutral-1000',
  belum_lengkap: 'bg-neutral-200 text-neutral-700',
};

export function StatusBadge({
  status,
  className,
}: {
  status: Status | null | undefined;
  className?: string;
}) {
  const style = status
    ? (STATUS_STYLE[status] ?? 'bg-neutral-100 text-neutral-700')
    : 'bg-neutral-100 text-neutral-700';
  const label = status
    ? (STATUS_LABEL[status] ?? 'Belum dihitung')
    : 'Belum dihitung';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}${className ? ` ${className}` : ''}`}
    >
      {label}
    </span>
  );
}

export function SyaratBadge({
  status,
  className,
}: {
  status: Syarat | null | undefined;
  className?: string;
}) {
  const key = status ?? 'belum';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${SYARAT_STYLE[key]}${className ? ` ${className}` : ''}`}
    >
      {SYARAT_LABEL[key]}
    </span>
  );
}
