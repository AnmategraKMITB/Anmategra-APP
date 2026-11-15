'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  GitBranch,
  Layers,
  Maximize2,
  Minus,
  PenLine,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  MAX_RULES,
  OPERATORS_BY_TYPE,
  readCondition,
} from '~/lib/forms/conditions';
import { cn } from '~/lib/utils';
import type { ConditionInput } from '~/server/api/types/form.type';

import { KindIcon } from './add-menu';
import { useBuilder } from './builder-context';
import {
  type ConditionSource,
  type Rule,
  ValueInput,
  emptyRuleFor,
  ruleComplete,
} from './condition-editor';
import {
  OPERATOR_LABELS,
  describeCondition,
  isConditionSource,
} from './condition-labels';
import {
  type EndingOut,
  FIELD_KINDS,
  type FieldKind,
  type FieldOut,
  type SectionOut,
  conditionSources,
  kindOf,
} from './model';
import { richTextToPlain } from './rich-text';

/* Ukuran node dan jarak kolom/baris kanvas, mengikuti prototype. */
const NW = 210;
const NH = 86;
const COLX = 290;
const ROWY = 132;
const END = '__end';

type Block = {
  /** Id node: id pertanyaan apa adanya, `s:` untuk bagian, `e:` untuk ending. */
  id: string;
  kind: 'field' | 'section' | 'ending';
  refId: string;
  title: string;
  typeLabel: string;
  fieldKind?: FieldKind;
  number?: number;
  required: boolean;
  /** Kondisi milik blok ini sendiri (bukan warisan bagian). */
  own: Condition | null;
  /** Aturan sah yang menggambar garis kondisi: milik sendiri, atau warisan bagian. */
  rules: Rule[];
  match: Condition['cocok'];
  /** Tanda kondisi efektif; kosong berarti blok ada di jalur utama. */
  key: string;
  invalid: number;
  field?: FieldOut;
  section?: SectionOut;
  ending?: EndingOut;
};

type Edge = {
  id: string;
  from: string;
  to: string;
  kind: 'seq' | 'cond' | 'rejoin';
  rule?: Rule;
  multi?: boolean;
  match?: Condition['cocok'];
};

type Condition = ConditionInput;
const readCond = (value: unknown) => readCondition(value) as Condition | null;

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

const signature = (c: Condition | null) =>
  c
    ? [
        c.cocok,
        c.aturan.map((r) => [
          r.fieldId,
          r.op,
          r.nilai ?? null,
          r.nilai2 ?? null,
        ]),
      ]
    : null;

/** Urutan blok form apa adanya: bagian, pertanyaannya, lalu ending. */
function buildBlocks(
  groups: { section: SectionOut | null; fields: FieldOut[] }[],
  endings: EndingOut[],
  numbers: Map<string, number>,
): Block[] {
  const out: Block[] = [];
  const seen = new Set<string>();
  const valid = (r: Rule) => seen.has(r.fieldId);
  const conditional = (c: Condition | null) =>
    c && c.aturan.length > 0 ? c : null;

  for (const group of groups) {
    let inherited: Condition | null = null;
    if (group.section) {
      const own = conditional(readCond(group.section.condition));
      const rules = own?.aturan.filter(valid) ?? [];
      inherited = rules.length ? own : null;
      out.push({
        id: `s:${group.section.id}`,
        kind: 'section',
        refId: group.section.id,
        title: group.section.title,
        typeLabel: 'Bagian',
        required: false,
        own,
        rules,
        match: own?.cocok ?? 'semua',
        key: inherited ? JSON.stringify([signature(inherited), null]) : '',
        invalid: (own?.aturan.length ?? 0) - rules.length,
        section: group.section,
      });
    }
    for (const field of group.fields) {
      const own = conditional(readCond(field.condition));
      const ownRules = own?.aturan.filter(valid) ?? [];
      const rules = ownRules.length ? ownRules : (inherited?.aturan ?? []);
      const kind = kindOf(field);
      out.push({
        id: field.id,
        kind: 'field',
        refId: field.id,
        title: richTextToPlain(field.label),
        typeLabel: FIELD_KINDS.find((k) => k.kind === kind)?.label ?? '',
        fieldKind: kind,
        number: numbers.get(field.id),
        required: field.required && field.type !== 'text_block',
        own,
        rules,
        match: (ownRules.length ? own : inherited)?.cocok ?? 'semua',
        key:
          inherited || ownRules.length
            ? JSON.stringify([
                signature(inherited),
                ownRules.length ? signature(own) : null,
              ])
            : '',
        invalid: (own?.aturan.length ?? 0) - ownRules.length,
        field,
      });
      seen.add(field.id);
    }
  }
  for (const ending of endings) {
    const own = conditional(readCond(ending.condition));
    const rules = own?.aturan.filter(valid) ?? [];
    out.push({
      id: `e:${ending.id}`,
      kind: 'ending',
      refId: ending.id,
      title: ending.title,
      typeLabel: 'Ending',
      required: false,
      own,
      rules,
      match: own?.cocok ?? 'semua',
      key: rules.length ? JSON.stringify([null, signature(own)]) : '',
      invalid: (own?.aturan.length ?? 0) - rules.length,
      ending,
    });
  }
  return out;
}

/**
 * Tata letak kiri ke kanan. Jalur utama = blok tanpa syarat di baris 0;
 * blok bersyarat digantung di atas/bawah pertanyaan acuannya, dan blok
 * berurutan dengan syarat identik menjadi satu cabang. Ujung tiap cabang
 * kembali ke blok tanpa syarat berikutnya.
 */
