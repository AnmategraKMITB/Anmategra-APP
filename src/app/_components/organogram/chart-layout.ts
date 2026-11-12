import { NODE_WIDTH_DEFAULT, effectiveEvenRows, effectiveTier, rankIndexOf } from './model';
import type { Draft, Person, PlacementsByPosition, Rank, Unit } from './model';

export const NODE_W = NODE_WIDTH_DEFAULT;
export const HEADER_H = 44;
export const SEAT_H = 36;
export const GROUP_H = 36;
/** Tinggi satu baris orang di dalam kelompok jabatan yang dibuka. */
export const PERSON_H = 28;
export const NODE_PAD = 8;
/** Jarak antara kartu bagian dan kotak jabatan nonstruktural di bawahnya. */
export const NS_GAP = 8;
/** Nama bagian boleh turun baris (paling banyak tiga), lalu dipotong dengan "...". */
export const TITLE_LINE_H = 18;
export const TITLE_MAX_LINES = 3;
export const TYPE_LINE_H = 16;
const HEADER_PAD_Y = 5;
/** Perkiraan lebar rata-rata satu huruf nama bagian (14 px, tebal), sedikit berlebih agar aman. */
const TITLE_CHAR_W = 7.8;
/** Lebar teks nama di header: kartu dikurangi padding dan tombol ciutkan. */
/** Lebar kartu satu bagian (bawaan bila belum diatur). */
export function nodeWidthOf(unit: Unit): number {
  return unit.layout.width ?? NODE_W;
}
/** Jarak antar subpohon saudara yang disusun berjajar. */
export const H_GAP = 32;
/** Dari dasar induk ke puncak anak (susunan berjajar). */
export const V_GAP = 56;
export const HANG_INDENT = 32;
/** Jarak antar saudara yang disusun menggantung. */
export const HANG_GAP = 16;
export const CANVAS_PAD = 32;
/** Ruang kosong di kiri-kanan sumbu agar garis tidak menembus simpul leher. */
const CORRIDOR = 30;
/** Jarak antar baris simpul leher. */
const NECK_GAP = 20;

/** Pilihan tampilan bagan yang bisa dimatikan pengguna. */
export type ChartLayoutOptions = {
  /** Tulis jenis bagian di atas nama. */
  showLabels: boolean;
  /** Samakan tinggi kartu dalam satu pita. */
  alignHeights: boolean;
};

export const DEFAULT_CHART_OPTIONS: ChartLayoutOptions = {
  showLabels: true,
  alignHeights: true,
};

export type SeatRow =
  | {
      kind: 'seat';
      positionId: string;
      title: string;
      rank: Rank;
      /** Urutan rank di organogram (0 = paling senior), untuk warna pil. */
      rankIndex: number;
      person: Person | null;
    }
  | {
      kind: 'group';
      positionId: string;
      title: string;
      filled: number;
      quota: number;
      people: Person[];
      expanded: boolean;
    };

export type ChartNode = {
  id: string;
  unit: Unit;
  depth: number;
  x: number;
  y: number;
  w: number;
  /** Tinggi seluruh node: kartu bagian ditambah kotak nonstruktural bila ada. */
  h: number;
  /** Tinggi header (nama bagian bisa lebih dari satu baris). */
  headerH: number;
  /** Tinggi kartu bagian saja (header dan jabatan struktural). */
  mainH: number;
  rows: SeatRow[];
  /** Jabatan nonstruktural, digambar sebagai kotak hijau terpisah di bawah kartu. */
  nsRows: SeatRow[];
  nsH: number;
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
  /** Lebar kartu akar subpohon. */
  rootW: number;
  nodes: ChartNode[];
};

const CORNER = 8;

/** Jumlah baris nama bagian setelah dibungkus per kata; dipotong di TITLE_MAX_LINES. */
export function titleLines(
  name: string,
  hasToggle: boolean,
  width: number = NODE_W,
): number {
  const avail = width - 24 - (hasToggle ? 44 : 0);
  const perLine = Math.max(1, Math.floor(avail / TITLE_CHAR_W));
  let lines = 1;
  let used = 0;
  for (const word of name.trim().split(/\s+/)) {
    if (word === '') continue;
    const len = word.length;
    if (len > perLine) {
      // Kata panjang dipecah paksa (break-words) dan memulai baris baru.
      if (used > 0) lines += 1;
      lines += Math.ceil(len / perLine) - 1;
      used = len % perLine === 0 ? perLine : len % perLine;
      continue;
    }
    if (used === 0) used = len;
    else if (used + 1 + len <= perLine) used += 1 + len;
    else {
      lines += 1;
      used = len;
    }
  }
  return Math.min(TITLE_MAX_LINES, lines);
}

