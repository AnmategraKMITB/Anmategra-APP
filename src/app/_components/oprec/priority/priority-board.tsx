'use client';

import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  ListOrdered,
  ListPlus,
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
  selectClass,
  when,
} from '../placement/shared';
import { PriorityAnswersSheet } from './answers-sheet';
import {
  type SubmitSort,
  bySubmitted,
  dropBlock,
  fillQuota,
  moveTo,
  parsePosition,
  remove,
  shift,
} from './order';
import { PageSizeSelect, Pager, pageCount, pageOf, pageSlice } from './pager';

type Board = RouterOutputs['oprec']['priorityBoard'];
type Row = Board['rows'][number];

/** Urutan yang sedang disunting; `base` = versi server tempat ia berpijak. */
type Local = { base: number; order: string[]; dirty: boolean };
type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';
type Section = 'ranked' | 'unranked' | 'blocked';
type Pages = Record<Section, number> & { key: string };
type SortableBits = ReturnType<typeof useSortable>;

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

/** Pembungkus hook seret-lepas agar satu baris tabel bisa diurutkan. */
function Sortable({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: (sortable: SortableBits) => React.ReactNode;
}) {
  return children(useSortable({ id, disabled }));
}

const screenReaderInstructions = {
  draggable:
    'Tekan Spasi atau Enter untuk mengangkat. Panah atas/bawah memindah, Spasi atau Enter melepas, Escape membatalkan. Bila beberapa baris dicentang, semuanya ikut pindah.',
};

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
  const [confirmFill, setConfirmFill] = useState(false);
  /** Urutan tampil tabel belum diurutkan dan tidak bisa diurutkan. */
  const [submitSort, setSubmitSort] = useState<SubmitSort>('bawaan');
  /** Baris yang sedang diseret. */
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
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

  const pageKey = JSON.stringify([query, rankFilter, pageSize, submitSort]);
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
  const sortedRows = bySubmitted(data.rows, submitSort);
  const unranked = sortedRows.filter(
    (row) => !row.blocked && !ordered.has(row.applicationId),
  );
  const blocked = sortedRows.filter((row) => row.blocked);
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
  const fillCandidates = fillQuota(
    data.rows,
    ranked.map((row) => row.applicationId),
    quota,
  );
  // Baris terpilih ikut diseret sebagai satu blok bila yang diseret terpilih.
  const dragBlock =
    dragId && pickedSet.has(dragId) && pickedRanked.length > 1
      ? new Set(pickedRanked)
      : null;
  const labelOf = (id: unknown) => {
    const row = rowById.get(String(id));
    return row ? (row.name ?? row.code) : 'Baris';
  };
  const positionOf = (id: unknown) => order.indexOf(String(id)) + 1;
  const blockSize = (id: unknown) =>
    pickedSet.has(String(id)) && pickedRanked.length > 1
      ? pickedRanked.length
      : 1;
  const dragSubject = (id: unknown) => {
    const extra = blockSize(id) - 1;
    return extra > 0 ? `${labelOf(id)} dan ${extra} lainnya` : labelOf(id);
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Mengangkat ${dragSubject(active.id)} dari urutan ${positionOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${dragSubject(active.id)} di urutan ${positionOf(over.id)}.`
        : `${dragSubject(active.id)} di luar daftar.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${dragSubject(active.id)} dilepas di urutan ${positionOf(over.id)}.`
        : 'Dilepas di luar daftar; urutan tidak berubah.',
    onDragCancel: () => 'Pemindahan dibatalkan.',
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragId(null);
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const next = dropBlock(order, pickedRanked, activeId, String(over.id));
    if (next.every((id, index) => id === order[index])) return;
    update(next);
    const count = blockSize(activeId);
    announce(
      count > 1
        ? `${count} orang dipindah mulai urutan ${next.indexOf(pickedRanked[0]!) + 1}.`
        : `${labelOf(activeId)} dipindah ke urutan ${next.indexOf(activeId) + 1}.`,
    );
  };

  const fillFromFirstChoice = () => {
    const added = fillCandidates.map((row) => row.applicationId);
    update([...order, ...added]);
    setConfirmFill(false);
    announce(`${added.length} pendaftar pilihan 1 ditambahkan ke urutan.`);
  };

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
    const unrankedAt = sortedRows
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

  const renderRow = (row: Row, isRanked: boolean, sortable?: SortableBits) => {
    const position = isRanked ? order.indexOf(row.applicationId) + 1 : null;
    const name = row.name ?? row.code;
    const inBlock =
      dragBlock?.has(row.applicationId) === true &&
      dragId !== row.applicationId;
    return (
      <TableRow
        key={row.applicationId}
        ref={(element) => {
          sortable?.setNodeRef(element);
          if (element) rowRefs.current.set(row.applicationId, element);
          else rowRefs.current.delete(row.applicationId);
        }}
        style={
          sortable
            ? {
                transform: CSS.Translate.toString(sortable.transform),
                transition: sortable.transition,
              }
            : undefined
        }
        data-dragging={sortable?.isDragging ? '' : undefined}
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
        className={`relative cursor-pointer align-top hover:bg-neutral-100 focus-visible:bg-primary-100 focus-visible:outline-none data-[dragging]:z-10 data-[dragging]:bg-primary-100 data-[dragging]:opacity-60 ${
          inBlock ? 'opacity-40' : ''
        }`}
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
            <div className="flex items-center gap-1">
              {sortable ? (
                <button
                  type="button"
                  ref={sortable.setActivatorNodeRef}
                  aria-label={`Seret ${name} untuk memindah urutan`}
                  disabled={reorderDisabled}
                  title={
                    searching
                      ? 'Matikan saringan untuk menyeret.'
                      : 'Seret untuk memindah. Baris yang dicentang ikut pindah.'
                  }
                  {...sortable.attributes}
                  {...sortable.listeners}
                  className={`${iconButton} -ml-1 w-6 cursor-grab touch-none active:cursor-grabbing`}
                >
                  <GripVertical className="size-4" />
                </button>
              ) : null}
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
            </div>
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
          <span className="mt-1 block text-xs text-neutral-700">
            Dikirim {when(row.submittedAt)}
          </span>
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
        <TableHead className="w-24">Urutan</TableHead>
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
          {canEdit && quota > 0 ? (
            <Button
              size="sm"
              variant="dark_blue_outline"
              disabled={fillCandidates.length === 0}
              title={
                fillCandidates.length === 0
                  ? ranked.length >= quota
                    ? 'Urutan sudah mencapai kuota.'
                    : 'Tidak ada pendaftar pilihan 1 yang belum diurutkan.'
                  : undefined
              }
              onClick={() => setConfirmFill(true)}
            >
              <ListPlus /> Isi kuota dari pilihan 1
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
            Seret pegangan{' '}
            <GripVertical aria-hidden className="inline size-3.5" /> untuk
            memindah. Centang beberapa orang lalu seret salah satunya: semuanya
            pindah sebagai satu blok, urutan di antara mereka tetap. Pegangan
            juga bisa dipakai dengan keyboard (Spasi, panah, Spasi).
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
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-neutral-700">
            Urutkan yang belum diurutkan
            <select
              value={submitSort}
              onChange={(event) =>
                setSubmitSort(event.target.value as SubmitSort)
              }
              className={`${selectClass} h-8 w-auto pr-8`}
            >
              <option value="bawaan">Pilihan, lalu nama</option>
              <option value="kirim_awal">Dikirim paling awal</option>
              <option value="kirim_akhir">Dikirim paling akhir</option>
            </select>
          </label>
          <PageSizeSelect value={pageSize} onChange={onPageSize} />
        </div>
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={{ announcements, screenReaderInstructions }}
            onDragStart={({ active }) => setDragId(String(active.id))}
            onDragCancel={() => setDragId(null)}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={rankedPage.rows.map((row) => row.applicationId)}
              strategy={verticalListSortingStrategy}
            >
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
                      const out = [
                        <Sortable
                          key={row.applicationId}
                          id={row.applicationId}
                          disabled={reorderDisabled}
                        >
                          {(sortable) => renderRow(row, true, sortable)}
                        </Sortable>,
                      ];
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
                              Batas kuota ({quota}). Yang di bawah garis masih
                              bisa masuk bila orang di atasnya diterima di
                              pilihan yang lebih tinggi.
                            </TableCell>
                          </TableRow>,
                        );
                      }
                      return out;
                    })
                  )}
                </TableBody>
              </Table>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {dragId ? (
                <div className="flex items-center gap-2 rounded-xl border border-primary-400 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-1000 shadow-lg">
                  <GripVertical
                    aria-hidden
                    className="size-4 text-neutral-700"
                  />
                  {dragSubject(dragId)}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
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

      <Modal
        open={confirmFill}
        onOpenChange={setConfirmFill}
        title="Isi kuota dari pilihan 1?"
        description="Pendaftar yang memilih divisi ini sebagai pilihan 1 dan belum diurutkan ditambahkan ke akhir urutan, dari yang paling awal mengirim, sampai kuota terisi. Nilai dan keterangan penilai tidak dipertimbangkan, dan urutan yang sudah ada tidak diubah."
        wide
        footer={
          <>
            <Button
              variant="dark_blue_outline"
              onClick={() => setConfirmFill(false)}
            >
              Batal
            </Button>
            <Button variant="dark_blue" onClick={fillFromFirstChoice}>
              Tambahkan {fillCandidates.length} orang
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Kuota {quota} · {ranked.length} sudah diurutkan · sisa{' '}
          {Math.max(quota - ranked.length, 0)}.
        </p>
        <ol
          start={ranked.length + 1}
          aria-label="Pratinjau tambahan urutan"
          className="mt-3 grid list-decimal gap-1 pl-8 text-sm text-neutral-1000"
        >
          {fillCandidates.map((row) => (
            <li key={row.applicationId}>
              <span className="font-semibold">{row.name ?? row.code}</span>
              <span className="text-neutral-700">
                {' '}
                · dikirim {when(row.submittedAt)}
              </span>
            </li>
          ))}
        </ol>
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