function layoutFlow(blocks: Block[]) {
  const col: Record<string, number> = {};
  const row: Record<string, number> = {};
  const edges: Edge[] = [];
  const rowLast: Record<number, number> = { 0: -1 };
  const order = new Map(blocks.map((b, i) => [b.id, i]));
  let maxCol = -1;
  let prevSpine: string | null = null;
  let prev: Block | null = null;
  const nonEnd = blocks.filter((b) => b.kind !== 'ending');

  for (const b of nonEnd) {
    if (!b.key) {
      col[b.id] = maxCol + 1;
      row[b.id] = 0;
      if (prevSpine)
        edges.push({ id: `s-${b.id}`, from: prevSpine, to: b.id, kind: 'seq' });
      prevSpine = b.id;
    } else if (prev?.key === b.key) {
      col[b.id] = col[prev.id]! + 1;
      row[b.id] = row[prev.id]!;
      edges.push({ id: `c-${b.id}`, from: prev.id, to: b.id, kind: 'seq' });
    } else {
      const anchor = [...b.rules]
        .map((r) => r.fieldId)
        .sort((x, y) => (order.get(y) ?? 0) - (order.get(x) ?? 0))[0]!;
      const c = (col[anchor] ?? maxCol) + 1;
      const anchorRow = row[anchor] ?? 0;
      let r: number | null = null;
      if (anchorRow !== 0 && (rowLast[anchorRow] ?? -1) < c) r = anchorRow;
      for (const cand of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
        if (r !== null) break;
        if ((rowLast[cand] ?? -1) < c) r = cand;
      }
      col[b.id] = c;
      row[b.id] = r ?? 6;
      b.rules.forEach((rule, i) =>
        edges.push({
          id: `k-${b.id}-${i}`,
          from: rule.fieldId,
          to: b.id,
          kind: 'cond',
          rule,
          match: b.match,
          multi: b.rules.length > 1,
        }),
      );
    }
    rowLast[row[b.id]!] = Math.max(rowLast[row[b.id]!] ?? -1, col[b.id]!);
    maxCol = Math.max(maxCol, col[b.id]!);
    prev = b;
  }

  const ends = blocks.filter((b) => b.kind === 'ending');
  const fallback = ends.find((e) => !e.key)?.id ?? END;
  nonEnd.forEach((b, i) => {
    if (!b.key) return;
    const next = nonEnd[i + 1];
    if (next?.key === b.key) return;
    const target = nonEnd.slice(i + 1).find((x) => !x.key);
    edges.push({
      id: `j-${b.id}`,
      from: b.id,
      to: target?.id ?? fallback,
      kind: 'rejoin',
    });
    if (target) col[target.id] = Math.max(col[target.id]!, col[b.id]! + 1);
  });

  // Rapikan ulang kolom jalur utama setelah cabang yang kembali mendorongnya.
  let last = -1;
  for (const b of nonEnd) {
    if (!b.key) {
      col[b.id] = Math.max(col[b.id]!, last + 1);
      last = col[b.id]!;
    } else last = Math.max(last, col[b.id]!);
  }
  maxCol = Math.max(-1, ...nonEnd.map((b) => col[b.id]!));

  // Ending di kolom terakhir; "Selesai (bawaan)" bila tak ada ending tanpa syarat.
  const ids = nonEnd.map((b) => b.id);
  const endIds = [...ends.map((e) => e.id), ...(fallback === END ? [END] : [])];
  const endRows = [0, 1, -1, 2, -2, 3, -3];
  endIds.forEach((id, i) => {
    col[id] = maxCol + 1;
    row[id] = endRows[i] ?? i;
    ids.push(id);
    const ending = ends.find((e) => e.id === id);
    if (!ending?.key) {
      if (prevSpine)
        edges.push({ id: `e-${id}`, from: prevSpine, to: id, kind: 'seq' });
    } else {
      ending.rules.forEach((rule, j) =>
        edges.push({
          id: `k-${id}-${j}`,
          from: rule.fieldId,
          to: id,
          kind: 'cond',
          rule,
          match: ending.match,
          multi: ending.rules.length > 1,
        }),
      );
    }
  });

  const pos: Record<string, { x: number; y: number }> = {};
  for (const id of ids) pos[id] = { x: col[id]! * COLX, y: row[id]! * ROWY };
  return { pos, edges, ids };
}

/** Tunda penyimpanan selama pengguna masih mengetik; disiram saat unmount. */
function useDebounced<T>(save: (value: T) => void, ms = 400) {
  const saveRef = useRef(save);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ value: T } | null>(null);
  useEffect(() => {
    saveRef.current = save;
  });
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (p) saveRef.current(p.value);
  }, []);
  useEffect(() => flush, [flush]);
  return useCallback(
    (value: T) => {
      pending.current = { value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, ms);
    },
    [flush, ms],
  );
}

/**
 * Tab Alur: peta ketergantungan dari kiri ke kanan seperti di prototype.
 * Kanvas digeser dengan menyeret atau scroll, di-zoom dengan Ctrl + scroll
 * atau tombol; klik node untuk mengatur kondisinya di panel logika.
 */
