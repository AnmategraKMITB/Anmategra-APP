'use client';

import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Keyboard,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  type CSSProperties,
  Fragment,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '~/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Input } from '~/components/ui/input';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { cn } from '~/lib/utils';

import {
  type Draft,
  type EditorAction,
  MAX_DEPTH,
  type PlacementsByPosition,
  type TreeRow as TreeRowData,
  type Unit,
  canMoveUnit,
  childrenOf,
  descendantsOf,
  endIndexOfPositions,
  levelLabelFor,
  levelOf,
  pathOf,
  peopleCountBySubtree,
  planUnitsDrop,
  unitTypeLabel,
  visibleRows,
} from './model';
import { draggedPositionId, isPositionDrag } from './position-dnd';

const SHORTCUTS: [string, string][] = [
  ['Enter', 'Tambah sejajar di bawah'],
  ['Shift + Enter', 'Tambah di dalam'],
  ['F2 atau klik dua kali', 'Ganti nama'],
  ['Alt + ↑ ↓', 'Naik atau turun urutan'],
  ['Alt + ← →', 'Naik atau turun tingkat'],
  ['Delete', 'Hapus'],
  ['Ctrl/Cmd + klik', 'Pilih beberapa'],
  ['Shift + klik', 'Pilih rentang'],
  ['Ctrl/Cmd + A', 'Pilih semua'],
  ['Esc', 'Kosongkan pilihan'],
  ['Ctrl/Cmd + Z', 'Urungkan (Shift: ulangi)'],
  ['Ctrl/Cmd + \\', 'Tutup atau buka panel samping'],
];

export type StructurePanelProps = {
  draft: Draft;
  placements: PlacementsByPosition;
  selectedId: string | null;
  /** Seluruh pilihan (kosong, satu, atau banyak bagian). */
  selectedIds: readonly string[];
  onSelect: (id: string | null) => void;
  onSelectIds: (ids: string[]) => void;
  dispatch: (action: EditorAction) => void;
  canEditUnit: (unitId: string) => boolean;
  canEditRoot: boolean;
  readOnly: boolean;
  newId: () => string;
  profileSlot?: ReactNode;
};

type DropPosition = 'before' | 'after' | 'inside';
type MoveDirection = 'up' | 'down' | 'outdent' | 'indent';

type TreeRowProps = {
  row: TreeRowData;
  selected: boolean;
  tabbable: boolean;
  canEdit: boolean;
  canEditRoot: boolean;
  canEditUnit: (unitId: string) => boolean;
  draft: Draft;
  placements: PlacementsByPosition;
  peopleCount: number;
  siblingIndex: number;
  siblingCount: number;
  renaming: boolean;
  renameValue: string;
  confirmingDelete: boolean;
  dropPosition: DropPosition | null;
  onSelect: (
    id: string,
    modifiers: { toggle: boolean; range: boolean },
  ) => void;
  onToggle: (id: string) => void;
  onFocusRow: (id: string) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>, id: string) => void;
  onStartRename: (id: string) => void;
  onRenameChange: (value: string) => void;
  onRenameCommit: (id: string) => void;
  onRenameCancel: () => void;
  onAddChild: (id: string) => void;
  onMoveRelative: (id: string, direction: MoveDirection) => void;
  onRequestDelete: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onPositionDrop: (positionId: string, unitId: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  onMoveTo: (id: string, parentId: string | null) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
};

type DeleteConfirmProps = {
  unit: Unit;
  draft: Draft;
  placements: PlacementsByPosition;
  onConfirm: () => void;
  onCancel: () => void;
};

