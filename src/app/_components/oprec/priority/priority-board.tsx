'use client';

import {
  ArrowDown,
  ArrowUp,
  ListOrdered,
  Lock,
  LockOpen,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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

import { StatusBadge } from '../nilai/status';
import {
  Chip,
  ErrorNote,
  Loading,
  Modal,
  Notice,
  inputClass,
  when,
} from '../placement/shared';
import { PriorityAnswersSheet } from './answers-sheet';
import { moveTo, parsePosition, remove, shift } from './order';
import { PageSizeSelect, Pager, pageCount, pageOf, pageSlice } from './pager';

type Board = RouterOutputs['oprec']['priorityBoard'];
type Row = Board['rows'][number];

/** Urutan yang sedang disunting; `base` = versi server tempat ia berpijak. */
type Local = { base: number; order: string[]; dirty: boolean };
type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';
type Section = 'ranked' | 'unranked' | 'blocked';
type Pages = Record<Section, number> & { key: string };

const SAVE_DELAY_MS = 700;

const iconButton =
  'inline-flex size-8 items-center justify-center rounded-md text-neutral-700 transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:pointer-events-none disabled:opacity-40';

function matches(row: Row, query: string) {
  if (!query) return true;
  const needle = query.toLowerCase();
  return [row.name, row.code, row.nim?.toString(), row.prodi].some((value) =>
    value?.toLowerCase().includes(needle),
  );
}

/** Isian angka urutan: Enter atau keluar kolom untuk menerapkan. */
function PositionInput({
  value,
  disabled,
  label,
  onCommit,
}: {
  value: number | null;
  disabled: boolean;
  label: string;
  onCommit: (position: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const parsed = parsePosition(draft);
    setDraft(null);
    if (parsed === 'invalid' || parsed === value) return;
    onCommit(parsed);
  };
  return (
    <input
      inputMode="numeric"
      aria-label={label}
      disabled={disabled}
      value={draft ?? value?.toString() ?? ''}
      placeholder="—"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        } else if (event.key === 'Escape') {
          setDraft(null);
        }
      }}
      className="h-8 w-14 rounded-md border border-neutral-400 bg-neutral-50 text-center text-sm font-semibold text-neutral-1000 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}

/** Keterangan bebas per kandidat; tersimpan saat keluar kolom. */
function NoteCell({
  recruitmentId,
  divisionId,
  row,
  disabled,
  onSaved,
  onError,
}: {
  recruitmentId: string;
  divisionId: string;
  row: Row;
  disabled: boolean;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const mutation = api.oprec.priorityNote.useMutation();
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const commit = () => {
    if (draft === null || draft.trim() === (row.note ?? '')) return;
    mutation.mutate(
      {
        recruitmentId,
        divisionId,
        applicationId: row.applicationId,
        note: draft,
      },
      {
        onSuccess: () => {
          setSaved(true);
          onSaved();
        },
        onError: (error) => onError(error.message),
      },
    );
  };
  const title = row.noteUpdatedBy
    ? `Terakhir diubah ${row.noteUpdatedBy}, ${when(row.noteUpdatedAt)}`
    : undefined;
  return (
    <div className="grid gap-0.5">
      <input
        type="text"
        maxLength={2000}
        aria-label={`Keterangan untuk ${row.name ?? row.code}`}
        title={title}
        disabled={disabled}
        value={draft ?? row.note ?? ''}
        placeholder="Keterangan (opsional)"
        onChange={(event) => {
          setDraft(event.target.value);
          setSaved(false);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') setDraft(null);
        }}
        className={`${inputClass} h-8 min-w-48`}
      />
      <span aria-live="polite" className="text-xs text-neutral-700">
        {mutation.isPending ? 'Menyimpan…' : saved ? 'Tersimpan' : ''}
      </span>
    </div>
  );
}

/** Papan prioritas satu divisi: urutan, keterangan, dan kunci daftar. */
export function PriorityBoard({
  recruitmentId,
  divisionId,
  registrationEnded,
  pageSize,
  onPageSize,
  onChanged,
  announce,
  onError,
}: {
  recruitmentId: string;
  divisionId: string;
  registrationEnded: boolean;
  /** Baris per halaman tiap tabel; 0 = semua. */
  pageSize: number;
  onPageSize: (size: number) => void;
  onChanged: () => void;
  announce: (message: string) => void;
  onError: (message: string) => void;
}) {
  const utils = api.useUtils();
  const board = api.oprec.priorityBoard.useQuery(
    { recruitmentId, divisionId },
    { retry: false, refetchOnWindowFocus: false },
  );
  const { mutate: saveOrder, isPending: saving } =
    api.oprec.prioritySave.useMutation();
  const lock = api.oprec.priorityLock.useMutation();

  const [local, setLocal] = useState<Local | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [search, setSearch] = useState('');
  /** 'semua', nomor pilihan (1, 2, …), atau 'dipindahkan'. */
  const [rankFilter, setRankFilter] = useState<
    'semua' | 'dipindahkan' | number
  >('semua');
  const [openRow, setOpenRow] = useState<Row | null>(null);
  /** Baris yang dicentang untuk aksi massal (id pendaftar). */
  const [picked, setPicked] = useState<string[]>([]);
  const [confirmScore, setConfirmScore] = useState(false);
  /** Halaman tiap tabel; kembali ke 1 bila saringan atau ukuran berubah. */
  const [pageState, setPageState] = useState<Pages>({
    key: '',
    ranked: 1,
    unranked: 1,
    blocked: 1,
  });
  /** Baris yang pindah ke halaman lain lewat isian urutan. */
  const [moved, setMoved] = useState<{
    name: string;
    position: number;
    page: number;
  } | null>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  /** Baris yang menerima fokus setelah urutan berikutnya dirender. */
  const pendingFocus = useRef<string | null>(null);

  const data = board.data;
  const serverOrder = useMemo(
    () =>
      (data?.rows ?? [])
        .filter((row) => row.rank !== null)
        .sort((a, b) => a.rank! - b.rank!)
        .map((row) => row.applicationId),
    [data],
  );
  // Suntingan lokal dipakai selama tidak lebih tua dari versi server.
  const useLocal =
    local !== null && data !== undefined && local.base >= data.version;
  const order = useLocal ? local.order : serverOrder;
  const version = useLocal ? local.base : (data?.version ?? 0);
  const canEdit = data?.canEdit ?? false;
  const query = search.trim();
  // Pencarian atau saringan pilihan: geser urutan hanya lewat isian angka.
  const searching = query.length > 0 || rankFilter !== 'semua';
  const shows = (row: Row) =>
    matches(row, query) &&
    (rankFilter === 'semua' ||
      (rankFilter === 'dipindahkan'
        ? row.kind === 'dipindahkan'
        : row.kind === 'pilihan' && row.choiceRank === rankFilter));

  const pageKey = JSON.stringify([query, rankFilter, pageSize]);
  const pagesNow: Pages =
    pageState.key === pageKey
      ? pageState
      : { key: pageKey, ranked: 1, unranked: 1, blocked: 1 };
  const setPage = (section: Section, page: number) => {
    setPageState({ ...pagesNow, [section]: page });
    setMoved(null);
  };

  const invalidateBoard = () =>
    void utils.oprec.priorityBoard.invalidate({ recruitmentId, divisionId });

  const update = (next: string[]) => {
    if (!canEdit) return;
    setLocal({ base: version, order: next, dirty: true });
    setSaveState('idle');
  };

  // Simpan otomatis sesaat setelah urutan berhenti berubah.
  useEffect(() => {
    if (!local?.dirty || saving) return;
    if (saveState === 'conflict' || saveState === 'error') return;
    const snapshot = local;
    const timer = window.setTimeout(() => {
      setSaveState('saving');
      saveOrder(
        {
          recruitmentId,
          divisionId,
          order: snapshot.order,
          baseVersion: snapshot.base,
        },
        {
          onSuccess: (result) => {
            setLocal((prev) =>
              prev && prev.order !== snapshot.order
                ? { base: result.version, order: prev.order, dirty: true }
                : { base: result.version, order: snapshot.order, dirty: false },
            );
            setSaveState('saved');
            void utils.oprec.priorityBoard.invalidate({
              recruitmentId,
              divisionId,
            });
            onChanged();
          },
          onError: (error) => {
            setSaveState(
              error.data?.code === 'CONFLICT' ? 'conflict' : 'error',
            );
            onError(error.message);
          },
        },
      );
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [
    local,
    saving,
    saveState,
    saveOrder,
    recruitmentId,
    divisionId,
    utils,
    onChanged,
    onError,
  ]);

  // Fokus mengikuti baris yang baru dipindah lewat keyboard.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    rowRefs.current.get(id)?.focus();
  }, [order, pageState]);

  if (board.isError) return <ErrorNote message={board.error.message} />;
  if (!data) return <Loading label="Memuat daftar prioritas…" />;

  const rowById = new Map(data.rows.map((row) => [row.applicationId, row]));
  const ordered = new Set(order);
  const ranked = order.flatMap((id) => {
    const row = rowById.get(id);
    return row && !row.blocked ? [row] : [];
  });
  const unranked = data.rows.filter(
    (row) => !row.blocked && !ordered.has(row.applicationId),
  );
  const blocked = data.rows.filter((row) => row.blocked);
  const shownRanked = ranked.filter(shows);
  const shownUnranked = unranked.filter(shows);
  const shownBlocked = blocked.filter(shows);
  const pageInfo = (section: Section, rows: Row[]) => {
    const pages = pageCount(rows.length, pageSize);
    const page = Math.min(pagesNow[section], pages);
    return { page, pages, rows: pageSlice(rows, page, pageSize) };
  };
  const rankedPage = pageInfo('ranked', shownRanked);
  const unrankedPage = pageInfo('unranked', shownUnranked);
  const blockedPage = pageInfo('blocked', shownBlocked);
  const rankedStart = pageSize === 0 ? 0 : (rankedPage.page - 1) * pageSize;
  // Baris yang sedang dirender, untuk ↑/↓ dan centang "semua yang tampil".
  const visible = [
    ...rankedPage.rows,
    ...unrankedPage.rows,
    ...blockedPage.rows,
  ];
  const pickedSet = new Set(picked);
  const selectableVisible = visible
    .filter((row) => !row.blocked)
    .map((row) => row.applicationId);
  const pickedUnranked = unranked
    .filter((row) => pickedSet.has(row.applicationId))
    .map((row) => row.applicationId);
  const pickedRanked = order.filter((id) => pickedSet.has(id));
  const hasScores = data.rows.some((row) => row.score !== null);
  // Tanpa nilai (mis. tab Nilai digantikan Prioritas), kolom status hanya
  // tampil bila ada status yang bermakna, seperti ubah status manual.
  const showStatus =
    hasScores ||
    data.rows.some(
      (row) =>
        row.blocked === 'closerec' ||
        (row.status !== null && row.status !== 'belum_lengkap'),
    );
  const rankOptions = [
    ...new Set(
      data.rows.flatMap((row) =>
        row.kind === 'pilihan' && row.choiceRank !== null
          ? [row.choiceRank]
          : [],
      ),
    ),
  ].sort((a, b) => a - b);
  const hasMoved = data.rows.some((row) => row.kind === 'dipindahkan');
  const quota = data.division.quota;
  const locked = data.lockedAt !== null;
  const noteDisabled = data.method !== 'prioritas' || data.state === 'final';
  const reorderDisabled = !canEdit || searching;

  const reload = () => {
    setLocal(null);
    setSaveState('idle');
    void board.refetch();
  };

  const fillFromScores = () => {
    const next = data.rows
      .filter((row) => !row.blocked && row.score !== null)
      .sort(
        (a, b) =>
          b.score! - a.score! ||
          (a.choiceRank ?? 99) - (b.choiceRank ?? 99) ||
          (a.name ?? a.code).localeCompare(b.name ?? b.code),
      )
      .map((row) => row.applicationId);
    update(next);
    setConfirmScore(false);
    announce(`Urutan diisi dari nilai: ${next.length} orang.`);
  };

  const setLocked = (next: boolean) => {
    lock.mutate(
      { recruitmentId, divisionId, locked: next },
      {
        onSuccess: () => {
          invalidateBoard();
          onChanged();
          announce(next ? 'Daftar dikunci.' : 'Kunci daftar dibuka.');
        },
        onError: (error) => onError(error.message),
      },
    );
  };

  /** Halaman tempat baris `id` berada setelah urutan menjadi `next`. */
  const placeOf = (id: string, next: string[]) => {
    const inNext = new Set(next);
    const rankedAt = next
      .filter((item) => {
        const row = rowById.get(item);
        return row && !row.blocked && shows(row);
      })
      .indexOf(id);
    if (rankedAt >= 0)
      return { section: 'ranked' as const, page: pageOf(rankedAt, pageSize) };
    const unrankedAt = data.rows
      .filter(
        (row) => !row.blocked && !inNext.has(row.applicationId) && shows(row),
      )
      .findIndex((row) => row.applicationId === id);
    return unrankedAt >= 0
      ? { section: 'unranked' as const, page: pageOf(unrankedAt, pageSize) }
      : null;
  };

  const onRowKey = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    row: Row,
    isRanked: boolean,
  ) => {
    if (event.target !== event.currentTarget) return;
    const index = visible.findIndex(
      (item) => item.applicationId === row.applicationId,
    );
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const target = visible[index + (event.key === 'ArrowUp' ? -1 : 1)];
      if (target) rowRefs.current.get(target.applicationId)?.focus();
      return;
    }
    if (reorderDisabled || row.blocked) return;
    const id = row.applicationId;
    const step = event.shiftKey ? 10 : 1;
    let next: string[] | null = null;
    if (isRanked) {
      if (event.key === 'PageUp') next = shift(order, id, -step);
      else if (event.key === 'PageDown') next = shift(order, id, step);
      else if (event.key === 'Home') next = moveTo(order, id, 1);
      else if (event.key === 'End') next = moveTo(order, id, order.length);
      else if (event.key === 'Delete' || event.key === 'Backspace') {
        next = remove(order, id);
      }
    } else if (event.key === 'Enter' || event.key === 'PageUp') {
      next = [...order, id];
    }
    if (next) {
      event.preventDefault();
      pendingFocus.current = id;
      update(next);
      // Fokus ikut pindah halaman bila baris keluar dari halaman ini.
      const place = placeOf(id, next);
      if (place && place.page !== pagesNow[place.section]) {
        setPageState({ ...pagesNow, [place.section]: place.page });
      }
    }
  };

  const renderRow = (row: Row, isRanked: boolean) => {
    const position = isRanked ? order.indexOf(row.applicationId) + 1 : null;
    const name = row.name ?? row.code;
    return (
      <TableRow
        key={row.applicationId}
        ref={(element) => {
          if (element) rowRefs.current.set(row.applicationId, element);
          else rowRefs.current.delete(row.applicationId);
        }}
        tabIndex={0}
        aria-label={
          position ? `${name}, urutan ${position}` : `${name}, belum diurutkan`
        }
        onKeyDown={(event) => onRowKey(event, row, isRanked)}
        onClick={(event) => {
          // Klik pada input, tombol, atau catatan tetap untuk mengurutkan.
          const target = event.target as HTMLElement;
          if (target.closest('input, button, textarea, a, select, label'))
            return;
          setOpenRow(row);
        }}
        className="cursor-pointer align-top hover:bg-neutral-100 focus-visible:bg-primary-100 focus-visible:outline-none"
      >
        {canEdit ? (
          <TableCell className="w-10">
            {row.blocked ? null : (
              <input
                type="checkbox"
                aria-label={`Pilih ${name}`}
                checked={pickedSet.has(row.applicationId)}
                onChange={(event) =>
                  setPicked((prev) =>
                    event.target.checked
                      ? [...prev, row.applicationId]
                      : prev.filter((id) => id !== row.applicationId),
                  )
                }
                className="mt-1 size-4"
              />
            )}
          </TableCell>
        ) : null}
        <TableCell>
          {row.blocked ? (
            <span className="text-sm text-neutral-500">—</span>
          ) : (
            <PositionInput
              value={position}
              disabled={!canEdit}
              label={`Urutan ${name}`}
              onCommit={(target) => {
                const next =
                  target === null
                    ? remove(order, row.applicationId)
                    : moveTo(order, row.applicationId, target);
                update(next);
                const place = placeOf(row.applicationId, next);
                const position = next.indexOf(row.applicationId) + 1;
                if (
                  place?.section === 'ranked' &&
                  place.page !== rankedPage.page
                ) {
                  setMoved({ name, position, page: place.page });
                  announce(
                    `${name} dipindah ke urutan ${position}, halaman ${place.page}.`,
                  );
                } else {
                  setMoved(null);
                }
              }}
            />
          )}
        </TableCell>
        <TableCell>
          <button
            type="button"
            onClick={() => setOpenRow(row)}
            className="text-left font-semibold text-neutral-1000 underline-offset-2 hover:text-primary-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            {name}
          </button>
          {data.blind ? null : (
            <span className="block text-xs text-neutral-700">
              {[row.nim, row.prodi, row.angkatan].filter(Boolean).join(' · ') ||
                '—'}
            </span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {row.kind === 'pilihan' ? (
              <Chip>Pilihan {row.choiceRank}</Chip>
            ) : (
              <Chip tone="warning">Dipindahkan</Chip>
            )}
            {row.kind === 'pilihan' && row.willingToMove ? (
              <Chip tone="muted">Bersedia dipindahkan</Chip>
            ) : null}
          </div>
          {row.kind === 'dipindahkan' ? (
            <span className="mt-1 block text-xs text-neutral-700">
              Memilih: {row.choices.map((choice) => choice.label).join(', ')}
            </span>
          ) : null}
        </TableCell>
        {showStatus ? (
          <TableCell>
            <div className="flex flex-wrap items-center gap-1.5">
              {row.score !== null ? (
                <span className="text-sm font-semibold text-neutral-1000">
                  {row.score.toFixed(1)}
                </span>
              ) : null}
              {row.blocked === 'closerec' ? (
                <Chip tone="muted">Sudah masuk lewat closerec</Chip>
              ) : row.status ? (
                <StatusBadge status={row.status} />
              ) : null}
            </div>
          </TableCell>
        ) : null}
        <TableCell>
          <NoteCell
            recruitmentId={recruitmentId}
            divisionId={divisionId}
            row={row}
            disabled={noteDisabled}
            onSaved={invalidateBoard}
            onError={onError}
          />
        </TableCell>
        <TableCell>
          {row.blocked ? null : isRanked ? (
            <div className="flex">
              <button
                type="button"
                className={iconButton}
                aria-label={`Naikkan ${name}`}
                disabled={reorderDisabled || position === 1}
                onClick={() => update(shift(order, row.applicationId, -1))}
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                className={iconButton}
                aria-label={`Turunkan ${name}`}
                disabled={reorderDisabled || position === order.length}
                onClick={() => update(shift(order, row.applicationId, 1))}
              >
                <ArrowDown className="size-4" />
              </button>
              <button
                type="button"
                className={iconButton}
                aria-label={`Keluarkan ${name} dari urutan`}
                disabled={!canEdit}
                onClick={() => update(remove(order, row.applicationId))}
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="dark_blue_outline"
              disabled={!canEdit}
              onClick={() => update([...order, row.applicationId])}
            >
              <Plus /> Urutkan
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  };

  const header = (
    <TableHeader>
      <TableRow>
        {canEdit ? (
          <TableHead className="w-10">
            <input
              type="checkbox"
              aria-label="Pilih semua yang tampil"
              checked={
                selectableVisible.length > 0 &&
                selectableVisible.every((id) => pickedSet.has(id))
              }
              onChange={(event) =>
                setPicked((prev) =>
                  event.target.checked
                    ? [...new Set([...prev, ...selectableVisible])]
                    : prev.filter((id) => !selectableVisible.includes(id)),
                )
              }
              className="size-4"
            />
          </TableHead>
        ) : null}
        <TableHead className="w-20">Urutan</TableHead>
        <TableHead className="min-w-48">Pendaftar</TableHead>
        <TableHead className="min-w-40">Pilihan</TableHead>
        {showStatus ? (
          <TableHead className="min-w-32">Nilai &amp; status</TableHead>
        ) : null}
        <TableHead className="min-w-56">Keterangan</TableHead>
        <TableHead className="min-w-28">Aksi</TableHead>
      </TableRow>
    </TableHeader>
  );

  const cutLineAfter =
    quota > 0 && !searching && ranked.length > quota ? quota : null;

  const saveLabel = {
    idle: local?.dirty ? 'Belum tersimpan' : '',
    saving: 'Menyimpan…',
    saved: 'Tersimpan',
    conflict: 'Daftar diubah orang lain.',
    error: 'Gagal menyimpan.',
  }[saveState];

  return (
    <section
      aria-label={`Daftar prioritas ${data.division.label}`}
      className="mt-4 grid gap-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-1000">
            {data.division.label}
            {data.division.groupLabel ? (
              <span className="font-normal text-neutral-700">
                {' '}
                · {data.division.groupLabel}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-neutral-700">
            Kuota {quota === 0 ? 'tanpa batas' : quota} · {ranked.length}{' '}
            diurutkan · {unranked.length} belum · {blocked.length} tidak bisa
            diurutkan
          </p>
          <p className="mt-1 text-sm text-neutral-700">
            {locked
              ? `Terkunci${data.lockedByName ? ` oleh ${data.lockedByName}` : ''}, ${when(data.lockedAt)}.`
              : 'Belum dikunci.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span aria-live="polite" className="text-sm text-neutral-700">
            {saveLabel}
          </span>
          {saveState === 'conflict' || saveState === 'error' ? (
            <Button size="sm" variant="dark_blue_outline" onClick={reload}>
              Muat ulang
            </Button>
          ) : null}
          {hasScores && canEdit ? (
            <Button
              size="sm"
              variant="dark_blue_outline"
              onClick={() =>
                order.length > 0 ? setConfirmScore(true) : fillFromScores()
              }
            >
              <ListOrdered /> Isi urutan dari nilai
            </Button>
          ) : null}
          {locked ? (
            data.method === 'prioritas' && data.state === 'berjalan' ? (
              <Button
                size="sm"
                variant="dark_blue_outline"
                disabled={lock.isPending}
                onClick={() => setLocked(false)}
              >
                <LockOpen /> Buka kunci
              </Button>
            ) : null
          ) : (
            <Button
              size="sm"
              variant="dark_blue"
              disabled={
                !canEdit ||
                !registrationEnded ||
                lock.isPending ||
                saving ||
                local?.dirty === true
              }
              title={
                registrationEnded
                  ? undefined
                  : 'Bisa dikunci setelah pendaftaran berakhir.'
              }
              onClick={() => setLocked(true)}
            >
              <Lock /> Kunci daftar
            </Button>
          )}
        </div>
      </div>

      <details className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4 text-sm text-neutral-700">
        <summary className="cursor-pointer font-semibold text-neutral-1000">
          Cara menyusun
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Ketik angka di kolom Urutan lalu Enter untuk memindah orang ke
            urutan itu; kosongkan untuk mengeluarkannya. Orang di luar urutan
            tidak diterima divisi ini.
          </li>
          <li>
            Di baris yang terpilih: PgUp/PgDn naik-turun 1 (Shift: 10), Home/End
            ke paling atas/bawah, Delete mengeluarkan, Enter memasukkan ke
            urutan, ↑/↓ pindah baris.
          </li>
          <li>
            Garis kuota bukan batas mati: orang di bawahnya tetap bisa masuk
            bila orang di atasnya diterima di pilihan yang lebih tinggi.
          </li>
          <li>
            Keterangan hanya terlihat penyusun daftar dan pengelola oprec, tidak
            pernah oleh pendaftar.
          </li>
        </ul>
      </details>

      <div className="relative">
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        {rankOptions.length > 1 || hasMoved ? (
          <div
            role="group"
            aria-label="Saring menurut pilihan"
            className="flex flex-wrap gap-1"
          >
            {(
              [
                ['semua', 'Semua'],
                ...rankOptions.map((n) => [n, `Pilihan ${n}`] as const),
                ...(hasMoved ? [['dipindahkan', 'Dipindahkan'] as const] : []),
              ] as const
            ).map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={rankFilter === value}
                onClick={() => setRankFilter(value)}
                className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                  rankFilter === value
                    ? 'bg-primary-200 text-primary-400'
                    : 'border border-neutral-400 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <PageSizeSelect value={pageSize} onChange={onPageSize} />
      </div>
      {searching ? (
        <p className="text-xs text-neutral-700">
          Saringan aktif: geser urutan dengan isian angka.
        </p>
      ) : null}
      {canEdit && picked.length > 0 ? (
        <div
          role="region"
          aria-label="Aksi untuk baris terpilih"
          className="flex flex-wrap items-center gap-2 rounded-xl bg-primary-100 px-3 py-2"
        >
          <span className="text-sm font-semibold text-neutral-1000">
            {picked.length} dipilih
          </span>
          <Button
            size="sm"
            variant="dark_blue"
            disabled={pickedUnranked.length === 0}
            onClick={() => {
              update([...order, ...pickedUnranked]);
              setPicked([]);
            }}
          >
            Tambahkan ke urutan ({pickedUnranked.length})
          </Button>
          <Button
            size="sm"
            variant="dark_blue_outline"
            disabled={pickedRanked.length === 0}
            onClick={() => {
              update(order.filter((id) => !pickedSet.has(id)));
              setPicked([]);
            }}
          >
            Keluarkan dari urutan ({pickedRanked.length})
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPicked([])}>
            Batal pilih
          </Button>
        </div>
      ) : null}

      {data.method !== 'prioritas' ? (
        <Notice>Oprec ini tidak memakai penempatan prioritas.</Notice>
      ) : null}

      {moved ? (
        <p
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-xl bg-primary-100 px-3 py-2 text-sm text-neutral-1000"
        >
          {moved.name} dipindah ke urutan {moved.position} (halaman {moved.page}
          ).
          <button
            type="button"
            onClick={() => setPage('ranked', moved.page)}
            className="font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            Lihat
          </button>
        </p>
      ) : null}

      <div>
        <div className="overflow-x-auto rounded-[24px] border border-neutral-400 bg-neutral-50">
          <Table>
            {header}
            <TableBody>
              {shownRanked.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={(showStatus ? 6 : 5) + (canEdit ? 1 : 0)}
                    className="text-sm text-neutral-700"
                  >
                    {searching
                      ? 'Tidak ada yang cocok di urutan.'
                      : 'Belum ada yang diurutkan. Mulai dari daftar di bawah.'}
                  </TableCell>
                </TableRow>
              ) : (
                rankedPage.rows.flatMap((row, index) => {
                  const out = [renderRow(row, true)];
                  if (
                    cutLineAfter !== null &&
                    rankedStart + index + 1 === cutLineAfter
                  ) {
                    out.push(
                      <TableRow key="batas-kuota" aria-hidden>
                        <TableCell
                          colSpan={(showStatus ? 6 : 5) + (canEdit ? 1 : 0)}
                          className="border-y-2 border-dashed border-warning-dark bg-warning-light py-1.5 text-xs font-semibold text-neutral-1000"
                        >
                          Batas kuota ({quota}). Yang di bawah garis masih bisa
                          masuk bila orang di atasnya diterima di pilihan yang
                          lebih tinggi.
                        </TableCell>
                      </TableRow>,
                    );
                  }
                  return out;
                })
              )}
            </TableBody>
          </Table>
        </div>
        <Pager
          label="urutan"
          page={rankedPage.page}
          pages={rankedPage.pages}
          total={shownRanked.length}
          size={pageSize}
          onPage={(page) => setPage('ranked', page)}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-neutral-1000">
          Belum diurutkan ({unranked.length})
        </h3>
        <p className="text-xs text-neutral-700">
          Tidak diterima divisi ini kecuali dimasukkan ke urutan.
        </p>
        {shownUnranked.length > 0 ? (
          <div className="mt-2 overflow-x-auto rounded-[24px] border border-neutral-400 bg-neutral-50">
            <Table>
              {header}
              <TableBody>
                {unrankedPage.rows.map((row) => renderRow(row, false))}
              </TableBody>
            </Table>
          </div>
        ) : null}
        <Pager
          label="belum diurutkan"
          page={unrankedPage.page}
          pages={unrankedPage.pages}
          total={shownUnranked.length}
          size={pageSize}
          onPage={(page) => setPage('unranked', page)}
        />
      </div>

      {blocked.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-neutral-1000">
            Tidak bisa diurutkan ({blocked.length})
          </h3>
          <p className="text-xs text-neutral-700">
            Tidak lolos di divisi ini atau sudah diterima lewat closerec.
            Keterangan tetap bisa diisi.
          </p>
          {shownBlocked.length > 0 ? (
            <div className="mt-2 overflow-x-auto rounded-[24px] border border-neutral-400 bg-neutral-50">
              <Table>
                {header}
                <TableBody>
                  {blockedPage.rows.map((row) => renderRow(row, false))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          <Pager
            label="tidak bisa diurutkan"
            page={blockedPage.page}
            pages={blockedPage.pages}
            total={shownBlocked.length}
            size={pageSize}
            onPage={(page) => setPage('blocked', page)}
          />
        </div>
      ) : null}

      <Modal
        open={confirmScore}
        onOpenChange={setConfirmScore}
        title="Isi urutan dari nilai?"
        description="Urutan sekarang diganti: pendaftar yang sudah bernilai diurutkan dari nilai tertinggi. Yang belum bernilai tetap di luar urutan. Setelah itu urutan masih bisa digeser."
        footer={
          <>
            <Button
              variant="dark_blue_outline"
              onClick={() => setConfirmScore(false)}
            >
              Batal
            </Button>
            <Button variant="dark_blue" onClick={fillFromScores}>
              Ganti urutan
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          {order.length} orang sudah diurutkan saat ini.
        </p>
      </Modal>

      <PriorityAnswersSheet
        recruitmentId={recruitmentId}
        divisionId={divisionId}
        divisionLabel={data.division.label}
        applicant={
          openRow
            ? {
                applicationId: openRow.applicationId,
                name: openRow.name ?? openRow.code,
                meta: data.blind
                  ? null
                  : [openRow.nim, openRow.prodi, openRow.angkatan]
                      .filter(Boolean)
                      .join(' · ') || null,
              }
            : null
        }
        onClose={() => setOpenRow(null)}
      />
    </section>
  );
}
