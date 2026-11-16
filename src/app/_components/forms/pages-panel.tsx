'use client';

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDownToLine,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
} from 'lucide-react';
import { Fragment, memo, useCallback, useMemo, useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

import { KindIcon } from './add-menu';
import { useBuilder, useFieldDraft } from './builder-context';
import { InsertSection } from './insert-section';
import { type ContentGroup, type FieldOut, containerId, kindOf } from './model';
import { richTextToPlain } from './rich-text';
import { REVEAL_FIELD_EVENT } from './section-card';
import { SECTION_PREFIX, useFieldDnd } from './use-field-dnd';

function jumpTo(fieldId: string) {
  const go = () => {
    document
      .getElementById(`field-${fieldId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById(`label-${fieldId}`)?.focus({ preventScroll: true });
  };
  if (document.getElementById(`field-${fieldId}`)) return go();
  // Bagian yang terlipat belum merender pertanyaannya: minta dibuka, lalu lompat setelah dirender.
  window.dispatchEvent(
    new CustomEvent<string>(REVEAL_FIELD_EVENT, { detail: fieldId }),
  );
  requestAnimationFrame(() => requestAnimationFrame(go));
}

const FieldItem = memo(function FieldItem({
  field,
  sectionId,
  index,
  size,
  onNavigate,
}: {
  field: FieldOut;
  sectionId: string;
  index: number;
  size: number;
  onNavigate?: () => void;
}) {
  const builder = useBuilder();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });
  const draft = useFieldDraft(field);
  const number = builder.numbers.get(field.id);
  const title = richTextToPlain(draft.label) || 'Tanpa judul';

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex min-w-0 items-center gap-1 rounded-lg bg-neutral-50',
        isDragging && 'opacity-40',
      )}
    >
      <button
        type="button"
        aria-label={`Seret ${title}`}
        className="shrink-0 cursor-grab touch-none rounded p-1 text-neutral-700 hover:text-neutral-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          jumpTo(field.id);
          onNavigate?.();
        }}
        onKeyDown={(e) => {
          if (!e.altKey) return;
          if (e.key === 'ArrowUp' && index > 0) {
            e.preventDefault();
            void builder.move(field.id, sectionId, index - 1);
          } else if (e.key === 'ArrowDown' && index < size - 1) {
            e.preventDefault();
            void builder.move(field.id, sectionId, index + 1);
          }
        }}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm text-neutral-1000 transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <span className="w-5 shrink-0 text-right text-xs font-semibold text-neutral-700">
          {number ?? ''}
        </span>
        <KindIcon
          kind={kindOf(field)}
          className="size-4 shrink-0 text-neutral-700"
        />
        <span className="truncate">{title}</span>
      </button>
    </li>
  );
});

const PanelGroup = memo(function PanelGroup({
  group,
  collapsed,
  activeId,
  onToggle,
  onNavigate,
}: {
  group: ContentGroup;
  collapsed: boolean;
  /** Id yang sedang diseret; kartunya harus tetap terpasang walau bagian diciutkan. */
  activeId: string | null;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const { section, fields } = group;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${SECTION_PREFIX}${section.id}`,
    disabled: !section,
  });
  // Seluruh kartu bagian (judul dan isi) menjadi wadah jatuh, supaya bagian
  // yang diciutkan pun tetap bisa menerima pertanyaan.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: containerId(section.id),
  });

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      setDropRef(node);
    },
    [setNodeRef, setDropRef],
  );
  // Daftar id harus stabil antar-render: dnd-kit membandingkannya dengan ===,
  // dan array baru tiap render memicu pengukuran ulang tanpa henti.
  const fieldIds = useMemo(() => fields.map((f) => f.id), [fields]);
  // Pertanyaan yang sedang diseret lalu dijatuhkan ke bagian yang diciutkan
  // tidak boleh dilepas dari DOM di tengah seretan; dnd-kit lalu mengukur ulang
  // tanpa henti. Maka ia tetap dirender, tersembunyi, di dalam bagian itu.
  const pinned = collapsed ? fields.find((f) => f.id === activeId) : undefined;
  // Bagian tertutup yang sedang dituju: ditandai gelap dengan nama tujuannya,
  // langsung dari pratinjau seretan, sebelum server menjawab.
  const fieldDrag = !!activeId && !activeId.startsWith(SECTION_PREFIX);
  const dropHere = collapsed && fieldDrag && (isOver || !!pinned);

  return (
    <div
      ref={ref}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'relative min-w-0 rounded-xl border border-neutral-400 p-2',
        isDragging && 'opacity-40',
        'transition-[border-color,box-shadow] duration-150',
        dropHere && 'border-primary-1000 shadow-lg',
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-primary-1000/80 px-3 text-sm font-semibold text-white opacity-0 transition-opacity duration-150',
          dropHere && 'opacity-100',
        )}
      >
        <ArrowDownToLine className="size-4 shrink-0" />
        <span className="truncate">
          Lepas di {section ? section.title : 'Tanpa bagian'}
        </span>
      </div>
      <div className="flex items-center gap-1 px-1 pb-1">
        {section ? (
          <button
            type="button"
            aria-label={`Seret bagian ${section.title}`}
            className="shrink-0 cursor-grab touch-none rounded p-1 text-neutral-700 hover:text-neutral-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Buka' : 'Ciutkan'} ${section ? section.title : 'Tanpa bagian'}`}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          {collapsed ? (
            <ChevronRight className="size-4 shrink-0 text-neutral-700" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-neutral-700" />
          )}
          <span className="truncate text-sm font-semibold text-neutral-1000">
            {section ? section.title : 'Tanpa bagian'}
          </span>
        </button>
        <span className="ml-auto text-xs tabular-nums text-neutral-700">
          {fields.length}
        </span>
      </div>
      {collapsed && !pinned ? null : (
        <SortableContext
          items={fieldIds}
          strategy={verticalListSortingStrategy}
        >
          <ul
            className={cn(
              'grid min-h-8 min-w-0 gap-0.5 rounded-lg',
              collapsed && 'hidden',
              isOver && fields.length === 0 && 'bg-primary-100',
            )}
          >
            {collapsed ? (
              pinned ? (
                <FieldItem
                  key={pinned.id}
                  field={pinned}
                  sectionId={section.id}
                  index={fields.indexOf(pinned)}
                  size={fields.length}
                />
              ) : null
            ) : fields.length === 0 ? (
              <li className="px-2 py-1.5 text-sm text-neutral-700">
                Kosong. Seret pertanyaan ke sini.
              </li>
            ) : (
              fields.map((field, index) => (
                <FieldItem
                  key={field.id}
                  field={field}
                  sectionId={section.id}
                  index={index}
                  size={fields.length}
                  onNavigate={onNavigate}
                />
              ))
            )}
          </ul>
        </SortableContext>
      )}
    </div>
  );
});

