'use client';

import { Download, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { Button } from '~/components/ui/button';
import { type RouterOutputs, api } from '~/trpc/react';

import {
  Chip,
  ErrorNote,
  Loading,
  Notice,
  inputClass,
  selectClass,
  when,
} from '../placement/shared';
import { DivisionSummary, type AcceptedNames } from './division-summary';
import { ReleasePanel } from './release-panel';
import { ResultsTable, type ResultRow } from './results-table';

type Overview = RouterOutputs['oprec']['resultsOverview'];
type FinalStatus = ResultRow['finalStatus'];

const PAGE_SIZE = 25;

const STATE_LABEL: Record<Overview['state'], string> = {
  berjalan: 'Berjalan',
  masa_banding: 'Masa banding',
  final: 'Final',
};

const FINAL_OPTIONS: [FinalStatus, string][] = [
  ['diterima', 'Diterima'],
  ['tidak_diterima', 'Tidak diterima'],
  ['belum_diputuskan', 'Belum diputuskan'],
];

const EMPTY_ALL = { status: '' as FinalStatus | '', rows: [] as ResultRow[] };

/** Layar Hasil: rekap, peringatan, rilis, dan tabel seluruh pendaftar. */
export function HasilView({
  recruitmentId,
  periodName,
  backHref,
  penempatanHref,
  acceptedByDivision,
  tabs,
}: {
  recruitmentId: string;
  periodName: string;
  backHref?: string;
  penempatanHref?: string;
  acceptedByDivision: AcceptedNames;
  tabs?: React.ReactNode;
}) {
  const utils = api.useUtils();
  const overview = api.oprec.resultsOverview.useQuery(
    { recruitmentId },
    { retry: false },
  );
  const [search, setSearch] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [pageState, setPageState] = useState({ key: '', page: 1 });
  const [announcement, setAnnouncement] = useState('');
  const [error, setError] = useState('');
  const [all, setAll] = useState<{
    status: FinalStatus | '';
    rows: ResultRow[];
    loading: boolean;
    error: string;
  }>({ ...EMPTY_ALL, loading: false, error: '' });

  const deferredSearch = useDeferredValue(search.trim());
  const filterKey = JSON.stringify({
    search: deferredSearch,
    divisionId,
    status: all.status,
  });
  const page = pageState.key === filterKey ? pageState.page : 1;

  const list = api.oprec.resultsList.useQuery(
    {
      recruitmentId,
      divisionId: divisionId || undefined,
      search: deferredSearch || undefined,
      page,
      pageSize: PAGE_SIZE,
    },
    {
      enabled: all.status === '',
      placeholderData: (previous) => previous,
    },
  );
  // Jumlah pendaftar keseluruhan untuk ringkasan rilis.
  const totals = api.oprec.resultsList.useQuery({
    recruitmentId,
    page: 1,
    pageSize: 1,
  });

  const announce = (message: string) => {
    setError('');
    setAnnouncement(message);
  };
  const refresh = () => {
    void utils.oprec.resultsOverview.invalidate({ recruitmentId });
    void utils.oprec.resultsList.invalidate();
    void utils.oprec.resultsList.invalidate({ recruitmentId, page: 1, pageSize: 1 });
  };
  const resetAll = () => {
    setAll({ ...EMPTY_ALL, loading: false, error: '' });
    setPageState({ key: '', page: 1 });
  };

  const fetchAllForStatus = async (status: FinalStatus) => {
    setAll({ status, rows: [], loading: true, error: '' });
    try {
      const collected: ResultRow[] = [];
      for (let next = 1; ; next++) {
        const data = await utils.oprec.resultsList.fetch({
          recruitmentId,
          divisionId: divisionId || undefined,
          search: deferredSearch || undefined,
          page: next,
          pageSize: 100,
        });
        collected.push(...data.rows);
        if (collected.length >= data.total || data.rows.length === 0) break;
      }
      setAll({
        status,
        rows: collected.filter((row) => row.finalStatus === status),
        loading: false,
        error: '',
      });
      setPageState({
        key: JSON.stringify({ search: deferredSearch, divisionId, status }),
        page: 1,
      });
    } catch (err) {
      setAll({
        status,
        rows: [],
        loading: false,
        error: err instanceof Error ? err.message : 'Gagal memuat hasil.',
      });
    }
  };

  const setStatusFilter = (value: FinalStatus | '') => {
    setPageState({ key: '', page: 1 });
    if (value === '') {
      setAll({ ...EMPTY_ALL, loading: false, error: '' });
      return;
    }
    void fetchAllForStatus(value);
  };
  const setDivisionFilter = (value: string) => {
    setDivisionId(value);
    resetAll();
  };
  const setSearchFilter = (value: string) => {
    setSearch(value);
    resetAll();
  };

  const localRows =
    all.status === ''
      ? null
      : all.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rows = localRows ?? list.data?.rows ?? [];
  const total = localRows ? all.rows.length : (list.data?.total ?? 0);
  const loading = all.status === '' ? list.isFetching : all.loading;

  const divisions = overview.data?.divisions ?? [];
  const activeDivision = divisions.find(
    (division) => division.id === divisionId,
  );
  const hasFilter = search !== '' || divisionId !== '' || all.status !== '';
  const overallTotal = totals.data?.total ?? 0;

  return (
    <div className="py-6 sm:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {backHref ? (
            <Link
              href={backHref}
              className="text-sm text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              ← Kembali ke oprec
            </Link>
          ) : null}
          <h1 className="mt-2 break-words text-2xl font-semibold text-neutral-1000 sm:text-[32px]">
            Hasil
          </h1>
          <p className="mt-1 text-sm text-neutral-700">
            {overview.data?.name ?? 'Oprec'}
            {periodName ? ` · ${periodName}` : ''}. Rekap akhir dan rilis ke
            pendaftar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['csv', 'xlsx'] as const).map((format) => (
            <Button
              key={format}
              asChild
              variant="dark_blue_outline"
              aria-disabled={overallTotal === 0}
              className={
                overallTotal === 0 ? 'pointer-events-none opacity-50' : ''
              }
            >
              <a
                href={`/api/oprec/${recruitmentId}/hasil?format=${format}`}
                download
                tabIndex={overallTotal === 0 ? -1 : undefined}
              >
                <Download /> Ekspor {format.toUpperCase()}
              </a>
            </Button>
          ))}
        </div>
      </header>

      {tabs}

      <div role="status" className="sr-only">
        {announcement}
      </div>
      {error ? (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      {overview.isError ? (
        <div className="mt-6">
          <ErrorNote message={overview.error.message} />
        </div>
      ) : overview.isLoading || !overview.data ? (
        <Loading label="Memuat hasil…" />
      ) : (
        <>
          <section
            aria-label="Keadaan hasil"
            className="mt-6 grid gap-2 rounded-[24px] border border-neutral-400 bg-neutral-50 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-neutral-1000">
                Keadaan
              </span>
              <Chip
                tone={overview.data.state === 'final' ? 'success' : 'primary'}
              >
                {STATE_LABEL[overview.data.state]}
              </Chip>
              {overview.data.released ? (
                <Chip tone="success">
                  Dirilis {when(overview.data.releasedAt)}
                </Chip>
              ) : (
                <Chip tone="muted">Belum dirilis</Chip>
              )}
            </div>
            {overview.data.warnings.undecided > 0 ? (
              <div className="rounded-xl bg-warning-light px-3 py-2 text-sm text-neutral-1000">
                <p className="font-semibold">
                  {overview.data.warnings.undecided} pilihan aktif belum
                  diputuskan.
                </p>
                <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                  {overview.data.warnings.perDivision.map((row) => (
                    <span key={row.divisionId}>
                      {row.label}: {row.pending}
                    </span>
                  ))}
                </p>
                {penempatanHref ? (
                  <Link
                    href={penempatanHref}
                    className="mt-2 inline-block font-semibold text-primary-500 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    Buka Penempatan
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-neutral-700">
                Semua pilihan aktif sudah diputuskan.
              </p>
            )}
          </section>

          <ReleasePanel
            recruitmentId={recruitmentId}
            overview={overview.data}
            total={overallTotal}
            penempatanHref={penempatanHref}
            announce={announce}
            onError={setError}
            onChanged={refresh}
          />

          <DivisionSummary
            divisions={divisions}
            acceptedByDivision={acceptedByDivision}
            onPickDivision={(id) => {
              setDivisionFilter(id);
              document
                .getElementById('hasil-table')
                ?.scrollIntoView({ block: 'start' });
            }}
          />

          <section
            id="hasil-table"
            aria-label="Semua pendaftar"
            className="mt-8 scroll-mt-4"
          >
            <h2 className="text-lg font-semibold text-neutral-1000">
              Semua pendaftar
            </h2>
            <div className="mt-3 grid gap-3 rounded-[24px] border border-neutral-400 bg-neutral-50 p-4 sm:p-5">
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearchFilter(event.target.value)}
                  placeholder="Cari nama atau NIM"
                  aria-label="Cari nama atau NIM"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                  Divisi
                  <select
                    className={selectClass}
                    value={divisionId}
                    onChange={(event) =>
                      setDivisionFilter(event.target.value)
                    }
                  >
                    <option value="">Semua divisi</option>
                    {divisions.map((division) => (
                      <option key={division.id} value={division.id}>
                        {division.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                  Status akhir
                  <select
                    className={selectClass}
                    value={all.status}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as FinalStatus | '',
                      )
                    }
                  >
                    <option value="">Semua status</option>
                    {FINAL_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {hasFilter ? (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setDivisionId('');
                      setStatusFilter('');
                    }}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    <X className="size-4" /> Hapus semua saringan
                  </button>
                </div>
              ) : null}
              {all.status !== '' ? (
                <p className="text-xs text-neutral-700">
                  Saringan status memuat semua pendaftar lebih dulu, lalu
                  menampilkan halaman dari hasil yang cocok.
                </p>
              ) : null}
            </div>

            <div className="mt-4" role="region" aria-label="Tabel hasil">
              {all.error ? (
                <ErrorNote message={all.error} />
              ) : list.isError && all.status === '' ? (
                <ErrorNote message={list.error.message} />
              ) : all.loading ||
                (all.status === '' && (list.isLoading || !list.data)) ? (
                <Loading label="Memuat pendaftar…" />
              ) : rows.length === 0 ? (
                <Notice>
                  {hasFilter
                    ? 'Tidak ada pendaftar yang cocok dengan saringan.'
                    : 'Belum ada pendaftar di oprec ini.'}
                </Notice>
              ) : (
                <>
                  <p className="mb-2 text-sm text-neutral-700">
                    Tanpa data sensitif di ekspor.
                    {activeDivision
                      ? ` Divisi: ${activeDivision.label}.`
                      : ''}
                  </p>
                  <ResultsTable
                    rows={rows}
                    total={total}
                    page={page}
                    pageSize={PAGE_SIZE}
                    loading={loading}
                    onPage={(next) =>
                      setPageState({ key: filterKey, page: next })
                    }
                  />
                </>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
