'use client';

import { useState } from 'react';
import { cn } from '~/lib/utils';
import { type RouterOutputs } from '~/trpc/react';

type Summary = RouterOutputs['oprec']['applicantSummary'];

/**
 * Ringkasan baca-saja: total pendaftar, jumlah per gelombang, dan sebaran
 * tujuan per urutan pilihan. Baris tujuan bisa diklik untuk menyaring tabel.
 */
export function ApplicantsSummary({
  data,
  activeDivisionId,
  onPickDivision,
}: {
  data: Summary;
  activeDivisionId: string | undefined;
  onPickDivision: (divisionId: string | undefined) => void;
}) {
  const [rank, setRank] = useState(1);
  const current = data.byRank.find((r) => r.rank === rank) ?? data.byRank[0];
  const peak = Math.max(1, ...(current?.items.map((i) => i.count) ?? [1]));

  return (
    <section
      aria-label="Ringkasan pendaftar"
      className="grid gap-px overflow-hidden rounded-[24px] border border-neutral-400 bg-neutral-400 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
    >
      <div className="bg-neutral-50 p-5 sm:p-6">
        <p className="text-sm text-neutral-700">Total pendaftar</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-1000">
          {data.total}
        </p>
        {data.byWave.length > 0 ? (
          <>
            <h2 className="mt-5 text-sm font-semibold text-neutral-1000">
              Per gelombang
            </h2>
            <ul className="mt-2 grid gap-1.5">
              {data.byWave.map((w) => (
                <li
                  key={w.waveId ?? 'none'}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-neutral-700">Gelombang {w.label}</span>
                  <span className="font-semibold tabular-nums text-neutral-1000">
                    {w.count}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="bg-neutral-50 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-neutral-1000">
            Per pilihan
          </h2>
          <div
            role="tablist"
            aria-label="Urutan pilihan"
            className="flex gap-1 rounded-full bg-neutral-200 p-1"
          >
            {data.byRank.map((r) => (
              <button
                key={r.rank}
                type="button"
                role="tab"
                aria-selected={rank === r.rank}
                onClick={() => setRank(r.rank)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  rank === r.rank
                    ? 'bg-neutral-50 text-primary-400'
                    : 'text-neutral-700 hover:text-neutral-1000',
                )}
              >
                Pilihan {r.rank}
              </button>
            ))}
          </div>
        </div>

        {current && current.items.length > 0 ? (
          <ul className="mt-3 grid gap-1">
            {current.items.map((item) => {
              const active = activeDivisionId === item.divisionId;
              return (
                <li key={item.divisionId}>
                  <button
                    type="button"
                    aria-pressed={active}
                    title={
                      active
                        ? 'Hapus saringan tujuan ini'
                        : 'Saring tabel ke tujuan ini'
                    }
                    onClick={() =>
                      onPickDivision(active ? undefined : item.divisionId)
                    }
                    className={cn(
                      'grid w-full grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 sm:grid-cols-[minmax(0,12rem)_1fr_auto]',
                      active && 'bg-primary-100',
                    )}
                  >
                    <span className="truncate text-neutral-1000">
                      {item.label}
                    </span>
                    <span
                      aria-hidden
                      className="h-1.5 overflow-hidden rounded-full bg-neutral-200"
                    >
                      <span
                        className="block h-full rounded-full bg-primary-300"
                        style={{ width: `${(item.count / peak) * 100}%` }}
                      />
                    </span>
                    <span className="font-semibold tabular-nums text-neutral-1000">
                      {item.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-700">
            Belum ada yang memilih sebagai pilihan {rank}.
          </p>
        )}
      </div>
    </section>
  );
}
