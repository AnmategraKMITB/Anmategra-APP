import {
  MAX_TREE_DEPTH,
  type PositionNode,
  type Tree,
  type UnitNode,
  computeLevels,
  subtreeIds,
  validateTree,
} from '~/server/api/routers/organization/tree';

/** Id rank; daftar dan labelnya disusun per organogram (lihat `Draft.ranks`). */
export type Rank = string;
export type RankDef = { id: Rank; label: string };
export type PositionKind = 'struktural' | 'nonstruktural';

/** Daftar rank bawaan (senior ke junior), dipakai selama organogram belum menyusunnya sendiri. */
export const DEFAULT_RANKS: readonly RankDef[] = [
  { id: 'head', label: 'Kepala' },
  { id: 'vice', label: 'Wakil' },
  { id: 'coordinator', label: 'Koordinator' },
  { id: 'staff', label: 'Staf' },
];

export const MAX_RANKS = 24;
export const MAX_RANK_LABEL = 60;

/** Daftar rank yang berlaku: milik organogram, atau bawaan bila belum disusun. */
export function effectiveRanks(ranks: RankDef[] | null): readonly RankDef[] {
  return ranks ?? DEFAULT_RANKS;
}

/** Id rank baru dari sebuah label: huruf kecil, tanpa aksen, unik terhadap yang sudah ada. */
export function newRankId(label: string, existing: readonly RankDef[]): Rank {
  const base =
    label
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 28) || 'rank';
  const taken = new Set(existing.map((rank) => rank.id));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now() % 100000}`;
}

export type UnitLayout = {
  tier?: 'depth' | 'manual';
  childrenMode?: 'hanging' | 'side';
  hidden?: boolean;
};

export type Unit = Omit<UnitNode, 'layout'> & { layout: UnitLayout };
export type Position = PositionNode;

export type Person = {
  id: string;
  userId: string;
  name: string | null;
  image: string | null;
  source: 'oprec' | 'closerec' | 'manual' | 'import';
  note: string | null;
};

export type PlacementsByPosition = Record<string, Person[]>;

export type Draft = {
  name: string;
  levelLabels: string[] | null;
  ranks: RankDef[] | null;
  units: Unit[];
  positions: Position[];
};

export type EditorHistory = {
  present: Draft;
  baseline: Draft;
  past: Draft[];
  future: Draft[];
  lastCoalesceKey: string | null;
};

export type ServerOrganogram = {
  name: string;
  levelLabels: string[] | null;
  ranks: RankDef[] | null;
  units: {
    id: string;
    parentId: string | null;
    name: string;
    typeLabel: string | null;
    description?: string | null;
    sortOrder: number;
    layout: Record<string, unknown> | null;
  }[];
  positions: (Position & { placements: Person[] })[];
};

type PositionPatch = Partial<
  Pick<Position, 'title' | 'rank' | 'kind' | 'quota' | 'hidden'>
>;

const HISTORY_LIMIT = 100;
/** Sentinel key so units without a parent can live in a Map keyed by parent id. */
const ROOT_KEY = '\u0000root';
const DEFAULT_LEVEL_LABEL = 'Bagian';
const DEFAULT_UNIT_NAME = 'Bagian baru';
const DEFAULT_POSITION_TITLE = 'Jabatan baru';

function cmpText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareUnitOrder(a: Unit, b: Unit): number {
  return a.sortOrder - b.sortOrder || cmpText(a.name, b.name);
}

function comparePositionOrder(a: Position, b: Position): number {
  return a.sortOrder - b.sortOrder || cmpText(a.title, b.title);
}

function groupBy<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

function clampIndex(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  const index = Math.trunc(value);
  if (index < 0) return 0;
  return index > max ? max : index;
}

function normalizeQuota(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const quota = Math.trunc(value);
  return quota < 0 ? 0 : quota;
}

function normalizeLayout(
  raw: Record<string, unknown> | null | undefined,
): UnitLayout {
  if (!raw) return {};
  const layout: UnitLayout = {};
  if (raw.tier === 'depth' || raw.tier === 'manual') layout.tier = raw.tier;
  if (raw.childrenMode === 'hanging' || raw.childrenMode === 'side') {
    layout.childrenMode = raw.childrenMode;
  }
  if (typeof raw.hidden === 'boolean') layout.hidden = raw.hidden;
  return layout;
}

function layoutToRecord(layout: UnitLayout): Record<string, unknown> | null {
  const entries: [string, unknown][] = [];
  if (layout.tier !== undefined) entries.push(['tier', layout.tier]);
  if (layout.childrenMode !== undefined) {
    entries.push(['childrenMode', layout.childrenMode]);
  }
  if (layout.hidden !== undefined) entries.push(['hidden', layout.hidden]);
  if (entries.length === 0) return null;
  return Object.fromEntries(entries);
}

function cloneDraft(draft: Draft): Draft {
  return {
    name: draft.name,
    levelLabels: draft.levelLabels ? [...draft.levelLabels] : null,
    ranks: draft.ranks ? draft.ranks.map((rank) => ({ ...rank })) : null,
    units: draft.units.map((unit) => ({ ...unit, layout: { ...unit.layout } })),
    positions: draft.positions.map((position) => ({ ...position })),
  };
}

/**
 * Representasi kanonik untuk perbandingan struktural: urutan kunci objek tidak
 * boleh memengaruhi hasil, jadi dibangun manual dengan urutan tetap.
 */
function draftKey(draft: Draft): string {
  return JSON.stringify([
    draft.name,
    draft.levelLabels,
    draft.ranks ? draft.ranks.map((rank) => [rank.id, rank.label]) : null,
    draft.units.map((unit) => [
      unit.id,
      unit.parentId,
      unit.name,
      unit.typeLabel,
      unit.description ?? null,
      unit.sortOrder,
      unit.layout.tier ?? null,
      unit.layout.childrenMode ?? null,
      unit.layout.hidden ?? null,
    ]),
    draft.positions.map((position) => [
      position.id,
      position.unitId,
      position.title,
      position.rank,
      position.kind,
      position.quota,
      position.hidden,
      position.sortOrder,
    ]),
  ]);
}

/** Urutan kanonik unit: DFS dari akar, lalu sisa unit (induk hilang/siklus) di akhir. */
function orderUnits(units: readonly Unit[]): Unit[] {
  const byParent = groupBy(units, (unit) => unit.parentId ?? ROOT_KEY);
  const placed = new Set<string>();
  const ordered: Unit[] = [];

  const visit = (unit: Unit, guard: Set<string>) => {
    if (placed.has(unit.id) || guard.has(unit.id)) return;
    guard.add(unit.id);
    placed.add(unit.id);
    ordered.push(unit);
    const children = [...(byParent.get(unit.id) ?? [])].sort(compareUnitOrder);
    for (const child of children) visit(child, guard);
    guard.delete(unit.id);
  };

  for (const root of [...(byParent.get(ROOT_KEY) ?? [])].sort(
    compareUnitOrder,
  )) {
    visit(root, new Set());
  }
  for (const unit of [...units].sort(compareUnitOrder)) visit(unit, new Set());

  const counters = new Map<string, number>();
  return ordered.map((unit) => {
    const key = unit.parentId ?? ROOT_KEY;
    const sortOrder = counters.get(key) ?? 0;
    counters.set(key, sortOrder + 1);
    return unit.sortOrder === sortOrder ? unit : { ...unit, sortOrder };
  });
}

/** Urutan kanonik posisi: dikelompokkan per unit mengikuti urutan unit, sortOrder 0..n-1. */
function orderPositions(
  positions: readonly Position[],
  unitIds: readonly string[],
): Position[] {
  const byUnit = groupBy(positions, (position) => position.unitId);
  const used = new Set<string>();
  const ordered: Position[] = [];

  const pushGroup = (unitId: string) => {
    if (used.has(unitId)) return;
    used.add(unitId);
    const items = [...(byUnit.get(unitId) ?? [])].sort(comparePositionOrder);
    items.forEach((position, index) => {
      ordered.push(
        position.sortOrder === index
          ? position
          : { ...position, sortOrder: index },
      );
    });
  };

  for (const unitId of unitIds) pushGroup(unitId);
  for (const unitId of [...byUnit.keys()].sort(cmpText)) pushGroup(unitId);
  return ordered;
}

function assignSiblingOrder(
  units: readonly Unit[],
  parentId: string | null,
  orderedIds: readonly string[],
): Unit[] {
  const orderById = new Map(
    orderedIds.map((id, index) => [id, index] as const),
  );
  return units.map((unit) => {
    if (unit.parentId !== parentId) return unit;
    const sortOrder = orderById.get(unit.id);
    return sortOrder === undefined || sortOrder === unit.sortOrder
      ? unit
      : { ...unit, sortOrder };
  });
}

function toPosition(position: Position & { placements: Person[] }): Position {
  return {
    id: position.id,
    unitId: position.unitId,
    title: position.title,
    rank: position.rank,
    kind: position.kind,
    quota: position.quota,
    hidden: position.hidden,
    sortOrder: position.sortOrder,
  };
}

function cleanLevelLabels(labels: string[] | null): string[] | null {
  if (!labels) return null;
  const cleaned = labels
    .map((label) => label.trim())
    .filter((label) => label !== '');
  return cleaned.length > 0 ? cleaned : null;
}

/** Membersihkan daftar rank sebelum dikirim; daftar yang sama dengan bawaan dikirim sebagai null. */
function cleanRanks(ranks: RankDef[] | null): RankDef[] | null {
  if (!ranks) return null;
  const cleaned = ranks
    .map((rank) => ({
      id: rank.id,
      label: rank.label.trim().slice(0, MAX_RANK_LABEL),
    }))
    .filter((rank) => rank.id !== '' && rank.label !== '');
  if (cleaned.length === 0) return null;
  const same =
    cleaned.length === DEFAULT_RANKS.length &&
    cleaned.every(
      (rank, index) =>
        rank.id === DEFAULT_RANKS[index]?.id &&
        rank.label === DEFAULT_RANKS[index]?.label,
    );
  return same ? null : cleaned;
}

export function toDraft(server: ServerOrganogram): Draft {
  const units = orderUnits(
    server.units.map((unit) => ({
      id: unit.id,
      parentId: unit.parentId,
      name: unit.name,
      typeLabel: unit.typeLabel,
      description: unit.description ?? null,
      sortOrder: unit.sortOrder,
      layout: normalizeLayout(unit.layout),
    })),
  );
  const positions = orderPositions(
    server.positions.map(toPosition),
    units.map((unit) => unit.id),
  );
  return {
    name: server.name,
    levelLabels: server.levelLabels ? [...server.levelLabels] : null,
    ranks: server.ranks ? server.ranks.map((rank) => ({ ...rank })) : null,
    units,
    positions,
  };
}

export function toPlacements(server: ServerOrganogram): PlacementsByPosition {
  const placements: PlacementsByPosition = {};
  for (const position of server.positions) {
    if (position.placements.length === 0) continue;
    placements[position.id] = position.placements.map((person) => ({
      ...person,
    }));
  }
  return placements;
}

export function toSavePayload(d: Draft): {
  name: string;
  levelLabels: string[] | null;
  ranks: RankDef[] | null;
  units: UnitNode[];
  positions: PositionNode[];
} {
  const unitCounters = new Map<string, number>();
  const units: UnitNode[] = d.units.map((unit) => {
    const key = unit.parentId ?? ROOT_KEY;
    const sortOrder = unitCounters.get(key) ?? 0;
    unitCounters.set(key, sortOrder + 1);
    return {
      id: unit.id,
      parentId: unit.parentId,
      name: unit.name,
      typeLabel: unit.typeLabel,
      description: unit.description ?? null,
      sortOrder,
      layout: layoutToRecord(unit.layout),
    };
  });

  const positionCounters = new Map<string, number>();
  const positions: PositionNode[] = d.positions.map((position) => {
    const sortOrder = positionCounters.get(position.unitId) ?? 0;
    positionCounters.set(position.unitId, sortOrder + 1);
    return { ...position, sortOrder };
  });

  return {
    name: d.name,
    levelLabels: cleanLevelLabels(d.levelLabels),
    ranks: cleanRanks(d.ranks),
    units,
    positions,
  };
}

export function createHistory(draft: Draft): EditorHistory {
  return {
    present: cloneDraft(draft),
    baseline: cloneDraft(draft),
    past: [],
    future: [],
    lastCoalesceKey: null,
  };
}

export function isDirty(h: EditorHistory): boolean {
  return draftKey(h.present) !== draftKey(h.baseline);
}

export function canUndo(h: EditorHistory): boolean {
  return h.past.length > 0;
}

export function canRedo(h: EditorHistory): boolean {
  return h.future.length > 0;
}

export type EditorAction =
  | { type: 'load'; draft: Draft }
  | { type: 'revert' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'setName'; name: string }
  | { type: 'setLevelLabels'; labels: string[] | null }
  | { type: 'setRanks'; ranks: RankDef[] | null }
  | {
      type: 'addUnit';
      id: string;
      parentId: string | null;
      name?: string;
      index?: number;
    }
  | { type: 'renameUnit'; id: string; name: string }
  | { type: 'setUnitType'; id: string; typeLabel: string | null }
  | { type: 'setUnitDescription'; id: string; description: string | null }
  | { type: 'setUnitLayout'; id: string; patch: Partial<UnitLayout> }
  | { type: 'moveUnit'; id: string; parentId: string | null; index: number }
  // Aksi massal untuk pilihan ganda: satu langkah urungkan untuk seluruh perubahan.
  | { type: 'moveUnits'; ids: string[]; parentId: string | null; index: number }
  | { type: 'deleteUnits'; ids: string[] }
  | { type: 'setUnitsLayout'; ids: string[]; patch: Partial<UnitLayout> }
  | { type: 'deleteUnit'; id: string }
  | {
      type: 'addPosition';
      id: string;
      unitId: string;
      title?: string;
      rank?: Rank;
      kind?: PositionKind;
      quota?: number;
    }
  | { type: 'updatePosition'; id: string; patch: PositionPatch }
  | { type: 'deletePosition'; id: string }
  | { type: 'movePosition'; id: string; unitId: string; index: number };

/** Menjalankan beberapa aksi lalu mencatatnya sebagai satu langkah riwayat. */
function applyBatch(h: EditorHistory, actions: EditorAction[]): EditorHistory {
  let next: EditorHistory = h;
  for (const action of actions) next = editorReducer(next, action);
  if (draftKey(next.present) === draftKey(h.present)) return h;
  return commit(h, next.present, null);
}

function commit(
  h: EditorHistory,
  next: Draft,
  coalesceKey: string | null,
): EditorHistory {
  if (draftKey(next) === draftKey(h.present)) return h;

  if (coalesceKey !== null && coalesceKey === h.lastCoalesceKey) {
    return { ...h, present: next };
  }

  const past = [...h.past, h.present];
  return {
    present: next,
    baseline: h.baseline,
    past:
      past.length > HISTORY_LIMIT
        ? past.slice(past.length - HISTORY_LIMIT)
        : past,
    future: [],
    lastCoalesceKey: coalesceKey,
  };
}

function applyPositionPatch(
  position: Position,
  patch: PositionPatch,
): Position {
  const next: Position = { ...position };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.rank !== undefined) next.rank = patch.rank;
  if (patch.kind !== undefined) next.kind = patch.kind;
  if (patch.quota !== undefined) next.quota = patch.quota;
  if (patch.hidden !== undefined) next.hidden = patch.hidden;
  return next;
}

export function editorReducer(
  h: EditorHistory,
  a: EditorAction,
): EditorHistory {
  switch (a.type) {
    case 'load': {
      return {
        present: cloneDraft(a.draft),
        baseline: cloneDraft(a.draft),
        past: [],
        future: [],
        lastCoalesceKey: null,
      };
    }
    case 'revert': {
      if (!isDirty(h) && h.past.length === 0 && h.future.length === 0) return h;
      return {
        present: cloneDraft(h.baseline),
        baseline: h.baseline,
        past: [],
        future: [],
        lastCoalesceKey: null,
      };
    }
    case 'undo': {
      const previous = h.past[h.past.length - 1];
      if (previous === undefined) return h;
      return {
        present: previous,
        baseline: h.baseline,
        past: h.past.slice(0, -1),
        future: [h.present, ...h.future],
        lastCoalesceKey: null,
      };
    }
    case 'redo': {
      const next = h.future[0];
      if (next === undefined) return h;
      const past = [...h.past, h.present];
      return {
        present: next,
        baseline: h.baseline,
        past:
          past.length > HISTORY_LIMIT
            ? past.slice(past.length - HISTORY_LIMIT)
            : past,
        future: h.future.slice(1),
        lastCoalesceKey: null,
      };
    }
    case 'setName': {
      if (a.name === h.present.name) return h;
      return commit(h, { ...h.present, name: a.name }, null);
    }
    case 'setLevelLabels': {
      return commit(
        h,
        { ...h.present, levelLabels: a.labels ? [...a.labels] : null },
        null,
      );
    }
    case 'setRanks': {
      return commit(
        h,
        {
          ...h.present,
          ranks: a.ranks ? a.ranks.map((rank) => ({ ...rank })) : null,
        },
        null,
      );
    }
    case 'addUnit': {
      const units = h.present.units;
      if (units.some((unit) => unit.id === a.id)) return h;
      if (
        a.parentId !== null &&
        !units.some((unit) => unit.id === a.parentId)
      ) {
        return h;
      }

      const parentLevel =
        a.parentId === null ? 0 : computeLevels(units).get(a.parentId);
      if (parentLevel === undefined || parentLevel + 1 > MAX_TREE_DEPTH)
        return h;

      const name =
        a.name !== undefined && a.name.trim() !== ''
          ? a.name
          : DEFAULT_UNIT_NAME;
      const siblings = childrenOf(units, a.parentId);
      const index = clampIndex(a.index ?? siblings.length, siblings.length);
      const created: Unit = {
        id: a.id,
        parentId: a.parentId,
        name,
        typeLabel: null,
        description: null,
        sortOrder: index,
        layout: {},
      };
      const orderedIds = [
        ...siblings.slice(0, index).map((unit) => unit.id),
        a.id,
        ...siblings.slice(index).map((unit) => unit.id),
      ];
      const nextUnits = orderUnits(
        assignSiblingOrder([...units, created], a.parentId, orderedIds),
      );
      return commit(h, { ...h.present, units: nextUnits }, null);
    }
    case 'renameUnit': {
      const target = h.present.units.find((unit) => unit.id === a.id);
      if (!target || target.name === a.name) return h;
      const units = h.present.units.map((unit) =>
        unit.id === a.id ? { ...unit, name: a.name } : unit,
      );
      return commit(h, { ...h.present, units }, `rename:${a.id}`);
    }
    case 'setUnitType': {
      const target = h.present.units.find((unit) => unit.id === a.id);
      if (!target) return h;
      const typeLabel =
        a.typeLabel !== null && a.typeLabel.trim() !== '' ? a.typeLabel : null;
      if (target.typeLabel === typeLabel) return h;
      const units = h.present.units.map((unit) =>
        unit.id === a.id ? { ...unit, typeLabel } : unit,
      );
      return commit(h, { ...h.present, units }, `type:${a.id}`);
    }
    case 'setUnitDescription': {
      const target = h.present.units.find((unit) => unit.id === a.id);
      if (!target) return h;
      const description =
        a.description !== null && a.description.trim() !== ''
          ? a.description
          : null;
      if ((target.description ?? null) === description) return h;
      const units = h.present.units.map((unit) =>
        unit.id === a.id ? { ...unit, description } : unit,
      );
      return commit(h, { ...h.present, units }, `desc:${a.id}`);
    }
    case 'setUnitLayout': {
      const target = h.present.units.find((unit) => unit.id === a.id);
      if (!target) return h;
      const merged: Record<string, unknown> = { ...target.layout, ...a.patch };
      const layout = normalizeLayout(merged);
      if (
        layout.tier === target.layout.tier &&
        layout.childrenMode === target.layout.childrenMode &&
        layout.hidden === target.layout.hidden
      ) {
        return h;
      }
      const units = h.present.units.map((unit) =>
        unit.id === a.id ? { ...unit, layout } : unit,
      );
      return commit(h, { ...h.present, units }, null);
    }
    case 'moveUnit': {
      const units = h.present.units;
      if (!units.some((unit) => unit.id === a.id)) return h;
      if (
        a.parentId !== null &&
        !units.some((unit) => unit.id === a.parentId)
      ) {
        return h;
      }

      const subtree = subtreeIds(units, [a.id]);
      if (a.parentId !== null && subtree.has(a.parentId)) return h;

      const levels = computeLevels(units);
      const ownLevel = levels.get(a.id);
      const parentLevel = a.parentId === null ? 0 : levels.get(a.parentId);
      if (ownLevel === undefined || parentLevel === undefined) return h;

      let subtreeHeight = 0;
      for (const id of subtree) {
        const level = levels.get(id);
        if (level === undefined) return h;
        subtreeHeight = Math.max(subtreeHeight, level - ownLevel);
      }
      if (parentLevel + 1 + subtreeHeight > MAX_TREE_DEPTH) return h;

      const reparented = units.map((unit) =>
        unit.id === a.id ? { ...unit, parentId: a.parentId } : unit,
      );
      const siblings = childrenOf(reparented, a.parentId).filter(
        (unit) => unit.id !== a.id,
      );
      const index = clampIndex(a.index, siblings.length);
      const orderedIds = [
        ...siblings.slice(0, index).map((unit) => unit.id),
        a.id,
        ...siblings.slice(index).map((unit) => unit.id),
      ];
      const nextUnits = orderUnits(
        assignSiblingOrder(reparented, a.parentId, orderedIds),
      );
      return commit(h, { ...h.present, units: nextUnits }, null);
    }
    case 'moveUnits': {
      return applyBatch(
        h,
        a.ids.map((id, k) => ({
          type: 'moveUnit' as const,
          id,
          parentId: a.parentId,
          index: a.index + k,
        })),
      );
    }
    case 'deleteUnits': {
      return applyBatch(
        h,
        a.ids.map((id) => ({ type: 'deleteUnit' as const, id })),
      );
    }
    case 'setUnitsLayout': {
      return applyBatch(
        h,
        a.ids.map((id) => ({
          type: 'setUnitLayout' as const,
          id,
          patch: a.patch,
        })),
      );
    }
    case 'deleteUnit': {
      const units = h.present.units;
      if (!units.some((unit) => unit.id === a.id)) return h;
      const removed = subtreeIds(units, [a.id]);
      const nextUnits = orderUnits(
        units.filter((unit) => !removed.has(unit.id)),
      );
      const positions = h.present.positions.filter(
        (position) => !removed.has(position.unitId),
      );
      const nextPositions = orderPositions(
        positions,
        nextUnits.map((unit) => unit.id),
      );
      return commit(
        h,
        { ...h.present, units: nextUnits, positions: nextPositions },
        null,
      );
    }
    case 'addPosition': {
      if (!h.present.units.some((unit) => unit.id === a.unitId)) return h;
      if (h.present.positions.some((position) => position.id === a.id))
        return h;

      const siblings = h.present.positions.filter(
        (position) => position.unitId === a.unitId,
      );
      const sortOrder = siblings.reduce(
        (max, position) => Math.max(max, position.sortOrder + 1),
        0,
      );
      const created: Position = {
        id: a.id,
        unitId: a.unitId,
        title:
          a.title !== undefined && a.title.trim() !== ''
            ? a.title
            : DEFAULT_POSITION_TITLE,
        rank: a.rank ?? defaultNewRank(h.present.ranks),
        kind: a.kind ?? 'struktural',
        quota: a.quota === undefined ? 0 : normalizeQuota(a.quota),
        hidden: false,
        sortOrder,
      };
      const positions = orderPositions(
        [...h.present.positions, created],
        h.present.units.map((unit) => unit.id),
      );
      return commit(h, { ...h.present, positions }, null);
    }
    case 'updatePosition': {
      const current = h.present.positions.find(
        (position) => position.id === a.id,
      );
      if (!current) return h;

      const patch: PositionPatch = { ...a.patch };
      if (patch.quota !== undefined) patch.quota = normalizeQuota(patch.quota);

      const next = applyPositionPatch(current, patch);
      const positions = h.present.positions.map((position) =>
        position.id === a.id ? next : position,
      );
      const keys = Object.keys(patch).sort().join(',');
      return commit(h, { ...h.present, positions }, `pos:${a.id}:${keys}`);
    }
    case 'deletePosition': {
      if (!h.present.positions.some((position) => position.id === a.id))
        return h;
      const positions = orderPositions(
        h.present.positions.filter((position) => position.id !== a.id),
        h.present.units.map((unit) => unit.id),
      );
      return commit(h, { ...h.present, positions }, null);
    }
    case 'movePosition': {
      const moved = h.present.positions.find(
        (position) => position.id === a.id,
      );
      if (!moved) return h;
      if (!h.present.units.some((unit) => unit.id === a.unitId)) return h;

      const siblings = h.present.positions.filter(
        (position) => position.unitId === a.unitId && position.id !== a.id,
      );
      const index = clampIndex(a.index, siblings.length);
      const orderedIds = [
        ...siblings.slice(0, index).map((position) => position.id),
        a.id,
        ...siblings.slice(index).map((position) => position.id),
      ];
      const orderById = new Map(orderedIds.map((id, i) => [id, i] as const));

      const updated = h.present.positions.map((position) => {
        if (position.id === a.id) {
          return {
            ...position,
            unitId: a.unitId,
            sortOrder: orderById.get(a.id) ?? 0,
          };
        }
        if (position.unitId !== a.unitId) return position;
        const sortOrder = orderById.get(position.id);
        return sortOrder === undefined || sortOrder === position.sortOrder
          ? position
          : { ...position, sortOrder };
      });

      const positions = orderPositions(
        updated,
        h.present.units.map((unit) => unit.id),
      );
      return commit(h, { ...h.present, positions }, null);
    }
  }
}

export const MAX_DEPTH = MAX_TREE_DEPTH;

export function childrenOf(units: Unit[], parentId: string | null): Unit[] {
  return units
    .filter((unit) => unit.parentId === parentId)
    .sort(compareUnitOrder);
}

export function levelOf(units: Unit[], id: string): number {
  return computeLevels(units).get(id) ?? 0;
}

export function maxDepth(units: Unit[]): number {
  let depth = 0;
  for (const level of computeLevels(units).values()) {
    if (level > depth) depth = level;
  }
  return depth;
}

export function pathOf(units: Unit[], id: string): string {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const parts: string[] = [];
  const visited = new Set<string>();
  let cursor: string | null = id;

  while (cursor !== null) {
    if (visited.has(cursor)) return '';
    visited.add(cursor);
    const unit = byId.get(cursor);
    if (!unit) return '';
    const index = childrenOf(units, unit.parentId).findIndex(
      (sibling) => sibling.id === unit.id,
    );
    if (index < 0) return '';
    parts.unshift(String(index + 1).padStart(2, '0'));
    cursor = unit.parentId;
  }

  return parts.join('.');
}

export function descendantsOf(units: Unit[], id: string): Set<string> {
  return subtreeIds(units, [id]);
}

export function levelLabelFor(
  depth: number,
  levelLabels: string[] | null,
): string {
  if (depth < 1 || !levelLabels) return DEFAULT_LEVEL_LABEL;
  const trimmed = levelLabels[depth - 1]?.trim();
  return trimmed === undefined || trimmed === ''
    ? DEFAULT_LEVEL_LABEL
    : trimmed;
}

export function rankLabelFor(rank: Rank, ranks: RankDef[] | null): string {
  const found = effectiveRanks(ranks).find((item) => item.id === rank);
  const trimmed = found?.label.trim();
  return trimmed === undefined || trimmed === '' ? rank : trimmed;
}

/** Urutan rank (0 = paling senior); rank yang tidak dikenal paling akhir. */
export function rankIndexOf(rank: Rank, ranks: RankDef[] | null): number {
  const index = effectiveRanks(ranks).findIndex((item) => item.id === rank);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

/** Rank untuk jabatan baru: yang paling junior (biasanya Staf). */
export function defaultNewRank(ranks: RankDef[] | null): Rank {
  const list = effectiveRanks(ranks);
  return list[list.length - 1]?.id ?? 'staff';
}

export function unitTypeLabel(
  unit: Unit,
  depth: number,
  levelLabels: string[] | null,
): string {
  const trimmed = unit.typeLabel?.trim();
  return trimmed === undefined || trimmed === ''
    ? levelLabelFor(depth, levelLabels)
    : trimmed;
}

export function canMoveUnit(
  units: Unit[],
  id: string,
  parentId: string | null,
): { ok: true } | { ok: false; reason: string } {
  const levels = computeLevels(units);
  const ownLevel = levels.get(id);
  if (ownLevel === undefined) {
    return { ok: false, reason: 'Unit tidak ditemukan.' };
  }
  if (parentId !== null && !units.some((unit) => unit.id === parentId)) {
    return { ok: false, reason: 'Unit induk tidak ditemukan.' };
  }

  const subtree = subtreeIds(units, [id]);
  if (parentId !== null && subtree.has(parentId)) {
    return {
      ok: false,
      reason: 'Unit tidak bisa dipindahkan ke dalam subpohonnya sendiri.',
    };
  }

  const parentLevel = parentId === null ? 0 : levels.get(parentId);
  if (parentLevel === undefined) {
    return { ok: false, reason: 'Unit induk tidak ditemukan.' };
  }

  let subtreeHeight = 0;
  for (const childId of subtree) {
    const level = levels.get(childId);
    if (level === undefined) {
      return { ok: false, reason: 'Unit berada dalam siklus induk-anak.' };
    }
    subtreeHeight = Math.max(subtreeHeight, level - ownLevel);
  }

  if (parentLevel + 1 + subtreeHeight > MAX_TREE_DEPTH) {
    return {
      ok: false,
      reason: `Pemindahan melebihi kedalaman maksimum ${MAX_TREE_DEPTH} tingkat.`,
    };
  }
  return { ok: true };
}

export function peopleCountBySubtree(
  d: Draft,
  placements: PlacementsByPosition,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const unit of d.units) counts[unit.id] = 0;

  const parentOf = new Map(
    d.units.map((unit) => [unit.id, unit.parentId] as const),
  );

  for (const position of d.positions) {
    const count = placements[position.id]?.length ?? 0;
    if (count === 0) continue;

    const seen = new Set<string>();
    let cursor: string | null = position.unitId;
    while (cursor !== null && !seen.has(cursor)) {
      seen.add(cursor);
      const current = counts[cursor];
      if (current !== undefined) counts[cursor] = current + count;
      cursor = parentOf.get(cursor) ?? null;
    }
  }

  return counts;
}

export function filledOfQuota(
  position: Position,
  placements: PlacementsByPosition,
): { filled: number; quota: number } {
  const people = placements[position.id] ?? [];
  const filled = people.filter((person) => person.source !== 'closerec').length;
  return { filled, quota: position.quota };
}

export type DraftStats = {
  levelCounts: number[];
  positionCount: number;
  depth: number;
};

export function statsOf(d: Draft): DraftStats {
  const counts: number[] = [];
  for (const level of computeLevels(d.units).values()) {
    const index = level - 1;
    counts[index] = (counts[index] ?? 0) + 1;
  }
  const levelCounts = Array.from(
    { length: counts.length },
    (_, index) => counts[index] ?? 0,
  );
  return {
    levelCounts,
    positionCount: d.positions.length,
    depth: levelCounts.length,
  };
}

export type TreeRow = {
  unit: Unit;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
};

export function visibleRows(
  d: Draft,
  expanded: ReadonlySet<string>,
  filter?: string,
): TreeRow[] {
  const query = (filter ?? '').trim().toLowerCase();

  const buckets = new Map<string | null, Unit[]>();
  for (const unit of d.units) {
    const bucket = buckets.get(unit.parentId);
    if (bucket) bucket.push(unit);
    else buckets.set(unit.parentId, [unit]);
  }

  const childrenOfParent = (parentId: string | null): Unit[] =>
    [...(buckets.get(parentId) ?? [])].sort(compareUnitOrder);

  const rows: TreeRow[] = [];

  if (query === '') {
    const seen = new Set<string>();
    const walk = (parentId: string | null, depth: number) => {
      for (const unit of childrenOfParent(parentId)) {
        if (seen.has(unit.id)) continue;
        seen.add(unit.id);
        const hasChildren = (buckets.get(unit.id)?.length ?? 0) > 0;
        const open = hasChildren && expanded.has(unit.id);
        rows.push({ unit, depth, hasChildren, expanded: open });
        if (open) walk(unit.id, depth + 1);
      }
    };
    walk(null, 1);
    return rows;
  }

  const keep = new Set<string>();
  const visited = new Set<string>();
  const matches = (unit: Unit, depth: number) =>
    unit.name.toLowerCase().includes(query) ||
    unitTypeLabel(unit, depth, d.levelLabels).toLowerCase().includes(query);

  const collect = (parentId: string | null, depth: number): boolean => {
    let any = false;
    for (const unit of childrenOfParent(parentId)) {
      if (visited.has(unit.id)) continue;
      visited.add(unit.id);
      const childMatched = collect(unit.id, depth + 1);
      if (matches(unit, depth) || childMatched) {
        keep.add(unit.id);
        any = true;
      }
    }
    return any;
  };
  collect(null, 1);

  const emitted = new Set<string>();
  const walkKept = (parentId: string | null, depth: number) => {
    for (const unit of childrenOfParent(parentId)) {
      if (!keep.has(unit.id) || emitted.has(unit.id)) continue;
      emitted.add(unit.id);
      const hasChildren = childrenOfParent(unit.id).some((child) =>
        keep.has(child.id),
      );
      rows.push({ unit, depth, hasChildren, expanded: hasChildren });
      walkKept(unit.id, depth + 1);
    }
  };
  walkKept(null, 1);
  return rows;
}

export function validateDraft(d: Draft): string[] {
  const tree: Tree = {
    units: d.units.map((unit) => ({
      id: unit.id,
      parentId: unit.parentId,
      name: unit.name,
      typeLabel: unit.typeLabel,
      description: unit.description ?? null,
      sortOrder: unit.sortOrder,
      layout: layoutToRecord(unit.layout),
    })),
    positions: d.positions.map((position) => ({ ...position })),
  };
  const problems = validateTree(tree);
  const known = new Set(effectiveRanks(d.ranks).map((rank) => rank.id));
  for (const position of d.positions) {
    if (!known.has(position.rank)) {
      problems.push(
        `Jabatan "${position.title}" memakai rank yang tidak ada di daftar rank.`,
      );
    }
  }
  return problems;
}

export type UnitDropPosition = 'before' | 'after' | 'inside';

/**
 * Rencana pemindahan bagian ke sasaran seretan: induk baru dan urutannya di antara
 * saudara. Dipakai bersama oleh pohon Struktur dan bagan; kebijakan hak ubah ada di pemanggil.
 */
export function planUnitDrop(
  units: Unit[],
  activeId: string,
  targetId: string,
  position: UnitDropPosition,
):
  | { ok: true; parentId: string | null; index: number }
  | { ok: false; reason: string } {
  const target = units.find((unit) => unit.id === targetId);
  if (!units.some((unit) => unit.id === activeId) || !target) {
    return { ok: false, reason: 'Bagian tidak ditemukan.' };
  }
  const parentId = position === 'inside' ? target.id : target.parentId;
  const siblings = childrenOf(units, parentId).filter(
    (unit) => unit.id !== activeId,
  );
  let index = siblings.length;
  if (position !== 'inside') {
    const targetIndex = siblings.findIndex((unit) => unit.id === targetId);
    if (targetIndex < 0) {
      return { ok: false, reason: 'Tujuan pemindahan tidak ditemukan.' };
    }
    index = position === 'before' ? targetIndex : targetIndex + 1;
  }
  const check = canMoveUnit(units, activeId, parentId);
  if (!check.ok) return check;
  return { ok: true, parentId, index };
}

/** Indeks di akhir daftar jabatan sebuah bagian, tidak menghitung jabatan yang dipindah. */
export function endIndexOfPositions(
  positions: Position[],
  unitId: string,
  movedId: string,
): number {
  return positions.filter(
    (position) => position.unitId === unitId && position.id !== movedId,
  ).length;
}

/**
 * Rencana pemindahan jabatan ke posisi relatif terhadap jabatan lain:
 * bagian tujuan dan indeks di antara jabatan bagian itu (tanpa jabatan yang dipindah).
 */
export function planPositionDrop(
  positions: Position[],
  movedId: string,
  targetId: string,
  where: 'before' | 'after',
): { unitId: string; index: number } | null {
  const target = positions.find((position) => position.id === targetId);
  if (!target || movedId === targetId) return null;
  const siblings = positions.filter(
    (position) => position.unitId === target.unitId && position.id !== movedId,
  );
  const at = siblings.findIndex((position) => position.id === targetId);
  if (at < 0) return null;
  return { unitId: target.unitId, index: where === 'before' ? at : at + 1 };
}

/**
 * Bagian induk dari sebuah pilihan: yang tidak punya leluhur ikut terpilih, dalam urutan
 * kanonik pohon. Memindah atau menghapus induk sudah membawa turunannya.
 */
export function selectionRoots(units: Unit[], ids: readonly string[]): Unit[] {
  const chosen = new Set(ids);
  const byId = new Map(units.map((unit) => [unit.id, unit] as const));
  const hasChosenAncestor = (unit: Unit): boolean => {
    let parentId = unit.parentId;
    for (
      let depth = 0;
      parentId !== null && depth < MAX_DEPTH + 2;
      depth += 1
    ) {
      if (chosen.has(parentId)) return true;
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return false;
  };
  return units.filter(
    (unit) => chosen.has(unit.id) && !hasChosenAncestor(unit),
  );
}

/** Rencana memindahkan beberapa bagian sekaligus ke sasaran seretan (urutan kanonik dipertahankan). */
export function planUnitsDrop(
  units: Unit[],
  ids: readonly string[],
  targetId: string,
  position: UnitDropPosition,
):
  | { ok: true; ids: string[]; parentId: string | null; index: number }
  | { ok: false; reason: string } {
  const roots = selectionRoots(units, ids);
  const target = units.find((unit) => unit.id === targetId);
  if (roots.length === 0 || !target) {
    return { ok: false, reason: 'Bagian tidak ditemukan.' };
  }
  const moved = subtreeIds(
    units,
    roots.map((unit) => unit.id),
  );
  if (moved.has(targetId)) {
    return {
      ok: false,
      reason: 'Bagian tidak bisa dipindahkan ke dalam dirinya sendiri.',
    };
  }
  const parentId = position === 'inside' ? target.id : target.parentId;
  const rootIds = new Set(roots.map((unit) => unit.id));
  const siblings = childrenOf(units, parentId).filter(
    (unit) => !rootIds.has(unit.id),
  );
  let index = siblings.length;
  if (position !== 'inside') {
    const at = siblings.findIndex((unit) => unit.id === targetId);
    if (at < 0)
      return { ok: false, reason: 'Tujuan pemindahan tidak ditemukan.' };
    index = position === 'before' ? at : at + 1;
  }
  for (const unit of roots) {
    const check = canMoveUnit(units, unit.id, parentId);
    if (!check.ok) return check;
  }
  return { ok: true, ids: roots.map((unit) => unit.id), parentId, index };
}

/** Rencana menjadikan beberapa bagian sebagai tingkat teratas (di akhir daftar akar). */
export function planUnitsToRoot(
  units: Unit[],
  ids: readonly string[],
):
  | { ok: true; ids: string[]; parentId: null; index: number }
  | { ok: false; reason: string } {
  const roots = selectionRoots(units, ids);
  if (roots.length === 0)
    return { ok: false, reason: 'Bagian tidak ditemukan.' };
  const rootIds = new Set(roots.map((unit) => unit.id));
  const index = childrenOf(units, null).filter(
    (unit) => !rootIds.has(unit.id),
  ).length;
  for (const unit of roots) {
    const check = canMoveUnit(units, unit.id, null);
    if (!check.ok) return check;
  }
  return { ok: true, ids: roots.map((unit) => unit.id), parentId: null, index };
}

/**
 * Teks toast "Urungkan" untuk aksi yang merusak atau memindahkan banyak hal; null untuk aksi
 * biasa. Dihitung sebelum aksi dijalankan, supaya nama dan jumlahnya masih ada.
 */
export function describeUndoable(
  action: EditorAction,
  draft: Draft,
): string | null {
  switch (action.type) {
    case 'deleteUnit': {
      const unit = draft.units.find((item) => item.id === action.id);
      if (!unit) return null;
      const subs = descendantsOf(draft.units, unit.id).size - 1;
      return subs > 0
        ? `"${unit.name}" dan ${subs} sub-bagiannya dihapus.`
        : `"${unit.name}" dihapus.`;
    }
    case 'deleteUnits': {
      const roots = selectionRoots(draft.units, action.ids);
      if (roots.length === 0) return null;
      return `${roots.length} bagian dihapus.`;
    }
    case 'moveUnits': {
      const roots = selectionRoots(draft.units, action.ids);
      return roots.length > 1 ? `${roots.length} bagian dipindahkan.` : null;
    }
    case 'deletePosition': {
      const position = draft.positions.find((item) => item.id === action.id);
      return position ? `Jabatan "${position.title}" dihapus.` : null;
    }
    default:
      return null;
  }
}
