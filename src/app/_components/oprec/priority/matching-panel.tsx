'use client';

import { Play, Search } from 'lucide-react';
import { useState } from 'react';
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

import {
  Chip,
  ErrorNote,
  Loading,
  Modal,
  inputClass,
} from '../placement/shared';
import { type FilterGroup, MultiFilter } from './multi-filter';

type Overview = RouterOutputs['oprec']['priorityOverview'];
type Preview = RouterOutputs['oprec']['matchingPreview'];
type Step = Preview['rows'][number]['steps'][number];

const NONE = '__none__';

/** Divisi dikelompokkan per bidang untuk saringan bertingkat. */
function groupDivisions(
  divisions: { id: string; label: string; groupLabel: string | null }[],
): FilterGroup[] {
  const groups = new Map<string, FilterGroup>();
  for (const d of divisions) {
    const key = d.groupLabel ?? '';
    const group = groups.get(key) ?? { label: d.groupLabel, options: [] };
    group.options.push({ value: d.id, label: d.label });
    groups.set(key, group);
  }
  return [...groups.values()];
}

const OUTCOME_LABEL: Record<Step['outcome'], string> = {
  diterima: 'diterima',
  tergeser: 'kuota penuh oleh urutan yang lebih baik',
  tidak_diprioritaskan: 'tidak diurutkan',
  tidak_lolos: 'tidak lolos',
  tidak_diproses: 'tidak diproses (sudah diterima di atasnya)',
};

/** Satu langkah jejak, mis. "Logistik (pilihan 1), urutan 23: kuota penuh…". */
export function stepText(step: Step) {
  const via =
    step.choiceRank === null ? 'dipindahkan' : `pilihan ${step.choiceRank}`;
  const rank =
    step.priorityRank === null ? '' : `, urutan ${step.priorityRank}`;
  return `${step.label} (${via}${rank}): ${OUTCOME_LABEL[step.outcome]}`;
}

