import type { Draft, Person, PlacementsByPosition, Rank, Unit } from './model';

export const NODE_W = 264;
export const HEADER_H = 44;
export const SEAT_H = 32;
export const GROUP_H = 36;
export const NODE_PAD = 8;
/** Jarak antar subpohon saudara yang disusun berjajar. */
export const H_GAP = 32;
/** Dari dasar induk ke puncak anak (susunan berjajar). */
export const V_GAP = 56;
export const HANG_INDENT = 32;
/** Jarak antar saudara yang disusun menggantung. */
export const HANG_GAP = 16;
export const CANVAS_PAD = 32;

export type SeatRow =
  | {
      kind: 'seat';
      positionId: string;
      title: string;
      rank: Rank;
      person: Person | null;
    }
  | {
      kind: 'group';
      positionId: string;
      title: string;
      filled: number;
      quota: number;
      people: Person[];
    };

export type ChartNode = {
  id: string;
  unit: Unit;
  depth: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rows: SeatRow[];
  hasChildren: boolean;
  collapsed: boolean;
};

export type ChartEdge = {
  id: string;
  from: string;
  to: string;
  /** Data jalur SVG dalam koordinat kanvas. */
  d: string;
};

export type ChartLayout = {
  nodes: ChartNode[];
  edges: ChartEdge[];
  width: number;
  height: number;
};

type Position = Draft['positions'][number];

/** Hasil tata letak satu subpohon, relatif terhadap sudut kiri-atas node akarnya (0,0). */
type Subtree = {
  width: number;
  height: number;
  /** Batas kiri subpohon relatif terhadap x node akar (bisa negatif). */
  minX: number;
  nodes: ChartNode[];
};

const CORNER = 8;

function childrenModeOf(unit: Unit): 'hanging' | 'side' {
  return (
    unit.layout.childrenMode ?? (unit.parentId === null ? 'side' : 'hanging')
  );
}

function pathSide(
  px: number,
  py: number,
  cx: number,
  cy: number,
  busY: number,
): string {
  const dx = cx - px;
  if (dx === 0) return `M ${px} ${py} V ${cy}`;
  if (Math.abs(dx) < 2 * CORNER) {
    return `M ${px} ${py} V ${busY} H ${cx} V ${cy}`;
  }
  const sign = dx >= 0 ? 1 : -1;
  return [
    `M ${px} ${py}`,
    `V ${busY - CORNER}`,
    `Q ${px} ${busY} ${px + sign * CORNER} ${busY}`,
    `H ${cx - sign * CORNER}`,
    `Q ${cx} ${busY} ${cx} ${busY + CORNER}`,
    `V ${cy}`,
  ].join(' ');
}

function pathHanging(sx: number, sy: number, cx: number, cy: number): string {
  const dx = cx - sx;
  if (Math.abs(dx) < 2 * CORNER) {
    return `M ${sx} ${sy} V ${cy} H ${cx}`;
  }
  const sign = dx >= 0 ? 1 : -1;
  return [
    `M ${sx} ${sy}`,
    `V ${cy - CORNER}`,
    `Q ${sx} ${cy} ${sx + sign * CORNER} ${cy}`,
    `H ${cx}`,
  ].join(' ');
}

