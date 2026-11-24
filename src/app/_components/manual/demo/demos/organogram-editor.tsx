'use client';

// Library Import
import {
  ChevronDown,
  ChevronRight,
  Download,
  GripVertical,
  Minus,
  PanelLeft,
  PanelRight,
  Plus,
  Redo2,
  ScanSearch,
  Search,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '~/lib/utils';

import { DEMO_STUDENTS, matchesStudent } from '../data';
import { DemoFrame, type DemoGuide, type DemoStep } from '../demo-frame';
import { Btn, Field, inputClass, tdClass, thClass, useFlash } from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'pilih',
    title: 'Di panel **Struktur**, pilih **Event Organizer**',
    hint: 'Bagan menyorot kotak yang sama, dan panel **Detail** menampilkan isinya.',
  },
  {
    id: 'tambah',
    title: 'Klik **Tambah Subdivisi di dalam Event Organizer**',
    hint: 'Bagan menyusun ulang dirinya sendiri. Anda tidak perlu menggeser kotak.',
  },
  {
    id: 'nama',
    title: 'Di panel **Detail**, ganti nama subdivisi baru, misalnya "Rundown"',
  },
  {
    id: 'jabatan',
    title:
      'Pada bagian **Jabatan**, klik **Tambah**, lalu beri nama jabatannya',
    hint: 'Atur juga **Rank** dan **Kuota**. Kuota inilah yang nanti dipakai oprec.',
  },
  {
    id: 'simpan',
    title: 'Klik **Simpan**',
    hint: 'Orang baru bisa ditempatkan setelah jabatannya tersimpan.',
  },
  {
    id: 'orang',
    title: 'Ketik nama pada **Cari nama atau NIM**, lalu pilih orangnya',
  },
  {
    id: 'tabel',
    title: 'Buka tab **Tabel** untuk melihat semua jabatan sekaligus',
  },
];

const LEVELS = ['Bidang', 'Divisi', 'Subdivisi', 'Bagian'];
const RANKS = ['Kepala', 'Wakil', 'Koordinator', 'Staf'];

type Mode = 'bagan' | 'tabel' | 'pengaturan';

const MODES: { id: Mode; label: string }[] = [
  { id: 'bagan', label: 'Bagan' },
  { id: 'tabel', label: 'Tabel' },
  { id: 'pengaturan', label: 'Pengaturan' },
];

const ARRANGE_ITEMS = [
  { label: 'Seimbangkan', hint: 'terbesar di tengah, mengecil ke tepi' },
  { label: 'Terbesar dulu', hint: 'bagian dengan subbagian terbanyak di kiri' },
  { label: 'Alfabetis', hint: 'urut nama A→Z' },
  {
    label: 'Ratakan tier',
    hint: 'buang semua tier manual, kembali ke kedalaman',
  },
] as const;

type Unit = {
  id: string;
  name: string;
  parentId: string | null;
  /** Sebutan khusus, mis. Kesekjenan, menggantikan nama level. */
  typeLabel?: string;
};
type Position = {
  id: string;
  unitId: string;
  title: string;
  rank: string;
  quota: number;
  people: string[];
  saved: boolean;
};
type Snapshot = { units: Unit[]; positions: Position[] };

// Struktur meniru contoh KAT ITB 2026 di prototipe editor organogram, diringkas
// ke lima bidang supaya muat di simulasi. Nama orang fiktif.
const ROOT = {
  name: 'KAT ITB 2026',
  label: 'Kepanitiaan',
  head: 'Ketua',
  person: 's4',
};
const ROOT_ID = '__root';

const UNITS: Unit[] = [
  { id: 'sekjen', name: 'Kesekjenan', parentId: null, typeLabel: 'Kesekjenan' },
  { id: 'sekretaris', name: 'Sekretaris', parentId: 'sekjen' },
  { id: 'bendahara', name: 'Bendahara', parentId: 'sekjen' },
  { id: 'perizinan', name: 'Perizinan', parentId: 'sekjen' },
  { id: 'hr', name: 'Human Resources', parentId: null },
  { id: 'hr-bidang', name: 'HR Bidang', parentId: 'hr' },
  { id: 'hr-pusat', name: 'HR Pusat', parentId: 'hr' },
  { id: 'acara', name: 'Acara', parentId: null },
  { id: 'manajemen-acara', name: 'Manajemen Acara', parentId: 'acara' },
  { id: 'eo', name: 'Event Organizer', parentId: 'acara' },
  { id: 'seremonial', name: 'Seremonial', parentId: 'acara' },
  { id: 'ops', name: 'Operasional', parentId: null },
  { id: 'produksi', name: 'Produksi', parentId: 'ops' },
  { id: 'akamtrans', name: 'Akamtrans', parentId: 'ops' },
  { id: 'logistik', name: 'Logistik', parentId: 'ops' },
  { id: 'kreatif', name: 'Kreatif', parentId: null },
  { id: 'grafis', name: 'Grafis', parentId: 'kreatif' },
  { id: 'dokumentasi', name: 'Dokumentasi', parentId: 'kreatif' },
  { id: 'publikasi', name: 'Publikasi', parentId: 'kreatif' },
];

