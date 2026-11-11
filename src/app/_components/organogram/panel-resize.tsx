'use client';

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useState,
} from 'react';
import type { JSX } from 'react';
import { cn } from '~/lib/utils';

export type PanelConfig = {
  /** Kunci penyimpanan ringkas di localStorage. */
  storageKey: string;
  defaultWidth: number;
  min: number;
  max: number;
};

type Stored = { width: number; collapsed: boolean };

function readStored(config: PanelConfig): Stored {
  const fallback = { width: config.defaultWidth, collapsed: false };
  try {
    const raw = window.localStorage.getItem(config.storageKey);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    const width =
      typeof parsed.width === 'number' &&
      parsed.width >= config.min &&
      parsed.width <= config.max
        ? parsed.width
        : config.defaultWidth;
    return { width, collapsed: parsed.collapsed === true };
  } catch {
    return fallback;
  }
}

function writeStored(config: PanelConfig, value: Stored): void {
  try {
    window.localStorage.setItem(config.storageKey, JSON.stringify(value));
  } catch {
    // Penyimpanan tidak tersedia (mode privat, dll): ukuran tidak diingat.
  }
}

/** Lebar dan status tutup sebuah panel samping; diingat per peramban. */
export function usePanel(config: PanelConfig) {
  const [state, setState] = useState<Stored>(() => readStored(config));

  const update = useCallback(
    (next: Stored) => {
      setState(next);
      writeStored(config, next);
    },
    [config],
  );

  return {
    width: state.width,
    collapsed: state.collapsed,
    setWidth: (width: number) =>
      update({
        width: Math.min(config.max, Math.max(config.min, Math.round(width))),
        collapsed: false,
      }),
    setCollapsed: (collapsed: boolean) =>
      update({ width: state.width, collapsed }),
    toggle: () => update({ width: state.width, collapsed: !state.collapsed }),
    reset: () => update({ width: config.defaultWidth, collapsed: false }),
  };
}

type ResizeHandleProps = {
  /** Sisi panel yang dipegang: panel kiri dipegang di tepi kanannya, dan sebaliknya. */
  edge: 'right' | 'left';
  label: string;
  width: number;
  min: number;
  max: number;
  onResize: (width: number) => void;
  onCollapse: () => void;
  onReset: () => void;
};

const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

/**
 * Pegangan geser di tepi panel. Seret untuk mengubah lebar; menyeret jauh di
 * bawah lebar minimum menutup panel (seperti Figma). Papan ketik: panah kiri/kanan
 * mengubah 16 px (Shift 64 px), Home/End ke batas, Enter menutup, dobel-klik mereset.
 */
export function ResizeHandle(props: ResizeHandleProps): JSX.Element {
  const { edge, label, width, min, max, onResize, onCollapse, onReset } = props;
  const [dragging, setDragging] = useState(false);

  const grow = edge === 'right' ? 1 : -1;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget;
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // Penunjuk sintetis tidak bisa ditangkap; seretan tetap jalan lewat target.
    }
    const startX = event.clientX;
    const startWidth = width;
    setDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (move: PointerEvent) => {
      const next = startWidth + (move.clientX - startX) * grow;
      if (next < min - 80) {
        finish();
        onCollapse();
        return;
      }
      onResize(Math.min(max, Math.max(min, next)));
    };
    const finish = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', finish);
      target.removeEventListener('pointercancel', finish);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDragging(false);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', finish);
    target.addEventListener('pointercancel', finish);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const direction = (event.key === 'ArrowRight' ? 1 : -1) * grow;
      onResize(Math.min(max, Math.max(min, width + direction * step)));
    } else if (event.key === 'Home') {
      event.preventDefault();
      onResize(min);
    } else if (event.key === 'End') {
      event.preventDefault();
      onResize(max);
    } else if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      onCollapse();
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title="Seret untuk mengubah lebar. Dobel-klik untuk mengembalikan."
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className={cn(
        'group absolute top-0 z-10 h-full w-2 cursor-col-resize touch-none focus-visible:outline-none',
        edge === 'right' ? '-right-1' : '-left-1',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-0 h-full w-0.5 transition-colors duration-150 group-hover:bg-primary-400 group-focus-visible:bg-primary-400',
          edge === 'right' ? 'right-[3px]' : 'left-[3px]',
          dragging ? 'bg-primary-400' : 'bg-transparent',
        )}
      />
    </div>
  );
}
