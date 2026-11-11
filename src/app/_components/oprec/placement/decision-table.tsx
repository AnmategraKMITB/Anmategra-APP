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

import { StatusBadge } from '../nilai/status';
import { RowHistory } from './row-history';
import { Chip } from './shared';

type Rows = RouterOutputs['oprec']['placementRows'];
type Row = Rows['rows'][number];
type Choice = Row['choices'][number];
type Division = Rows['division'];
type State = RouterOutputs['oprec']['placementOverview']['state'];

const REASON_LABEL: Record<string, string> = {
  siap: 'siap diputuskan',
  menunggu_pilihan_sebelumnya: 'menunggu pilihan sebelumnya',
  ditolak: 'ditolak',
  tidak_lolos: 'tidak lolos',
  diterima_di_lain: 'sudah diterima di pilihan lain',
};

const TAG_LABEL: Record<string, string> = {
  pindahan: 'pindahan',
  lewat_banding: 'lewat banding',
  di_luar_pilihan: 'di luar pilihan',
};

function choiceName(choice: Choice) {
  if (choice.rank !== null) return `Pilihan ${choice.rank}`;
  if (choice.origin === 'closerec') return 'Closerec';
  return 'Dialihkan';
}

/** Tabel pendaftar satu divisi: pilihan, status, keputusan, dan tindakan. */
export function DecisionTable({
  recruitmentId,
  data,
  division,
  state,
  isAdmin,
  page,
  onPage,
  loading,
  onDecide,
  onAppeal,
  onMove,
  onRequestTransfer,
}: {
  recruitmentId: string;
  data: Rows;
  division: Division;
  state: State;
  isAdmin: boolean;
  page: number;
  onPage: (page: number) => void;
  loading: boolean;
  onDecide: (choice: Choice, decision: 'terima' | 'tolak') => void;
  onAppeal: (choice: Choice) => void;
  onMove: (row: Row) => void;
  onRequestTransfer: (row: Row) => void;
}) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

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
              <TableHead className="whitespace-nowrap">Skor &amp; status</TableHead>
              <TableHead className="min-w-56">Pilihan</TableHead>
              <TableHead className="min-w-44">Keputusan</TableHead>
              <TableHead className="min-w-36">Tindakan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => {
              const target = row.choices.find(
                (choice) => choice.divisionId === division.id,
              );
              const accepted = row.choices.find(
                (choice) => choice.decision === 'terima',
              );
              if (!target) return null;
              const canDecide =
                state === 'berjalan' &&
                target.origin !== 'closerec' &&
                target.stage === 'aktif';
              const canAppeal =
                state === 'masa_banding' &&
                (target.decision === 'tolak' ||
                  target.stageReason === 'tidak_lolos');
              const canMove = isAdmin && accepted !== undefined && state !== 'final';
              const canRequest =
                !isAdmin &&
                state === 'masa_banding' &&
                accepted?.divisionId === division.id;

              return (
                <TableRow key={row.id} className="align-top">
                  <TableCell>
                    <span className="font-semibold text-neutral-1000">
                      {row.name ?? 'Tanpa nama'}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-700">
                      {[row.nim, row.prodi, row.angkatan]
                        .filter((value) => value !== null && value !== undefined)
                        .join(' · ')}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {row.source === 'closerec' ? (
                        <Chip tone="muted">closerec</Chip>
                      ) : null}
                      {row.willingToMove ? (
                        <Chip tone="muted" title="Bersedia dipindahkan">
                          bersedia pindah
                        </Chip>
                      ) : null}
                      {row.acceptedElsewhere && accepted ? (
                        <Chip tone="warning">
                          diterima di {accepted.label}
                        </Chip>
                      ) : null}
                    </span>
                    <RowHistory
                      recruitmentId={recruitmentId}
                      applicationId={row.id}
                    />
                  </TableCell>

                  <TableCell className="whitespace-nowrap">
                    <div className="grid gap-1">
                      <span className="text-sm font-semibold text-neutral-1000">
                        {target.score ?? '—'}
                      </span>
                      <StatusBadge status={target.status} />
                      {target.overridden ? (
                        <Chip
                          tone="muted"
                          title={target.overrideReason ?? 'Status diubah manual'}
                        >
                          diubah manual
                        </Chip>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell>
                    <ul className="grid gap-1">
                      {row.choices.map((choice) => (
                        <li
                          key={choice.id}
                          className="flex flex-wrap items-center gap-1"
                        >
                          <Chip
                            tone={
                              choice.decision === 'terima'
                                ? 'success'
                                : choice.decision === 'tolak'
                                  ? 'danger'
                                  : choice.stage === 'menunggu'
                                    ? 'muted'
                                    : 'primary'
                            }
                            title={REASON_LABEL[choice.stageReason] ?? ''}
                          >
                            {choiceName(choice)} · {choice.label}
                          </Chip>
                          {choice.stage !== 'aktif' ? (
                            <span className="text-xs text-neutral-700">
                              {REASON_LABEL[choice.stageReason] ?? choice.stage}
                            </span>
                          ) : null}
                          {choice.tag ? (
                            <Chip tone="warning">
                              {TAG_LABEL[choice.tag] ?? choice.tag}
                            </Chip>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </TableCell>

                  <TableCell>
                    {canDecide ? (
                      <div
                        role="group"
                        aria-label="Keputusan pilihan ini"
                        className="flex flex-wrap gap-1"
                      >
                        <Button
                          size="sm"
                          aria-pressed={target.decision === 'terima'}
                          variant={
                            target.decision === 'terima'
                              ? 'dark_blue'
                              : 'dark_blue_outline'
                          }
                          onClick={() => onDecide(target, 'terima')}
                        >
                          Terima
                        </Button>
                        <Button
                          size="sm"
                          aria-pressed={target.decision === 'tolak'}
                          variant={
                            target.decision === 'tolak'
                              ? 'warning'
                              : 'warning_outline'
                          }
                          onClick={() => onDecide(target, 'tolak')}
                        >
                          Tolak
                        </Button>
                      </div>
                    ) : target.decision === 'terima' ? (
                      <Chip tone="success">Diterima</Chip>
                    ) : target.decision === 'tolak' ? (
                      <Chip tone="danger">Ditolak</Chip>
                    ) : (
                      <span className="text-xs text-neutral-700">
                        {REASON_LABEL[target.stageReason] ?? 'Menunggu'}
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {canAppeal ? (
                        <Button
                          size="sm"
                          variant="dark_blue_outline"
                          onClick={() => onAppeal(target)}
                        >
                          Terima lewat banding
                        </Button>
                      ) : null}
                      {canRequest ? (
                        <Button
                          size="sm"
                          variant="dark_blue_outline"
                          onClick={() => onRequestTransfer(row)}
                        >
                          Minta pindah…
                        </Button>
                      ) : null}
                      {canMove ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onMove(row)}
                        >
                          Pindahkan…
                        </Button>
                      ) : null}
                    </div>
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
          {data.total} pendaftar · halaman {page} dari {pages}
        </span>
      </div>
    </div>
  );
}
