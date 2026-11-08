'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
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

type Applicants = RouterOutputs['oprec']['applicants'];
type Choice = { rank: number | null; label: string; origin: string };

const when = (d: Date | null) =>
  d
    ? d.toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta',
      })
    : '—';

function ChoiceChip({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-full items-center truncate rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-400">
      {label}
    </span>
  );
}

/** Tabel pendaftar berhalaman; klik satu baris membuka berkas pendaftar. */
export function ApplicantsTable({
  data,
  maxChoices,
  groupLabel,
  page,
  onPage,
  loading,
  onOpen,
}: {
  data: Applicants;
  maxChoices: number;
  /** Nama pengelompokan aktif, atau null bila tanpa kelompok. */
  groupLabel: string | null;
  page: number;
  onPage: (page: number) => void;
  loading: boolean;
  onOpen: (applicationId: string) => void;
}) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const columns = 4 + maxChoices;

  return (
    <div>
      <div
        className="overflow-x-auto rounded-[24px] border border-neutral-400 bg-neutral-50"
        aria-busy={loading}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">Pendaftar</TableHead>
              <TableHead className="whitespace-nowrap">Gelombang</TableHead>
              {Array.from({ length: maxChoices }, (_, i) => (
                <TableHead key={i} className="whitespace-nowrap">
                  Pilihan {i + 1}
                </TableHead>
              ))}
              <TableHead className="whitespace-nowrap">Dikirim</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row, index) => {
              const byRank = new Map(
                (row.choices as Choice[]).map((c) => [c.rank, c.label]),
              );
              const showGroup =
                groupLabel !== null &&
                (index === 0 ||
                  data.rows[index - 1]?.groupKey !== row.groupKey);
              return (
                <Fragment key={row.id}>
                  {showGroup ? (
                    <TableRow className="bg-neutral-200 hover:bg-neutral-200">
                      <TableCell
                        colSpan={columns}
                        className="py-2 text-xs font-semibold uppercase tracking-wide text-neutral-700"
                      >
                        {groupLabel}: {row.groupKey ?? 'Tidak ada'}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => onOpen(row.id)}
                  >
                    <TableCell>
                      <button
                        type="button"
                        className="text-left font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(row.id);
                        }}
                      >
                        {row.name ?? 'Tanpa nama'}
                      </button>
                      <span className="mt-0.5 block text-xs text-neutral-700">
                        {[row.nim, row.prodi, row.angkatan]
                          .filter((v) => v !== null && v !== undefined)
                          .join(' · ')}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.waveLabel ?? '—'}
                    </TableCell>
                    {Array.from({ length: maxChoices }, (_, i) => {
                      const label = byRank.get(i + 1);
                      return (
                        <TableCell key={i}>
                          {label ? (
                            <ChoiceChip label={label} />
                          ) : (
                            <span className="text-neutral-500">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="whitespace-nowrap text-neutral-700">
                      {when(row.submittedAt)}
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-700">
        <span>
          {data.total} pendaftar · halaman {page} dari {pages}
        </span>
        <div className="flex gap-2">
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
        </div>
      </div>
    </div>
  );
}