const POSITIONS: Position[] = [
  {
    id: 'p1',
    unitId: 'sekjen',
    title: 'Sekretaris Jenderal',
    rank: 'Kepala',
    quota: 1,
    people: ['s2'],
    saved: true,
  },
  {
    id: 'p2',
    unitId: 'hr',
    title: 'Kepala Bidang',
    rank: 'Kepala',
    quota: 1,
    people: ['s6'],
    saved: true,
  },
  {
    id: 'p3',
    unitId: 'acara',
    title: 'Kepala Bidang',
    rank: 'Kepala',
    quota: 1,
    people: ['s3'],
    saved: true,
  },
  {
    id: 'p4',
    unitId: 'acara',
    title: 'Wakil Kepala Bidang',
    rank: 'Wakil',
    quota: 1,
    people: [],
    saved: true,
  },
  {
    id: 'p5',
    unitId: 'eo',
    title: 'Ketua Divisi',
    rank: 'Kepala',
    quota: 1,
    people: ['s5'],
    saved: true,
  },
  {
    id: 'p6',
    unitId: 'eo',
    title: 'Staf',
    rank: 'Staf',
    quota: 6,
    people: [],
    saved: true,
  },
  {
    id: 'p7',
    unitId: 'ops',
    title: 'Kepala Bidang',
    rank: 'Kepala',
    quota: 1,
    people: ['s7'],
    saved: true,
  },
  {
    id: 'p8',
    unitId: 'logistik',
    title: 'Ketua Divisi',
    rank: 'Kepala',
    quota: 1,
    people: [],
    saved: true,
  },
  {
    id: 'p9',
    unitId: 'kreatif',
    title: 'Kepala Bidang',
    rank: 'Kepala',
    quota: 1,
    people: ['s8'],
    saved: true,
  },
  {
    id: 'p10',
    unitId: 'grafis',
    title: 'Staf',
    rank: 'Staf',
    quota: 6,
    people: [],
    saved: true,
  },
];

// Garis penghubung bagan: akar ke tiap bidang (melebar), lalu divisi
// menggantung di bawah bidangnya.
const CHART_CSS = `
.oc { display: flex; flex-direction: column; align-items: center; }
.oc > ul { display: flex; align-items: flex-start; padding-top: 20px; position: relative; }
.oc > ul::before { content: ''; position: absolute; top: 0; left: 50%; height: 20px; border-left: 1px solid #9DA4A8; }
.oc > ul > li { position: relative; padding: 20px 10px 0; display: flex; flex-direction: column; align-items: flex-start; }
.oc > ul > li::before, .oc > ul > li::after { content: ''; position: absolute; top: 0; width: 50%; height: 20px; border-top: 1px solid #9DA4A8; }
.oc > ul > li::before { right: 50%; }
.oc > ul > li::after { left: 50%; border-left: 1px solid #9DA4A8; }
.oc > ul > li:first-child::before, .oc > ul > li:last-child::after { border-top: 0; }
.oc > ul > li:last-child::before { border-right: 1px solid #9DA4A8; }
.oc > ul > li:only-child::before { display: none; }
.oc > ul > li:only-child::after { border-top: 0; }
.oc > ul > li::after { left: 50%; }
.oc > ul > li > div:first-child { align-self: center; }
.oc-hang { position: relative; margin-left: 18px; padding-left: 16px; padding-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.oc-hang::before { content: ''; position: absolute; left: 0; top: 0; bottom: 18px; border-left: 1px solid #9DA4A8; }
.oc-hang-item { position: relative; }
.oc-hang-item::before { content: ''; position: absolute; left: -16px; top: 18px; width: 16px; border-top: 1px solid #9DA4A8; }
`;

const studentName = (id: string) =>
  DEMO_STUDENTS.find((student) => student.id === id)?.name ?? 'Tanpa nama';

function depthOf(units: Unit[], id: string): number {
  let depth = 0;
  let current = units.find((unit) => unit.id === id);
  while (current?.parentId) {
    depth += 1;
    current = units.find((unit) => unit.id === current?.parentId);
  }
  return depth;
}

const levelLabel = (depth: number) => LEVELS[depth] ?? 'Bagian';

function pathOf(units: Unit[], id: string): string {
  const names: string[] = [];
  let current = units.find((unit) => unit.id === id);
  while (current) {
    names.unshift(current.name);
    current = current.parentId
      ? units.find((unit) => unit.id === current?.parentId)
      : undefined;
  }
  return names.join(' › ');
}

function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part !== '');
  const first = parts[0]?.charAt(0) ?? '';
  const last =
    parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase() || '?';
}

function rankPillClass(rank: string): string {
  const index = RANKS.indexOf(rank);
  if (index === 0) return 'bg-primary-400 text-white';
  if (index === 1) return 'bg-secondary-800 text-white';
  if (index === 2) return 'bg-primary-200 text-primary-400';
  return 'bg-neutral-200 text-neutral-1000';
}

function AvatarInitial({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full border border-neutral-400 bg-primary-200 text-[10px] font-semibold text-primary-400',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[8px] bg-neutral-100 px-2 py-2 text-center">
      <p className="text-base font-semibold tabular-nums text-primary-400">
        {value}
      </p>
      <p className="text-[10px] text-neutral-700">{label}</p>
    </div>
  );
}

