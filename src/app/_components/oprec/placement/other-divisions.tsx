'use client';

import { useState } from 'react';
import { api } from '~/trpc/react';

import { Chip, ErrorNote, Loading, Notice, when } from './shared';

/** Daftar pendaftar yang sudah diterima di divisi lain, hanya baca. */
export function OtherDivisions({
  recruitmentId,
  divisions,
}: {
  recruitmentId: string;
  divisions: { id: string; label: string }[];
}) {
  if (divisions.length === 0) return null;
  return (
    <section aria-label="Divisi lain yang boleh dilihat" className="mt-6 grid gap-2">
      <h2 className="text-lg font-semibold text-neutral-1000">
        Lihat divisi lain
      </h2>
      <p className="text-sm text-neutral-700">
        Kamu hanya bisa melihat nama yang sudah diterima, tanpa mengubah apa pun.
      </p>
      {divisions.map((division) => (
        <AcceptedForDivision
          key={division.id}
          recruitmentId={recruitmentId}
          divisionId={division.id}
          label={division.label}
        />
      ))}
    </section>
  );
}

function AcceptedForDivision({
  recruitmentId,
  divisionId,
  label,
}: {
  recruitmentId: string;
  divisionId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const list = api.oprec.placementAccepted.useQuery(
    { recruitmentId, divisionId },
    { enabled: open },
  );

  return (
    <details
      className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-semibold text-neutral-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
        {label}
      </summary>
      <div className="mt-3">
        {!open ? null : list.isError ? (
          <ErrorNote message={list.error.message} />
        ) : list.isLoading ? (
          <Loading label="Memuat…" />
        ) : (list.data?.rows.length ?? 0) === 0 ? (
          <Notice>Belum ada yang diterima di divisi ini.</Notice>
        ) : (
          <ul className="grid gap-2">
            {(list.data?.rows ?? []).map((row) => (
              <li
                key={row.choiceId}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-2 last:border-0 last:pb-0"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-neutral-1000">
                    {row.name ?? 'Tanpa nama'}
                  </span>
                  <span className="block text-xs text-neutral-700">
                    {[row.nim, row.prodi, row.angkatan]
                      .filter((value) => value !== null && value !== undefined)
                      .join(' · ')}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-1 text-xs text-neutral-700">
                  {row.origin === 'closerec' ? (
                    <Chip tone="muted">closerec</Chip>
                  ) : null}
                  {row.tag === 'lewat_banding' ? (
                    <Chip tone="warning">lewat banding</Chip>
                  ) : null}
                  {when(row.decidedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
