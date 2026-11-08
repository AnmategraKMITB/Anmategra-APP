'use client';

import { Download, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

import { ApplicantSheet } from './applicant-sheet';
import { ApplicantsSummary } from './applicants-summary';
import { ApplicantsTable } from './applicants-table';

const PAGE_SIZE = 50;

const SORTS = [
  ['nama', 'Nama'],
  ['gelombang', 'Gelombang'],
  ['angkatan', 'Angkatan'],
  ['prodi', 'Program studi'],
  ['waktu', 'Terbaru dikirim'],
] as const;

const GROUPS = [
  ['tanpa', 'Tanpa'],
  ['gelombang', 'Gelombang'],
  ['pilihan1', 'Pilihan 1'],
  ['angkatan', 'Angkatan'],
  ['prodi', 'Program studi'],
] as const;

type Sort = (typeof SORTS)[number][0];
type Group = (typeof GROUPS)[number][0];

const selectClass =
  'h-9 w-full rounded-lg border border-neutral-400 bg-neutral-50 px-3 text-sm text-neutral-1000 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-neutral-700">
      {label}
      {children}
    </label>
  );
}

/** Layar Pendaftar: ringkasan baca-saja, saringan, tabel, dan berkas per pendaftar. */
export function ApplicantsView({
  recruitmentId,
  name,
  periodName,
  backHref,
}: {
  recruitmentId: string;
  name: string;
  periodName: string;
  backHref: string;
}) {
  const [search, setSearch] = useState('');
  const [waveId, setWaveId] = useState('');
  const [divisionId, setDivisionId] = useState<string | undefined>();
  const [angkatan, setAngkatan] = useState('');
  const [prodi, setProdi] = useState('');
  const [sort, setSort] = useState<Sort>('nama');
  const [groupBy, setGroupBy] = useState<Group>('tanpa');
  const [pageState, setPageState] = useState({ key: '', page: 1 });
  const [openId, setOpenId] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(search.trim());
  const filters = {
    search: deferredSearch || undefined,
    waveId: waveId || undefined,
    divisionId,
    angkatan: angkatan ? Number(angkatan) : undefined,
    prodi: prodi || undefined,
    sort,
    groupBy,
  };
  // Halaman kembali ke 1 setiap kali saringan berubah, tanpa efek samping.
  const key = JSON.stringify(filters);
  const page = pageState.key === key ? pageState.page : 1;

  const summary = api.oprec.applicantSummary.useQuery({ recruitmentId });
  const list = api.oprec.applicants.useQuery(
    { recruitmentId, ...filters, page, pageSize: PAGE_SIZE },
    { placeholderData: (previous) => previous },
  );

  const hasFilter =
    search !== '' ||
    waveId !== '' ||
    divisionId !== undefined ||
    angkatan !== '' ||
    prodi !== '';
  const reset = () => {
    setSearch('');
    setWaveId('');
    setDivisionId(undefined);
    setAngkatan('');
    setProdi('');
  };
  const total = summary.data?.total;
  const exportHref = (format: 'csv' | 'xlsx') =>
    `/api/oprec/${recruitmentId}/pendaftar?format=${format}`;
  const exportDisabled = !total;

  return (
    <div className="py-6 sm:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={backHref}
            className="text-sm text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            ← Kembali ke oprec
          </Link>
          <h1 className="mt-2 break-words text-2xl font-semibold text-neutral-1000 sm:text-[32px]">
            Pendaftar
          </h1>
          <p className="mt-1 text-sm text-neutral-700">
            {name}
            {periodName ? ` · ${periodName}` : ''}. Klik satu baris untuk
            membuka berkasnya.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['csv', 'xlsx'] as const).map((format) => (
            <Button
              key={format}
              asChild
              variant="dark_blue_outline"
              aria-disabled={exportDisabled}
              className={exportDisabled ? 'pointer-events-none opacity-50' : ''}
            >
              <a
                href={exportHref(format)}
                download
                tabIndex={exportDisabled ? -1 : undefined}
              >
                <Download /> Ekspor {format.toUpperCase()}
              </a>
            </Button>
          ))}
        </div>
      </header>

      <div className="mt-6">
        {summary.isError ? (
          <ErrorNote message={summary.error.message} />
        ) : summary.data ? (
          <ApplicantsSummary
            data={summary.data}
            activeDivisionId={divisionId}
            onPickDivision={setDivisionId}
          />
        ) : (
          <Loading label="Memuat ringkasan…" />
        )}
      </div>

      <section
        aria-label="Saringan pendaftar"
        className="mt-6 grid gap-3 rounded-[24px] border border-neutral-400 bg-neutral-50 p-4 sm:p-5"
      >
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau NIM"
            aria-label="Cari nama atau NIM"
            className="h-9 w-full rounded-lg border border-neutral-400 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-1000 placeholder:text-neutral-500 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Field label="Gelombang">
            <select
              className={selectClass}
              value={waveId}
              onChange={(e) => setWaveId(e.target.value)}
            >
              <option value="">Semua</option>
              {summary.data?.byWave
                .filter((w) => w.waveId)
                .map((w) => (
                  <option key={w.waveId} value={w.waveId!}>
                    {w.label}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Tujuan">
            <select
              className={selectClass}
              value={divisionId ?? ''}
              title="Pendaftar yang memilih tujuan ini di pilihan mana pun"
              onChange={(e) => setDivisionId(e.target.value || undefined)}
            >
              <option value="">Semua</option>
              {summary.data?.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Angkatan">
            <select
              className={selectClass}
              value={angkatan}
              onChange={(e) => setAngkatan(e.target.value)}
            >
              <option value="">Semua</option>
              {summary.data?.angkatan.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Program studi">
            <select
              className={selectClass}
              value={prodi}
              onChange={(e) => setProdi(e.target.value)}
            >
              <option value="">Semua</option>
              {summary.data?.prodi.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kelompokkan">
            <select
              className={selectClass}
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as Group)}
            >
              {GROUPS.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Urutkan">
            <select
              className={selectClass}
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              {SORTS.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {hasFilter ? (
          <div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <X className="size-4" /> Hapus semua saringan
            </button>
          </div>
        ) : null}
      </section>

      <div className="mt-6" role="region" aria-label="Daftar pendaftar">
        {list.isError ? (
          <ErrorNote message={list.error.message} />
        ) : list.data ? (
          list.data.total === 0 ? (
            <p className="rounded-[24px] border border-neutral-400 bg-neutral-50 p-8 text-center text-neutral-700">
              {hasFilter
                ? 'Tidak ada pendaftar yang cocok dengan saringan.'
                : 'Belum ada yang mendaftar.'}
            </p>
          ) : (
            <ApplicantsTable
              data={list.data}
              maxChoices={summary.data?.maxChoices ?? 3}
              groupLabel={
                groupBy === 'tanpa'
                  ? null
                  : (GROUPS.find(([v]) => v === groupBy)?.[1] ?? null)
              }
              page={page}
              onPage={(p) => setPageState({ key, page: p })}
              loading={list.isFetching}
              onOpen={setOpenId}
            />
          )
        ) : (
          <Loading label="Memuat pendaftar…" />
        )}
      </div>

      <ApplicantSheet
        recruitmentId={recruitmentId}
        applicationId={openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <p role="status" className="py-10 text-center text-neutral-700">
      {label}
    </p>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
    >
      Data belum bisa dimuat: {message}
    </p>
  );
}
