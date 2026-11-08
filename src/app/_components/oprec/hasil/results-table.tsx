'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { type RouterOutputs } from '~/trpc/react';

import { Chip, when } from '../placement/shared';

type List = RouterOutputs['oprec']['resultsList'];
export type ResultRow = List['rows'][number];

const FINAL: Record<
  ResultRow['finalStatus'],
  { label: string; tone: 'success' | 'danger' | 'warning' }
> = {
  diterima: { label: 'Diterima', tone: 'success' },
  tidak_diterima: { label: 'Tidak diterima', tone: 'danger' },
  belum_diputuskan: { label: 'Belum diputuskan', tone: 'warning' },
};

const DECISION: Record<'terima' | 'tolak', string> = {
  terima: 'Diterima',
  tolak: 'Ditolak',
};

const choiceName = (choice: ResultRow['choices'][number]) => {
  if (choice.rank !== null) return `Pilihan ${choice.rank}`;
  return choice.origin === 'closerec' ? 'Closerec' : 'Dialihkan';
};

/** Tabel hasil semua pendaftar dengan status akhir dan alasan yang boleh dilihat. */
export function ResultsTable({
  rows,
  total,
  page,
  pageSize,
  loading,
  onPage,
}: {
  rows: ResultRow[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div
        className="overflow-x-auto rounded-[24px] border border-neutral-400 bg-neutral-50"
        aria-busy={loading}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-52">Pendaftar</TableHead>
              <TableHead className="min-w-40">Status akhir</TableHead>
              <TableHead className="min-w-64">Pilihan</TableHead>
              <TableHead className="min-w-40">Diterima di</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const final = FINAL[row.finalStatus];
              return (
                <TableRow key={row.id} className="align-top">
                  <TableCell>
                    <span className="font-semibold text-neutral-1000">
                      {row.name ?? 'Tanpa nama'}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-700">
                      {[row.nim, row.prodi, row.angkatan]
                        .filter(
                          (value) => value !== null && value !== undefined,
                        )
                        .join(' · ')}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {row.waveLabel ? (
                        <Chip tone="muted">{row.waveLabel}</Chip>
                      ) : null}
                      {row.source === 'closerec' ? (
                        <Chip tone="muted">closerec</Chip>
                      ) : null}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Chip tone={final.tone}>{final.label}</Chip>
                    {row.acceptedAt ? (
                      <span className="mt-1 block text-xs text-neutral-700">
                        {when(row.acceptedAt)}
                      </span>
                    ) : null}
                  </TableCell>

                  <TableCell>
                    <ul className="grid gap-1.5">
                      {row.choices.map((choice) => (
                        <li key={choice.id} className="text-sm">
                          <div className="flex flex-wrap items-center gap-1">
                            <Chip
                              tone={
                                choice.decision === 'terima'
                                  ? 'success'
                                  : choice.decision === 'tolak'
                                    ? 'danger'
                                    : 'muted'
                              }
                            >
                              {choiceName(choice)} · {choice.label}
                            </Chip>
                            <span className="text-xs text-neutral-700">
                              {choice.decision
                                ? DECISION[choice.decision]
                                : 'Belum diputuskan'}
                            </span>
                          </div>
                          {choice.reason && choice.decision !== 'terima' ? (
                            <span className="mt-0.5 block text-xs text-neutral-700">
                              {choice.reason}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </TableCell>

                  <TableCell>
                    {row.acceptedLabel ? (
                      <Chip tone="success">{row.acceptedLabel}</Chip>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="dark_blue_outline"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft /> Sebelumnya
        </Button>
        <Button
          variant="dark_blue_outline"
          size="sm"
          disabled={page >= pages || loading}
          onClick={() => onPage(page + 1)}
        >
          Berikutnya <ChevronRight />
        </Button>
        <span className="text-sm text-neutral-700">
          {total} pendaftar · halaman {page} dari {pages}
        </span>
      </div>
    </div>
  );
}
