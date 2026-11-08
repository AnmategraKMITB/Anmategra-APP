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

import { FLAG_STYLE, StatusBadge, SyaratBadge } from './nilai/status';

type Applicants = RouterOutputs['oprec']['applicants'];
type Choice = Applicants['rows'][number]['choices'][number];

const when = (d: Date | null) =>
  d
    ? d.toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta',
      })
    : '—';

function ChoiceChip({ choice }: { choice: Choice }) {
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1.5">
      <span className="truncate rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-400">
        {choice.label}
      </span>
      <StatusBadge status={choice.status} />
    </span>
  );
}

function SmallChip({
  children,
  title,
  warning = false,
}: {
  children: React.ReactNode;
  title: string;
  warning?: boolean;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${warning ? 'bg-warning-light text-neutral-1000' : 'bg-primary-100 text-primary-500'}`}
    >
      {children}
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
  const columns = 6 + maxChoices;

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
              <TableHead className="whitespace-nowrap">Syarat umum</TableHead>
              <TableHead className="whitespace-nowrap">Flag</TableHead>
              <TableHead className="whitespace-nowrap">Dikirim</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row, index) => {
              const byRank = new Map(row.choices.map((c) => [c.rank, c]));
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
                      const choice = byRank.get(i + 1);
                      return (
                        <TableCell key={i}>
                          {choice ? (
                            <div className="flex max-w-64 flex-wrap items-center gap-1.5">
                              <ChoiceChip choice={choice} />
                              {choice.overridden ? (
                                <SmallChip title="Status pilihan ini diubah manual">
                                  diubah manual
                                </SmallChip>
                              ) : null}
                              {choice.needsReview ? (
                                <SmallChip
                                  warning
                                  title="Nilai berubah sejak diubah manual"
                                >
                                  perlu ditinjau ulang
                                </SmallChip>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-neutral-500">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="whitespace-nowrap">
                      <SyaratBadge status={row.syaratUmum} />
                    </TableCell>
                    <TableCell>
                      {row.flags.length === 0 ? (
                        <span className="text-neutral-500">—</span>
                      ) : (
                        <div className="flex max-w-56 flex-wrap gap-1">
                          {row.flags.map((flag) => (
                            <span
                              key={flag.labelId}
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${FLAG_STYLE[flag.color as keyof typeof FLAG_STYLE] ?? 'bg-neutral-100 text-neutral-700'}`}
                            >
                              {flag.name}
                              {flag.isSensitive ? ' · sensitif' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
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