/**
 * Daftar "Halaman": bagian dan pertanyaan, bisa diseret. Papan ketik: tombol
 * seret bisa diambil dengan Spasi lalu digerakkan dengan panah; pada nama
 * pertanyaan, Alt+↑/↓ memindahkannya satu langkah.
 */
export const PagesPanel = memo(function PagesPanel({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const builder = useBuilder();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const dnd = useFieldDnd(builder.groups, (fieldId, sectionId, index) =>
    builder.move(fieldId, sectionId, index),
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const sections = builder.detail?.sections ?? [];
  const keyOf = (g: ContentGroup) => g.section.id;
  // Urutan bagian sementara sesudah dilepas, sampai urutan tersimpan tiba dari server.
  const [sectionOrder, setSectionOrder] = useState<string[] | null>(null);
  const groups = useMemo(() => {
    if (!sectionOrder) return dnd.groups;
    const rank = (g: ContentGroup) =>
      g.section ? sectionOrder.indexOf(g.section.id) : -1;
    return [...dnd.groups].sort((a, b) => rank(a) - rank(b));
  }, [dnd.groups, sectionOrder]);
  const sectionIds = useMemo(
    () => groups.map((g) => `${SECTION_PREFIX}${g.section.id}`),
    [groups],
  );
  const draggingSection = dnd.activeId?.startsWith(SECTION_PREFIX) ?? false;
  const allCollapsed =
    builder.groups.length > 0 &&
    builder.groups.every((g) => collapsed.has(keyOf(g)));

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const activeField =
    dnd.activeId && !draggingSection
      ? builder.detail?.fields.find((f) => f.id === dnd.activeId)
      : undefined;
  const activeSection = draggingSection
    ? sections.find((s) => `${SECTION_PREFIX}${s.id}` === dnd.activeId)
    : undefined;

  const onDragEnd = (event: DragEndEvent) => {
    void dnd.handlers.onDragEnd(event);
    const activeId = String(event.active.id);
    if (!activeId.startsWith(SECTION_PREFIX)) return;
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;
    const from = sections.findIndex(
      (s) => s.id === activeId.slice(SECTION_PREFIX.length),
    );
    const to = sections.findIndex(
      (s) => s.id === overId.slice(SECTION_PREFIX.length),
    );
    if (from < 0 || to < 0 || from === to) return;
    const ids = arrayMove(sections, from, to).map((s) => s.id);
    setSectionOrder(ids);
    void builder.reorderSectionIds(ids).finally(() => setSectionOrder(null));
  };

  return (
    <nav aria-label="Halaman form" className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-1000">Halaman</h2>
        {builder.groups.length > 1 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setCollapsed(
                allCollapsed ? new Set() : new Set(builder.groups.map(keyOf)),
              )
            }
          >
            {allCollapsed ? 'Buka semua' : 'Ciutkan semua'}
          </Button>
        ) : null}
      </div>
      {builder.groups.length === 0 ? (
        <p className="text-sm text-neutral-700">Belum ada pertanyaan.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={dnd.collisionDetection}
          measuring={{
            droppable: {
              // Mengukur ulang terus hanya perlu saat bagian diciutkan di tengah
              // seretan; untuk pertanyaan, pengukuran awal sudah cukup dan jauh lebih ringan.
              strategy: draggingSection
                ? MeasuringStrategy.Always
                : MeasuringStrategy.WhileDragging,
            },
          }}
          autoScroll={{
            threshold: { x: 0, y: 0.2 },
            acceleration: 25,
            interval: 10,
            // Hanya panel ini yang menggulung; halaman di belakangnya tidak ikut,
            // karena panel menempel di tepi atas dan bawah layar.
            canScroll: (el) =>
              el !== document.scrollingElement &&
              el !== document.documentElement &&
              el !== document.body,
          }}
          {...dnd.handlers}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={sectionIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-3">
              {groups.map((group, i) => {
                const position = group.section
                  ? sections.findIndex((s) => s.id === group.section.id)
                  : -1;
                return (
                  <Fragment key={keyOf(group)}>
                    {/* Celah sisip disembunyikan selama menyeret. */}
                    {i === 0 && group.section && !dnd.activeId ? (
                      <InsertSection compact atIndex={0} />
                    ) : null}
                    <PanelGroup
                      group={group}
                      // Saat memindahkan bagian, semua bagian diciutkan supaya mudah diurutkan.
                      collapsed={draggingSection || collapsed.has(keyOf(group))}
                      activeId={dnd.activeId}
                      onToggle={() => toggle(keyOf(group))}
                      onNavigate={onNavigate}
                    />
                    {sections.length > 0 &&
                    i < groups.length - 1 &&
                    !dnd.activeId ? (
                      <InsertSection compact atIndex={position + 1} />
                    ) : null}
                  </Fragment>
                );
              })}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeField ? (
              <div className="flex w-64 items-center gap-2 truncate rounded-lg border border-primary-400 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-1000 shadow-xl ring-4 ring-primary-400/20">
                <GripVertical className="size-4 shrink-0 text-primary-400" />
                <span className="truncate">
                  {richTextToPlain(builder.draftOf(activeField).label) ||
                    'Tanpa judul'}
                </span>
              </div>
            ) : activeSection ? (
              <div className="truncate rounded-xl border border-primary-400 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-1000 shadow-lg">
                {activeSection.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
      <Button
        variant="light_blue"
        className="w-full"
        onClick={() => void builder.addSection()}
      >
        <Plus /> Tambah bagian
      </Button>
    </nav>
  );
});
