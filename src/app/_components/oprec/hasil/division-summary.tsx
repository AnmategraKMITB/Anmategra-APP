'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { type RouterOutputs } from '~/trpc/react';

import { Chip } from '../placement/shared';

type Overview = RouterOutputs['oprec']['resultsOverview'];
type Division = Overview['divisions'][number];
export type AcceptedNames = Record<
  string,
  { name: string | null; nim: number | null; closerec: boolean }[]
>;

/** Rekap per divisi, dikelompokkan menurut bidang induk. */
export function DivisionSummary({
  divisions,
  acceptedByDivision,
  onPickDivision,
}: {
  divisions: Division[];
  acceptedByDivision: AcceptedNames;
  onPickDivision: (divisionId: string) => void;
}) {
  const groups = new Map<string, Division[]>();
  for (const division of divisions) {
    const key = division.groupLabel ?? 'Tanpa bidang';
    groups.set(key, [...(groups.get(key) ?? []), division]);
  }

  return (
    <section aria-labelledby="rekap-divisi" className="mt-8">
      <h2
        id="rekap-divisi"
        className="text-lg font-semibold text-neutral-1000"
      >
        Rekap per divisi
      </h2>
      <div className="mt-3 grid gap-6">
        {[...groups.entries()].map(([group, rows]) => (
          <div key={group}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
              {group}
            </h3>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {rows.map((division) => (
                <DivisionCard
                  key={division.id}
                  division={division}
                  names={acceptedByDivision[division.id] ?? []}
                  onPickDivision={onPickDivision}
                />
              ))}
            </div>
          </div>
        ))}
        {divisions.length === 0 ? (
          <p className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4 text-sm text-neutral-700">
            Oprec ini belum punya divisi tujuan.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function DivisionCard({
  division,
  names,
  onPickDivision,
}: {
  division: Division;
  names: AcceptedNames[string];
  onPickDivision: (divisionId: string) => void;
}) {
  const quota = division.quota === 0 ? 'Tanpa batas' : division.quota;
  return (
    <article className="grid gap-2 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-base font-semibold text-neutral-1000">
          {division.label}
        </h4>
        <div className="flex flex-wrap gap-1">
          {division.pending > 0 ? (
            <Chip tone="warning">{division.pending} belum diputuskan</Chip>
          ) : null}
          {division.extras > 0 ? (
            <Chip tone="muted">{division.extras} closerec</Chip>
          ) : null}
        </div>
      </div>

      <p className="text-sm text-neutral-700">
        <span className="text-lg font-semibold text-neutral-1000">
          {division.accepted}
        </span>{' '}
        diterima / {quota}
      </p>
      {division.overQuota ? (
        <p className="rounded-xl bg-warning-light px-3 py-2 text-sm text-neutral-1000">
          Diterima melebihi kuota ({division.accepted} dari{' '}
          {division.quota}).
        </p>
      ) : null}

      <details className="group">
        <summary className="cursor-pointer text-sm font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
          {names.length === 0
            ? 'Belum ada yang diterima'
            : `Lihat ${names.length} nama diterima`}
        </summary>
        {names.length > 0 ? (
          <ul className="mt-2 max-h-56 overflow-y-auto pr-1">
            {names.map((row, index) => (
              <li
                key={`${row.nim ?? 'x'}-${index}`}
                className="flex flex-wrap items-center gap-2 border-b border-neutral-200 py-1.5 text-sm last:border-0"
              >
                <span className="min-w-0 flex-1 truncate font-semibold text-neutral-1000">
                  {row.name ?? 'Tanpa nama'}
                </span>
                <span className="text-xs text-neutral-700">{row.nim ?? ''}</span>
                {row.closerec ? <Chip tone="muted">closerec</Chip> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </details>

      <div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onPickDivision(division.id)}
        >
          Lihat pendaftar divisi ini <ArrowRight />
        </Button>
      </div>
    </article>
  );
}
