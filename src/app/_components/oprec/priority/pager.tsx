'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';

import { selectClass } from '../placement/shared';

/** Pilihan baris per halaman; 0 = semua dalam satu halaman. */
export const PAGE_SIZES = [10, 25, 50, 100, 0] as const;
export const DEFAULT_PAGE_SIZE = 25;

export const pageCount = (total: number, size: number) =>
  size === 0 ? 1 : Math.max(1, Math.ceil(total / size));

/** Halaman (mulai 1) tempat baris ke-`index` (mulai 0) berada. */
export const pageOf = (index: number, size: number) =>
  size === 0 ? 1 : Math.floor(index / size) + 1;

export function pageSlice<T>(rows: T[], page: number, size: number) {
  return size === 0 ? rows : rows.slice((page - 1) * size, page * size);
}

/** Pemilih baris per halaman, berlaku untuk semua tabel papan. */
export function PageSizeSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (size: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 whitespace-nowrap text-sm text-neutral-700">
      Baris per halaman
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`${selectClass} h-8 w-auto pr-8`}
      >
        {PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size === 0 ? 'Semua' : size}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Navigasi halaman satu tabel; nomor halaman bisa diketik lalu Enter. */
export function Pager({
  label,
  page,
  pages,
  total,
  size,
  onPage,
}: {
  label: string;
  page: number;
  pages: number;
  total: number;
  size: number;
  onPage: (page: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (pages <= 1) return null;

  const commit = () => {
    if (draft === null) return;
    const parsed = Number.parseInt(draft, 10);
    setDraft(null);
    if (Number.isFinite(parsed)) onPage(Math.min(pages, Math.max(1, parsed)));
  };

  return (
    <nav
      aria-label={`Halaman ${label}`}
      className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-700"
    >
      <span>
        {(page - 1) * size + 1}–{Math.min(total, page * size)} dari {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="dark_blue_outline"
          aria-label="Halaman sebelumnya"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="flex items-center gap-1.5">
          Halaman
          <input
            inputMode="numeric"
            aria-label={`Nomor halaman ${label}`}
            value={draft ?? String(page)}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              } else if (event.key === 'Escape') {
                setDraft(null);
              }
            }}
            className="h-8 w-12 rounded-md border border-neutral-400 bg-neutral-50 text-center text-sm font-semibold text-neutral-1000 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          />
          dari {pages}
        </span>
        <Button
          size="sm"
          variant="dark_blue_outline"
          aria-label="Halaman berikutnya"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
