'use client';

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
import { GripVertical } from 'lucide-react';
import { cn } from '~/lib/utils';

import { KindIcon } from './add-menu';
import { useBuilder } from './builder-context';
import { type ContentGroup, type FieldOut, containerId, kindOf } from './model';
import { richTextToPlain } from './rich-text';

const SECTION_PREFIX = 'section:';

function jumpTo(fieldId: string) {
  document
    .getElementById(`field-${fieldId}`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById(`label-${fieldId}`)?.focus({ preventScroll: true });
}

function FieldItem({
  field,
  sectionId,
  index,
  size,
  onNavigate,
}: {
  field: FieldOut;
  sectionId: string | null;
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
  const number = builder.numbers.get(field.id);
  const title = richTextToPlain(builder.draftOf(field).label) || 'Tanpa judul';

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex min-w-0 items-center gap-1 rounded-lg bg-neutral-50',
        isDragging && 'relative z-10 shadow-md ring-1 ring-neutral-400',
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
}

function PanelGroup({
  group,
  onNavigate,
}: {
  group: ContentGroup;
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
    id: `${SECTION_PREFIX}${section?.id ?? 'none'}`,
    disabled: !section,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: containerId(section?.id ?? null),
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'min-w-0 rounded-xl border border-neutral-400 p-2',
        isDragging && 'relative z-10 bg-neutral-50 shadow-md',
      )}
    >
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
        <span className="truncate text-sm font-semibold text-neutral-1000">
          {section ? section.title : 'Tanpa bagian'}
        </span>
        <span className="ml-auto text-xs text-neutral-700">
          {fields.length}
        </span>
      </div>
      <SortableContext
        items={fields.map((f) => f.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul
          ref={setDropRef}
          className={cn(
            'grid min-h-8 min-w-0 gap-0.5 rounded-lg',
            isOver && fields.length === 0 && 'bg-primary-100',
          )}
        >
          {fields.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-neutral-700">
              Kosong. Seret pertanyaan ke sini.
            </li>
          ) : (
            fields.map((field, index) => (
              <FieldItem
                key={field.id}
                field={field}
                sectionId={section?.id ?? null}
                index={index}
                size={fields.length}
                onNavigate={onNavigate}
              />
            ))
          )}
        </ul>
      </SortableContext>
    </div>
  );
}

/**
 * Daftar "Halaman": bagian dan pertanyaan, bisa diseret. Papan ketik: tombol
 * seret bisa diambil dengan Spasi lalu digerakkan dengan panah; pada nama
 * pertanyaan, Alt+↑/↓ memindahkannya satu langkah.
 */
export function PagesPanel({ onNavigate }: { onNavigate?: () => void }) {
  const builder = useBuilder();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const sections = builder.detail?.sections ?? [];

  const sectionOf = (id: string): string | null => {
    if (id.startsWith(SECTION_PREFIX)) return id.slice(SECTION_PREFIX.length);
    if (id.startsWith('container:')) return id.slice('container:'.length);
    return builder.detail?.fields.find((f) => f.id === id)?.sectionId ?? 'none';
  };

  const onDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;

    if (activeId.startsWith(SECTION_PREFIX)) {
      const from = sections.findIndex(
        (s) => s.id === activeId.slice(SECTION_PREFIX.length),
      );
      const target = sectionOf(overId);
      const to = sections.findIndex((s) => s.id === target);
      if (from < 0 || to < 0 || from === to) return;
      void builder.reorderSectionIds(
        arrayMove(sections, from, to).map((s) => s.id),
      );
      return;
    }

    // Soltado di atas judul bagian = ke wadah bagian itu.
    const over = overId.startsWith(SECTION_PREFIX)
      ? containerId(
          overId.slice(SECTION_PREFIX.length) === 'none'
            ? null
            : overId.slice(SECTION_PREFIX.length),
        )
      : overId;
    void builder.drop(activeId, over);
  };

  return (
    <nav aria-label="Halaman form" className="grid gap-3">
      <h2 className="text-lg font-semibold text-neutral-1000">Halaman</h2>
      {builder.groups.length === 0 ? (
        <p className="text-sm text-neutral-700">Belum ada pertanyaan.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={builder.groups.map(
              (g) => `${SECTION_PREFIX}${g.section?.id ?? 'none'}`,
            )}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-3">
              {builder.groups.map((group) => (
                <PanelGroup
                  key={group.section?.id ?? 'none'}
                  group={group}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </nav>
  );
}
