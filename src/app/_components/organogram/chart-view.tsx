'use client';

import {
  ChevronDown,
  ChevronRight,
  Minus,
  Plus,
  ScanSearch,
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
  HEADER_H,
  SEAT_H,
  boundsOf,
  layoutChart,
} from './chart-layout';
import type { ChartNode, SeatRow } from './chart-layout';
import { type Draft, type PlacementsByPosition, unitTypeLabel } from './model';

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
  onSelect: (id: string) => void;
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

function RowView(props: { row: SeatRow }): JSX.Element {
  const { row } = props;
  if (row.kind === 'seat') {
    const name = row.person?.name ?? null;
    return (
      <li className="flex items-center gap-2 px-3" style={{ height: SEAT_H }}>
        {row.person ? (
          <PersonAvatar name={name ?? 'Tanpa nama'} image={row.person.image} />
        ) : (
          <span
            aria-hidden
            className="size-6 shrink-0 rounded-full border border-dashed border-neutral-400"
          />
        )}
        <span className="min-w-0 flex-1 truncate text-sm text-neutral-1000">
          <span className="font-semibold">{row.title}</span>
          <span className="text-neutral-700">
            {' · '}
            {row.person ? (name ?? 'Tanpa nama') : 'Kosong'}
          </span>
        </span>
      </li>
    );
  }

  const shown = row.people.slice(0, 3);
  const extra = row.people.length - shown.length;
  const count =
    row.quota === 0 ? `${row.filled} orang` : `${row.filled}/${row.quota}`;
  return (
    <li className="flex items-center gap-2 px-3" style={{ height: GROUP_H }}>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-1000">
        {row.title}
      </span>
      <span className="flex -space-x-1.5" aria-hidden>
        {shown.map((person) => (
          <PersonAvatar
            key={person.id}
            name={person.name ?? 'Tanpa nama'}
            image={person.image}
          />
        ))}
      </span>
      {extra > 0 ? (
        <span className="text-xs tabular-nums text-neutral-700">+{extra}</span>
      ) : null}
      <span className="text-xs font-semibold tabular-nums text-neutral-700">
        {count}
      </span>
    </li>
  );
}

function NodeCard(props: {
  node: ChartNode;
  draft: Draft;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}): JSX.Element {
  const { node, draft, selected, onSelect, onToggle } = props;
  const typeLabel = unitTypeLabel(node.unit, node.depth, draft.levelLabels);

  return (
    <div
      data-chart-node
      className={`absolute overflow-hidden rounded-[12px] border transition-colors duration-150 ${
        selected
          ? 'border-primary-400 bg-primary-100'
          : 'border-neutral-400 bg-white'
      }`}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
    >
      <div className="flex items-center" style={{ height: HEADER_H }}>
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          aria-pressed={selected}
          className="flex h-full min-w-0 flex-1 flex-col justify-center px-3 text-left hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
        >
          <span className="truncate text-sm font-semibold text-neutral-1000">
            {node.unit.name}
          </span>
          <span className="truncate text-xs text-neutral-700">{typeLabel}</span>
        </button>
        {node.hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-expanded={!node.collapsed}
            aria-label={
              node.collapsed
                ? `Buka bagian di bawah ${node.unit.name}`
                : `Ciutkan bagian di bawah ${node.unit.name}`
            }
            className="flex size-11 shrink-0 items-center justify-center text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
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
            <RowView key={row.positionId} row={row} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ChartView(props: ChartViewProps): JSX.Element {
  const { draft, placements, selectedId, onSelect } = props;
  const markerId = useId();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [panning, setPanning] = useState(false);
  const touchedRef = useRef(false);

  const layout = useMemo(
    () => layoutChart(draft, placements, collapsed),
    [draft, placements, collapsed],
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
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(
        event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
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

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button')) return;
    touchedRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
    };
    setPanning(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    setView((prev) => ({
      ...prev,
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    }));
  };

  const endPan = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setPanning(false);
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
    <div className="relative h-full min-h-[320px] bg-neutral-100">
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
        className={`absolute inset-0 touch-none overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400 ${
          panning ? 'cursor-grabbing' : 'cursor-grab'
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
              selected={node.id === selectedId}
              onSelect={onSelect}
              onToggle={toggle}
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
        <span
          className="w-12 text-center text-xs font-semibold tabular-nums text-neutral-700"
          aria-live="polite"
        >
          {Math.round(view.scale * 100)}%
        </span>
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
    </div>
  );
}