export function headerHeight(
  name: string,
  hasToggle: boolean,
  width: number = NODE_W,
  showLabel = true,
): number {
  const lines = titleLines(name, hasToggle, width);
  return Math.max(
    HEADER_H,
    HEADER_PAD_Y * 2 + lines * TITLE_LINE_H + (showLabel ? TYPE_LINE_H : 0),
  );
}

export function rowHeight(row: SeatRow): number {
  if (row.kind === 'seat') return SEAT_H;
  return row.expanded ? GROUP_H + row.people.length * PERSON_H + 4 : GROUP_H;
}

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
  expandedGroups: ReadonlySet<string> = new Set(),
  options: ChartLayoutOptions = DEFAULT_CHART_OPTIONS,
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

  const toRow = (position: Position): SeatRow => {
    const people = placements[position.id] ?? [];
    // Kursi tunggal: kuota 1, atau kuota bebas (0) yang kini dipegang satu orang (umum setelah impor).
    const single =
      (position.quota === 1 && people.length <= 1) ||
      (position.quota === 0 && people.length === 1);
    if (single) {
      return {
        kind: 'seat',
        positionId: position.id,
        title: position.title,
        rank: position.rank,
        rankIndex: rankIndexOf(position.rank, draft.ranks),
        person: people[0] ?? null,
      };
    }
    return {
      kind: 'group',
      positionId: position.id,
      title: position.title,
      filled: people.filter((person) => person.source !== 'closerec').length,
      quota: position.quota,
      people,
      expanded: expandedGroups.has(position.id),
    };
  };

  const rowsOf = (
    unit: Unit,
    hasToggle: boolean,
  ): {
    headerH: number;
    mainH: number;
    nsH: number;
    h: number;
    rows: SeatRow[];
    nsRows: SeatRow[];
  } => {
    const positions = positionsByUnit.get(unit.id) ?? [];
    const rows = positions
      .filter((position) => position.kind !== 'nonstruktural')
      .map(toRow);
    const nsRows = positions
      .filter((position) => position.kind === 'nonstruktural')
      .map(toRow);
    const headerH = headerHeight(
      unit.name,
      hasToggle,
      nodeWidthOf(unit),
      unit.layout.showLabel ?? options.showLabels,
    );
    const body = rows.reduce((sum, row) => sum + rowHeight(row), 0);
    const mainH = headerH + body + NODE_PAD;
    const nsBody = nsRows.reduce((sum, row) => sum + rowHeight(row), 0);
    const nsH = nsRows.length > 0 ? nsBody + NODE_PAD : 0;
    const h = nsRows.length > 0 ? mainH + NS_GAP + nsH : mainH;
    return { headerH, mainH, nsH, h, rows, nsRows };
  };

  const layoutUnit = (unit: Unit, depth: number): Subtree => {
    const visibleChildren = childrenByParent.get(unit.id) ?? [];
    const hasChildren = visibleChildren.length > 0;
    const {
      h: nodeH,
      headerH,
      mainH,
      nsH,
      rows,
      nsRows,
    } = rowsOf(unit, hasChildren);
    const isCollapsed = collapsed.has(unit.id) && hasChildren;
    const ownW = nodeWidthOf(unit);

    const own: ChartNode = {
      id: unit.id,
      unit,
      depth,
      x: 0,
      y: 0,
      w: ownW,
      h: nodeH,
      headerH,
      mainH,
      rows,
      nsRows,
      nsH,
      hasChildren,
      collapsed: isCollapsed,
    };

    if (!hasChildren || isCollapsed) {
      return {
        width: ownW,
        height: nodeH,
        minX: 0,
        rootW: ownW,
        nodes: [own],
      };
    }

    const childSubs = visibleChildren.map((child) =>
      layoutUnit(child, depth + 1),
    );
    const nodes: ChartNode[] = [own];
    let minX = 0;
    let maxX = ownW;
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
      type Entry = { unit: Unit; sub: Subtree; tier: number; index: number };
      const entries: Entry[] = visibleChildren.map((child, index) => ({
        unit: child,
        sub: childSubs[index]!,
        tier: effectiveTier(child, depth + 1),
        index,
      }));

      // Bagian dengan tier paling dalam membentuk pita utama. Bagian yang tier-nya
      // lebih dangkal menjadi "simpul leher": digeser ke kiri/kanan sumbu supaya
      // koridor dari induk ke pita utama tetap kosong.
      const maxTier = Math.max(...entries.map((entry) => entry.tier));
      const mainEntries = entries.filter((entry) => entry.tier === maxTier);
      const neckEntries = entries
        .filter((entry) => entry.tier < maxTier)
        .sort((a, b) => a.tier - b.tier || a.index - b.index);

      // Satu baris leher memuat paling banyak dua simpul pada tier yang sama;
      // sisanya turun ke baris berikutnya agar jalurnya tidak bertabrakan.
      const neckRows: Entry[][] = [];
      for (const entry of neckEntries) {
        const last = neckRows[neckRows.length - 1];
        if (
          !last ||
          last[0]?.tier !== entry.tier ||
          last.length >= 2
        ) {
          neckRows.push([entry]);
        } else {
          last.push(entry);
        }
      }

      // Tinggi seragam: kartu terpendek dalam satu pita dinaikkan agar sebaris.
      const even = effectiveEvenRows(unit, options.alignHeights);
      const evenRow = (list: Entry[]): Entry[] => {
        if (!even || list.length < 2) return list;
        const tallest = Math.max(
          ...list.map((entry) => entry.sub.nodes[0]?.h ?? 0),
        );
        return list.map((entry) => {
          const ownH = entry.sub.nodes[0]?.h ?? 0;
          const delta = tallest - ownH;
          if (delta <= 0) return entry;
          const nodes = entry.sub.nodes.map((node, index) =>
            index === 0
              ? { ...node, h: node.h + delta, mainH: node.mainH + delta }
              : { ...node, y: node.y + delta },
          );
          return {
            ...entry,
            sub: { ...entry.sub, height: entry.sub.height + delta, nodes },
          };
        });
      };

      const mainBand = evenRow(mainEntries);
      const neckBands = neckRows.map(evenRow);

      let mainCursor = 0;
      const mainLefts = mainBand.map((entry) => {
        const left = mainCursor;
        mainCursor += entry.sub.width + H_GAP;
        return left;
      });
      const mainWidth = mainBand.length > 0 ? mainCursor - H_GAP : 0;
      const spine = Math.max(ownW, mainWidth) / 2;

      const nodesOut: ChartNode[] = [{ ...own, x: spine - ownW / 2, y: 0 }];
      const addSubtree = (
        sub: Subtree,
        boundLeft: number,
        nodeY: number,
      ) => {
        const nodeX = boundLeft - sub.minX;
        for (const childNode of sub.nodes) {
          nodesOut.push({
            ...childNode,
            x: childNode.x + nodeX,
            y: childNode.y + nodeY,
          });
        }
      };

      let cursorY = nodeH + V_GAP;
      let leftCount = 0;
      let rightCount = 0;
      for (const band of neckBands) {
        const bandHeight = Math.max(
          ...band.map((entry) => entry.sub.height),
        );
        let leftX = spine - CORRIDOR;
        let rightX = spine + CORRIDOR;
        const taken = new Set<'left' | 'right' | 'center'>();
        band.forEach((entry, index) => {
          let side = entry.unit.layout.side;
          side ??=
            band.length === 2
              ? index === 0
                ? 'left'
                : 'right'
              : leftCount <= rightCount
                ? 'left'
                : 'right';
          if (side !== 'center' && taken.has(side)) {
            side = side === 'left' ? 'right' : 'left';
          }
          taken.add(side);
          if (side === 'left') {
            leftCount += 1;
            const left = leftX - entry.sub.width;
            leftX = left - H_GAP;
            addSubtree(entry.sub, left, cursorY);
          } else if (side === 'right') {
            rightCount += 1;
            addSubtree(entry.sub, rightX, cursorY);
            rightX += entry.sub.width + H_GAP;
          } else {
            addSubtree(entry.sub, spine - entry.sub.width / 2, cursorY);
          }
        });
        cursorY += bandHeight + NECK_GAP;
      }

      const mainY =
        neckBands.length > 0 ? cursorY - NECK_GAP + V_GAP : nodeH + V_GAP;
      mainBand.forEach((entry, index) => {
        addSubtree(entry.sub, mainLefts[index] ?? 0, mainY);
      });

      let lo = Infinity;
      let hi = -Infinity;
      let bottom = 0;
      for (const node of nodesOut) {
        lo = Math.min(lo, node.x);
        hi = Math.max(hi, node.x + node.w);
        bottom = Math.max(bottom, node.y + node.h);
      }
      return {
        width: hi - lo,
        height: bottom,
        minX: lo,
        rootW: ownW,
        nodes: nodesOut,
      };
    } else {
      let cursorY = nodeH + HANG_GAP;
      for (const sub of childSubs) {
        place(sub, HANG_INDENT, cursorY);
        cursorY += sub.height + HANG_GAP;
      }
    }

    return { width: maxX - minX, height: maxY, minX, rootW: ownW, nodes };
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
            // Belokan mendatar diletakkan tepat di atas anak, sedangkan ruas
            // tegaknya turun di koridor sumbu sehingga tidak menembus simpul leher.
            Math.max(node.y + node.h + V_GAP / 2, childNode.y - 12),
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