export default function OrganogramEditorDemo() {
  return (
    <DemoFrame
      title="Editor organogram"
      location="Lembaga › Organogram › Aku Masuk ITB 2027"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [tab, setTab] = useState<Mode>('bagan');
  const [units, setUnits] = useState<Unit[]>(UNITS);
  const [positions, setPositions] = useState<Position[]>(POSITIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [counter, setCounter] = useState(1);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [showHint, setShowHint] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [alignHeights, setAlignHeights] = useState(true);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [zoom, setZoom] = useState(50);
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState<Record<string, string>>({});
  const [locked, setLocked] = useState(false);
  const { flash, node } = useFlash();
  const rootRef = useRef<HTMLDivElement>(null);

  const [narrow, setNarrow] = useState(false);

  // Di kolom manual yang sempit, panel Detail baru tampil saat ada bagian
  // yang dipilih supaya bagan tidak tergencet.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setNarrow(entry.contentRect.width < 860);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const selected = units.find((unit) => unit.id === selectedId) ?? null;
  const selectedDepth = selected ? depthOf(units, selected.id) : 0;
  const childLabel = levelLabel(selectedDepth + 1);
  const level1Count = units.filter((unit) => unit.parentId === null).length;
  const positionCount = positions.length;
  const maxDepth =
    units.reduce((max, unit) => Math.max(max, depthOf(units, unit.id)), 0) + 1;
  const totalPeople = positions.reduce(
    (sum, position) => sum + position.people.length,
    0,
  );
  const peopleIn = (unitId: string) =>
    positions
      .filter((position) => position.unitId === unitId)
      .reduce((sum, position) => sum + position.people.length, 0);
  const unitPositions = selected
    ? positions.filter((position) => position.unitId === selected.id)
    : [];

  const commit = (nextUnits: Unit[], nextPositions: Position[]) => {
    setPast((prev) => [...prev, { units, positions }]);
    setFuture([]);
    setUnits(nextUnits);
    setPositions(nextPositions);
    setDirty(true);
  };

  // Seret-lepas memakai pointer event, sama seperti editor aslinya: lebih andal
  // daripada drag HTML5 di tombol dan tetap jalan di dalam salindia yang diskalakan.
  const [drag, setDrag] = useState<{
    id: string;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const dragStart = useRef<{ id: string; x: number; y: number } | null>(null);
  const justDragged = useRef(false);
  const dragId = drag?.active ? drag.id : null;

  /** Bagian tidak boleh dipindah ke dirinya sendiri atau ke subbagiannya. */
  const canDrop = (id: string | null, targetId: string): boolean => {
    if (!id || id === targetId) return false;
    const moving = units.find((unit) => unit.id === id);
    if (targetId === ROOT_ID) return moving?.parentId !== null;
    let current = units.find((unit) => unit.id === targetId);
    while (current) {
      if (current.id === id) return false;
      current = current.parentId
        ? units.find((unit) => unit.id === current?.parentId)
        : undefined;
    }
    return moving?.parentId !== targetId;
  };

  const startDrag = (event: React.PointerEvent, unitId: string) => {
    if (event.button !== 0) return;
    dragStart.current = { id: unitId, x: event.clientX, y: event.clientY };
  };

  useEffect(() => {
    const targetAt = (x: number, y: number) =>
      document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-unit-drop]')
        ?.dataset.unitDrop ?? null;

    const onMove = (event: PointerEvent) => {
      const start = dragStart.current;
      if (!start) return;
      const far =
        Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) >
        6;
      if (!far && !drag?.active) return;
      event.preventDefault();
      setDrag({
        id: start.id,
        x: event.clientX,
        y: event.clientY,
        active: true,
      });
      const target = targetAt(event.clientX, event.clientY);
      setDropId(target && canDrop(start.id, target) ? target : null);
    };

    const onUp = () => {
      const start = dragStart.current;
      dragStart.current = null;
      if (!start || !drag?.active) {
        setDrag(null);
        return;
      }
      justDragged.current = true;
      window.setTimeout(() => {
        justDragged.current = false;
      }, 0);
      const target = dropId;
      setDrag(null);
      setDropId(null);
      if (!target || !canDrop(start.id, target)) return;
      const moved = units.find((unit) => unit.id === start.id);
      const parentId = target === ROOT_ID ? null : target;
      const targetName =
        target === ROOT_ID
          ? ROOT.name
          : (units.find((unit) => unit.id === target)?.name ?? '');
      commit(
        units.map((unit) =>
          unit.id === start.id ? { ...unit, parentId } : unit,
        ),
        positions,
      );
      flash(`${moved?.name ?? 'Bagian'} dipindah ke bawah ${targetName}.`);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  });

  const dragProps = (unitId: string) => ({
    'data-unit-drop': unitId,
    onPointerDown: (event: React.PointerEvent) => startDrag(event, unitId),
  });

  const undo = () => {
    const last = past[past.length - 1];
    if (!last) return;
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [{ units, positions }, ...prev]);
    setUnits(last.units);
    setPositions(last.positions);
    setDirty(true);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, { units, positions }]);
    setUnits(next.units);
    setPositions(next.positions);
    setDirty(true);
  };

  const select = (id: string | null) => {
    if (justDragged.current) return;
    setSelectedId(id);
    if (id) setShowRight(true);
    if (id === 'eo') guide.complete('pilih');
  };

  const addChild = (parentId: string) => {
    const parent = units.find((unit) => unit.id === parentId);
    if (!parent) return;
    const label = levelLabel(depthOf(units, parentId) + 1);
    const id = `u${counter}`;
    setCounter((value) => value + 1);
    commit([...units, { id, name: `${label} baru`, parentId }], positions);
    setSelectedId(id);
    guide.complete('tambah');
  };

  const addRoot = () => {
    const id = `u${counter}`;
    setCounter((value) => value + 1);
    commit(
      [...units, { id, name: `${levelLabel(0)} baru`, parentId: null }],
      positions,
    );
    setSelectedId(id);
  };

  const renameUnit = (id: string, name: string) => {
    setUnits((prev) =>
      prev.map((unit) => (unit.id === id ? { ...unit, name } : unit)),
    );
    setDirty(true);
  };

  const addPosition = (unitId: string) => {
    const id = `n${counter}`;
    setCounter((value) => value + 1);
    commit(units, [
      ...positions,
      {
        id,
        unitId,
        title: '',
        rank: 'Staf',
        quota: 1,
        people: [],
        saved: false,
      },
    ]);
    setExpandedIds((prev) => new Set(prev).add(id));
  };

  const patchPosition = (id: string, patch: Partial<Position>) => {
    setPositions((prev) =>
      prev.map((position) =>
        position.id === id ? { ...position, ...patch } : position,
      ),
    );
    setDirty(true);
  };

  const removePosition = (id: string) => {
    setPositions((prev) => prev.filter((position) => position.id !== id));
    setDirty(true);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = () => {
    setPositions((prev) =>
      prev.map((position) => ({ ...position, saved: true })),
    );
    setDirty(false);
    guide.complete('simpan');
    flash('Perubahan tersimpan.');
  };

  const changeTab = (next: Mode) => {
    setTab(next);
    if (next === 'tabel') guide.complete('tabel');
  };

  const q = search.trim().toLowerCase();
  const matchesSearch = (unit: Unit): boolean => {
    if (q === '') return true;
    if (unit.name.toLowerCase().includes(q)) return true;
    return units.some(
      (child) => child.parentId === unit.id && matchesSearch(child),
    );
  };

  const renderTree = (parentId: string | null, depth: number) =>
    units
      .filter((unit) => unit.parentId === parentId && matchesSearch(unit))
      .map((unit) => {
        const hasChildren = units.some((child) => child.parentId === unit.id);
        return (
          <li key={unit.id}>
            <button
              type="button"
              aria-current={unit.id === selectedId}
              onClick={() => select(unit.id)}
              {...dragProps(unit.id)}
              style={{ paddingLeft: depth * 12 + 4 }}
              className={cn(
                'group flex min-h-[34px] w-full cursor-grab items-center gap-0.5 rounded-[8px] py-0.5 pr-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 active:cursor-grabbing',
                unit.id === selectedId
                  ? 'bg-primary-200'
                  : 'hover:bg-neutral-200',
                unit.id === dropId &&
                  'bg-secondary-100 ring-2 ring-inset ring-secondary-400',
                unit.id === dragId && 'opacity-50',
                unit.id === 'eo' && guide.spot('pilih'),
              )}
            >
              <GripVertical
                className="size-3.5 shrink-0 text-neutral-500"
                aria-hidden
              />
              <ChevronRight
                className={cn(
                  'size-3.5 shrink-0 rotate-90 text-neutral-700',
                  !hasChildren && 'opacity-0',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-sm',
                  unit.id === selectedId
                    ? 'font-medium text-primary-400'
                    : 'font-normal text-neutral-1000',
                )}
              >
                {unit.name}
              </span>
              <span
                className={cn(
                  'ml-1 shrink-0 text-sm font-normal tabular-nums',
                  peopleIn(unit.id) > 0
                    ? 'text-primary-400'
                    : 'text-neutral-1000',
                )}
              >
                {peopleIn(unit.id)}
              </span>
            </button>
            <ul>{renderTree(unit.id, depth + 1)}</ul>
          </li>
        );
      });

  const renderUnitCard = (unit: Unit) => {
    const depth = depthOf(units, unit.id);
    const cards = positions.filter((position) => position.unitId === unit.id);
    return (
      <div
        key={unit.id}
        {...dragProps(unit.id)}
        className={cn(
          'w-44 cursor-grab overflow-hidden rounded-[12px] border transition-colors active:cursor-grabbing',
          unit.id === selectedId
            ? 'border-primary-400 bg-primary-100'
            : 'border-neutral-400 bg-white',
          unit.id === dropId &&
            'border-secondary-400 ring-2 ring-secondary-400',
          unit.id === dragId && 'opacity-50',
        )}
      >
        <button
          type="button"
          onClick={() => select(unit.id)}
          title={unit.name}
          className="flex w-full flex-col justify-center px-3 py-2 text-left hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
        >
          <span className="line-clamp-2 break-words text-sm font-semibold leading-[18px] text-neutral-1000">
            {unit.name}
          </span>
          {showLabels ? (
            <span className="truncate text-xs leading-4 text-neutral-700">
              {unit.typeLabel ?? levelLabel(depth)}
            </span>
          ) : null}
        </button>
        {cards.length > 0 ? (
          <ul className="border-t border-neutral-200">
            {cards.map((position) => {
              const personId = position.people[0];
              const person = personId
                ? DEMO_STUDENTS.find((student) => student.id === personId)
                : undefined;
              return (
                <li
                  key={position.id}
                  className="flex min-h-8 items-center gap-2 px-2 py-1"
                >
                  {person ? (
                    <>
                      <AvatarInitial
                        name={person.name}
                        className="size-5 text-[9px]"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-primary-400">
                        {person.name}
                      </span>
                      <span
                        className={cn(
                          'max-w-[48%] shrink-0 truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                          rankPillClass(position.rank),
                        )}
                      >
                        {position.title}
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        aria-hidden
                        className="size-5 shrink-0 rounded-full border border-dashed border-neutral-500"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs text-neutral-700">
                        + {position.title}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-neutral-700">
                        {position.people.length}/{position.quota}
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );
  };

  // Divisi ke bawah digambar menggantung di bawah bidangnya, seperti tata letak
  // bawaan editor untuk kepanitiaan.
  const renderHanging = (unit: Unit): React.ReactNode => {
    const children = units.filter((child) => child.parentId === unit.id);
    return (
      <div key={unit.id} className="oc-hang-item">
        {renderUnitCard(unit)}
        {children.length > 0 ? (
          <div className="oc-hang">
            {children.map((child) => renderHanging(child))}
          </div>
        ) : null}
      </div>
    );
  };

  const rootPerson = DEMO_STUDENTS.find(
    (student) => student.id === ROOT.person,
  );

  const renderPositionRow = (position: Position) => {
    const expanded = expandedIds.has(position.id);
    const people = position.people;
    const term = query[position.id] ?? '';
    const matches =
      term.trim().length >= 2
        ? DEMO_STUDENTS.filter(
            (student) =>
              matchesStudent(student, term) && !people.includes(student.id),
          ).slice(0, 3)
        : [];
    const filled = people.length;
    const fillClass =
      position.quota > 0 && filled >= position.quota
        ? 'text-success-dark'
        : position.quota > 0 && filled === 0
          ? 'text-neutral-1000'
          : 'text-neutral-700';

    return (
      <div key={position.id} className="border-b border-neutral-200">
        <div className="flex min-h-10 items-center gap-0.5 px-0.5 py-1">
          <span
            className="grid size-6 shrink-0 place-items-center rounded-[8px] text-neutral-500"
            aria-hidden
          >
            <GripVertical className="size-4" />
          </span>
          <button
            type="button"
            onClick={() => toggleExpanded(position.id)}
            aria-expanded={expanded}
            title={expanded ? 'Tutup pengaturan' : 'Pengaturan lanjut'}
            aria-label={
              expanded
                ? `Tutup pengaturan jabatan ${position.title}`
                : `Pengaturan lanjut jabatan ${position.title}`
            }
            className="grid size-6 shrink-0 place-items-center rounded-[8px] text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
          <input
            value={position.title}
            title={position.title}
            onChange={(event) => {
              const title = event.target.value;
              patchPosition(position.id, { title });
              if (title.trim() !== '') guide.complete('jabatan');
            }}
            aria-label={`Nama jabatan ${position.title}`}
            className={cn(
              inputClass,
              'h-7 min-w-0 flex-1 rounded-[8px] px-2 text-xs',
              !position.saved && position.title === '' && guide.spot('jabatan'),
            )}
          />
          <span
            className={cn(
              'shrink-0 text-[10px] font-semibold tabular-nums',
              fillClass,
            )}
          >
            {filled}/{position.quota}
          </span>
          <button
            type="button"
            onClick={() => removePosition(position.id)}
            aria-label={`Hapus jabatan ${position.title}`}
            className="grid size-6 shrink-0 place-items-center rounded-[8px] text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

        {expanded ? (
          <div className="ml-5 space-y-3 border-l border-neutral-200 py-3 pl-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-[10px] font-semibold text-neutral-800">
                Rank
                <select
                  value={position.rank}
                  onChange={(event) =>
                    patchPosition(position.id, { rank: event.target.value })
                  }
                  className={cn(inputClass, 'h-7 text-xs')}
                >
                  {RANKS.map((rank) => (
                    <option key={rank}>{rank}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-[10px] font-semibold text-neutral-800">
                Kuota
                <input
                  type="number"
                  min={0}
                  value={position.quota}
                  onChange={(event) =>
                    patchPosition(position.id, {
                      quota: Math.max(0, Number(event.target.value) || 0),
                    })
                  }
                  className={cn(inputClass, 'h-7 text-xs')}
                />
              </label>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-neutral-1000">Orang</p>
              {people.map((personId) => (
                <span
                  key={personId}
                  className="flex items-center gap-1.5 rounded-full bg-neutral-200 py-1 pl-1 pr-2"
                >
                  <AvatarInitial name={studentName(personId)} />
                  <span className="min-w-0 flex-1 truncate text-xs text-neutral-1000">
                    {studentName(personId)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Keluarkan ${studentName(personId)}`}
                    onClick={() =>
                      patchPosition(position.id, {
                        people: people.filter((item) => item !== personId),
                      })
                    }
                    className="grid size-5 place-items-center rounded-full hover:bg-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>

            <div>
              <input
                aria-label="Cari nama atau NIM"
                placeholder="Cari nama atau NIM"
                value={term}
                disabled={!position.saved}
                onChange={(event) =>
                  setQuery((prev) => ({
                    ...prev,
                    [position.id]: event.target.value,
                  }))
                }
                className={cn(
                  inputClass,
                  'h-8 text-xs',
                  position.saved &&
                    selected !== null &&
                    selected.id.startsWith('u') &&
                    guide.spot('orang'),
                )}
              />
              {!position.saved ? (
                <p className="mt-1 text-[10px] text-neutral-700">
                  Simpan dulu untuk menempatkan orang.
                </p>
              ) : null}
              {term.trim().length > 0 && term.trim().length < 2 ? (
                <p className="mt-1 text-[10px] text-neutral-700">
                  Ketik minimal 2 huruf
                </p>
              ) : null}
              {matches.length > 0 ? (
                <ul className="mt-1 divide-y divide-neutral-300 rounded-md border border-neutral-400 bg-white">
                  {matches.map((student) => (
                    <li key={student.id}>
                      <button
                        type="button"
                        onClick={() => {
                          patchPosition(position.id, {
                            people: [...people, student.id],
                          });
                          setQuery((prev) => ({
                            ...prev,
                            [position.id]: '',
                          }));
                          guide.complete('orang');
                        }}
                        className="flex w-full justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                      >
                        <span className="font-semibold">{student.name}</span>
                        <span className="text-neutral-700">{student.nim}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const structurePanel = (
    <div className="flex h-full min-h-0 w-full flex-col border-r border-neutral-400 bg-neutral-50">
      <div className="flex flex-col gap-2 px-3 pb-2 pt-3">
        <h2 className="text-base font-semibold leading-6 text-neutral-1000">
          Struktur
        </h2>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500"
            aria-hidden
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari bagian"
            aria-label="Cari bagian"
            className="h-8 w-full rounded-full border border-neutral-400 bg-neutral-50 pl-8 pr-3 text-xs text-neutral-1000 placeholder:text-neutral-500 focus-visible:border-primary-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-400"
          />
        </div>
        <div
          data-unit-drop={ROOT_ID}
          className={cn(
            'flex items-center justify-between gap-2 rounded-[8px]',
            dropId === ROOT_ID &&
              'bg-secondary-100 ring-2 ring-inset ring-secondary-400',
          )}
        >
          <span className="line-clamp-2 break-words text-sm font-medium text-primary-400">
            {ROOT.name}
          </span>
          <span
            className="text-sm font-medium tabular-nums text-primary-400"
            aria-label={`${totalPeople} orang`}
          >
            {totalPeople}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-0.5">
        <div role="tree" aria-label="Struktur organogram">
          {renderTree(null, 0)}
        </div>
        {selected ? (
          <button
            type="button"
            onClick={() => addChild(selected.id)}
            className={cn(
              'flex w-full items-center gap-1 rounded-[8px] px-2 py-1.5 text-left text-xs font-medium text-primary-400 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
              selected.id === 'eo' && guide.spot('tambah'),
            )}
          >
            <Plus className="size-3.5 shrink-0" />
            Tambah {childLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={addRoot}
          className="flex w-full items-center gap-1 rounded-[8px] px-2 py-1.5 text-left text-xs font-medium text-primary-400 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <Plus className="size-3.5 shrink-0" />
          Tambah {levelLabel(0)}
        </button>
      </div>
    </div>
  );

  const inspector = (
    <div className="flex h-full min-h-0 flex-col border-l border-neutral-400 bg-neutral-50">
      <div className="p-3 pb-0">
        <h2 className="line-clamp-2 break-words text-base font-semibold text-neutral-1000">
          Struktur Kepanitiaan
        </h2>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          <StatBlock value={level1Count} label={levelLabel(0)} />
          <StatBlock value={positionCount} label="Jabatan" />
          <StatBlock value={maxDepth} label="Kedalaman" />
        </div>

        <Btn
          small
          tone="teal"
          className={cn('w-full', selected !== null && guide.spot('tambah'))}
          onClick={() => (selected ? addChild(selected.id) : addRoot())}
        >
          <Plus aria-hidden />
          Tambah {selected ? childLabel : levelLabel(0)}
        </Btn>

        {selected ? (
          <div className="space-y-3">
            <Field label={`Nama ${levelLabel(selectedDepth)}`}>
              {(id) => (
                <input
                  id={id}
                  value={selected.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    renameUnit(selected.id, name);
                    if (
                      selected.id.startsWith('u') &&
                      name.trim() !== '' &&
                      !name.endsWith(' baru')
                    ) {
                      guide.complete('nama');
                    }
                  }}
                  className={cn(
                    inputClass,
                    'h-8 rounded-[8px] text-sm',
                    selected.id.startsWith('u') && guide.spot('nama'),
                  )}
                />
              )}
            </Field>

            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-neutral-700">Path</span>
              <span className="truncate tabular-nums text-neutral-700">
                {pathOf(units, selected.id)}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary-400">
                  Jabatan ({unitPositions.length})
                </h3>
                <button
                  type="button"
                  onClick={() => addPosition(selected.id)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-xs font-semibold text-primary-400 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                    guide.spot('jabatan'),
                  )}
                >
                  <Plus className="size-3.5" />
                  Tambah
                </button>
              </div>
              {unitPositions.length === 0 ? (
                <p className="mt-1 text-xs text-neutral-700">
                  Belum ada jabatan di {levelLabel(selectedDepth).toLowerCase()}{' '}
                  ini.
                </p>
              ) : null}
              <div className="mt-1">
                {unitPositions.map((position) => renderPositionRow(position))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-700">
            Tidak ada {levelLabel(0).toLowerCase()} yang dipilih. Pilih satu di
            Struktur atau bagan untuk melihat dan mengubahnya.
          </p>
        )}
      </div>
    </div>
  );

  const chart = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-400 bg-white px-3 py-1.5">
        <div className="relative">
          <Btn
            small
            tone="outline"
            aria-haspopup="menu"
            aria-expanded={arrangeOpen}
            onClick={() => setArrangeOpen((open) => !open)}
          >
            Tata ulang
            <ChevronDown className="size-3.5" />
          </Btn>
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
                className="absolute left-0 top-full z-30 mt-1 w-60 overflow-hidden rounded-[8px] border border-neutral-400 bg-white py-1 shadow-lg"
              >
                {ARRANGE_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2 text-left hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
                    onClick={() => {
                      setArrangeOpen(false);
                      flash(`${item.label}: diterapkan (simulasi).`);
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
        <Btn
          small
          tone={showLabels ? 'teal' : 'outline'}
          aria-pressed={showLabels}
          onClick={() => setShowLabels((value) => !value)}
        >
          Jenis unit
        </Btn>
        <Btn
          small
          tone={alignHeights ? 'teal' : 'outline'}
          aria-pressed={alignHeights}
          onClick={() => setAlignHeights((value) => !value)}
        >
          Tinggi seragam
        </Btn>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto bg-neutral-100">
        <div
          className="mx-auto w-max p-6"
          // `zoom` (bukan transform) supaya area gulir ikut mengecil.
          style={{ zoom: zoom / 100 }}
        >
          <div className="oc">
            <div
              {...dragProps(ROOT_ID)}
              className={cn(
                'w-52 overflow-hidden rounded-[12px] border border-primary-400 bg-primary-400 text-white',
                dropId === ROOT_ID && 'ring-4 ring-secondary-400',
              )}
            >
              <div className="px-3 py-2">
                <p className="text-sm font-semibold leading-[18px]">
                  {ROOT.name}
                </p>
                <p className="text-xs leading-4 text-primary-200">
                  {ROOT.label}
                </p>
              </div>
              <div className="flex items-center gap-2 border-t border-white/20 px-2 py-1.5">
                <AvatarInitial
                  name={rootPerson?.name ?? '?'}
                  className="size-5 text-[9px]"
                />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                  {rootPerson?.name}
                </span>
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-primary-400">
                  {ROOT.head}
                </span>
              </div>
            </div>
            <ul>
              {units
                .filter((unit) => unit.parentId === null)
                .map((unit) => {
                  const children = units.filter(
                    (child) => child.parentId === unit.id,
                  );
                  return (
                    <li key={unit.id}>
                      {renderUnitCard(unit)}
                      {children.length > 0 ? (
                        <div className="oc-hang">
                          {children.map((child) => renderHanging(child))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>

        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full border border-neutral-400 bg-white p-1 shadow-sm">
          <button
            type="button"
            aria-label="Perkecil"
            onClick={() => setZoom((value) => Math.max(25, value - 10))}
            className="grid size-7 place-items-center rounded-full text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-10 text-center text-xs font-semibold tabular-nums text-neutral-1000">
            {zoom}%
          </span>
          <button
            type="button"
            aria-label="Perbesar"
            onClick={() => setZoom((value) => Math.min(200, value + 10))}
            className="grid size-7 place-items-center rounded-full text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Pas ke layar"
            onClick={() => setZoom(50)}
            className="grid size-7 place-items-center rounded-full text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <ScanSearch className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const table = (
    <div className="h-full overflow-auto bg-white p-4">
      <div className="overflow-x-auto rounded-lg border border-neutral-400">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr>
              <th className={thClass}>Bagian</th>
              <th className={thClass}>Jabatan</th>
              <th className={thClass}>Rank</th>
              <th className={thClass}>Terisi</th>
              <th className={thClass}>Orang</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const unit = units.find((item) => item.id === position.unitId);
              return (
                <tr key={position.id}>
                  <td className={tdClass}>
                    <span className="text-[10px] uppercase text-secondary-800">
                      {unit ? levelLabel(depthOf(units, unit.id)) : 'Bagian'}
                    </span>{' '}
                    {unit?.name}
                  </td>
                  <td className={cn(tdClass, 'font-semibold')}>
                    {position.title || 'Tanpa nama'}
                  </td>
                  <td className={tdClass}>{position.rank}</td>
                  <td className={tdClass}>
                    {position.people.length}/{position.quota}
                  </td>
                  <td className={cn(tdClass, 'text-xs')}>
                    {position.people.map(studentName).join(', ') || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const settings = (
    <div className="h-full overflow-auto bg-white p-4">
      <div className="max-w-md space-y-3 rounded-[12px] border border-neutral-400 bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-neutral-1000">
            Pengaturan organogram
          </p>
          <p className="mt-0.5 text-xs text-neutral-700">
            Atur label tingkat dan kunci penyuntingan.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-1000">
          <input
            type="checkbox"
            checked={locked}
            onChange={(event) => setLocked(event.target.checked)}
            className="size-4 rounded border-neutral-400 text-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          />
          Kunci penyuntingan
        </label>
        <p className="text-xs text-neutral-700">
          Label tingkat: {LEVELS.join(' › ')}
        </p>
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="relative flex h-[560px] flex-col overflow-hidden rounded-lg border border-neutral-400 bg-neutral-100"
    >
      <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-400 bg-white px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label={
              showLeft ? 'Tutup panel Struktur' : 'Buka panel Struktur'
            }
            aria-pressed={showLeft}
            onClick={() => setShowLeft((value) => !value)}
            className="grid size-8 shrink-0 place-items-center rounded-[8px] text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <PanelLeft className="size-4" />
          </button>
          <nav aria-label="Jejak halaman" className="min-w-0">
            <ol className="flex items-center gap-1.5 text-xs text-neutral-700">
              <li className="hidden shrink-0 sm:block">Beranda</li>
              <li className="hidden max-w-[10rem] truncate md:block">
                <span aria-hidden className="mr-1.5">
                  /
                </span>
                Kabinet KM ITB
              </li>
              <li className="max-w-[12rem] truncate">
                <span aria-hidden className="mr-1.5 hidden sm:inline">
                  /
                </span>
                Aku Masuk ITB 2027
              </li>
              <li
                aria-current="page"
                className="shrink-0 font-semibold text-neutral-1000"
              >
                <span aria-hidden className="mr-1.5">
                  /
                </span>
                Organogram
              </li>
            </ol>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Urungkan"
              disabled={past.length === 0}
              onClick={undo}
              className="grid size-8 place-items-center rounded-[8px] text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Undo2 className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Ulangi"
              disabled={future.length === 0}
              onClick={redo}
              className="grid size-8 place-items-center rounded-[8px] text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Redo2 className="size-4" />
            </button>
          </div>
          <span
            aria-live="polite"
            className={cn(
              'inline-block min-w-[10rem] text-right text-xs',
              dirty ? 'font-semibold text-neutral-1000' : 'text-neutral-700',
            )}
          >
            {dirty
              ? 'Ada perubahan belum disimpan'
              : 'Semua perubahan tersimpan'}
          </span>
          <Btn small tone="teal" disabled={!dirty} onClick={save}>
            Simpan
          </Btn>
          <div
            role="group"
            aria-label="Tampilan"
            className="flex items-center gap-1"
          >
            {MODES.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => changeTab(item.id)}
                  className={cn(
                    'h-7 rounded-full border px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1',
                    active
                      ? 'border-secondary-800 bg-secondary-800 text-white'
                      : 'border-secondary-400 bg-white text-secondary-800 hover:bg-secondary-100',
                    guide.spot(item.id),
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <Btn
            small
            tone="outline"
            onClick={() => flash('Impor: fitur simulasi.')}
          >
            <Upload aria-hidden />
            Impor
          </Btn>
          <Btn
            small
            tone="outline"
            onClick={() => flash('Ekspor: fitur simulasi.')}
          >
            <Download aria-hidden />
            Ekspor
          </Btn>
          <button
            type="button"
            aria-label={showRight ? 'Tutup panel Detail' : 'Buka panel Detail'}
            aria-pressed={showRight}
            onClick={() => setShowRight((value) => !value)}
            className="grid size-8 shrink-0 place-items-center rounded-[8px] text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <PanelRight className="size-4" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {showLeft ? (
          <aside
            aria-label="Struktur"
            className="w-[200px] shrink-0 border-r border-neutral-400 bg-white"
          >
            {structurePanel}
          </aside>
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col">
          {tab === 'bagan' && showHint ? (
            <div
              role="note"
              className="flex shrink-0 items-start gap-2 border-b border-neutral-400 bg-primary-100 px-3 py-1.5 text-xs text-primary-400"
            >
              <p className="min-w-0 flex-1">
                Gunakan <strong>seret</strong> untuk memindahkan bagian atau
                jabatan. Ctrl atau Cmd + klik memilih beberapa, Shift + seret
                ruang kosong memilih dengan kotak. Cubit atau geser dua jari
                untuk zoom dan menggeser.
              </p>
              <button
                type="button"
                onClick={() => setShowHint(false)}
                aria-label="Tutup petunjuk"
                className="grid size-6 shrink-0 place-items-center rounded-[8px] hover:bg-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}

          <div className="relative min-h-0 flex-1">
            {tab === 'bagan' ? chart : null}
            {tab === 'tabel' ? table : null}
            {tab === 'pengaturan' ? settings : null}
          </div>
        </main>

        {showRight && (!narrow || selectedId !== null) ? (
          <aside
            aria-label="Detail"
            className="w-[240px] shrink-0 border-l border-neutral-400 bg-white"
          >
            {inspector}
          </aside>
        ) : null}
      </div>
      <style>{CHART_CSS}</style>
      {drag?.active
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[100] rounded-[8px] border border-primary-400 bg-white px-3 py-1.5 text-sm font-semibold text-primary-400 shadow-[0_6px_20px_rgba(20,40,40,0.18)]"
              style={{ left: drag.x + 12, top: drag.y + 12 }}
            >
              {units.find((unit) => unit.id === drag.id)?.name}
            </div>,
            document.body,
          )
        : null}
      {node}
    </div>
  );
}
