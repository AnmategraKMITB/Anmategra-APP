'use client';

import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Minus,
  Plus,
  ScanSearch,
  Trash2,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { JSX, KeyboardEvent, PointerEvent } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';

import {
  CANVAS_PAD,
  GROUP_H,
  PERSON_H,
  SEAT_H,
  boundsOf,
  layoutChart,
  rowHeight,
} from './chart-layout';
import type { ChartNode, SeatRow } from './chart-layout';
import {
  type ArrangeMode,
  type Draft,
  MAX_DEPTH,
  NODE_WIDTH_DEFAULT,
  NODE_WIDTH_MAX,
  NODE_WIDTH_MIN,
  type PlacementsByPosition,
  type UnitDropPosition,
  clampNodeWidth,
  effectiveShowLabel,
  levelLabelFor,
  planUnitsDrop,
  unitTypeLabel,
} from './model';
import { draggedPositionId, isPositionDrag } from './position-dnd';

const MIN_SCALE = 0.25;
const MAX_SCALE = 2;
const ZOOM_STEP = 1.2;
const PAN_STEP = 64;
const FIT_FLOOR = 0.5;

type View = { x: number; y: number; scale: number };

export type ChartViewProps = {
  draft: Draft;
  placements: PlacementsByPosition;
  selectedId: string | null;
  /** Seluruh pilihan; Ctrl/Cmd atau Shift + klik menambah atau mencabut, Shift + seret ruang kosong memilih dengan kotak. */
  selectedIds: readonly string[];
  onSelect: (id: string) => void;
  onSelectIds: (ids: string[]) => void;
  /** Bagian boleh diseret ke bagian lain (menjadi anak, atau saudara sebelum/sesudahnya). */
  onMoveUnit?: (
    activeId: string,
    targetId: string,
    position: UnitDropPosition,
  ) => void;
  /** Jabatan dari panel Detail boleh dilepas ke sebuah bagian. */
  onDropPositionOnUnit?: (positionId: string, unitId: string) => void;
  canEditUnit?: (unitId: string) => boolean;
  /** Tombol + pada node terpilih: tambah bagian di dalamnya. */
  onAddChild?: (unitId: string) => void;
  /** Tombol sampah pada node terpilih; pemanggil yang meminta konfirmasi. */
  onRequestDelete?: (unitId: string) => void;
  /** Lebar kartu diubah dengan menyeret tepi kanan node terpilih; undefined mengembalikan ke bawaan. */
  onResizeUnit?: (unitId: string, width: number | undefined) => void;
  /** Urutkan ulang otomatis lewat menu "Tata ulang"; undefined saat hanya-baca. */
  onArrange?: (mode: ArrangeMode) => void;
};

const DRAG_THRESHOLD = 6;
const EDGE_ZONE = 56;
const EDGE_MAX_SPEED = 18;

/** Pilihan menu "Tata ulang"; semuanya hanya mengubah urutan data, bukan koordinat. */
const ARRANGE_ITEMS: { mode: ArrangeMode; label: string; hint: string }[] = [
  {
    mode: 'balance',
    label: 'Seimbangkan',
    hint: 'terbesar di tengah, mengecil ke tepi',
  },
  {
    mode: 'size',
    label: 'Terbesar dulu',
    hint: 'bagian dengan subbagian terbanyak di kiri',
  },
  { mode: 'alpha', label: 'Alfabetis', hint: 'urut nama A→Z' },
  {
    mode: 'flatten',
    label: 'Ratakan tier',
    hint: 'buang semua tier manual, kembali ke kedalaman',
  },
];

/** Kecepatan gulir otomatis (piksel per bingkai) menurut jarak penunjuk dari tepi; 0 di tengah. */
function edgeSpeed(position: number, size: number): number {
  if (position < EDGE_ZONE) {
    return -EDGE_MAX_SPEED * Math.min(1, (EDGE_ZONE - position) / EDGE_ZONE);
  }
  if (position > size - EDGE_ZONE) {
    return (
      EDGE_MAX_SPEED * Math.min(1, (position - (size - EDGE_ZONE)) / EDGE_ZONE)
    );
  }
  return 0;
}

type Marquee = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  ids: string[];
};

type NodeDrag = {
  id: string;
  name: string;
  x: number;
  y: number;
  overId: string | null;
  position: UnitDropPosition | null;
  valid: boolean;
};

const clampScale = (scale: number): number =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part !== '');
  const first = parts[0]?.charAt(0) ?? '';
  const last =
    parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  const initials = `${first}${last}`.toUpperCase();
  return initials === '' ? '?' : initials;
}