/** Panel admin: status kunci tiap divisi, pratinjau, dan penerapan penempatan. */
export function MatchingPanel({
  recruitmentId,
  overview,
  onChanged,
  announce,
  onError,
}: {
  recruitmentId: string;
  overview: Overview;
  onChanged: () => void;
  announce: (message: string) => void;
  onError: (message: string) => void;
}) {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [fakultasFilter, setFakultasFilter] = useState<string[]>([]);
  /** id divisi hasil penempatan; NONE = tidak ditempatkan. */
  const [divisionFilter, setDivisionFilter] = useState<string[]>([]);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const preview = api.oprec.matchingPreview.useQuery(
    { recruitmentId },
    { enabled: open, retry: false },
  );
  const applyMutation = api.oprec.matchingApply.useMutation();
  const setMethod = api.oprec.prioritySetMethod.useMutation();
  const [confirmManual, setConfirmManual] = useState(false);

  const lockedCount = overview.divisions.filter((d) => d.lockedAt).length;
  const running = overview.state === 'berjalan';

  const apply = () => {
    applyMutation.mutate(
      { recruitmentId },
      {
        onSuccess: (result) => {
          setOpen(false);
          announce(
            `Penempatan diterapkan: ${result.placed} ditempatkan, ${result.unplaced} tidak ditempatkan.`,
          );
          void utils.oprec.placementOverview.invalidate({ recruitmentId });
          void utils.oprec.placementRows.invalidate();
          onChanged();
        },
        onError: (error) => onError(error.message),
      },
    );
  };

  const backToManual = () => {
    setMethod.mutate(
      { recruitmentId, method: 'manual' },
      {
        onSuccess: () => {
          setConfirmManual(false);
          announce('Metode penempatan kembali ke manual.');
          onChanged();
        },
        onError: (error) => onError(error.message),
      },
    );
  };

  const data = preview.data;
  const needle = search.trim().toLowerCase();
  const rows = (data?.rows ?? []).filter(
    (row) =>
      (!onlyChanged || row.changed) &&
      (!needle ||
        (row.name ?? '').toLowerCase().includes(needle) ||
        String(row.nim ?? '').includes(needle)) &&
      (fakultasFilter.length === 0 ||
        fakultasFilter.includes(row.fakultas ?? NONE)) &&
      (divisionFilter.length === 0 ||
        divisionFilter.includes(row.after?.divisionId ?? NONE)),
  );
  const fakultasGroups: FilterGroup[] = [
    {
      label: null,
      options: [
        ...[...new Set((data?.rows ?? []).map((r) => r.fakultas ?? NONE))]
          .sort()
          .map((f) => ({
            value: f,
            label: f === NONE ? 'Tidak diketahui' : f,
          })),
      ],
    },
  ];
  const divisionGroups: FilterGroup[] = [
    ...groupDivisions(data?.divisions ?? []),
    { label: null, options: [{ value: NONE, label: 'Tidak ditempatkan' }] },
  ];

  return (
    <section
      aria-label="Penempatan otomatis"
      className="mt-6 grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-neutral-1000">
            Penempatan otomatis
          </h2>
          <p className="mt-1 text-sm text-neutral-700">
            {lockedCount} dari {overview.divisions.length} daftar terkunci ·{' '}
            {overview.registrationEnded
              ? 'pendaftaran sudah berakhir'
              : 'pendaftaran masih berjalan'}
            {running ? '' : ' · penempatan sudah lewat tahap berjalan'}.
          </p>
          <p className="mt-1 text-sm text-neutral-700">
            Sistem menempatkan tiap pendaftar di pilihan tertinggi yang
            mengurutkannya, mengikuti kuota. Keputusan terima/tolak dan
            organogram diisi otomatis; menjalankan ulang mengganti hasil
            sebelumnya.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {running ? (
            <Button
              size="sm"
              variant="dark_blue_outline"
              onClick={() => setConfirmManual(true)}
            >
              Kembali ke manual
            </Button>
          ) : null}
          <Button size="sm" variant="dark_blue" onClick={() => setOpen(true)}>
            <Play /> Pratinjau penempatan
          </Button>
        </div>
      </div>

      <Modal
        open={open}
        onOpenChange={setOpen}
        wide
        title="Pratinjau penempatan"
        description="Hasil dihitung dari daftar prioritas yang tersimpan. Belum ada yang berubah sampai kamu menekan Terapkan."
        footer={
          <>
            <Button variant="dark_blue_outline" onClick={() => setOpen(false)}>
              Tutup
            </Button>
            <Button
              variant="dark_blue"
              disabled={
                !data || data.problems.length > 0 || applyMutation.isPending
              }
              onClick={apply}
            >
              {applyMutation.isPending ? 'Menerapkan…' : 'Terapkan'}
            </Button>
          </>
        }
      >
        {preview.isError ? (
          <ErrorNote message={preview.error.message} />
        ) : !data ? (
          <Loading label="Menghitung penempatan…" />
        ) : (
          <>
            {data.problems.length > 0 ? (
              <div
                role="alert"
                className="rounded-xl bg-warning-light px-4 py-3 text-sm text-neutral-1000"
              >
                <p className="font-semibold">Belum bisa diterapkan:</p>
                <ul className="mt-1 list-disc pl-5">
                  {data.problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="text-sm text-neutral-1000">
              {data.totals.placed} dari {data.totals.applicants} pendaftar
              ditempatkan
              {data.totals.redirected > 0
                ? ` (${data.totals.redirected} di luar pilihannya)`
                : ''}
              . {data.totals.changed} berbeda dari keputusan saat ini
              {data.totals.replacedDecisions > 0
                ? `; ${data.totals.replacedDecisions} keputusan yang ada akan diganti`
                : ''}
              .
            </p>
            {data.totals.ignoredTidakLolos +
              data.totals.ignoredCloserec +
              data.totals.ignoredOther >
            0 ? (
              <p className="text-sm text-neutral-700">
                Urutan yang diabaikan: {data.totals.ignoredTidakLolos} tidak
                lolos, {data.totals.ignoredCloserec} sudah closerec,{' '}
                {data.totals.ignoredOther} bukan kandidat lagi.
              </p>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-neutral-400">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Divisi</TableHead>
                    <TableHead>Diterima</TableHead>
                    <TableHead>Batas urutan</TableHead>
                    <TableHead>Daftar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.divisions.map((division) => (
                    <TableRow key={division.id}>
                      <TableCell className="font-semibold text-neutral-1000">
                        {division.label}
                      </TableCell>
                      <TableCell>
                        {division.accepted} /{' '}
                        {division.quota === 0 ? '∞' : division.quota}
                      </TableCell>
                      <TableCell>
                        {division.cutoff === null
                          ? 'tidak penuh'
                          : `urutan ${division.cutoff}`}
                      </TableCell>
                      <TableCell>
                        {division.lockedAt ? (
                          <Chip tone="success">Terkunci</Chip>
                        ) : (
                          <Chip tone="warning">Belum dikunci</Chip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-48 flex-1">
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
                  className={`${inputClass} pl-9`}
                />
              </div>
              <MultiFilter
                label="Fakultas"
                allLabel="Semua fakultas"
                groups={fakultasGroups}
                selected={fakultasFilter}
                onChange={setFakultasFilter}
              />
              <MultiFilter
                label="Bidang/divisi hasil"
                allLabel="Semua divisi"
                groups={divisionGroups}
                selected={divisionFilter}
                onChange={setDivisionFilter}
              />
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={onlyChanged}
                  onChange={(event) => setOnlyChanged(event.target.checked)}
                />
                Hanya yang berubah
              </label>
            </div>

            <div className="overflow-x-auto rounded-xl border border-neutral-400">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-40">Pendaftar</TableHead>
                    <TableHead className="min-w-36">Hasil</TableHead>
                    <TableHead className="min-w-72">Penjelasan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.applicationId} className="align-top">
                      <TableCell>
                        <span className="font-semibold text-neutral-1000">
                          {row.name ?? 'Tanpa nama'}
                        </span>
                        <span className="block text-xs text-neutral-700">
                          {row.nim ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.after ? (
                          <Chip tone="success">{row.after.label}</Chip>
                        ) : (
                          <Chip tone="muted">Tidak ditempatkan</Chip>
                        )}
                        {row.changed ? (
                          <span className="mt-1 block text-xs text-neutral-700">
                            Sebelumnya: {row.before?.label ?? 'belum ada'}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <ol className="list-decimal space-y-0.5 pl-4 text-xs text-neutral-700">
                          {row.steps.map((step) => (
                            <li key={step.divisionId}>{stepText(step)}</li>
                          ))}
                        </ol>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={confirmManual}
        onOpenChange={setConfirmManual}
        title="Kembali ke penempatan manual?"
        description="Daftar prioritas tetap tersimpan. Keputusan yang sudah diterapkan tidak dihapus; terima/tolak kembali dilakukan per pilihan dan status lulus kembali memakai pemotongan kuota."
        footer={
          <>
            <Button
              variant="dark_blue_outline"
              onClick={() => setConfirmManual(false)}
            >
              Batal
            </Button>
            <Button
              variant="dark_blue"
              disabled={setMethod.isPending}
              onClick={backToManual}
            >
              Pakai manual
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Bisa dinyalakan lagi kapan saja selama penempatan berjalan.
        </p>
      </Modal>
    </section>
  );
}
