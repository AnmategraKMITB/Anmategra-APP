'use client';

import {
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { ContentGroup, FieldOut } from './model';

export const SECTION_PREFIX = 'section:';
const CONTAINER_PREFIX = 'container:';

const keyOf = (group: ContentGroup) => group.section.id;
const isContainer = (id: string) => id.startsWith(CONTAINER_PREFIX);
const isSection = (id: string) => id.startsWith(SECTION_PREFIX);

/**
 * Seret-lepas pertanyaan antarbagian dengan pratinjau langsung: saat kartu
 * melewati bagian lain, urutan sementara di sini langsung berpindah, jadi
 * kartu tidak menghilang lalu melompat saat dilepas. Urutan sementara
 * dipertahankan sampai urutan yang tersimpan tiba dari server.
 */
export function useFieldDnd(
  groups: ContentGroup[],
  commit: (
    fieldId: string,
    sectionId: string,
    index: number,
  ) => Promise<unknown> | void,
) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, string[]> | null>(null);
  const lastOver = useRef<string | null>(null);

  const base = useMemo(
    () =>
      Object.fromEntries(
        groups.map((g) => [keyOf(g), g.fields.map((f) => f.id)]),
      ) as Record<string, string[]>,
    [groups],
  );
  const items = preview ?? base;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const view = useMemo(() => {
    if (!preview) return groups;
    const byId = new Map<string, FieldOut>();
    for (const g of groups) for (const f of g.fields) byId.set(f.id, f);
    return groups.map((g) => {
      const ids = preview[keyOf(g)] ?? [];
      if (
        ids.length === g.fields.length &&
        ids.every((id, i) => id === g.fields[i]?.id)
      ) {
        return g;
      }
      return {
        ...g,
        fields: ids.map((id) => byId.get(id)).filter((f): f is FieldOut => !!f),
      };
    });
  }, [groups, preview]);

  const findKey = (id: string, source: Record<string, string[]>) =>
    isContainer(id)
      ? id.slice(CONTAINER_PREFIX.length)
      : Object.keys(source).find((k) => source[k]!.includes(id));

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const active = String(args.active.id);
    const sections = isSection(active);
    // Bagian hanya bisa jatuh di antara bagian; pertanyaan hanya di antara
    // pertanyaan dan wadah bagian.
    const droppableContainers = args.droppableContainers.filter(
      (c) => isSection(String(c.id)) === sections,
    );
    if (sections) {
      return closestCenter({ ...args, droppableContainers });
    }
    const scoped = { ...args, droppableContainers };
    const hits = pointerWithin(scoped);
    const collisions = hits.length > 0 ? hits : rectIntersection(scoped);
    let overId = getFirstCollision(collisions, 'id');
    if (overId != null) {
      const id = String(overId);
      if (isContainer(id)) {
        const ids = itemsRef.current[id.slice(CONTAINER_PREFIX.length)] ?? [];
        if (ids.length > 0) {
          overId =
            closestCenter({
              ...scoped,
              droppableContainers: droppableContainers.filter((c) =>
                ids.includes(String(c.id)),
              ),
            })[0]?.id ?? overId;
        }
      }
      lastOver.current = String(overId);
      return [{ id: overId }];
    }
    return lastOver.current ? [{ id: lastOver.current }] : [];
  }, []);

  const onDragStart = (event: DragStartEvent) => {
    lastOver.current = null;
    setActiveId(String(event.active.id));
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    const id = String(active.id);
    if (!over || isSection(id)) return;
    const overId = String(over.id);
    const cur = itemsRef.current;
    const from = findKey(id, cur);
    const to = findKey(overId, cur);
    if (!from || !to || from === to) return;

    const target = cur[to]!;
    let index = target.length;
    if (!isContainer(overId)) {
      const overIndex = target.indexOf(overId);
      const translated = active.rect.current.translated;
      const below =
        !!translated && translated.top > over.rect.top + over.rect.height / 2;
      index = overIndex + (below ? 1 : 0);
    }
    setPreview({
      ...cur,
      [from]: cur[from]!.filter((x) => x !== id),
      [to]: [...target.slice(0, index), id, ...target.slice(index)],
    });
  };

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    const cur = itemsRef.current;
    const from = findKey(id, cur);
    setActiveId(null);
    lastOver.current = null;
    if (!over || !from || isSection(id)) {
      setPreview(null);
      return;
    }
    const overId = String(over.id);
    let list = cur[from]!;
    if (
      findKey(overId, cur) === from &&
      !isContainer(overId) &&
      overId !== id
    ) {
      list = arrayMove(list, list.indexOf(id), list.indexOf(overId));
    }
    const index = list.indexOf(id);
    const origin = Object.keys(base).find((k) => base[k]!.includes(id));
    if (origin === from && base[origin]!.indexOf(id) === index) {
      setPreview(null);
      return;
    }
    setPreview({ ...cur, [from]: list });
    try {
      await commit(id, from, index);
    } finally {
      setPreview(null);
    }
  };

  const onDragCancel = () => {
    setActiveId(null);
    setPreview(null);
    lastOver.current = null;
  };

  return {
    activeId,
    groups: view,
    collisionDetection,
    handlers: { onDragStart, onDragOver, onDragEnd, onDragCancel },
  };
}