function PersonAvatar(props: {
  name: string;
  image: string | null;
}): JSX.Element {
  return (
    <Avatar className="size-6 shrink-0 border-neutral-400">
      {props.image ? <AvatarImage src={props.image} alt="" /> : null}
      <AvatarFallback className="bg-primary-200 text-xs font-semibold text-primary-400">
        {initialsOf(props.name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Warna pil jabatan menurut urutan rank: yang paling senior paling pekat; semuanya lolos kontras AA. */
function pillClass(rankIndex: number): string {
  if (rankIndex === 0) return 'bg-primary-400 text-white';
  if (rankIndex === 1) return 'bg-secondary-800 text-white';
  if (rankIndex === 2) return 'bg-primary-200 text-primary-400';
  return 'bg-neutral-200 text-neutral-1000';
}

function RowView(props: {
  row: SeatRow;
  tone: 'main' | 'ns';
  onToggleGroup: (positionId: string) => void;
}): JSX.Element {
  const { row, tone, onToggleGroup } = props;
  if (row.kind === 'seat') {
    const name = row.person?.name ?? null;
    return (
      <li className="flex items-center gap-2 px-3" style={{ height: SEAT_H }}>
        {row.person ? (
          <>
            <PersonAvatar
              name={name ?? 'Tanpa nama'}
              image={row.person.image}
            />
            <span
              className="min-w-0 flex-1 truncate text-sm font-semibold text-primary-400"
              title={name ?? 'Tanpa nama'}
            >
              {name ?? 'Tanpa nama'}
            </span>
            <span
              className={`max-w-[48%] shrink-0 truncate rounded-full px-2.5 py-0.5 text-xs font-semibold ${pillClass(row.rankIndex)}`}
              title={row.title}
            >
              {row.title}
            </span>
          </>
        ) : (
          <>
            <span
              aria-hidden
              className="size-6 shrink-0 rounded-full border border-dashed border-neutral-500"
            />
            <span
              className="min-w-0 flex-1 truncate text-sm text-neutral-700"
              title={`${row.title} (kosong)`}
            >
              {row.title}
            </span>
            <span className="sr-only">kosong</span>
          </>
        )}
      </li>
    );
  }

  const shown = row.people.slice(0, 3);
  const extra = row.people.length - shown.length;
  const count =
    row.quota === 0 ? `${row.filled} orang` : `${row.filled}/${row.quota}`;
  const border =
    tone === 'ns' ? 'border-success-dark/40' : 'border-neutral-400';
  return (
    <li className="px-2" style={{ height: rowHeight(row) }}>
      <div
        className={`overflow-hidden rounded-[8px] border bg-white ${border}`}
        style={{ height: rowHeight(row) - 4 }}
      >
        <button
          type="button"
          data-chart-toggle
          onClick={() => onToggleGroup(row.positionId)}
          aria-expanded={row.expanded}
          aria-label={`${row.expanded ? 'Tutup' : 'Buka'} daftar ${row.title}`}
          className="flex w-full items-center gap-2 px-1.5 text-left hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
          style={{ height: GROUP_H - 4 }}
        >
          {row.expanded ? (
            <ChevronDown className="size-4 shrink-0 text-primary-400" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-primary-400" />
          )}
          <span
            className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-1000"
            title={row.title}
          >
            {row.title}
          </span>
          {!row.expanded ? (
            <span className="flex -space-x-1.5" aria-hidden>
              {shown.map((person) => (
                <PersonAvatar
                  key={person.id}
                  name={person.name ?? 'Tanpa nama'}
                  image={person.image}
                />
              ))}
            </span>
          ) : null}
          {!row.expanded && extra > 0 ? (
            <span className="text-xs tabular-nums text-neutral-700">
              +{extra}
            </span>
          ) : null}
          <span className="text-xs font-semibold tabular-nums text-neutral-1000">
            {count}
          </span>
        </button>
        {row.expanded ? (
          <ul className="px-1.5">
            {row.people.map((person) => (
              <li
                key={person.id}
                className="flex items-center gap-2"
                style={{ height: PERSON_H }}
              >
                <PersonAvatar
                  name={person.name ?? 'Tanpa nama'}
                  image={person.image}
                />
                <span
                  className="min-w-0 flex-1 truncate text-sm font-semibold text-primary-400"
                  title={person.name ?? 'Tanpa nama'}
                >
                  {person.name ?? 'Tanpa nama'}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

const WIDTH_STEP = 8;

/** Gagang di tepi kanan kartu: seret, tekan panah kiri/kanan, atau klik dua kali untuk kembali ke lebar bawaan. */
function WidthHandle(props: {
  width: number;
  scale: number;
  onPreview: (width: number | null) => void;
  onCommit: (width: number | undefined) => void;
}): JSX.Element {
  const { width, scale, onPreview, onCommit } = props;
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
    width: number;
  } | null>(null);

  const snapped = (value: number): number =>
    clampNodeWidth(Math.round(value / WIDTH_STEP) * WIDTH_STEP);
  const commit = (value: number): void =>
    onCommit(value === NODE_WIDTH_DEFAULT ? undefined : value);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Ubah lebar kartu"
      aria-valuemin={NODE_WIDTH_MIN}
      aria-valuemax={NODE_WIDTH_MAX}
      aria-valuenow={width}
      tabIndex={0}
      data-chart-toggle
      title="Seret untuk mengubah lebar; klik dua kali untuk mengembalikan"
      className="group absolute -right-2 top-0 z-10 flex h-full w-4 cursor-ew-resize touch-none items-center justify-center focus-visible:outline-none"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: width,
          width,
        };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (drag?.pointerId !== event.pointerId) return;
        event.stopPropagation();
        drag.width = snapped(
          drag.startWidth + (event.clientX - drag.startX) / scale,
        );
        onPreview(drag.width);
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        if (drag?.pointerId !== event.pointerId) return;
        event.stopPropagation();
        dragRef.current = null;
        if (drag.width === drag.startWidth) onPreview(null);
        else commit(drag.width);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
        onPreview(null);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onCommit(undefined);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        event.stopPropagation();
        commit(
          snapped(
            width + (event.key === 'ArrowRight' ? WIDTH_STEP : -WIDTH_STEP),
          ),
        );
      }}
    >
      <span
        aria-hidden
        className="h-10 w-1.5 rounded-full bg-primary-400 opacity-60 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-focus-visible:ring-2 group-focus-visible:ring-primary-400 group-focus-visible:ring-offset-2"
      />
    </div>
  );
}

function NodeCard(props: {
  node: ChartNode;
  draft: Draft;
  selected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onToggle: (id: string) => void;
  onToggleGroup: (positionId: string) => void;
  /** Sasaran seretan bagian: tempat jatuhnya, dan apakah dibolehkan. */
  dropPosition: UnitDropPosition | null;
  dropValid: boolean;
  dragging: boolean;
  onDropPosition?: (positionId: string, unitId: string) => void;
  canDropPosition: boolean;
  /** Tombol aksi cepat di samping node terpilih (tambah anak, hapus). */
  quickActions: boolean;
  childLabel: string;
  canAddChild: boolean;
  onAddChild?: (unitId: string) => void;
  onRequestDelete?: (unitId: string) => void;
  /** Gagang lebar di tepi kanan node terpilih. */
  resizable: boolean;
  /** Tulis jenis bagian di atas nama (sakelar bagan atau timpaan per bagian). */
  showLabel: boolean;
  scale: number;
  onResizePreview: (width: number | null) => void;
  onResizeCommit: (width: number | undefined) => void;
}): JSX.Element {
  const {
    node,
    draft,
    selected,
    onSelect,
    onToggle,
    onToggleGroup,
    dropPosition,
    dropValid,
    dragging,
    onDropPosition,
    canDropPosition,
    quickActions,
    childLabel,
    canAddChild,
    onAddChild,
    onRequestDelete,
    resizable,
    showLabel,
    scale,
    onResizePreview,
    onResizeCommit,
  } = props;
  const typeLabel = unitTypeLabel(node.unit, node.depth, draft.levelLabels);
  const [positionOver, setPositionOver] = useState(false);

  const highlight =
    positionOver || (dropPosition === 'inside' && dropValid)
      ? 'border-primary-400 bg-primary-100 ring-2 ring-primary-400'
      : dropPosition === 'inside' && !dropValid
        ? 'border-danger-dark ring-2 ring-danger-dark'
        : null;

  return (
    <div
      data-chart-node
      data-node-id={node.id}
      onDragOver={(event) => {
        if (!canDropPosition || !isPositionDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setPositionOver(true);
      }}
      onDragLeave={() => setPositionOver(false)}
      onDrop={(event) => {
        setPositionOver(false);
        const positionId = draggedPositionId(event);
        if (positionId === null || !onDropPosition) return;
        event.preventDefault();
        onDropPosition(positionId, node.id);
      }}
      className={`absolute ${dragging ? 'opacity-50' : ''}`}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
    >
      {dropPosition === 'before' || dropPosition === 'after' ? (
        <span
          aria-hidden
          className={`absolute -top-1 h-[calc(100%+8px)] w-1 rounded-full ${
            dropValid ? 'bg-primary-400' : 'bg-danger-dark'
          } ${dropPosition === 'before' ? '-left-2' : '-right-2'}`}
        />
      ) : null}

      <div
        className={`overflow-hidden rounded-[12px] border transition-colors duration-150 ${
          highlight ??
          (selected
            ? 'border-primary-400 bg-primary-100'
            : 'border-neutral-400 bg-white')
        }`}
        style={{ height: node.mainH }}
      >
        <div className="flex items-stretch" style={{ height: node.headerH }}>
          <button
            type="button"
            onClick={(event) =>
              onSelect(
                node.id,
                event.shiftKey || event.ctrlKey || event.metaKey,
              )
            }
            aria-pressed={selected}
            className="flex h-full min-w-0 flex-1 select-none flex-col justify-center px-3 text-left hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
            title={node.unit.name}
          >
            <span className="line-clamp-3 break-words text-sm font-semibold leading-[18px] text-neutral-1000">
              {node.unit.name}
            </span>
            {showLabel ? (
              <span className="truncate text-xs leading-4 text-neutral-700">
                {typeLabel}
              </span>
            ) : null}
          </button>
          {node.hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(node.id)}
              data-chart-toggle
              aria-expanded={!node.collapsed}
              aria-label={
                node.collapsed
                  ? `Buka bagian di bawah ${node.unit.name}`
                  : `Ciutkan bagian di bawah ${node.unit.name}`
              }
              className="flex w-11 shrink-0 items-center justify-center text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
            >
              {node.collapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </button>
          ) : null}
        </div>
        {node.rows.length > 0 ? (
          <ul className="border-t border-neutral-200">
            {node.rows.map((row) => (
              <RowView
                key={row.positionId}
                row={row}
                tone="main"
                onToggleGroup={onToggleGroup}
              />
            ))}
          </ul>
        ) : null}
      </div>

      {node.nsRows.length > 0 ? (
        <div
          className="mt-2 overflow-hidden rounded-[12px] border border-success-dark/40 bg-success-light"
          style={{ height: node.nsH }}
        >
          <ul className="pt-1">
            {node.nsRows.map((row) => (
              <RowView
                key={row.positionId}
                row={row}
                tone="ns"
                onToggleGroup={onToggleGroup}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {resizable ? (
        <WidthHandle
          width={node.w}
          scale={scale}
          onPreview={onResizePreview}
          onCommit={onResizeCommit}
        />
      ) : null}

      {quickActions ? (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -left-[30px] top-3 grid h-9 w-6 place-items-center rounded-[8px] border border-neutral-400 bg-white text-primary-400"
          >
            <GripVertical className="size-4" />
          </span>
          <div className="absolute -top-11 right-0 flex gap-2">
            <button
              type="button"
              data-chart-toggle
              disabled={!canAddChild}
              onClick={() => onAddChild?.(node.id)}
              aria-label={`Tambah ${childLabel} di dalam ${node.unit.name}`}
              title={`Tambah ${childLabel}`}
              className="grid size-9 place-items-center rounded-[10px] bg-secondary-800 text-white hover:bg-secondary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-5" />
            </button>
            <button
              type="button"
              data-chart-toggle
              onClick={() => onRequestDelete?.(node.id)}
              aria-label={`Hapus ${node.unit.name}`}
              title="Hapus"
              className="grid size-9 place-items-center rounded-[10px] bg-danger-dark text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1"
            >
              <Trash2 className="size-5" />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ChartView(props: ChartViewProps): JSX.Element {
  const {
    draft,
    placements,
    selectedId,
    selectedIds,
    onSelect,
    onSelectIds,
    onMoveUnit,
    onDropPositionOnUnit,
    canEditUnit,
    onAddChild,
    onRequestDelete,
    onResizeUnit,
    onArrange,
  } = props;
  const markerId = useId();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
    onNode: boolean;
  } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; mx: number; my: number } | null>(
    null,
  );
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const marqueeRef = useRef<{ pointerId: number; additive: boolean } | null>(
    null,
  );
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [panning, setPanning] = useState(false);
  const [nodeDrag, setNodeDrag] = useState<NodeDrag | null>(null);
  const nodeCandidateRef = useRef<{
    pointerId: number;
    id: string;
    name: string;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const touchedRef = useRef(false);

  // Esc membatalkan seretan bagian.
  const dragging = nodeDrag !== null;
  useEffect(() => {
    if (!dragging) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      nodeCandidateRef.current = null;
      setNodeDrag(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dragging]);

  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggleGroup = useCallback((positionId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(positionId)) next.delete(positionId);
      else next.add(positionId);
      return next;
    });
  }, []);

  // Sakelar tampilan bagan; seperti prototipe, hanya berlaku di sesi ini.
  const [showLabels, setShowLabels] = useState(true);
  const [alignHeights, setAlignHeights] = useState(true);
  const [arrangeOpen, setArrangeOpen] = useState(false);

  // Selama kartu diseret, lebarnya dipratinjau tanpa mengubah draf; baru dicatat saat dilepas.
  const [resizing, setResizing] = useState<{
    id: string;
    width: number;
  } | null>(null);
  const layoutDraft = useMemo<Draft>(
    () =>
      resizing === null
        ? draft
        : {
            ...draft,
            units: draft.units.map((unit) =>
              unit.id === resizing.id
                ? { ...unit, layout: { ...unit.layout, width: resizing.width } }
                : unit,
            ),
          },
    [draft, resizing],
  );
  const layout = useMemo(
    () =>
      layoutChart(layoutDraft, placements, collapsed, expandedGroups, {
        showLabels,
        alignHeights,
      }),
    [layoutDraft, placements, collapsed, expandedGroups, showLabels, alignHeights],
  );

  const fit = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    // Di bawah FIT_FLOOR bagan tak terbaca; lebih baik mulai dari kiri atas dan digeser.
    const scale = clampScale(
      Math.max(
        FIT_FLOOR,
        Math.min(1, width / layout.width, height / layout.height),
      ),
    );
    setView({
      scale,
      x: Math.max(0, (width - layout.width * scale) / 2),
      y: 0,
    });
  }, [layout.width, layout.height]);

  // Pas ke layar sampai orang menggeser atau memperbesar sendiri.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (!touchedRef.current) fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    touchedRef.current = true;
    const el = viewportRef.current;
    const rect = el?.getBoundingClientRect();
    const px = cx ?? (rect ? rect.width / 2 : 0);
    const py = cy ?? (rect ? rect.height / 2 : 0);
    setView((prev) => {
      const scale = clampScale(prev.scale * factor);
      const ratio = scale / prev.scale;
      return {
        scale,
        x: px - (px - prev.x) * ratio,
        y: py - (py - prev.y) * ratio,
      };
    });
  }, []);

  // Ctrl + roda untuk zoom; listener non-pasif supaya halaman tidak ikut zoom.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    // Trackpad: cubit dua jari datang sebagai wheel dengan ctrlKey (Chrome, Firefox, Edge) dan
    // gesture* (Safari) untuk memperbesar; geser dua jari datang sebagai wheel biasa untuk menggeser.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      if (event.ctrlKey || event.metaKey) {
        const rect = el.getBoundingClientRect();
        const delta = Math.max(-30, Math.min(30, event.deltaY * unit));
        zoomAt(
          Math.exp(-delta * 0.012),
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
        return;
      }
      touchedRef.current = true;
      const horizontal = event.shiftKey && event.deltaX === 0;
      const dx = (horizontal ? event.deltaY : event.deltaX) * unit;
      const dy = (horizontal ? 0 : event.deltaY) * unit;
      setView((prev) => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
    };
    type GestureEvent = Event & {
      scale: number;
      clientX: number;
      clientY: number;
    };
    let lastScale = 1;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      lastScale = 1;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as GestureEvent;
      const rect = el.getBoundingClientRect();
      zoomAt(
        gesture.scale / lastScale,
        gesture.clientX - rect.left,
        gesture.clientY - rect.top,
      );
      lastScale = gesture.scale;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
    };
  }, [zoomAt]);

  // Tampilkan bagian yang dipilih dari panel Struktur.
  const selectedBounds = useMemo(
    () =>
      selectedId === null ? null : boundsOf(layout, new Set([selectedId])),
    [layout, selectedId],
  );
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !selectedBounds) return;
    const rect = el.getBoundingClientRect();
    setView((prev) => {
      const left = selectedBounds.x * prev.scale + prev.x;
      const top = selectedBounds.y * prev.scale + prev.y;
      const right = left + selectedBounds.w * prev.scale;
      const bottom = top + selectedBounds.h * prev.scale;
      let { x, y } = prev;
      if (left < CANVAS_PAD) x += CANVAS_PAD - left;
      else if (right > rect.width - CANVAS_PAD)
        x -= right - (rect.width - CANVAS_PAD);
      if (top < CANVAS_PAD) y += CANVAS_PAD - top;
      else if (bottom > rect.height - CANVAS_PAD)
        y -= bottom - (rect.height - CANVAS_PAD);
      return x === prev.x && y === prev.y ? prev : { ...prev, x, y };
    });
  }, [selectedBounds]);

  const handleNodeSelect = (id: string, additive: boolean) => {
    if (!additive) {
      onSelect(id);
      return;
    }
    onSelectIds(
      selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id],
    );
  };

  // Kolom persen zoom yang bisa diketik: null = tampilkan nilai sekarang.
  const [zoomDraft, setZoomDraft] = useState<string | null>(null);
  // Zoom absolut ke tengah kanvas: dipanggil berulang dengan nilai sama tidak mengubah apa pun.
  const applyZoomPercent = (percent: number) => {
    touchedRef.current = true;
    const target = Math.min(MAX_SCALE, Math.max(MIN_SCALE, percent / 100));
    const rect = viewportRef.current?.getBoundingClientRect();
    const px = rect ? rect.width / 2 : 0;
    const py = rect ? rect.height / 2 : 0;
    setView((prev) => {
      const ratio = target / prev.scale;
      return {
        scale: target,
        x: px - (px - prev.x) * ratio,
        y: py - (py - prev.y) * ratio,
      };
    });
  };
  const zoomCancelRef = useRef(false);
  const commitZoom = (text: string | null) => {
    setZoomDraft(null);
    if (text === null || text === '') return;
    const percent = Number(text);
    if (!Number.isFinite(percent) || percent <= 0) return;
    applyZoomPercent(percent);
  };

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Id yang ikut berpindah: seluruh pilihan bila bagian yang diseret termasuk di dalamnya.
  const dragIdsFor = (activeId: string): string[] =>
    selectedIds.length > 1 && selectedIds.includes(activeId)
      ? [...selectedIds]
      : [activeId];

  const computeNodeDrag = (
    candidate: { id: string; name: string },
    x: number,
    y: number,
  ): NodeDrag => {
    const overEl = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>('[data-chart-node]');
    const overId = overEl?.dataset.nodeId ?? null;
    const ids = dragIdsFor(candidate.id);
    const overSelf = overId === candidate.id;
    let position: UnitDropPosition | null = null;
    let valid = false;
    if (overEl && overId && !overSelf) {
      const rect = overEl.getBoundingClientRect();
      const ratio = rect.width > 0 ? (x - rect.left) / rect.width : 0.5;
      position = ratio < 0.2 ? 'before' : ratio > 0.8 ? 'after' : 'inside';
      valid = planUnitsDrop(draft.units, ids, overId, position).ok;
    }
    return {
      id: candidate.id,
      name:
        ids.length > 1
          ? `${candidate.name} dan ${ids.length - 1} lainnya`
          : candidate.name,
      x,
      y,
      overId: overSelf ? null : overId,
      position,
      valid,
    };
  };

  // Salinan terbaru untuk putaran gulir otomatis, yang berjalan di luar siklus render.
  const computeRef = useRef(computeNodeDrag);
  useEffect(() => {
    computeRef.current = computeNodeDrag;
  });

  // Gulir otomatis: menyeret bagian ke tepi kanvas menggeser bagan.
  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    let scrolledLastFrame = false;
    const tick = () => {
      const el = viewportRef.current;
      const candidate = nodeCandidateRef.current;
      if (el && candidate?.active) {
        const { x, y } = lastPointerRef.current;
        if (scrolledLastFrame) {
          // Isi kanvas sudah bergeser; hitung ulang sasaran di bawah penunjuk.
          setNodeDrag(computeRef.current(candidate, x, y));
        }
        const rect = el.getBoundingClientRect();
        const vx = edgeSpeed(x - rect.left, rect.width);
        const vy = edgeSpeed(y - rect.top, rect.height);
        scrolledLastFrame = vx !== 0 || vy !== 0;
        if (scrolledLastFrame) {
          touchedRef.current = true;
          setView((prev) => ({ ...prev, x: prev.x - vx, y: prev.y - vy }));
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dragging]);

  const idsInRect = (x0: number, y0: number, x1: number, y1: number) => {
    const left = Math.min(x0, x1);
    const right = Math.max(x0, x1);
    const top = Math.min(y0, y1);
    const bottom = Math.max(y0, y1);
    return layout.nodes
      .filter((node) => {
        const nl = node.x * view.scale + view.x;
        const nt = node.y * view.scale + view.y;
        return (
          nl < right &&
          nl + node.w * view.scale > left &&
          nt < bottom &&
          nt + node.h * view.scale > top
        );
      })
      .map((node) => node.id);
  };

  const startPinch = () => {
    nodeCandidateRef.current = null;
    setNodeDrag(null);
    dragRef.current = null;
    setPanning(false);
    marqueeRef.current = null;
    setMarquee(null);
    const [a, b] = [...pointersRef.current.values()];
    if (!a || !b) return;
    pinchRef.current = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    if (pointersRef.current.size === 2) {
      startPinch();
      return;
    }
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    // Menekan sebuah bagian lalu menggeser mulai menyeretnya (bila boleh); diam saja berarti klik biasa.
    const nodeEl = target.closest<HTMLElement>('[data-chart-node]');
    const nodeId = nodeEl?.dataset.nodeId;
    if (
      nodeId &&
      onMoveUnit &&
      !target.closest('[data-chart-toggle]') &&
      (canEditUnit?.(nodeId) ?? true)
    ) {
      nodeCandidateRef.current = {
        pointerId: event.pointerId,
        id: nodeId,
        name: draft.units.find((unit) => unit.id === nodeId)?.name ?? '',
        startX: event.clientX,
        startY: event.clientY,
        active: false,
      };
      return;
    }
    if (target.closest('button, [data-chart-toggle]')) return;
    touchedRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Penunjuk sintetis tidak bisa ditangkap.
    }
    // Shift + seret di ruang kosong: kotak pilih (marquee).
    if (event.shiftKey && !nodeEl) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      marqueeRef.current = {
        pointerId: event.pointerId,
        additive: event.ctrlKey || event.metaKey,
      };
      setMarquee({ x0: x, y0: y, x1: x, y1: y, ids: [] });
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
      moved: false,
      onNode: nodeEl !== null,
    };
    setPanning(true);
  };

  const updateNodeDrag = (event: PointerEvent<HTMLDivElement>) => {
    const candidate = nodeCandidateRef.current;
    if (candidate?.pointerId !== event.pointerId) return false;
    if (!candidate.active) {
      const moved = Math.hypot(
        event.clientX - candidate.startX,
        event.clientY - candidate.startY,
      );
      if (moved < DRAG_THRESHOLD) return true;
      candidate.active = true;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Penunjuk sintetis tidak bisa ditangkap; seretan tetap jalan.
      }
    }
    setNodeDrag(computeNodeDrag(candidate, event.clientX, event.clientY));
    return true;
  };

  const finishNodeDrag = (
    event: PointerEvent<HTMLDivElement>,
    drop: boolean,
  ) => {
    const candidate = nodeCandidateRef.current;
    if (candidate?.pointerId !== event.pointerId) return false;
    nodeCandidateRef.current = null;
    const drag = nodeDrag;
    setNodeDrag(null);
    if (
      drop &&
      candidate.active &&
      drag?.overId &&
      drag.position &&
      drag.valid
    ) {
      onMoveUnit?.(candidate.id, drag.overId, drag.position);
    }
    return true;
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }
    lastPointerRef.current = { x: event.clientX, y: event.clientY };

    // Cubit dua jari di layar sentuh: perbesar dan geser sekaligus.
    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const rect = event.currentTarget.getBoundingClientRect();
      if (pinch.dist > 0 && dist > 0) {
        zoomAt(dist / pinch.dist, mx - rect.left, my - rect.top);
      }
      setView((prev) => ({
        ...prev,
        x: prev.x + (mx - pinch.mx),
        y: prev.y + (my - pinch.my),
      }));
      pinchRef.current = { dist, mx, my };
      return;
    }

    const marqueeState = marqueeRef.current;
    if (marqueeState?.pointerId === event.pointerId) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x1 = event.clientX - rect.left;
      const y1 = event.clientY - rect.top;
      setMarquee((prev) =>
        prev
          ? { ...prev, x1, y1, ids: idsInRect(prev.x0, prev.y0, x1, y1) }
          : prev,
      );
      return;
    }

    if (updateNodeDrag(event)) return;
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3
    ) {
      drag.moved = true;
    }
    setView((prev) => ({
      ...prev,
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    }));
  };

  const endPan = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;

    const marqueeState = marqueeRef.current;
    if (marqueeState?.pointerId === event.pointerId) {
      marqueeRef.current = null;
      const current = marquee;
      setMarquee(null);
      if (current && event.type === 'pointerup') {
        onSelectIds(
          marqueeState.additive
            ? [...new Set([...selectedIds, ...current.ids])]
            : current.ids,
        );
      }
      return;
    }
    if (finishNodeDrag(event, event.type === 'pointerup')) return;
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setPanning(false);
    // Klik di ruang kosong (tanpa menggeser) mengosongkan pilihan.
    if (event.type === 'pointerup' && !drag.moved && !drag.onNode) {
      onSelectIds([]);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Hanya saat kanvas sendiri yang fokus; tombol di dalam node punya perilakunya sendiri.
    if (event.target !== event.currentTarget) return;
    const pan = (dx: number, dy: number) => {
      event.preventDefault();
      touchedRef.current = true;
      setView((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    };
    switch (event.key) {
      case 'ArrowLeft':
        pan(PAN_STEP, 0);
        break;
      case 'ArrowRight':
        pan(-PAN_STEP, 0);
        break;
      case 'ArrowUp':
        pan(0, PAN_STEP);
        break;
      case 'ArrowDown':
        pan(0, -PAN_STEP);
        break;
      case '+':
      case '=':
        event.preventDefault();
        zoomAt(ZOOM_STEP);
        break;
      case '-':
        event.preventDefault();
        zoomAt(1 / ZOOM_STEP);
        break;
      case '0':
        event.preventDefault();
        touchedRef.current = false;
        fit();
        break;
      default:
    }
  };

  if (layout.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-700">
        Belum ada bagian di bagan. Tambahkan lewat panel Struktur.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[320px] flex-col bg-neutral-100">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-400 bg-white px-3 py-1.5">
        <div className="relative">
          <Button
            variant="dark_blue_outline"
            size="sm"
            aria-haspopup="menu"
            aria-expanded={arrangeOpen}
            disabled={onArrange === undefined}
            onClick={() => setArrangeOpen((open) => !open)}
          >
            Tata ulang
            <ChevronDown className="size-4" />
          </Button>
          {arrangeOpen ? (
            <>
              <button
                type="button"
                aria-label="Tutup menu tata ulang"
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setArrangeOpen(false)}
              />
              <div
                role="menu"
                className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-[8px] border border-neutral-400 bg-white py-1 shadow-lg"
              >
                {ARRANGE_ITEMS.map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2 text-left hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
                    onClick={() => {
                      setArrangeOpen(false);
                      onArrange?.(item.mode);
                    }}
                  >
                    <span className="block text-sm font-semibold text-neutral-1000">
                      {item.label}
                    </span>
                    <span className="block text-xs text-neutral-700">
                      {item.hint}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <Button
          variant={showLabels ? 'light_blue' : 'dark_blue_outline'}
          size="sm"
          aria-pressed={showLabels}
          onClick={() => setShowLabels((value) => !value)}
          title={
            showLabels
              ? 'Jenis bagian ditulis di atas namanya — klik untuk menyembunyikan'
              : 'Hanya nama bagian yang ditulis — klik untuk menampilkan jenisnya'
          }
        >
          Jenis unit
        </Button>
        <Button
          variant={alignHeights ? 'light_blue' : 'dark_blue_outline'}
          size="sm"
          aria-pressed={alignHeights}
          onClick={() => setAlignHeights((value) => !value)}
          title={
            alignHeights
              ? 'Tinggi kartu diseragamkan per pita — klik untuk mematikan'
              : 'Tinggi kartu mengikuti isinya — klik untuk menyeragamkan'
          }
        >
          Tinggi seragam
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
      <div
        ref={viewportRef}
        role="group"
        aria-label="Bagan organogram. Geser dengan tombol panah, perbesar dengan plus dan minus, nol untuk pas ke layar."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onKeyDown={onKeyDown}
        className={`absolute inset-0 touch-none select-none overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400 ${
          panning || nodeDrag !== null ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        >
          <svg
            aria-hidden
            className="absolute left-0 top-0"
            width={layout.width}
            height={layout.height}
          >
            <defs>
              <marker
                id={markerId}
                viewBox="0 0 6 6"
                refX="5"
                refY="3"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0 0 L6 3 L0 6 z" className="fill-neutral-500" />
              </marker>
            </defs>
            {layout.edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.d}
                fill="none"
                strokeWidth={1.5}
                className="stroke-neutral-500"
                markerEnd={`url(#${markerId})`}
              />
            ))}
          </svg>
          {layout.nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              draft={draft}
              selected={
                selectedIds.includes(node.id) ||
                (marquee?.ids.includes(node.id) ?? false)
              }
              onSelect={handleNodeSelect}
              onToggle={toggle}
              onToggleGroup={toggleGroup}
              quickActions={
                onAddChild !== undefined &&
                selectedIds.length === 1 &&
                selectedIds[0] === node.id &&
                (canEditUnit?.(node.id) ?? true)
              }
              childLabel={levelLabelFor(node.depth + 1, draft.levelLabels)}
              canAddChild={node.depth + 1 <= MAX_DEPTH}
              onAddChild={onAddChild}
              onRequestDelete={onRequestDelete}
              resizable={
                onResizeUnit !== undefined &&
                selectedIds.length === 1 &&
                selectedIds[0] === node.id &&
                (canEditUnit?.(node.id) ?? true)
              }
              showLabel={effectiveShowLabel(node.unit, showLabels)}
              scale={view.scale}
              onResizePreview={(width) =>
                setResizing(width === null ? null : { id: node.id, width })
              }
              onResizeCommit={(width) => {
                setResizing(null);
                onResizeUnit?.(node.id, width);
              }}
              dropPosition={
                nodeDrag?.overId === node.id ? nodeDrag.position : null
              }
              dropValid={nodeDrag?.overId === node.id && nodeDrag.valid}
              dragging={
                nodeDrag !== null &&
                (nodeDrag.id === node.id ||
                  (selectedIds.length > 1 &&
                    selectedIds.includes(nodeDrag.id) &&
                    selectedIds.includes(node.id)))
              }
              onDropPosition={onDropPositionOnUnit}
              canDropPosition={
                onDropPositionOnUnit !== undefined &&
                (canEditUnit?.(node.id) ?? true)
              }
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full border border-neutral-400 bg-white p-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Perkecil"
          onClick={() => zoomAt(1 / ZOOM_STEP)}
        >
          <Minus className="size-4" />
        </Button>
        <input
          type="text"
          inputMode="numeric"
          aria-label="Tingkat zoom dalam persen"
          title="Ketik angka lalu Enter. Panah atas/bawah menambah atau mengurangi 10."
          value={zoomDraft ?? `${Math.round(view.scale * 100)}%`}
          onFocus={(event) => {
            setZoomDraft(String(Math.round(view.scale * 100)));
            event.currentTarget.select();
          }}
          onChange={(event) =>
            setZoomDraft(event.target.value.replace(/[^\d]/g, '').slice(0, 3))
          }
          onBlur={() => {
            if (zoomCancelRef.current) {
              zoomCancelRef.current = false;
              setZoomDraft(null);
              return;
            }
            commitZoom(zoomDraft);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              zoomCancelRef.current = true;
              event.currentTarget.blur();
            } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault();
              const base = Number(zoomDraft ?? Math.round(view.scale * 100));
              const step = event.key === 'ArrowUp' ? 10 : -10;
              const next = Math.min(
                MAX_SCALE * 100,
                Math.max(
                  MIN_SCALE * 100,
                  (Number.isNaN(base) ? 100 : base) + step,
                ),
              );
              setZoomDraft(String(next));
              applyZoomPercent(next);
            }
          }}
          className="h-8 w-14 rounded-[8px] border border-transparent bg-transparent text-center text-xs font-semibold tabular-nums text-neutral-1000 hover:border-neutral-400 focus-visible:border-primary-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-400"
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Perbesar"
          onClick={() => zoomAt(ZOOM_STEP)}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Pas ke layar"
          onClick={() => {
            touchedRef.current = false;
            fit();
          }}
        >
          <ScanSearch className="size-4" />
        </Button>
      </div>
      {marquee ? (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 rounded-[4px] border border-primary-400 bg-primary-100/40"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      ) : null}
      </div>
      {nodeDrag ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 max-w-[220px] truncate rounded-full border border-primary-400 bg-white px-3 py-1 text-sm font-semibold text-neutral-1000"
          style={{ left: nodeDrag.x + 12, top: nodeDrag.y + 12 }}
        >
          {nodeDrag.name}
        </div>
      ) : null}
    </div>
  );
}
