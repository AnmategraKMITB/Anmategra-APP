'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
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
import { GripVertical } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { cn } from '~/lib/utils';

import { useBuilder } from './builder-context';
import { FieldCard } from './field-card';
import { type ContentGroup, type FieldOut, containerId } from './model';
import { richTextToPlain } from './rich-text';
import { useFieldDnd } from './use-field-dnd';

/** Seret-lepas pertanyaan di kanvas utama, termasuk antarbagian. */
export function CanvasDnd({
  children,
}: {
  children: (groups: ContentGroup[]) => ReactNode;
}) {
  const builder = useBuilder();
  const dnd = useFieldDnd(builder.groups, (fieldId, sectionId, index) =>
    builder.move(fieldId, sectionId, index),
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const active = dnd.activeId
    ? builder.detail?.fields.find((f) => f.id === dnd.activeId)
    : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={dnd.collisionDetection}
      // Tarik ke tepi atas/bawah layar menggulung halaman lebih cepat.
      autoScroll={{
        threshold: { x: 0, y: 0.2 },
        acceleration: 25,
        interval: 10,
      }}
      {...dnd.handlers}
    >
      {children(dnd.groups)}
      {/* Pratinjau ringkas: kartu aslinya terlalu berat untuk digandakan. */}
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="rounded-xl border border-primary-400 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-1000 shadow-lg">
            {richTextToPlain(active.label) || 'Tanpa judul'}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Daftar pertanyaan satu bagian: urutan yang bisa diurut dan wadah kosong yang bisa dijatuhi. */
export function SectionFields({
  sectionId,
  fields,
  children,
}: {
  sectionId: string;
  fields: FieldOut[];
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: containerId(sectionId) });
  const ids = useMemo(() => fields.map((f) => f.id), [fields]);
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn('grid gap-4', fields.length === 0 && 'min-h-16')}
      >
        {children}
      </div>
    </SortableContext>
  );
}

export function SortableFieldCard({
  field,
  sectionId,
  index,
  size,
}: {
  field: FieldOut;
  sectionId: string;
  index: number;
  size: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative', isDragging && 'opacity-40')}
    >
      <button
        type="button"
        aria-label="Seret untuk memindahkan pertanyaan"
        className="absolute right-4 top-4 z-10 cursor-grab touch-none rounded p-1 text-neutral-700 hover:text-neutral-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" />
      </button>
      <FieldCard
        field={field}
        sectionId={sectionId}
        index={index}
        size={size}
      />
    </div>
  );
}