const cmpText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function layoutChart(
  draft: Draft,
  placements: PlacementsByPosition,
  collapsed: ReadonlySet<string>,
): ChartLayout {
  const empty: ChartLayout = {
    nodes: [],
    edges: [],
    width: 2 * CANVAS_PAD,
    height: 2 * CANVAS_PAD,
  };
  if (draft.units.length === 0) return empty;

  const byId = new Map(draft.units.map((unit) => [unit.id, unit] as const));

  const roots: Unit[] = [];
  const childrenByParent = new Map<string, Unit[]>();
  for (const unit of draft.units) {
    if (unit.layout.hidden === true) continue;
    if (unit.parentId === null || !byId.has(unit.parentId)) {
      roots.push(unit);
    } else {
      const list = childrenByParent.get(unit.parentId);
      if (list) list.push(unit);
      else childrenByParent.set(unit.parentId, [unit]);
    }
  }

  const cmpUnit = (a: Unit, b: Unit): number =>
    a.sortOrder - b.sortOrder || cmpText(a.name, b.name);
  roots.sort(cmpUnit);
  for (const list of childrenByParent.values()) list.sort(cmpUnit);

  const positionsByUnit = new Map<string, Position[]>();
  for (const position of draft.positions) {
    if (position.hidden) continue;
    const list = positionsByUnit.get(position.unitId);
    if (list) list.push(position);
    else positionsByUnit.set(position.unitId, [position]);
  }
  const cmpPosition = (a: Position, b: Position): number =>
    a.sortOrder - b.sortOrder || cmpText(a.title, b.title);
  for (const list of positionsByUnit.values()) list.sort(cmpPosition);

  const rowsOf = (unitId: string): { h: number; rows: SeatRow[] } => {
    const rows: SeatRow[] = (positionsByUnit.get(unitId) ?? []).map(
      (position): SeatRow => {
        const people = placements[position.id] ?? [];
        if (position.quota === 1 && people.length <= 1) {
          return {
            kind: 'seat',
            positionId: position.id,
            title: position.title,
            rank: position.rank,
            person: people[0] ?? null,
          };
        }
        return {
          kind: 'group',
          positionId: position.id,
          title: position.title,
          filled: people.filter((person) => person.source !== 'closerec')
            .length,
          quota: position.quota,
          people,
        };
      },
    );
    const body = rows.reduce(
      (sum, row) => sum + (row.kind === 'seat' ? SEAT_H : GROUP_H),
      0,
    );
    return { h: HEADER_H + body + NODE_PAD, rows };
  };

  const layoutUnit = (unit: Unit, depth: number): Subtree => {
    const { h: nodeH, rows } = rowsOf(unit.id);
    const visibleChildren = childrenByParent.get(unit.id) ?? [];
    const hasChildren = visibleChildren.length > 0;
    const isCollapsed = collapsed.has(unit.id) && hasChildren;

    const own: ChartNode = {
      id: unit.id,
      unit,
      depth,
      x: 0,
      y: 0,
      w: NODE_W,
      h: nodeH,
      rows,
      hasChildren,
      collapsed: isCollapsed,
    };

    if (!hasChildren || isCollapsed) {
      return { width: NODE_W, height: nodeH, minX: 0, nodes: [own] };
    }

    const childSubs = visibleChildren.map((child) =>
      layoutUnit(child, depth + 1),
    );
    const nodes: ChartNode[] = [own];
    let minX = 0;
    let maxX = NODE_W;
    let maxY = nodeH;

    const place = (sub: Subtree, boundLeft: number, nodeY: number) => {
      const nodeX = boundLeft - sub.minX;
      for (const childNode of sub.nodes) {
        nodes.push({
          ...childNode,
          x: childNode.x + nodeX,
          y: childNode.y + nodeY,
        });
      }
      minX = Math.min(minX, boundLeft);
      maxX = Math.max(maxX, boundLeft + sub.width);
      maxY = Math.max(maxY, nodeY + sub.height);
    };

    if (childrenModeOf(unit) === 'side') {
      const lefts: number[] = [];
      let cursor = 0;
      for (const sub of childSubs) {
        lefts.push(cursor);
        cursor += sub.width + H_GAP;
      }
      const firstSub = childSubs[0];
      const lastSub = childSubs[childSubs.length - 1];
      const firstLeft = lefts[0];
      const lastLeft = lefts[lefts.length - 1];
      if (
        firstSub === undefined ||
        lastSub === undefined ||
        firstLeft === undefined ||
        lastLeft === undefined
      ) {
        return { width: NODE_W, height: nodeH, minX: 0, nodes: [own] };
      }
      const firstCenter = firstLeft - firstSub.minX + NODE_W / 2;
      const lastCenter = lastLeft - lastSub.minX + NODE_W / 2;
      // Induk berada di tengah rentang pusat anak pertama dan terakhir.
      const shift = NODE_W / 2 - (firstCenter + lastCenter) / 2;
      childSubs.forEach((sub, index) => {
        place(sub, (lefts[index] ?? 0) + shift, nodeH + V_GAP);
      });
    } else {
      let cursorY = nodeH + HANG_GAP;
      for (const sub of childSubs) {
        place(sub, HANG_INDENT, cursorY);
        cursorY += sub.height + HANG_GAP;
      }
    }

    return { width: maxX - minX, height: maxY, minX, nodes };
  };

  const placed: ChartNode[] = [];
  let cursorX = 0;
  for (const root of roots) {
    const sub = layoutUnit(root, 1);
    const nodeX = cursorX - sub.minX;
    for (const node of sub.nodes) {
      placed.push({ ...node, x: node.x + nodeX });
    }
    cursorX += sub.width + H_GAP;
  }
  if (placed.length === 0) return empty;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of placed) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.w);
    maxY = Math.max(maxY, node.y + node.h);
  }

  const dx = CANVAS_PAD - minX;
  const dy = CANVAS_PAD - minY;
  const nodes = placed.map((node) => ({
    ...node,
    x: node.x + dx,
    y: node.y + dy,
  }));
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));

  const edges: ChartEdge[] = [];
  for (const node of nodes) {
    if (node.collapsed) continue;
    const side = childrenModeOf(node.unit) === 'side';
    for (const child of childrenByParent.get(node.id) ?? []) {
      const childNode = nodeById.get(child.id);
      if (!childNode) continue;
      const d = side
        ? pathSide(
            node.x + node.w / 2,
            node.y + node.h,
            childNode.x + childNode.w / 2,
            childNode.y,
            node.y + node.h + V_GAP / 2,
          )
        : pathHanging(
            node.x + 16,
            node.y + node.h,
            childNode.x,
            childNode.y + childNode.h / 2,
          );
      edges.push({
        id: `${node.id}->${child.id}`,
        from: node.id,
        to: child.id,
        d,
      });
    }
  }

  return {
    nodes,
    edges,
    width: maxX - minX + 2 * CANVAS_PAD,
    height: maxY - minY + 2 * CANVAS_PAD,
  };
}

/** Kotak pembatas gabungan node-node dengan id yang diberikan; null bila tidak ada yang ditemukan. */
export function boundsOf(
  layout: ChartLayout,
  ids: ReadonlySet<string>,
): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;
  for (const node of layout.nodes) {
    if (!ids.has(node.id)) continue;
    found = true;
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.w);
    maxY = Math.max(maxY, node.y + node.h);
  }
  if (!found) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
