'use client';

import { Maximize2, Minus, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { readCondition } from '~/lib/forms/conditions';
import { cn } from '~/lib/utils';

import { useBuilder } from './builder-context';
import { ConditionEditor } from './condition-editor';
import { describeCondition } from './condition-labels';
import { FIELD_KINDS, conditionSources, kindOf } from './model';
import { richTextToPlain } from './rich-text';

const NODE_W = 280;
const NODE_H = 56;
const HEAD_H = 36;
const GAP = 18;
const LEFT = 30;
const TOP = 20;

type Node = {
  key: string;
  kind: 'section' | 'field' | 'ending';
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  h: number;
  condition: unknown;
  conditional: boolean;
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/**
 * Tab Alur: peta form dari atas ke bawah. Jalur utama berupa garis lurus;
 * pertanyaan, bagian, dan ending bersyarat bergaris putus-putus dengan
 * lengkung dari pertanyaan acuannya. Tata letak otomatis, node tidak bisa
 * diseret; pan dengan menyeret latar, zoom dengan tombol.
 */
export function FlowPane({
  onOpenInContent,
}: {
  onOpenInContent: (fieldId: string) => void;
}) {
  const builder = useBuilder();
  const detail = builder.detail;
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  if (!detail) return null;

  const numbers = builder.numbers;
  const nodes: Node[] = [];
  let y = TOP;
  const push = (n: Omit<Node, 'x' | 'y'>) => {
    nodes.push({ ...n, x: LEFT, y });
    y += n.h + GAP;
  };
  for (const group of builder.groups) {
    if (group.section) {
      push({
        key: `s:${group.section.id}`,
        kind: 'section',
        id: group.section.id,
        label: group.section.title,
        sub: 'Bagian',
        h: HEAD_H,
        condition: group.section.condition,
        conditional: !!readCondition(group.section.condition)?.aturan.length,
      });
    }
    for (const field of group.fields) {
      const n = numbers.get(field.id);
      push({
        key: `f:${field.id}`,
        kind: 'field',
        id: field.id,
        label: richTextToPlain(field.label),
        sub: `${n ? `${n}. ` : ''}${FIELD_KINDS.find((k) => k.kind === kindOf(field))?.label ?? ''}`,
        h: NODE_H,
        condition: field.condition,
        conditional: !!readCondition(field.condition)?.aturan.length,
      });
    }
  }
  if (detail.endings.length > 0) {
    push({
      key: 'e-head',
      kind: 'section',
      id: 'endings',
      label: 'Ending',
      sub: '',
      h: HEAD_H,
      condition: null,
      conditional: false,
    });
    for (const ending of detail.endings) {
      push({
        key: `e:${ending.id}`,
        kind: 'ending',
        id: ending.id,
        label: ending.title,
        sub: 'Ending',
        h: NODE_H,
        condition: ending.condition,
        conditional: !!readCondition(ending.condition)?.aturan.length,
      });
    }
  }

  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const sources = detail.fields.map((f) => ({
    id: f.id,
    type: f.type,
    label: f.label,
    options: f.options,
  }));
  const edges: { d: string; key: string }[] = [];
  nodes.forEach((target) => {
    const rules = readCondition(target.condition)?.aturan ?? [];
    rules.forEach((rule, i) => {
      const from = byKey.get(`f:${rule.fieldId}`);
      if (!from) return;
      const x = LEFT + NODE_W;
      const y1 = from.y + from.h / 2;
      const y2 = target.y + target.h / 2;
      const off = 36 + ((i + nodes.indexOf(target)) % 5) * 12;
      edges.push({
        key: `${target.key}:${i}`,
        d: `M${x},${y1} C${x + off},${y1} ${x + off},${y2} ${x},${y2}`,
      });
    });
  });

  const width = LEFT + NODE_W + 140;
  const height = y + TOP;

  const fit = () => {
    const box = viewport.current;
    if (!box) return;
    const k = clamp(
      Math.min(box.clientWidth / width, box.clientHeight / height),
      0.3,
      1,
    );
    setView({ k, x: (box.clientWidth - width * k) / 2, y: 0 });
  };
  const zoom = (factor: number) =>
    setView((v) => ({ ...v, k: clamp(v.k * factor, 0.3, 2) }));

  const open = selected ? byKey.get(selected) : undefined;

  const panel = () => {
    if (!open) return null;
    const summary = describeCondition(open.condition, sources);
    const targetSources =
      open.kind === 'field'
        ? conditionSources(builder.groups, { fieldId: open.id })
        : open.kind === 'section' && open.id !== 'endings'
          ? conditionSources(builder.groups, { sectionId: open.id })
          : conditionSources(builder.groups, null);
    return (
      <>
        <SheetHeader>
          <SheetTitle className="break-words">{open.label}</SheetTitle>
          <SheetDescription>{open.sub}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 grid gap-4">
          {open.id === 'endings' ? (
            <p className="text-sm text-neutral-700">
              Ending diatur di tab Konten, di bagian paling bawah.
            </p>
          ) : (
            <>
              <p className="text-sm text-neutral-700">
                {summary
                  ? `Tampil jika ${summary}.`
                  : 'Selalu tampil (tanpa kondisi).'}
              </p>
              <div>
                <ConditionEditor
                  title={open.label}
                  value={open.condition}
                  sources={targetSources}
                  onSave={(condition) => {
                    if (open.kind === 'field') {
                      const field = detail.fields.find((f) => f.id === open.id);
                      if (field)
                        builder.edit({ ...builder.draftOf(field), condition });
                    } else if (open.kind === 'section') {
                      void builder.editSection(open.id, { condition });
                    } else {
                      void builder.editEnding(open.id, { condition });
                    }
                  }}
                />
              </div>
              {open.kind === 'field' ? (
                <div>
                  <Button
                    variant="dark_blue_outline"
                    size="sm"
                    onClick={() => {
                      setSelected(null);
                      onOpenInContent(open.id);
                    }}
                  >
                    Buka di Konten
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </>
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-neutral-700">
          Garis putus-putus = tampil bersyarat. Seret latar untuk menggeser;
          klik kotak untuk mengatur kondisinya.
        </p>
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <Button
            variant="dark_blue_outline"
            size="icon"
            aria-label="Perkecil"
            onClick={() => zoom(0.8)}
          >
            <Minus />
          </Button>
          <Button
            variant="dark_blue_outline"
            size="icon"
            aria-label="Perbesar"
            onClick={() => zoom(1.25)}
          >
            <Plus />
          </Button>
          <Button
            variant="dark_blue_outline"
            size="icon"
            aria-label="Pas ke layar"
            onClick={fit}
          >
            <Maximize2 />
          </Button>
        </div>
      </div>

      <div
        ref={viewport}
        className="relative h-[70vh] min-h-96 touch-none overflow-hidden rounded-[24px] border border-neutral-400 bg-neutral-100"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          drag.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const start = drag.current;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          drag.current = { x: e.clientX, y: e.clientY };
          setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width,
            height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
          }}
        >
          <svg
            width={width}
            height={height}
            className="pointer-events-none absolute left-0 top-0"
            aria-hidden
          >
            {nodes.slice(1).map((n, i) => {
              const prev = nodes[i]!;
              const x = LEFT + NODE_W / 2;
              return (
                <line
                  key={n.key}
                  x1={x}
                  y1={prev.y + prev.h}
                  x2={x}
                  y2={n.y}
                  className="stroke-neutral-400"
                  strokeWidth={2}
                />
              );
            })}
            {edges.map((e) => (
              <path
                key={e.key}
                d={e.d}
                fill="none"
                className="stroke-primary-400"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
            ))}
          </svg>
          {nodes.map((n) => (
            <button
              key={n.key}
              type="button"
              onClick={() => setSelected(n.key)}
              style={{ left: n.x, top: n.y, width: NODE_W, height: n.h }}
              className={cn(
                'absolute overflow-hidden rounded-xl border px-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                n.conditional
                  ? 'border-dashed border-primary-400'
                  : 'border-neutral-400',
                n.kind === 'section'
                  ? 'bg-neutral-200 text-sm font-semibold'
                  : n.kind === 'ending'
                    ? 'bg-success-light'
                    : 'bg-neutral-50',
                'hover:border-primary-400',
              )}
            >
              <span className="block truncate text-sm font-medium text-neutral-1000">
                {n.label}
              </span>
              {n.kind !== 'section' ? (
                <span className="block truncate text-xs text-neutral-700">
                  {n.conditional
                    ? `jika ${describeCondition(n.condition, sources)}`
                    : n.sub}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {panel()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
