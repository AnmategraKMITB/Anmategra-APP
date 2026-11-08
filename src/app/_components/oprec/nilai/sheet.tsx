'use client';

import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { type RouterOutputs, api } from '~/trpc/react';

import { StatusBadge } from './status';

const PAGE_SIZE = 50;

type Queue = RouterOutputs['oprec']['assessQueue'];
type QueueCriterion = Queue['criteria'][number];
type QueueRow = Queue['rows'][number];
type QueueValue = NonNullable<NonNullable<QueueRow['values']>[string]>;
type GateState = NonNullable<QueueValue['gateState']>;

type SaveValue = {
  rating?: number | null;
  gateState?: GateState | null;
};

function parseGateState(raw: string): GateState | null {
  return raw === 'memenuhi' || raw === 'ditinjau' || raw === 'tidak'
    ? raw
    : null;
}

const selectClass =
  'h-9 w-full min-w-24 rounded-lg border border-neutral-400 bg-neutral-50 px-2 text-sm text-neutral-1000 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50';

export function SheetView({
  recruitmentId,
  scope,
  ratingMin,
  ratingMax,
}: {
  recruitmentId: string;
  scope: string;
  ratingMin: number;
  ratingMax: number;
}) {
  const [search, setSearch] = useState('');
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [pageState, setPageState] = useState({ key: '', page: 1 });
  const [error, setError] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(search.trim());
  const filterKey = JSON.stringify({
    search: deferredSearch,
    onlyIncomplete,
  });
  const page = pageState.key === filterKey ? pageState.page : 1;

  const meta = api.oprec.assessScopes.useQuery({ recruitmentId });
  const blind = meta.data?.blind ?? false;

  const queue = api.oprec.assessQueue.useQuery(
    {
      recruitmentId,
      scope,
      search: deferredSearch === '' ? undefined : deferredSearch,
      onlyIncomplete,
      page,
      pageSize: PAGE_SIZE,
      withValues: true,
    },
    { placeholderData: (previous) => previous },
  );

  const utils = api.useUtils();
  const save = api.oprec.assessSave.useMutation();

  const criteria = queue.data?.criteria ?? [];
  const rows = queue.data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((queue.data?.total ?? 0) / PAGE_SIZE));
  const ratings = Array.from(
    { length: Math.max(0, ratingMax - ratingMin + 1) },
    (_, index) => ratingMin + index,
  );

  const update = (
    row: QueueRow,
    criterion: QueueCriterion,
    value: SaveValue,
  ) => {
    const first = row.choices[0];
    if (scope !== 'umum' && !first) return;
    const existing = row.values?.[criterion.id] ?? null;
    setError(null);
    save.mutate(
      {
        recruitmentId,
        applicationId: row.id,
        criterionId: criterion.id,
        choiceId: scope === 'umum' ? null : (first?.id ?? null),
        rating: value.rating ?? null,
        gateState: value.gateState ?? null,
        note: existing?.note ?? null,
      },
      {
        onSuccess: () => {
          void Promise.all([
            utils.oprec.assessQueue.invalidate(),
            utils.oprec.assessGet.invalidate(),
          ]);
        },
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

  const sticky = 'sticky left-0 z-10 bg-neutral-50';

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {blind ? null : (
          <div className="relative min-w-56 flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama atau NIM"
              aria-label="Cari nama atau NIM"
              className="h-9 w-full rounded-lg border border-neutral-400 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-1000 placeholder:text-neutral-500 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            />
          </div>
        )}
        <button
          type="button"
          aria-pressed={onlyIncomplete}
          onClick={() => setOnlyIncomplete((value) => !value)}
          className={`inline-flex h-8 items-center rounded-full border px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
            onlyIncomplete
              ? 'border-primary-300 bg-primary-100 text-primary-500'
              : 'border-neutral-400 bg-neutral-50 text-neutral-700 hover:border-primary-300'
          }`}
        >
          Belum selesai
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
        >
          Nilai belum tersimpan: {error}
        </p>
      ) : null}

      {queue.isError ? (
        <p
          role="alert"
          className="rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
        >
          Antrean belum bisa dimuat: {queue.error.message}
        </p>
      ) : !queue.data ? (
        <p role="status" className="py-10 text-center text-sm text-neutral-700">
          Memuat antrean…
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-[24px] border border-neutral-400 bg-neutral-50 p-8 text-center text-sm text-neutral-700">
          Tidak ada pendaftar yang cocok.
        </p>
      ) : (
        <div
          className="overflow-x-auto rounded-[24px] border border-neutral-400 bg-neutral-50"
          aria-busy={queue.isFetching}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={`${sticky} min-w-56`}>
                  Pendaftar
                </TableHead>
                <TableHead className="whitespace-nowrap">Gelombang</TableHead>
                {criteria.map((criterion) => (
                  <TableHead key={criterion.id} className="whitespace-nowrap">
                    {criterion.name}
                  </TableHead>
                ))}
                {scope === 'umum' ? (
                  <TableHead className="whitespace-nowrap">
                    Status pilihan
                  </TableHead>
                ) : (
                  <>
                    <TableHead className="whitespace-nowrap">Nilai</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const first = row.choices[0];
                return (
                  <TableRow
                    key={row.id}
                    aria-disabled={!row.open}
                    className={row.open ? undefined : 'opacity-50'}
                  >
                    <TableCell className={`${sticky} min-w-56`}>
                      <span className="block text-sm font-semibold text-neutral-1000">
                        {row.name ?? row.code}
                      </span>
                      {row.progress.total > 0 ? (
                        <span className="mt-0.5 block text-xs text-neutral-700">
                          {row.progress.done}/{row.progress.total} dinilai
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-neutral-700">
                      {row.waveLabel ?? '—'}
                    </TableCell>
                    {criteria.map((criterion) => {
                      const value = row.values?.[criterion.id] ?? null;
                      const rating = value?.rating ?? null;
                      const gateState = value?.gateState ?? null;
                      return (
                        <TableCell key={criterion.id}>
                          {criterion.kind === 'skor' ? (
                            <select
                              aria-label={`${criterion.name} ${row.name ?? row.code}`}
                              value={rating === null ? '' : String(rating)}
                              disabled={!row.open}
                              onChange={(event) => {
                                const raw = event.target.value;
                                update(row, criterion, {
                                  rating: raw === '' ? null : Number(raw),
                                  gateState: null,
                                });
                              }}
                              className={selectClass}
                            >
                              <option value="">—</option>
                              {ratings.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : criterion.kind === 'gugur_manual' ? (
                            <select
                              aria-label={`${criterion.name} ${row.name ?? row.code}`}
                              value={gateState ?? ''}
                              disabled={!row.open}
                              onChange={(event) => {
                                const raw = event.target.value;
                                update(row, criterion, {
                                  rating: null,
                                  gateState: parseGateState(raw),
                                });
                              }}
                              className={selectClass}
                            >
                              <option value="">—</option>
                              <option value="memenuhi">Memenuhi</option>
                              <option value="ditinjau">Perlu ditinjau</option>
                              <option value="tidak">Tidak memenuhi</option>
                            </select>
                          ) : (
                            <span className="text-sm text-neutral-500">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                    {scope === 'umum' ? (
                      <TableCell>
                        {row.choices.length === 0 ? (
                          <span className="text-sm text-neutral-500">—</span>
                        ) : (
                          <span className="flex flex-wrap gap-1.5">
                            {row.choices.map((choice) => (
                              <span
                                key={choice.id}
                                className="inline-flex items-center gap-1.5"
                              >
                                <span className="text-xs text-neutral-700">
                                  {choice.label}
                                </span>
                                <StatusBadge status={choice.status} />
                              </span>
                            ))}
                          </span>
                        )}
                      </TableCell>
                    ) : (
                      <>
                        <TableCell className="whitespace-nowrap text-sm font-semibold text-neutral-1000">
                          {typeof first?.score === 'number'
                            ? Math.round(first.score)
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={first?.status} />
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {queue.data ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-700">
          <span>
            {queue.data.total} pendaftar · halaman {page} dari {pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="dark_blue_outline"
              size="sm"
              disabled={page <= 1 || queue.isFetching}
              onClick={() => setPageState({ key: filterKey, page: page - 1 })}
            >
              <ChevronLeft /> Sebelumnya
            </Button>
            <Button
              variant="dark_blue_outline"
              size="sm"
              disabled={page >= pages || queue.isFetching}
              onClick={() => setPageState({ key: filterKey, page: page + 1 })}
            >
              Berikutnya <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