export function FlowPane({
  onOpenInContent,
}: {
  onOpenInContent: (elementId: string) => void;
}) {
  const builder = useBuilder();
  const detail = builder.detail;
  const [sel, setSel] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const view = useRef({ x: 40, y: 0, k: 1 });

  const blocks = useMemo(
    () =>
      detail
        ? buildBlocks(builder.groups, detail.endings, builder.numbers)
        : [],
    [detail, builder.groups, builder.numbers],
  );
  const { pos, edges, ids } = useMemo(() => layoutFlow(blocks), [blocks]);
  const sources = useMemo(
    () =>
      (detail?.fields ?? []).map((f) => ({
        id: f.id,
        type: f.type,
        label: f.label,
        options: f.options,
      })),
    [detail],
  );
  const invalidCount = blocks.reduce((n, b) => n + b.invalid, 0);
  const condCount = blocks.filter((b) => b.key).length;

  const apply = () => {
    const v = view.current;
    if (worldRef.current)
      worldRef.current.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.k})`;
  };
  const fit = useCallback(() => {
    const w = wrapRef.current;
    const xs = Object.values(pos);
    if (!w || !xs.length) return;
    const minX = Math.min(...xs.map((p) => p.x));
    const maxX = Math.max(...xs.map((p) => p.x)) + NW;
    const minY = Math.min(...xs.map((p) => p.y)) - NH / 2 - 30;
    const maxY = Math.max(...xs.map((p) => p.y)) + NH / 2 + 20;
    const W = w.clientWidth;
    const H = w.clientHeight;
    const k = clamp(
      Math.min((W - 80) / (maxX - minX), (H - 80) / (maxY - minY)),
      0.62,
      1.1,
    );
    const fitsX = (maxX - minX) * k <= W - 80;
    view.current = {
      k,
      x: fitsX ? (W - (maxX - minX) * k) / 2 - minX * k : 40 - minX * k,
      y: (H - (maxY - minY) * k) / 2 - minY * k,
    };
    if (worldRef.current)
      worldRef.current.style.transform = `translate(${view.current.x}px,${view.current.y}px) scale(${k})`;
  }, [pos]);

  // Paskan sekali saat tab dibuka; setelah itu posisi kanvas milik pengguna.
  const fitted = useRef(false);
  useLayoutEffect(() => {
    if (fitted.current || !ids.length) return;
    fitted.current = true;
    fit();
  }, [fit, ids.length]);

  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    const w = wrapRef.current;
    if (!w) return;
    const v = view.current;
    const k = clamp(v.k * factor, 0.3, 2);
    const px = cx ?? w.clientWidth / 2;
    const py = cy ?? w.clientHeight / 2;
    v.x = px - ((px - v.x) * k) / v.k;
    v.y = py - ((py - v.y) * k) / v.k;
    v.k = k;
    apply();
  };
  const zoomRef = useRef(zoomAt);
  useEffect(() => {
    zoomRef.current = zoomAt;
  });

  useEffect(() => {
    const w = wrapRef.current;
    if (!w) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = w.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomRef.current(
          Math.exp(-e.deltaY * 0.01),
          e.clientX - r.left,
          e.clientY - r.top,
        );
      } else {
        view.current.x -= e.deltaX;
        view.current.y -= e.deltaY;
        const v = view.current;
        if (worldRef.current)
          worldRef.current.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.k})`;
      }
    };
    w.addEventListener('wheel', onWheel, { passive: false });
    return () => w.removeEventListener('wheel', onWheel);
  }, []);

  // Geser: transform langsung lewat rAF. Pointer baru ditangkap setelah
  // bergeser beberapa piksel supaya klik pada node tetap sampai ke tombolnya.
  const pan = useRef<{
    x0: number;
    y0: number;
    vx: number;
    vy: number;
    moved: boolean;
  } | null>(null);
  const moved = useRef(false);
  const raf = useRef(0);

  if (!detail) return null;

  const selBlock = blocks.find((b) => b.id === sel);
  const bounds = (() => {
    const xs = Object.values(pos);
    if (!xs.length) return { w: 0, minY: 0, maxY: 0 };
    return {
      w: Math.max(...xs.map((p) => p.x)) + NW + 400,
      minY: Math.min(...xs.map((p) => p.y)) - 400,
      maxY: Math.max(...xs.map((p) => p.y)) + 400,
    };
  })();
  const deps = (id: string) =>
    blocks.filter((b) => b.own?.aturan.some((r) => r.fieldId === id)).length;

  return (
    <div className="grid gap-3">
      <div className="flex min-h-12 flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-neutral-400 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-800">
        <Legend className="border-neutral-600">Jalur utama</Legend>
        <Legend className="border-secondary-500">Kondisi tampil</Legend>
        <Legend className="border-dashed border-neutral-600">
          Kembali ke jalur utama
        </Legend>
        <span className="hidden flex-1 sm:block" />
        <span className="text-neutral-700">{condCount} blok bersyarat</span>
        {invalidCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-light px-3 py-1 text-xs font-semibold text-danger-dark">
            <AlertTriangle aria-hidden className="size-3.5" />
            {invalidCount} kondisi merujuk pertanyaan di bawahnya, diabaikan
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 lg:h-[max(28rem,calc(100dvh-var(--app-navbar-h,0px)-var(--builder-head-h,8rem)-7.5rem))] lg:flex-row">
        <div
          ref={wrapRef}
          className="relative h-[65vh] min-h-[24rem] min-w-0 flex-1 cursor-grab touch-none select-none overflow-hidden rounded-[24px] border border-neutral-400 bg-neutral-100 active:cursor-grabbing lg:h-auto"
          style={{
            backgroundImage:
              'radial-gradient(rgb(157 164 168 / 0.45) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            if ((e.target as HTMLElement).closest('[data-flow-ui]')) return;
            moved.current = false;
            pan.current = {
              x0: e.clientX,
              y0: e.clientY,
              vx: view.current.x,
              vy: view.current.y,
              moved: false,
            };
          }}
          onPointerMove={(e) => {
            const p = pan.current;
            if (!p) return;
            const dx = e.clientX - p.x0;
            const dy = e.clientY - p.y0;
            if (!p.moved) {
              if (Math.hypot(dx, dy) < 3) return;
              p.moved = true;
              moved.current = true;
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // Pointer sudah dilepas; geser tetap jalan tanpa capture.
              }
            }
            view.current.x = p.vx + dx;
            view.current.y = p.vy + dy;
            cancelAnimationFrame(raf.current);
            raf.current = requestAnimationFrame(apply);
          }}
          onPointerUp={() => (pan.current = null)}
          onPointerCancel={() => (pan.current = null)}
          onClick={(e) => {
            if (moved.current) return;
            const target = e.target as HTMLElement;
            if (!target.closest('[data-node], [data-flow-ui]')) setSel(null);
          }}
        >
          <div
            ref={worldRef}
            className="absolute left-0 top-0 origin-top-left will-change-transform"
          >
            <svg
              className="pointer-events-none absolute left-0 overflow-visible"
              width={bounds.w}
              height={bounds.maxY - bounds.minY}
              style={{ top: bounds.minY }}
              viewBox={`0 ${bounds.minY} ${bounds.w} ${bounds.maxY - bounds.minY}`}
              aria-hidden
            >
              <defs>
                <marker
                  id="flow-ah"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M0 0 10 5 0 10z" className="fill-neutral-600" />
                </marker>
                <marker
                  id="flow-ahc"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M0 0 10 5 0 10z" className="fill-secondary-500" />
                </marker>
              </defs>
              {edges.map((e) => {
                const a = pos[e.from];
                const b = pos[e.to];
                if (!a || !b) return null;
                const x1 = a.x + NW;
                const x2 = b.x - 4;
                const mx = (x1 + x2) / 2;
                const hl = !!sel && (e.from === sel || e.to === sel);
                return (
                  <path
                    key={e.id}
                    d={`M${x1} ${a.y} C${mx} ${a.y}, ${mx} ${b.y}, ${x2} ${b.y}`}
                    fill="none"
                    markerEnd={
                      e.kind === 'cond' ? 'url(#flow-ahc)' : 'url(#flow-ah)'
                    }
                    className={cn(
                      e.kind === 'cond'
                        ? 'stroke-secondary-500'
                        : 'stroke-neutral-600',
                      e.kind === 'rejoin' && 'opacity-80',
                    )}
                    strokeWidth={hl ? 3 : e.kind === 'cond' ? 2 : 1.6}
                    strokeDasharray={e.kind === 'rejoin' ? '6 5' : undefined}
                  />
                );
              })}
            </svg>

            {edges
              .filter((e) => e.kind === 'cond')
              .map((e) => {
                const b = pos[e.to];
                if (!b || !e.rule) return null;
                const nth = edges
                  .filter((x) => x.kind === 'cond' && x.to === e.to)
                  .indexOf(e);
                const full = describeCondition(
                  { cocok: 'semua', aturan: [e.rule] },
                  sources,
                );
                const source = sources.find((s) => s.id === e.rule!.fieldId);
                const name = source ? richTextToPlain(source.label) : '';
                const short = full.startsWith(name)
                  ? full.slice(name.length).trim()
                  : full;
                const prefix = e.multi
                  ? e.match === 'salah-satu'
                    ? 'atau '
                    : 'dan '
                  : '';
                return (
                  <div
                    key={`${e.id}-l`}
                    title={full}
                    className="pointer-events-none absolute max-w-[132px] -translate-x-1/2 -translate-y-1/2 truncate rounded-full border border-secondary-500 bg-neutral-50 px-2 py-0.5 text-[11.5px] font-semibold text-secondary-800"
                    style={{
                      left: b.x - 70,
                      top: b.y - NH / 2 - 14 - nth * 24,
                    }}
                  >
                    {prefix}
                    {short}
                  </div>
                );
              })}

            {ids.map((id) => {
              const p = pos[id]!;
              if (id === END) {
                return (
                  <div
                    key={id}
                    data-node={id}
                    className="absolute flex flex-col gap-1.5 rounded-2xl border-2 border-transparent bg-primary-100 p-2"
                    style={{
                      left: p.x,
                      top: p.y - NH / 2,
                      width: NW,
                      height: NH,
                    }}
                  >
                    <span className="flex items-center gap-1.5 rounded-lg bg-neutral-50/60 px-2 py-1 text-[11.5px] font-bold text-neutral-800">
                      <CheckCircle2 aria-hidden className="size-3.5" />
                      Selesai (bawaan)
                    </span>
                    <span className="px-1.5 text-[12.5px] leading-snug text-neutral-700">
                      {detail.endings.length
                        ? 'Belum ada ending tanpa syarat'
                        : 'Belum ada ending screen'}
                    </span>
                  </div>
                );
              }
              const b = blocks.find((x) => x.id === id)!;
              const n = deps(id);
              return (
                <button
                  key={id}
                  type="button"
                  data-node={id}
                  onClick={() => setSel(id)}
                  aria-pressed={sel === id}
                  style={{
                    left: p.x,
                    top: p.y - NH / 2,
                    width: NW,
                    height: NH,
                  }}
                  className={cn(
                    'absolute flex flex-col gap-1.5 rounded-2xl border-2 border-transparent p-2 text-left transition-[border-color,box-shadow,background-color] duration-150 hover:border-secondary-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400',
                    b.kind === 'ending'
                      ? 'bg-primary-100'
                      : b.kind === 'section'
                        ? 'bg-secondary-100'
                        : 'bg-neutral-200',
                    sel === id &&
                      'border-secondary-400 bg-neutral-50 shadow-[0_6px_18px_rgba(0,0,0,0.14)] hover:border-secondary-400',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5 rounded-lg bg-neutral-50/60 px-2 py-1 text-[11.5px] font-bold text-neutral-800">
                    {b.key ? (
                      <GitBranch
                        aria-hidden
                        className="size-3.5 shrink-0 text-secondary-700"
                      />
                    ) : (
                      <NodeIcon block={b} />
                    )}
                    <span className="truncate">
                      {b.number ? `${b.number} · ` : ''}
                      {b.typeLabel}
                    </span>
                    {b.required ? (
                      <span
                        className="ml-auto size-1.5 shrink-0 rounded-full bg-tomato"
                        title="Wajib diisi"
                      />
                    ) : null}
                  </span>
                  <span className="line-clamp-2 px-1.5 text-[12.5px] leading-snug text-neutral-1000">
                    {b.title || <i className="text-neutral-700">Tanpa judul</i>}
                  </span>
                  {n > 0 ? (
                    <span
                      title={`Memicu ${n} blok`}
                      className="absolute -right-3 top-1/2 grid size-[22px] -translate-y-1/2 place-items-center rounded-full border-2 border-neutral-100 bg-neutral-800 text-[11px] font-bold text-neutral-50"
                    >
                      {n}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div
            data-flow-ui
            role="group"
            aria-label="Zoom"
            className="absolute bottom-4 left-4 flex gap-1 rounded-xl bg-neutral-50 p-1 shadow-[0_1px_2px_rgba(20,40,40,0.06),0_6px_20px_rgba(20,40,40,0.08)]"
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label="Perkecil"
              title="Perkecil"
              onClick={() => zoomAt(1 / 1.2)}
            >
              <Minus />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Perbesar"
              title="Perbesar"
              onClick={() => zoomAt(1.2)}
            >
              <Plus />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Paskan ke layar"
              title="Paskan ke layar"
              onClick={fit}
            >
              <Maximize2 />
            </Button>
          </div>
          <p className="pointer-events-none absolute bottom-5 right-4 hidden text-xs text-neutral-700 md:block">
            Seret untuk geser · Ctrl + scroll untuk zoom · klik node untuk atur
            kondisi
          </p>
        </div>

        {selBlock ? (
          <LogicPanel
            key={selBlock.id}
            block={selBlock}
            blocks={blocks}
            onClose={() => setSel(null)}
            onSelect={setSel}
            onOpenInContent={onOpenInContent}
          />
        ) : null}
      </div>
    </div>
  );
}

function Legend({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <i aria-hidden className={cn('h-0 w-7 border-t-2', className)} />
      {children}
    </span>
  );
}

function NodeIcon({ block }: { block: Block }) {
  if (block.kind === 'section')
    return <Layers aria-hidden className="size-3.5 shrink-0" />;
  if (block.kind === 'ending')
    return <Flag aria-hidden className="size-3.5 shrink-0" />;
  return <KindIcon kind={block.fieldKind!} className="size-3.5 shrink-0" />;
}

/* ---------------------------------------------------------------------------
   Panel logika
   ------------------------------------------------------------------------- */

const ruleKey = (r: Rule) =>
  JSON.stringify([r.op, r.nilai ?? null, r.nilai2 ?? null]);

const withRules = (
  cond: Condition | null,
  aturan: Rule[],
): ConditionInput | null =>
  aturan.length ? { cocok: cond?.cocok ?? 'semua', aturan } : null;

function LogicPanel({
  block,
  blocks,
  onClose,
  onSelect,
  onOpenInContent,
}: {
  block: Block;
  blocks: Block[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onOpenInContent: (elementId: string) => void;
}) {
  const builder = useBuilder();
  const [drafts, setDrafts] = useState<{ id: number; rule: Rule }[]>([]);
  const nextDraft = useRef(1);
  const panelRef = useRef<HTMLElement>(null);

  // Di layar sempit panel ada di bawah kanvas: bawa ke pandangan saat dibuka.
  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      panelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, []);

  const saveCondition = (b: Block, condition: ConditionInput | null) => {
    if (b.kind === 'field' && b.field) {
      builder.edit({ ...builder.draftOf(b.field), condition });
    } else if (b.kind === 'section') {
      void builder.editSection(b.refId, { condition });
    } else {
      void builder.editEnding(b.refId, { condition });
    }
  };

  const ownSources: ConditionSource[] =
    block.kind === 'field'
      ? conditionSources(builder.groups, { fieldId: block.refId })
      : block.kind === 'section'
        ? conditionSources(builder.groups, { sectionId: block.refId })
        : conditionSources(builder.groups, null);

  const isSource =
    block.kind === 'field' &&
    !!block.field &&
    isConditionSource(block.field.type);
  const asSource: ConditionSource | null =
    isSource && block.field
      ? {
          id: block.field.id,
          type: block.field.type,
          label: block.field.label,
          options: block.field.options,
        }
      : null;

  // Aturan yang dipicu jawaban blok ini = kondisi di blok sesudahnya yang
  // acuannya blok ini, dikelompokkan per kondisi yang sama.
  // Di form oprec, bagian tampil lewat ikatan ke tujuan (tabel ikatan + kondisi
  // bagian sekaligus). Menyunting kondisinya dari sini membuat keduanya tidak
  // sejalan, jadi bagian tidak bisa dijadikan tujuan aturan.
  const oprecForm = !!builder.detail?.oprec;
  const index = blocks.findIndex((b) => b.id === block.id);
  const later = blocks
    .slice(index + 1)
    .filter((b) => !oprecForm || b.kind !== 'section');
  const groups: {
    key: string;
    rule: Rule;
    items: { target: Block; at: number }[];
  }[] = [];
  if (asSource) {
    for (const target of later) {
      target.own?.aturan.forEach((r, at) => {
        if (r.fieldId !== block.refId) return;
        const key = ruleKey(r);
        let g = groups.find((x) => x.key === key);
        if (!g) groups.push((g = { key, rule: r, items: [] }));
        g.items.push({ target, at });
      });
    }
  }

  const patchRules = (
    items: { target: Block; at: number }[],
    patch: Partial<Rule>,
  ) => {
    for (const { target, at } of items) {
      const aturan = target.own!.aturan.map((r, i) =>
        i === at ? { ...r, ...patch } : r,
      );
      saveCondition(target, withRules(target.own, aturan));
    }
  };
  const removeRules = (items: { target: Block; at: number }[]) => {
    for (const { target, at } of items) {
      const aturan = target.own!.aturan.filter((_, i) => i !== at);
      saveCondition(target, withRules(target.own, aturan));
    }
  };
  const addRule = (target: Block, rule: Rule) => {
    const aturan = [...(target.own?.aturan ?? []), rule];
    saveCondition(target, withRules(target.own, aturan));
  };

  // Pertanyaan baru disisipkan sesudah sumber dan cabang yang sudah ada darinya.
  const createTarget = async (
    kind: FieldKind | 'ending',
    title: string,
    rule: Rule,
  ) => {
    const condition: ConditionInput = { cocok: 'semua', aturan: [rule] };
    if (kind === 'ending') {
      const made = await builder.addEnding({
        title: title.trim() || 'Terima kasih!',
        condition,
      });
      if (made) onSelect(`e:${made.id}`);
      return;
    }
    const field = block.field!;
    const group = builder.groups.find((g) =>
      g.fields.some((f) => f.id === field.id),
    );
    const fields = group?.fields ?? [];
    let at = fields.findIndex((f) => f.id === field.id) + 1;
    while (
      at < fields.length &&
      readCond(fields[at]!.condition)?.aturan.some(
        (r) => r.fieldId === field.id,
      )
    ) {
      at++;
    }
    const id = await builder.addField(kind, field.sectionId, at, {
      ...(title.trim() ? { label: title.trim() } : {}),
      condition,
    });
    if (id) onSelect(id);
  };

  const elementId =
    block.kind === 'field'
      ? `field-${block.refId}`
      : block.kind === 'section'
        ? `section-${block.refId}`
        : 'endings-heading';

  return (
    <aside
      ref={panelRef}
      aria-label="Panel logika"
      className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto rounded-[24px] border border-neutral-400 bg-neutral-50 p-4 lg:max-h-none lg:w-[360px] lg:flex-none"
    >
      <div className="flex items-start gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-400 text-xs font-bold text-neutral-50">
          {block.number ?? <NodeIcon block={block} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-neutral-700">{block.typeLabel}</p>
          <p className="break-words font-semibold text-neutral-1000">
            {block.title || 'Tanpa judul'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Tutup panel"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>

      <section className="grid gap-2 border-t border-neutral-400 pt-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-1000">
          <GitBranch aria-hidden className="size-4 text-secondary-700" />
          {block.kind === 'section'
            ? 'Bagian ini tampil jika'
            : block.kind === 'ending'
              ? 'Ending ini dipakai jika'
              : 'Pertanyaan ini tampil jika'}
        </h3>
        {block.kind === 'field' && !block.own && block.key ? (
          <p className="text-xs text-neutral-700">
            Mengikuti kondisi bagiannya. Kondisi di bawah berlaku tambahan.
          </p>
        ) : null}
        {oprecForm && block.kind === 'section' ? (
          <p className="text-sm text-neutral-700">
            Di form oprec, bagian tampil sesuai tujuan yang dipilih pendaftar.
            Atur lewat tombol “Tampil bagi …” pada bagian ini di tab Konten.
          </p>
        ) : (
          <InlineCondition
            value={block.own}
            sources={ownSources}
            onSave={(c) => saveCondition(block, c)}
          />
        )}
      </section>

      {asSource ? (
        <section className="grid gap-2 border-t border-neutral-400 pt-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-1000">
            <GitBranch aria-hidden className="size-4 text-secondary-700" />
            Aturan dari jawaban ini
          </h3>
          <p className="text-xs text-neutral-700">
            Tulis kondisinya, lalu pilih blok yang dimunculkan. Blok tujuan
            tersembunyi sampai kondisinya terpenuhi.
          </p>
          {groups.map((g) => (
            <TriggerGroup
              key={g.key + g.items[0]!.target.id}
              source={asSource}
              rule={g.rule}
              items={g.items}
              later={later}
              onSelect={onSelect}
              onRule={(patch) => patchRules(g.items, patch)}
              onAddTarget={(t) => addRule(t, g.rule)}
              onRemoveTarget={(item) => removeRules([item])}
              onRemove={() => removeRules(g.items)}
              onCreate={(kind, title) => createTarget(kind, title, g.rule)}
            />
          ))}
          {drafts.map((d) => (
            <TriggerGroup
              key={`d${d.id}`}
              source={asSource}
              rule={d.rule}
              items={[]}
              later={later}
              onSelect={onSelect}
              onRule={(patch) =>
                setDrafts((ds) =>
                  ds.map((x) =>
                    x.id === d.id ? { ...x, rule: { ...x.rule, ...patch } } : x,
                  ),
                )
              }
              onAddTarget={(t) => {
                addRule(t, d.rule);
                setDrafts((ds) => ds.filter((x) => x.id !== d.id));
              }}
              onRemoveTarget={() => undefined}
              onRemove={() =>
                setDrafts((ds) => ds.filter((x) => x.id !== d.id))
              }
              onCreate={async (kind, title) => {
                await createTarget(kind, title, d.rule);
                setDrafts((ds) => ds.filter((x) => x.id !== d.id));
              }}
            />
          ))}
          <Button
            variant="dark_blue_outline"
            size="sm"
            className="w-full"
            onClick={() =>
              setDrafts((ds) => [
                ...ds,
                { id: nextDraft.current++, rule: emptyRuleFor(asSource) },
              ])
            }
          >
            <Plus /> Tambah aturan
          </Button>
        </section>
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={() => onOpenInContent(elementId)}
      >
        <PenLine /> Edit isi di Konten
      </Button>
    </aside>
  );
}

/** Satu baris aturan: acuan (bisa dikunci), operator, dan nilainya. */
function RuleRow({
  rule,
  sources,
  fixed,
  invalid,
  onChange,
  onRemove,
}: {
  rule: Rule;
  sources: ConditionSource[];
  fixed?: boolean;
  invalid?: boolean;
  onChange: (patch: Partial<Rule>) => void;
  onRemove?: () => void;
}) {
  const source = sources.find((s) => s.id === rule.fieldId);
  return (
    <div
      className={cn(
        'grid gap-2 rounded-xl border bg-neutral-50 p-2',
        invalid ? 'border-danger-dark' : 'border-neutral-400',
      )}
    >
      <div className="flex items-start gap-1.5">
        {!fixed ? (
          <Select
            value={source ? rule.fieldId : ''}
            onValueChange={(id) => {
              const next = sources.find((s) => s.id === id)!;
              onChange({
                ...emptyRuleFor(next),
                nilai: undefined,
                nilai2: undefined,
              });
            }}
          >
            <SelectTrigger
              aria-label="Pertanyaan acuan"
              className="min-w-0 flex-1"
            >
              <SelectValue placeholder="(acuan tidak sah)" />
            </SelectTrigger>
            <SelectContent>
              {sources.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {richTextToPlain(s.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {source ? (
          <Select
            value={rule.op}
            onValueChange={(op) =>
              onChange({ op, nilai: undefined, nilai2: undefined })
            }
          >
            <SelectTrigger aria-label="Operator" className="min-w-0 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(OPERATORS_BY_TYPE[source.type] ?? []).map((op) => (
                <SelectItem key={op} value={op}>
                  {OPERATOR_LABELS[op] ?? op}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {onRemove ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Hapus kondisi"
            title="Hapus kondisi"
            onClick={onRemove}
          >
            <X />
          </Button>
        ) : null}
      </div>
      {source ? (
        <ValueInput rule={rule} source={source} onChange={onChange} />
      ) : null}
    </div>
  );
}

/**
 * Pembuat kondisi "tampil jika" di panel. Tersimpan otomatis begitu semua
 * aturannya lengkap; menghapus aturan terakhir mengembalikan ke selalu tampil.
 */
function InlineCondition({
  value,
  sources,
  onSave,
}: {
  value: Condition | null;
  sources: ConditionSource[];
  onSave: (next: ConditionInput | null) => void;
}) {
  const stored = JSON.stringify(value);
  const [seen, setSeen] = useState(stored);
  const [draft, setDraft] = useState<ConditionInput>(
    () => value ?? { cocok: 'semua', aturan: [] },
  );
  if (seen !== stored) {
    setSeen(stored);
    setDraft(value ?? { cocok: 'semua', aturan: [] });
  }
  const save = useDebounced(onSave);
  const ids = new Set(sources.map((s) => s.id));

  const commit = (next: ConditionInput) => {
    setDraft(next);
    if (next.aturan.length === 0) save(null);
    else if (next.aturan.every(ruleComplete)) save(next);
  };
  const incomplete = draft.aturan.some((r) => !ruleComplete(r));

  if (!sources.length && draft.aturan.length === 0) {
    return (
      <p className="text-sm text-neutral-700">
        Belum ada pertanyaan sebelum blok ini yang bisa dijadikan syarat.
        Pindahkan blok ini ke bawah atau tambah pertanyaan di atasnya.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {draft.aturan.length === 0 ? (
        <p className="text-sm text-neutral-700">
          Selalu tampil. Tambah kondisi agar blok ini hanya muncul setelah
          prasyaratnya terjawab sesuai aturan.
        </p>
      ) : (
        <>
          {draft.aturan.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-800">
              Tampilkan bila
              <Select
                value={draft.cocok}
                onValueChange={(cocok) =>
                  commit({ ...draft, cocok: cocok as ConditionInput['cocok'] })
                }
              >
                <SelectTrigger
                  className="h-9 w-auto"
                  aria-label="Cara menggabungkan kondisi"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">SEMUA kondisi terpenuhi</SelectItem>
                  <SelectItem value="salah-satu">
                    SALAH SATU kondisi terpenuhi
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {draft.aturan.map((rule, i) => (
            <Fragment key={i}>
              {i > 0 ? (
                <span className="text-xs font-bold text-neutral-700">
                  {draft.cocok === 'salah-satu' ? 'ATAU' : 'DAN'}
                </span>
              ) : null}
              <RuleRow
                rule={rule}
                sources={sources}
                invalid={!ids.has(rule.fieldId)}
                onChange={(patch) =>
                  commit({
                    ...draft,
                    aturan: draft.aturan.map((r, j) =>
                      j === i ? { ...r, ...patch } : r,
                    ),
                  })
                }
                onRemove={() =>
                  commit({
                    ...draft,
                    aturan: draft.aturan.filter((_, j) => j !== i),
                  })
                }
              />
            </Fragment>
          ))}
        </>
      )}
      {incomplete ? (
        <p className="text-xs text-neutral-700">
          Lengkapi nilainya agar kondisi tersimpan.
        </p>
      ) : null}
      {sources.length > 0 && draft.aturan.length < MAX_RULES ? (
        <button
          type="button"
          className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-primary-400 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          onClick={() =>
            commit({
              ...draft,
              aturan: [
                ...draft.aturan,
                emptyRuleFor(sources[sources.length - 1]!),
              ],
            })
          }
        >
          <Plus aria-hidden className="size-3.5" /> Tambah kondisi
        </button>
      ) : null}
    </div>
  );
}

const NEW_QUESTION = '__new_q';
const NEW_ENDING = '__new_e';

/**
 * Satu aturan dari sisi sumber: "Jika jawaban [op] [nilai] → tampilkan
 * [tujuan…]". Disimpan sebagai kondisi di tiap blok tujuan.
 */
function TriggerGroup({
  source,
  rule,
  items,
  later,
  onSelect,
  onRule,
  onAddTarget,
  onRemoveTarget,
  onRemove,
  onCreate,
}: {
  source: ConditionSource;
  rule: Rule;
  items: { target: Block; at: number }[];
  later: Block[];
  onSelect: (id: string) => void;
  onRule: (patch: Partial<Rule>) => void;
  onAddTarget: (target: Block) => void;
  onRemoveTarget: (item: { target: Block; at: number }) => void;
  onRemove: () => void;
  onCreate: (kind: FieldKind | 'ending', title: string) => Promise<void>;
}) {
  const stored = ruleKey(rule);
  const [seen, setSeen] = useState(stored);
  const [local, setLocal] = useState(rule);
  if (seen !== stored) {
    setSeen(stored);
    setLocal(rule);
  }
  const push = useDebounced(onRule);
  const [creating, setCreating] = useState<'q' | 'e' | null>(null);
  const [kind, setKind] = useState<FieldKind>('short_text');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const complete = ruleComplete(local);
  const taken = new Set(items.map((x) => x.target.id));
  const options = later.filter(
    (t) => !taken.has(t.id) && (t.own?.aturan.length ?? 0) < MAX_RULES,
  );
  const questions = options.filter((t) => t.kind !== 'ending');
  const endings = options.filter((t) => t.kind === 'ending');

  const change = (patch: Partial<Rule>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    if (items.length === 0) onRule(patch);
    else if (ruleComplete(next)) push(patch);
  };
  const create = async () => {
    if (!creating) return;
    setBusy(true);
    try {
      await onCreate(creating === 'e' ? 'ending' : kind, title);
      setCreating(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        'grid gap-2 rounded-xl border bg-neutral-100 p-3',
        items.length
          ? 'border-neutral-400'
          : 'border-dashed border-neutral-500',
      )}
    >
      <div className="flex items-center justify-between text-sm font-medium text-neutral-800">
        Jika jawaban
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Hapus aturan"
          title="Hapus aturan beserta semua tujuannya"
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
      <RuleRow rule={local} sources={[source]} fixed onChange={change} />
      <p className="text-sm font-medium text-neutral-800">maka tampilkan</p>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((x) => {
            const extra = (x.target.own?.aturan.length ?? 1) - 1;
            return (
              <span
                key={`${x.target.id}-${x.at}`}
                title={
                  extra > 0
                    ? `Juga punya ${extra} syarat lain (${x.target.own?.cocok === 'salah-satu' ? 'salah satu cukup' : 'semua harus terpenuhi'})`
                    : undefined
                }
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-secondary-300 bg-secondary-100 py-0.5 pl-2 pr-1 text-xs text-secondary-900"
              >
                <NodeIcon block={x.target} />
                <button
                  type="button"
                  className="truncate font-semibold hover:underline"
                  title="Buka node ini"
                  onClick={() => onSelect(x.target.id)}
                >
                  {x.target.number ? `${x.target.number}. ` : ''}
                  {x.target.title || 'Tanpa judul'}
                </button>
                {extra > 0 ? (
                  <b className="text-secondary-700">+{extra}</b>
                ) : null}
                <button
                  type="button"
                  aria-label={`Lepas ${x.target.title}`}
                  className="grid size-5 place-items-center rounded-full hover:bg-secondary-200"
                  onClick={() => onRemoveTarget(x)}
                >
                  <X aria-hidden className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      <Select
        value={
          creating === 'q' ? NEW_QUESTION : creating === 'e' ? NEW_ENDING : ''
        }
        disabled={!complete}
        onValueChange={(v) => {
          if (v === NEW_QUESTION) {
            setCreating('q');
            setTitle('');
          } else if (v === NEW_ENDING) {
            setCreating('e');
            setTitle('Terima kasih!');
          } else {
            const t = later.find((b) => b.id === v);
            if (t) onAddTarget(t);
          }
        }}
      >
        <SelectTrigger
          aria-label="Tambah tujuan"
          className={cn(
            !items.length && !creating && complete && 'border-secondary-500',
          )}
        >
          <SelectValue
            placeholder={
              !complete
                ? 'Lengkapi kondisinya dulu'
                : items.length
                  ? '+ Tambah tujuan…'
                  : 'Pilih atau buat tujuan…'
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Buat baru</SelectLabel>
            <SelectItem value={NEW_QUESTION}>+ Pertanyaan baru…</SelectItem>
            <SelectItem value={NEW_ENDING}>+ Ending baru…</SelectItem>
          </SelectGroup>
          {questions.length ? (
            <SelectGroup>
              <SelectLabel>Pertanyaan & bagian berikutnya</SelectLabel>
              {questions.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.kind === 'section'
                    ? 'Bagian: '
                    : t.number
                      ? `${t.number}. `
                      : ''}
                  {t.title || 'Tanpa judul'}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
          {endings.length ? (
            <SelectGroup>
              <SelectLabel>Ending</SelectLabel>
              {endings.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title || 'Tanpa judul'}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
        </SelectContent>
      </Select>

      {creating ? (
        <div className="grid gap-2 rounded-xl border border-neutral-400 bg-neutral-50 p-2.5">
          {creating === 'q' ? (
            <Select value={kind} onValueChange={(v) => setKind(v as FieldKind)}>
              <SelectTrigger aria-label="Jenis pertanyaan baru">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_KINDS.map((k) => (
                  <SelectItem key={k.kind} value={k.kind}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Input
            autoFocus
            aria-label="Judul"
            placeholder={
              creating === 'q' ? 'Tulis pertanyaannya…' : 'Judul ending'
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void create();
              }
              if (e.key === 'Escape') setCreating(null);
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="dark_blue"
              size="sm"
              disabled={busy}
              onClick={() => void create()}
            >
              Buat & sambungkan
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCreating(null)}>
              Batal
            </Button>
          </div>
          <p className="text-xs text-neutral-700">
            {creating === 'q'
              ? 'Disisipkan setelah pertanyaan ini dan tersembunyi sampai kondisinya terpenuhi. Isinya bisa dilengkapi di Konten.'
              : 'Ending ini dipakai bila kondisinya terpenuhi.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