function DeleteConfirm({
  unit,
  draft,
  placements,
  onConfirm,
  onCancel,
}: DeleteConfirmProps) {
  const subtree = descendantsOf(draft.units, unit.id);
  const descendantCount = Math.max(0, subtree.size - 1);
  const positions = draft.positions.filter((position) =>
    subtree.has(position.unitId),
  );
  const positionCount = positions.length;
  const hasPeople = positions.some(
    (position) => (placements[position.id]?.length ?? 0) > 0,
  );

  return (
    <div
      className="flex w-full flex-col gap-2 rounded-[8px] bg-danger-light px-3 py-2"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <p className="text-sm text-danger-dark">
        Hapus {unit.name}? {descendantCount} sub-bagian dan {positionCount}{' '}
        jabatan ikut terhapus.
      </p>
      {hasPeople ? (
        <p className="text-sm text-danger-dark">
          Ada orang yang ditempatkan. Penghapusan akan ditolak saat disimpan
          sampai penempatannya dipindahkan.
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button variant="warning" size="sm" onClick={onConfirm}>
          Hapus
        </Button>
        <Button variant="dark_blue_outline" size="sm" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </div>
  );
}

type MoveToPopoverProps = {
  draft: Draft;
  unitId: string;
  canEditUnit: (unitId: string) => boolean;
  canEditRoot: boolean;
  onMove: (parentId: string | null) => void;
};

function MoveToPopover({
  draft,
  unitId,
  canEditUnit,
  canEditRoot,
  onMove,
}: MoveToPopoverProps) {
  const units = draft.units;
  const candidates = useMemo(() => {
    const list: Unit[] = [];
    for (const candidate of units) {
      if (candidate.id === unitId) continue;
      if (!canEditUnit(candidate.id)) continue;
      const check = canMoveUnit(units, unitId, candidate.id);
      if (check.ok) list.push(candidate);
    }
    return list.sort((a, b) => {
      const pathA = pathOf(units, a.id);
      const pathB = pathOf(units, b.id);
      return pathA.localeCompare(pathB);
    });
  }, [units, unitId, canEditUnit]);

  return (
    <Command className="rounded-[8px]">
      <CommandInput placeholder="Cari bagian tujuan" />
      <CommandList className="max-h-64">
        <CommandEmpty>Tidak ada tujuan yang bisa dipilih.</CommandEmpty>
        {canEditRoot ? (
          <CommandItem value="jadikan-teratas" onSelect={() => onMove(null)}>
            <span className="text-sm font-medium text-neutral-1000">
              Jadikan {levelLabelFor(1, draft.levelLabels)} teratas
            </span>
          </CommandItem>
        ) : null}
        {candidates.map((candidate) => (
          <CommandItem
            key={candidate.id}
            value={`${pathOf(draft.units, candidate.id)} ${candidate.name}`}
            onSelect={() => onMove(candidate.id)}
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-normal text-neutral-1000">
                {candidate.name}
              </span>
              <span className="truncate text-xs tabular-nums text-neutral-700">
                {pathOf(draft.units, candidate.id)}
              </span>
            </div>
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  );
}

const TreeRow = memo(function TreeRow({
  row,
  selected,
  tabbable,
  canEdit,
  canEditRoot,
  canEditUnit,
  draft,
  placements,
  peopleCount,
  siblingIndex,
  siblingCount,
  renaming,
  renameValue,
  confirmingDelete,
  dropPosition,
  onSelect,
  onToggle,
  onFocusRow,
  onKeyDown,
  onStartRename,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onAddChild,
  onMoveRelative,
  onRequestDelete,
  onToggleHidden,
  onPositionDrop,
  onConfirmDelete,
  onCancelDelete,
  onMoveTo,
  registerRef,
}: TreeRowProps) {
  const { unit, depth, hasChildren, expanded } = row;
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [moveToOpen, setMoveToOpen] = useState(false);
  const [positionOver, setPositionOver] = useState(false);
  const { setNodeRef: setDropRef } = useDroppable({ id: unit.id });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    setActivatorNodeRef,
  } = useDraggable({
    id: unit.id,
    disabled: !canEdit,
  });

  const setRefs = (node: HTMLDivElement | null) => {
    rowRef.current = node;
    setDropRef(node);
    setDragRef(node);
    registerRef(unit.id, node);
  };

  const isHidden = unit.layout.hidden === true;
  const childLevelLabel = levelLabelFor(depth + 1, draft.levelLabels);
  const childDisabled = depth + 1 > MAX_DEPTH;
  const canMoveUp = siblingIndex > 0;
  const canMoveDown = siblingIndex < siblingCount - 1;
  const canOutdent = unit.parentId !== null;
  const canIndent = siblingIndex > 0;

  const rowClasses = cn(
    'group relative flex min-h-[34px] w-full select-none items-center gap-0.5 rounded-[8px] py-0.5 pr-0.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400',
    selected && dropPosition !== 'inside' && 'bg-primary-200',
    !selected && dropPosition !== 'inside' && 'hover:bg-neutral-200',
    (dropPosition === 'inside' || positionOver) &&
      'bg-primary-100 ring-1 ring-primary-400',
  );

  return (
    <Popover open={moveToOpen} onOpenChange={setMoveToOpen}>
      <PopoverAnchor asChild>
        <div
          ref={setRefs}
          role="treeitem"
          aria-level={depth}
          aria-expanded={hasChildren ? expanded : undefined}
          aria-selected={selected}
          tabIndex={tabbable ? 0 : -1}
          className={rowClasses}
          onClick={
            confirmingDelete
              ? undefined
              : (event) => {
                  onSelect(unit.id, {
                    toggle: event.ctrlKey || event.metaKey,
                    range: event.shiftKey,
                  });
                  rowRef.current?.focus();
                }
          }
          onFocus={() => onFocusRow(unit.id)}
          onKeyDown={(event) => onKeyDown(event, unit.id)}
          onDoubleClick={(event) => {
            // Klik dua kali pada nama mengganti namanya (bila boleh).
            if ((event.target as HTMLElement).closest('button, input')) return;
            if (canEdit) onStartRename(unit.id);
          }}
          onDragOver={(event) => {
            if (!canEditUnit(unit.id) || !isPositionDrag(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setPositionOver(true);
          }}
          onDragLeave={() => setPositionOver(false)}
          onDrop={(event) => {
            setPositionOver(false);
            const positionId = draggedPositionId(event);
            if (positionId === null) return;
            event.preventDefault();
            onPositionDrop(positionId, unit.id);
          }}
        >
          {confirmingDelete ? (
            <DeleteConfirm
              unit={unit}
              draft={draft}
              placements={placements}
              onConfirm={() => onConfirmDelete(unit.id)}
              onCancel={onCancelDelete}
            />
          ) : (
            <>
              <div
                className="relative flex h-full shrink-0 items-stretch"
                style={{ width: depth * 12 }}
                aria-hidden
              >
                {Array.from({ length: depth - 1 }).map((_, index) => (
                  <span
                    key={index}
                    className="absolute bottom-0 top-0 border-l border-neutral-200"
                    style={{ left: (index + 1) * 12 }}
                  />
                ))}
              </div>

              {hasChildren ? (
                <button
                  type="button"
                  className="grid size-6 shrink-0 place-items-center rounded-[8px] text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  aria-label={
                    expanded ? `Lipat ${unit.name}` : `Buka ${unit.name}`
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggle(unit.id);
                    rowRef.current?.focus();
                  }}
                >
                  <ChevronRight
                    className={cn(
                      'size-4 transition-transform',
                      expanded && 'rotate-90',
                    )}
                  />
                </button>
              ) : (
                <span className="size-6 shrink-0" aria-hidden />
              )}

              {canEdit ? (
                <button
                  type="button"
                  ref={(node) => setActivatorNodeRef(node)}
                  {...listeners}
                  {...attributes}
                  className="grid size-5 shrink-0 cursor-grab place-items-center rounded-[8px] text-neutral-500 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 active:cursor-grabbing"
                  aria-label={`Seret ${unit.name}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <GripVertical className="size-4" />
                </button>
              ) : null}

              <div
                className="min-w-0 flex-1"
                title={`${unitTypeLabel(unit, depth, draft.levelLabels)}: ${unit.name}`}
              >
                {renaming ? (
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(event) => onRenameChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.stopPropagation();
                        onRenameCommit(unit.id);
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        event.stopPropagation();
                        onRenameCancel();
                      }
                    }}
                    onBlur={() => onRenameCommit(unit.id)}
                    onClick={(event) => event.stopPropagation()}
                    className="mt-0.5 h-7 rounded-[8px] border-neutral-400 px-2 text-sm font-medium text-neutral-1000 shadow-none focus-visible:ring-1 focus-visible:ring-primary-400"
                    aria-label={`Nama ${unitTypeLabel(
                      unit,
                      depth,
                      draft.levelLabels,
                    )}`}
                  />
                ) : (
                  <div
                    className={cn(
                      'line-clamp-2 break-words text-sm leading-5',
                      selected
                        ? 'font-medium text-primary-400'
                        : 'font-normal text-neutral-1000',
                      isHidden && 'opacity-60',
                    )}
                  >
                    {unit.name}
                  </div>
                )}
              </div>

              <div
                className={cn(
                  'ml-1 shrink-0 text-sm font-normal tabular-nums',
                  peopleCount > 0 ? 'text-primary-400' : 'text-neutral-1000',
                )}
                title={`${peopleCount} orang`}
                aria-label={`${peopleCount} orang`}
              >
                {peopleCount}
              </div>

              {canEdit || isHidden ? (
                <button
                  type="button"
                  disabled={!canEdit}
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-[8px] text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-default disabled:hover:bg-transparent',
                    isHidden || selected
                      ? 'opacity-100'
                      : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
                  )}
                  aria-label={
                    isHidden
                      ? `Tampilkan ${unit.name} di bagan`
                      : `Sembunyikan ${unit.name} dari bagan`
                  }
                  aria-pressed={isHidden}
                  title={
                    isHidden
                      ? 'Disembunyikan dari bagan. Klik untuk menampilkan.'
                      : 'Sembunyikan dari bagan'
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleHidden(unit.id);
                  }}
                >
                  {isHidden ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              ) : null}

              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-[8px] text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 data-[state=open]:opacity-100',
                        selected
                          ? 'opacity-100'
                          : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
                      )}
                      aria-label={`Menu ${unit.name}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 shadow-lg">
                    <DropdownMenuItem
                      disabled={childDisabled}
                      title={
                        childDisabled
                          ? `Kedalaman maksimum ${MAX_DEPTH} tingkat.`
                          : undefined
                      }
                      onSelect={() => onAddChild(unit.id)}
                    >
                      Tambah {childLevelLabel} di dalam
                      {childDisabled ? (
                        <span className="ml-auto text-xs text-neutral-700">
                          Maksimal {MAX_DEPTH} tingkat
                        </span>
                      ) : null}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onStartRename(unit.id)}>
                      Ganti nama
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canMoveUp}
                      onSelect={() => onMoveRelative(unit.id, 'up')}
                    >
                      Naik
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canMoveDown}
                      onSelect={() => onMoveRelative(unit.id, 'down')}
                    >
                      Turun
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canOutdent}
                      onSelect={() => onMoveRelative(unit.id, 'outdent')}
                    >
                      Naik tingkat
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canIndent}
                      onSelect={() => onMoveRelative(unit.id, 'indent')}
                    >
                      Turun tingkat
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setMoveToOpen(true)}>
                      Pindahkan ke…
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-danger-dark focus:text-danger-dark"
                      onSelect={() => onRequestDelete(unit.id)}
                    >
                      Hapus
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </>
          )}

          {dropPosition === 'before' ? (
            <div
              className="pointer-events-none absolute left-0 right-0 top-0 h-0.5 bg-primary-400"
              style={{ marginLeft: depth * 12 }}
            />
          ) : null}
          {dropPosition === 'after' ? (
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-0.5 bg-primary-400"
              style={{ marginLeft: depth * 12 }}
            />
          ) : null}
        </div>
      </PopoverAnchor>
      {moveToOpen ? (
        <PopoverContent
          align="start"
          className="w-80 rounded-[8px] p-0 shadow-lg"
        >
          <MoveToPopover
            draft={draft}
            unitId={unit.id}
            canEditUnit={canEditUnit}
            canEditRoot={canEditRoot}
            onMove={(parentId) => {
              setMoveToOpen(false);
              onMoveTo(unit.id, parentId);
            }}
          />
        </PopoverContent>
      ) : null}
    </Popover>
  );
});

export function StructurePanel({
  draft,
  placements,
  selectedId,
  selectedIds,
  onSelect,
  onSelectIds,
  dispatch,
  canEditUnit,
  canEditRoot,
  readOnly,
  newId,
  profileSlot,
}: StructurePanelProps) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [extraExpanded, setExtraExpanded] = useState<Set<string>>(
    () => new Set(),
  );
  const [focusedId, setFocusedId] = useState<string | null>(selectedId);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: DropPosition;
  } | null>(null);

  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingFocusRef = useRef<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  const focusRow = useCallback((id: string) => {
    const el = rowRefs.current.get(id);
    if (el) el.focus();
  }, []);

  useEffect(() => {
    const id = pendingFocusRef.current;
    if (!id) return;
    const el = rowRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ block: 'nearest' });
    el.focus();
    pendingFocusRef.current = null;
  }, [draft.units]);

  const defaultExpanded = useMemo(() => {
    const set = new Set<string>();
    for (const unit of draft.units) {
      if (levelOf(draft.units, unit.id) <= 2) set.add(unit.id);
    }
    return set;
  }, [draft.units]);

  const expanded = useMemo(() => {
    const result = new Set(defaultExpanded);
    for (const id of collapsed) result.delete(id);
    for (const id of extraExpanded) result.add(id);
    return result;
  }, [defaultExpanded, collapsed, extraExpanded]);

  const expandedRef = useRef(expanded);
  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  const toggleExpanded = useCallback((id: string) => {
    const isExpanded = expandedRef.current.has(id);
    if (isExpanded) {
      setCollapsed((prev) => new Set(prev).add(id));
      setExtraExpanded((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      setExtraExpanded((prev) => new Set(prev).add(id));
      setCollapsed((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const handleSelect = useCallback(
    (id: string | null) => {
      onSelect(id);
      if (id) setFocusedId(id);
    },
    [onSelect],
  );

  const handleFocusRow = useCallback((id: string) => {
    setFocusedId(id);
  }, []);

  const rows = useMemo(
    () => visibleRows(draft, expanded, search),
    [draft, expanded, search],
  );

  // Jangkar untuk Shift-klik; diperbarui oleh klik biasa dan Ctrl/Cmd-klik.
  const anchorRef = useRef<string | null>(null);

  const handleSelectRow = useCallback(
    (id: string, modifiers: { toggle: boolean; range: boolean }) => {
      const visible = rows.map((row) => row.unit.id);
      if (modifiers.range && anchorRef.current !== null) {
        const from = visible.indexOf(anchorRef.current);
        const to = visible.indexOf(id);
        if (from >= 0 && to >= 0) {
          const [start, end] = from < to ? [from, to] : [to, from];
          const range = visible.slice(start, end + 1);
          onSelectIds(
            modifiers.toggle ? [...new Set([...selectedIds, ...range])] : range,
          );
          setFocusedId(id);
          return;
        }
      }
      if (modifiers.toggle) {
        onSelectIds(
          selectedIds.includes(id)
            ? selectedIds.filter((item) => item !== id)
            : [...selectedIds, id],
        );
        anchorRef.current = id;
        setFocusedId(id);
        return;
      }
      anchorRef.current = id;
      handleSelect(id);
    },
    [rows, selectedIds, onSelectIds, handleSelect],
  );

  const peopleCounts = useMemo(
    () => peopleCountBySubtree(draft, placements),
    [draft, placements],
  );

  const siblingInfo = useMemo(() => {
    const byParent = new Map<string | null, string[]>();
    for (const unit of draft.units) {
      const ids = byParent.get(unit.parentId);
      if (ids) ids.push(unit.id);
      else byParent.set(unit.parentId, [unit.id]);
    }
    const info = new Map<string, { index: number; count: number }>();
    for (const [parentId, ids] of byParent) {
      const ordered = childrenOf(draft.units, parentId).map((u) => u.id);
      ordered.forEach((id, index) =>
        info.set(id, { index, count: ids.length }),
      );
    }
    return info;
  }, [draft.units]);

  const totalPeople = useMemo(() => {
    let total = 0;
    for (const unit of draft.units) {
      if (unit.parentId === null) total += peopleCounts[unit.id] ?? 0;
    }
    return total;
  }, [draft.units, peopleCounts]);

  const firstRowId = rows[0]?.unit.id ?? null;
  const activeRowId =
    focusedId && rows.some((row) => row.unit.id === focusedId)
      ? focusedId
      : selectedId && rows.some((row) => row.unit.id === selectedId)
        ? selectedId
        : firstRowId;

  const handleAdd = useCallback(
    (parentId: string | null, startRename: boolean, index?: number) => {
      if (readOnly) return;
      if (parentId === null) {
        if (!canEditRoot) {
          announce('Anda tidak punya izin menambah tingkat teratas.');
          return;
        }
      } else {
        if (!draft.units.some((unit) => unit.id === parentId)) {
          announce('Bagian induk tidak ditemukan.');
          return;
        }
        if (!canEditUnit(parentId)) {
          announce('Anda tidak punya izin menambah di bagian ini.');
          return;
        }
      }

      const parentDepth =
        parentId === null ? 0 : levelOf(draft.units, parentId);
      if (parentDepth + 1 > MAX_DEPTH) {
        announce(`Kedalaman maksimum ${MAX_DEPTH} tingkat.`);
        return;
      }

      const id = newId();
      const name = `${levelLabelFor(parentDepth + 1, draft.levelLabels)} baru`;
      dispatch({ type: 'addUnit', id, parentId, name, index });

      if (parentId !== null) {
        setExtraExpanded((prev) => new Set(prev).add(parentId));
      }
      setSearch('');
      onSelect(id);
      setFocusedId(id);

      if (startRename) {
        // Kolom nama sudah memegang fokus; memindahkannya ke baris menutup isiannya.
        setRenamingId(id);
        setRenameValue(name);
      } else {
        pendingFocusRef.current = id;
      }
    },
    [
      readOnly,
      canEditRoot,
      canEditUnit,
      draft.units,
      draft.levelLabels,
      newId,
      dispatch,
      onSelect,
      announce,
    ],
  );

  const handleAddChild = useCallback(
    (parentId: string) => {
      handleAdd(parentId, true);
    },
    [handleAdd],
  );

  const handleAddRoot = useCallback(() => {
    handleAdd(null, false);
  }, [handleAdd]);

  /** Izin mengubah isi sebuah induk (null = tingkat teratas); mengumumkan alasan bila ditolak. */
  const mayEditParent = useCallback(
    (parentId: string | null): boolean => {
      if (parentId === null) {
        if (canEditRoot) return true;
        announce('Anda tidak punya izin mengubah tingkat teratas.');
        return false;
      }
      if (canEditUnit(parentId)) return true;
      announce('Anda tidak punya izin mengubah susunan di bagian itu.');
      return false;
    },
    [canEditRoot, canEditUnit, announce],
  );

  const moveRelative = useCallback(
    (id: string, direction: MoveDirection) => {
      if (readOnly) return;
      const unit = draft.units.find((item) => item.id === id);
      if (!unit) return;
      if (!canEditUnit(id)) {
        announce('Anda tidak punya izin memindahkan bagian ini.');
        return;
      }

      const parentId = unit.parentId;
      const siblings = childrenOf(draft.units, parentId);
      const index = siblings.findIndex((item) => item.id === id);
      if (index < 0) return;

      let nextParentId: string | null = parentId;
      let nextIndex = index;

      if (direction === 'up') {
        if (index === 0) {
          announce('Sudah di urutan teratas.');
          return;
        }
        nextIndex = index - 1;
      } else if (direction === 'down') {
        if (index === siblings.length - 1) {
          announce('Sudah di urutan terbawah.');
          return;
        }
        nextIndex = index + 1;
      } else if (direction === 'outdent') {
        if (parentId === null) {
          announce('Sudah berada di tingkat teratas.');
          return;
        }
        const parent = draft.units.find((item) => item.id === parentId);
        if (!parent) return;
        nextParentId = parent.parentId;
        const grandSiblings = childrenOf(draft.units, nextParentId);
        const parentIndex = grandSiblings.findIndex(
          (item) => item.id === parentId,
        );
        if (parentIndex < 0) {
          announce('Bagian induk tidak ditemukan.');
          return;
        }
        nextIndex = parentIndex + 1;
      } else {
        const previousSibling = siblings[index - 1];
        if (index === 0 || !previousSibling) {
          announce('Tidak ada bagian sebelumnya untuk jadi induk.');
          return;
        }
        nextParentId = previousSibling.id;
        nextIndex = childrenOf(draft.units, nextParentId).filter(
          (item) => item.id !== id,
        ).length;
      }

      if (!mayEditParent(nextParentId)) return;

      const check = canMoveUnit(draft.units, id, nextParentId);
      if (!check.ok) {
        announce(check.reason);
        return;
      }

      dispatch({
        type: 'moveUnit',
        id,
        parentId: nextParentId,
        index: nextIndex,
      });
      if (nextParentId !== null) {
        setExtraExpanded((prev) => new Set(prev).add(nextParentId));
      }
    },
    [readOnly, draft.units, canEditUnit, mayEditParent, announce, dispatch],
  );

  const handleStartRename = useCallback(
    (id: string) => {
      const unit = draft.units.find((item) => item.id === id);
      if (!unit) return;
      if (readOnly || !canEditUnit(id)) {
        announce('Anda tidak punya izin mengganti nama bagian ini.');
        return;
      }
      setRenamingId(id);
      setRenameValue(unit.name);
      setConfirmingDeleteId(null);
    },
    [draft.units, readOnly, canEditUnit, announce],
  );

  const handleCommitRename = useCallback(
    (id: string) => {
      if (renamingId !== id) return;
      const trimmed = renameValue.trim();
      if (trimmed !== '') {
        dispatch({ type: 'renameUnit', id, name: trimmed });
      }
      setRenamingId(null);
      requestAnimationFrame(() => focusRow(id));
    },
    [renamingId, renameValue, dispatch, focusRow],
  );

  const handleCancelRename = useCallback(() => {
    const id = renamingId;
    setRenamingId(null);
    if (id !== null) requestAnimationFrame(() => focusRow(id));
  }, [renamingId, focusRow]);

  const handleRequestDelete = useCallback(
    (id: string) => {
      if (readOnly || !canEditUnit(id)) {
        announce('Anda tidak punya izin menghapus bagian ini.');
        return;
      }
      setConfirmingDeleteId(id);
      setRenamingId(null);
    },
    [readOnly, canEditUnit, announce],
  );

  const handleConfirmDelete = useCallback(
    (id: string) => {
      const unit = draft.units.find((item) => item.id === id);
      if (!unit) return;
      const subtree = descendantsOf(draft.units, id);
      const parentId = unit.parentId;
      dispatch({ type: 'deleteUnit', id });
      if (selectedId && subtree.has(selectedId)) onSelect(parentId);
      if (focusedId && subtree.has(focusedId)) setFocusedId(parentId);
      setConfirmingDeleteId(null);
    },
    [draft.units, dispatch, selectedId, onSelect, focusedId],
  );

  const handleCancelDelete = useCallback(() => {
    setConfirmingDeleteId(null);
  }, []);

  const handleMoveTo = useCallback(
    (unitId: string, parentId: string | null) => {
      if (readOnly) return;
      if (!canEditUnit(unitId)) {
        announce('Anda tidak punya izin memindahkan bagian ini.');
        return;
      }
      if (!mayEditParent(parentId)) return;

      const check = canMoveUnit(draft.units, unitId, parentId);
      if (!check.ok) {
        announce(check.reason);
        return;
      }

      const siblings = childrenOf(draft.units, parentId).filter(
        (unit) => unit.id !== unitId,
      );
      dispatch({
        type: 'moveUnit',
        id: unitId,
        parentId,
        index: siblings.length,
      });
      if (parentId !== null) {
        setExtraExpanded((prev) => new Set(prev).add(parentId));
      }
    },
    [readOnly, canEditUnit, mayEditParent, announce, draft.units, dispatch],
  );

  const handlePositionDrop = useCallback(
    (positionId: string, unitId: string) => {
      if (readOnly) return;
      const position = draft.positions.find((item) => item.id === positionId);
      const target = draft.units.find((item) => item.id === unitId);
      if (!position || !target || position.unitId === unitId) return;
      if (!canEditUnit(position.unitId) || !canEditUnit(unitId)) {
        announce('Anda tidak punya izin memindahkan jabatan ini.');
        return;
      }
      dispatch({
        type: 'movePosition',
        id: positionId,
        unitId,
        index: endIndexOfPositions(draft.positions, unitId, positionId),
      });
      onSelect(unitId);
      announce(`Jabatan ${position.title} dipindahkan ke ${target.name}.`);
    },
    [
      readOnly,
      draft.positions,
      draft.units,
      canEditUnit,
      dispatch,
      onSelect,
      announce,
    ],
  );

  const handleToggleHidden = useCallback(
    (id: string) => {
      const unit = draft.units.find((item) => item.id === id);
      if (!unit || !canEditUnit(id)) return;
      dispatch({
        type: 'setUnitLayout',
        id,
        patch: { hidden: unit.layout.hidden !== true },
      });
    },
    [draft.units, canEditUnit, dispatch],
  );

  const handleDrop = useCallback(
    (activeId: string, targetId: string, position: DropPosition) => {
      if (readOnly) return;
      const activeUnit = draft.units.find((unit) => unit.id === activeId);
      const targetUnit = draft.units.find((unit) => unit.id === targetId);
      if (!activeUnit || !targetUnit) return;

      // Menyeret salah satu bagian yang terpilih memindahkan seluruh pilihan.
      const ids =
        selectedIds.length > 1 && selectedIds.includes(activeId)
          ? selectedIds
          : [activeId];
      const plan = planUnitsDrop(draft.units, ids, targetId, position);
      if (!plan.ok) {
        announce(plan.reason);
        return;
      }
      if (!plan.ids.every((id) => canEditUnit(id))) {
        announce('Anda tidak punya izin memindahkan bagian ini.');
        return;
      }
      const { parentId, index } = plan;
      if (!mayEditParent(parentId)) return;

      dispatch({ type: 'moveUnits', ids: plan.ids, parentId, index });
      if (parentId !== null) {
        setExtraExpanded((prev) => new Set(prev).add(parentId));
      }
    },
    [
      readOnly,
      draft.units,
      selectedIds,
      canEditUnit,
      mayEditParent,
      announce,
      dispatch,
    ],
  );

  const handleRowKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, id: string) => {
      if (event.key === 'Escape') {
        if (confirmingDeleteId === id) {
          event.preventDefault();
          setConfirmingDeleteId(null);
          return;
        }
        if (renamingId === id) {
          event.preventDefault();
          setRenamingId(null);
          return;
        }
      }

      if (event.target !== event.currentTarget) return;

      const currentIndex = rows.findIndex((item) => item.unit.id === id);
      const row = rows[currentIndex];
      if (!row) return;
      const unit = row.unit;

      const focusAndSet = (targetId: string) => {
        setFocusedId(targetId);
        focusRow(targetId);
      };

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === 'a'
      ) {
        event.preventDefault();
        onSelectIds(rows.map((item) => item.unit.id));
        return;
      }

      if (event.altKey) {
        const directions: Record<string, MoveDirection | undefined> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'outdent',
          ArrowRight: 'indent',
        };
        const direction = directions[event.key];
        if (direction) {
          event.preventDefault();
          moveRelative(id, direction);
          return;
        }
      }

      switch (event.key) {
        case 'ArrowDown': {
          const next = rows[currentIndex + 1];
          if (next) {
            event.preventDefault();
            focusAndSet(next.unit.id);
          }
          break;
        }
        case 'ArrowUp': {
          const previous = rows[currentIndex - 1];
          if (previous) {
            event.preventDefault();
            focusAndSet(previous.unit.id);
          }
          break;
        }
        case 'ArrowRight': {
          if (row.hasChildren && !row.expanded) {
            event.preventDefault();
            toggleExpanded(id);
          } else if (row.hasChildren && row.expanded) {
            const firstChild = rows[currentIndex + 1];
            if (firstChild?.depth === row.depth + 1) {
              event.preventDefault();
              focusAndSet(firstChild.unit.id);
            }
          }
          break;
        }
        case 'ArrowLeft': {
          if (row.hasChildren && row.expanded) {
            event.preventDefault();
            toggleExpanded(id);
          } else if (unit.parentId !== null) {
            const parentRow = rows.find(
              (item) => item.unit.id === unit.parentId,
            );
            if (parentRow) {
              event.preventDefault();
              focusAndSet(parentRow.unit.id);
            }
          }
          break;
        }
        case 'Home': {
          const first = rows[0];
          if (first) {
            event.preventDefault();
            focusAndSet(first.unit.id);
          }
          break;
        }
        case 'End': {
          const last = rows[rows.length - 1];
          if (last) {
            event.preventDefault();
            focusAndSet(last.unit.id);
          }
          break;
        }
        case 'Enter': {
          event.preventDefault();
          // Enter menambah bagian sejajar tepat di bawah; Shift + Enter menambah di dalamnya.
          // Tanpa hak ubah, Enter hanya memilih.
          if (readOnly || !canEditUnit(id)) {
            handleSelect(id);
          } else if (event.shiftKey) {
            handleAdd(id, true);
          } else {
            const siblingIndex = childrenOf(
              draft.units,
              unit.parentId,
            ).findIndex((item) => item.id === id);
            handleAdd(unit.parentId, true, siblingIndex + 1);
          }
          break;
        }
        case ' ': {
          event.preventDefault();
          handleSelect(id);
          break;
        }
        case 'F2': {
          event.preventDefault();
          handleStartRename(id);
          break;
        }
        case 'Delete': {
          event.preventDefault();
          handleRequestDelete(id);
          break;
        }
        default: {
          if (
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            event.key.toLowerCase() === 'a'
          ) {
            event.preventDefault();
            handleAddChild(id);
          }
        }
      }
    },
    [
      rows,
      confirmingDeleteId,
      renamingId,
      toggleExpanded,
      moveRelative,
      handleSelect,
      handleStartRename,
      handleRequestDelete,
      handleAddChild,
      handleAdd,
      canEditUnit,
      readOnly,
      draft.units,
      onSelectIds,
      focusRow,
    ],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      setActiveDragId(id);
      setDropTarget(null);
      // Menyeret bagian yang belum terpilih memilihnya lebih dulu (seperti di Figma).
      if (!selectedIds.includes(id)) onSelect(id);
    },
    [selectedIds, onSelect],
  );

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!event.over) {
      setDropTarget(null);
      return;
    }
    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    if (activeId === overId) {
      setDropTarget(null);
      return;
    }

    const activator = event.activatorEvent;
    const clientY =
      activator instanceof PointerEvent ? activator.clientY : null;
    if (clientY === null) {
      setDropTarget(null);
      return;
    }

    const pointerY = clientY + event.delta.y;
    const rect = event.over.rect;
    const ratio = rect.height > 0 ? (pointerY - rect.top) / rect.height : 0.5;
    let position: DropPosition = 'inside';
    if (ratio < 0.25) position = 'before';
    else if (ratio > 0.75) position = 'after';
    setDropTarget({ id: overId, position });
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const target = dropTarget;
      setDropTarget(null);
      if (!target) return;
      const activeId = String(event.active.id);
      if (activeId === target.id) return;
      handleDrop(activeId, target.id, target.position);
    },
    [dropTarget, handleDrop],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setDropTarget(null);
  }, []);

  const activeUnit = activeDragId
    ? (draft.units.find((unit) => unit.id === activeDragId) ?? null)
    : null;

  const level1 = levelLabelFor(1, draft.levelLabels);
  // Tombol tambah di dasar pohon mengikuti pilihan: bagian terpilih mendapat anak dengan nama level berikutnya.
  const selectedUnit =
    selectedIds.length === 1
      ? (draft.units.find((unit) => unit.id === selectedIds[0]) ?? null)
      : null;
  const selectedDepth = selectedUnit
    ? levelOf(draft.units, selectedUnit.id)
    : 0;
  const childLabel = levelLabelFor(selectedDepth + 1, draft.levelLabels);
  // Tombol tambah muncul tepat di bawah bagian terpilih: setelah baris terakhir dalam subpohonnya yang tampak.
  let addAfterId: string | null = null;
  if (selectedUnit && !readOnly && canEditUnit(selectedUnit.id)) {
    const start = rows.findIndex((row) => row.unit.id === selectedUnit.id);
    const base = rows[start]?.depth;
    if (start >= 0 && base !== undefined) {
      let last = start;
      while ((rows[last + 1]?.depth ?? 0) > base) last += 1;
      addAfterId = rows[last]?.unit.id ?? null;
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col border-r border-neutral-400 bg-neutral-50">
      <div className="sr-only" role="status" aria-live="polite">
        {notice}
      </div>

      <div className="flex flex-col gap-2 px-3 pb-2 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold leading-6 text-neutral-1000">
            Struktur
          </h2>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Pintasan papan ketik"
                title="Pintasan papan ketik"
                className="grid size-7 place-items-center rounded-[8px] text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <Keyboard className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3">
              <h3 className="text-sm font-medium text-neutral-1000">
                Pintasan papan ketik
              </h3>
              <dl className="mt-2 space-y-1.5 text-sm">
                {SHORTCUTS.map(([keys, effect]) => (
                  <div
                    key={keys}
                    className="flex items-start justify-between gap-3"
                  >
                    <dt>
                      <kbd className="rounded-[4px] border border-neutral-400 bg-neutral-50 px-1.5 py-0.5 text-xs font-medium text-neutral-1000">
                        {keys}
                      </kbd>
                    </dt>
                    <dd className="text-right text-neutral-700">{effect}</dd>
                  </div>
                ))}
              </dl>
            </PopoverContent>
          </Popover>
        </div>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Cari ${level1.toLowerCase()}`}
          startAdornment={<Search className="size-4 text-neutral-500" />}
          endAdornment={
            search !== '' ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Bersihkan pencarian"
                className="grid size-5 place-items-center rounded-full text-neutral-500 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <X className="size-4" />
              </button>
            ) : null
          }
          className="h-8 rounded-full border-neutral-400 bg-neutral-50 pr-9 text-sm text-neutral-1000 shadow-none placeholder:text-neutral-500 focus-visible:border-primary-400 focus-visible:ring-1 focus-visible:ring-primary-400"
          aria-label={`Cari ${level1.toLowerCase()}`}
        />

        {notice ? (
          <p className="rounded-[8px] bg-warning-light px-3 py-2 text-xs text-neutral-1000">
            {notice}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <span className="line-clamp-2 break-words text-sm font-medium text-primary-400">
            {draft.name}
          </span>
          <span
            className="text-sm font-medium tabular-nums text-primary-400"
            aria-label={`${totalPeople} orang`}
          >
            {totalPeople}
          </span>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          className="min-h-0 flex-1 overflow-y-auto px-1 py-0.5"
          onClick={(event) => {
            // Klik di ruang kosong mengosongkan pilihan.
            if (event.target === event.currentTarget) onSelect(null);
          }}
        >
          {draft.units.length === 0 ? (
            <div className="px-3 py-6 text-sm text-neutral-700">
              {!readOnly && canEditRoot ? (
                <div className="flex flex-col items-start gap-3">
                  <p>Belum ada {level1}. Tambahkan yang pertama.</p>
                  <Button
                    variant="light_blue"
                    size="sm"
                    onClick={handleAddRoot}
                  >
                    Tambah {level1}
                  </Button>
                </div>
              ) : (
                <p>Belum ada struktur.</p>
              )}
            </div>
          ) : (
            <>
              <div role="tree" aria-label="Struktur organogram">
                {rows.map((row) => {
                  const unit = row.unit;
                  const sibling = siblingInfo.get(unit.id);
                  const canEdit = !readOnly && canEditUnit(unit.id);
                  return (
                    <Fragment key={unit.id}>
                      <TreeRow
                        row={row}
                        selected={selectedIds.includes(unit.id)}
                        tabbable={activeRowId === unit.id}
                        canEdit={canEdit}
                        canEditRoot={canEditRoot}
                        canEditUnit={canEditUnit}
                        draft={draft}
                        placements={placements}
                        peopleCount={peopleCounts[unit.id] ?? 0}
                        siblingIndex={sibling?.index ?? 0}
                        siblingCount={sibling?.count ?? 1}
                        renaming={renamingId === unit.id}
                        renameValue={renameValue}
                        confirmingDelete={confirmingDeleteId === unit.id}
                        dropPosition={
                          dropTarget?.id === unit.id
                            ? dropTarget.position
                            : null
                        }
                        onSelect={handleSelectRow}
                        onToggle={toggleExpanded}
                        onFocusRow={handleFocusRow}
                        onKeyDown={handleRowKeyDown}
                        onStartRename={handleStartRename}
                        onRenameChange={setRenameValue}
                        onRenameCommit={handleCommitRename}
                        onRenameCancel={handleCancelRename}
                        onAddChild={handleAddChild}
                        onMoveRelative={moveRelative}
                        onRequestDelete={handleRequestDelete}
                        onToggleHidden={handleToggleHidden}
                        onPositionDrop={handlePositionDrop}
                        onConfirmDelete={handleConfirmDelete}
                        onCancelDelete={handleCancelDelete}
                        onMoveTo={handleMoveTo}
                        registerRef={registerRef}
                      />
                      {unit.id === addAfterId && selectedUnit ? (
                        <button
                          type="button"
                          className="flex w-[calc(100%-var(--indent))] items-center gap-1 rounded-[8px] py-1 pr-2 text-left text-sm font-medium text-primary-400 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50"
                          style={
                            {
                              marginLeft: (selectedDepth + 1) * 12 + 24,
                              '--indent': `${(selectedDepth + 1) * 12 + 24}px`,
                            } as CSSProperties
                          }
                          onClick={() => handleAddChild(selectedUnit.id)}
                          disabled={selectedDepth + 1 > MAX_DEPTH}
                          title={`Tambah ${childLabel} di dalam ${selectedUnit.name}`}
                        >
                          <Plus className="size-4 shrink-0" />
                          <span className="min-w-0 break-words">
                            Tambah {childLabel}
                          </span>
                        </button>
                      ) : null}
                    </Fragment>
                  );
                })}
              </div>

              {rows.length === 0 && search !== '' ? (
                <p className="px-3 py-4 text-sm text-neutral-700">
                  Tidak ada hasil untuk “{search}”.
                </p>
              ) : null}

              {!readOnly && canEditRoot ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-1 rounded-[8px] px-2 py-1.5 text-left text-sm font-medium text-primary-400 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  onClick={handleAddRoot}
                >
                  <Plus className="size-4 shrink-0" />
                  Tambah {level1}
                </button>
              ) : null}
            </>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeUnit ? (
            <div className="rounded-[8px] border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-1000 shadow-lg">
              {activeUnit.name}
              {selectedIds.length > 1 && selectedIds.includes(activeUnit.id)
                ? ` dan ${selectedIds.length - 1} lainnya`
                : ''}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {profileSlot ? (
        <div className="border-t border-neutral-200 px-3 py-2">
          {profileSlot}
        </div>
      ) : null}
    </div>
  );
}
