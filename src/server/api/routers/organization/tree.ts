import type {
  OrganizationPositionKind,
  OrganizationPositionRank,
} from '~/server/db/schema';

/**
 * Logika murni (tanpa database) untuk editor organogram: validasi pohon, selisih
 * antara pohon tersimpan dan pohon yang dikirim, dan pemeriksaan hak edit anggota.
 * Dipisah dari router supaya bisa diuji tuntas.
 */

export const MAX_TREE_DEPTH = 16;
export const MAX_UNITS = 2000;
export const MAX_POSITIONS = 10000;

export type UnitNode = {
  id: string;
  parentId: string | null;
  name: string;
  typeLabel: string | null;
  description?: string | null;
  sortOrder: number;
  layout: Record<string, unknown> | null;
};

export type PositionNode = {
  id: string;
  unitId: string;
  title: string;
  rank: OrganizationPositionRank;
  kind: OrganizationPositionKind;
  quota: number;
  hidden: boolean;
  sortOrder: number;
};

export type Tree = { units: UnitNode[]; positions: PositionNode[] };

/** Kedalaman tiap unit (akar = 1). Unit yang induknya tidak ada atau yang berada dalam siklus tidak dimasukkan. */
export function computeLevels(units: UnitNode[]): Map<string, number> {
  const byId = new Map(units.map((u) => [u.id, u]));
  const levels = new Map<string, number>();
  const visiting = new Set<string>();
  const failed = new Set<string>();

  const resolve = (id: string): number | undefined => {
    const known = levels.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id) || failed.has(id)) return undefined; // siklus atau sudah gagal
    const unit = byId.get(id);
    if (!unit) return undefined;
    visiting.add(id);
    const parentLevel = unit.parentId === null ? 0 : resolve(unit.parentId);
    visiting.delete(id);
    if (parentLevel === undefined) {
      failed.add(id);
      return undefined;
    }
    levels.set(id, parentLevel + 1);
    return parentLevel + 1;
  };

  for (const unit of units) resolve(unit.id);
  return levels;
}

/** Pesan galat (Bahasa Indonesia) untuk pohon yang tidak sah; kosong berarti sah. */
export function validateTree(tree: Tree): string[] {
  const errors: string[] = [];
  const { units, positions } = tree;

  if (units.length > MAX_UNITS) errors.push(`Terlalu banyak unit (maksimum ${MAX_UNITS}).`);
  if (positions.length > MAX_POSITIONS) {
    errors.push(`Terlalu banyak posisi (maksimum ${MAX_POSITIONS}).`);
  }

  const unitIds = new Set<string>();
  for (const u of units) {
    if (unitIds.has(u.id)) errors.push(`Id unit ganda: ${u.id}.`);
    unitIds.add(u.id);
    if (u.name.trim() === '') errors.push('Nama unit tidak boleh kosong.');
  }
  const positionIds = new Set<string>();
  for (const p of positions) {
    if (positionIds.has(p.id)) errors.push(`Id posisi ganda: ${p.id}.`);
    positionIds.add(p.id);
    if (p.title.trim() === '') errors.push('Nama posisi tidak boleh kosong.');
    if (!Number.isInteger(p.quota) || p.quota < 0) {
      errors.push(`Kuota posisi "${p.title}" harus bilangan bulat 0 atau lebih.`);
    }
    if (!unitIds.has(p.unitId)) {
      errors.push(`Posisi "${p.title}" menunjuk unit yang tidak ada.`);
    }
  }

  let missingParent = false;
  for (const u of units) {
    if (u.parentId !== null && !unitIds.has(u.parentId)) {
      missingParent = true;
      errors.push(`Unit "${u.name}" menunjuk induk yang tidak ada.`);
    }
    if (u.parentId === u.id) errors.push(`Unit "${u.name}" menjadi induk dirinya sendiri.`);
  }

  if (!missingParent) {
    const levels = computeLevels(units);
    for (const u of units) {
      const level = levels.get(u.id);
      if (level === undefined) {
        errors.push(`Unit "${u.name}" berada dalam siklus induk-anak.`);
      } else if (level > MAX_TREE_DEPTH) {
        errors.push(`Unit "${u.name}" melebihi kedalaman maksimum ${MAX_TREE_DEPTH} tingkat.`);
      }
    }
  }
  return [...new Set(errors)];
}

export type UnitChange = { before: UnitNode; after: UnitNode };
export type PositionChange = { before: PositionNode; after: PositionNode };

export type TreeDiff = {
  unitsToInsert: UnitNode[]; // induk lebih dulu
  unitsToUpdate: UnitChange[];
  unitsToDelete: UnitNode[]; // anak lebih dulu
  positionsToInsert: PositionNode[];
  positionsToUpdate: PositionChange[];
  positionsToDelete: PositionNode[];
};

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const unitChanged = (a: UnitNode, b: UnitNode) =>
  a.parentId !== b.parentId ||
  a.name !== b.name ||
  a.typeLabel !== b.typeLabel ||
  (a.description ?? null) !== (b.description ?? null) ||
  a.sortOrder !== b.sortOrder ||
  !sameJson(a.layout, b.layout);

const positionChanged = (a: PositionNode, b: PositionNode) =>
  a.unitId !== b.unitId ||
  a.title !== b.title ||
  a.rank !== b.rank ||
  a.kind !== b.kind ||
  a.quota !== b.quota ||
  a.hidden !== b.hidden ||
  a.sortOrder !== b.sortOrder;

/** Mengurutkan unit sehingga induk selalu muncul sebelum anaknya (hanya untuk unit dalam daftar). */
function parentsFirst(units: UnitNode[]): UnitNode[] {
  const inList = new Set(units.map((u) => u.id));
  const byId = new Map(units.map((u) => [u.id, u]));
  const out: UnitNode[] = [];
  const done = new Set<string>();
  const visit = (u: UnitNode, guard: Set<string>) => {
    if (done.has(u.id) || guard.has(u.id)) return;
    guard.add(u.id);
    if (u.parentId && inList.has(u.parentId)) visit(byId.get(u.parentId)!, guard);
    done.add(u.id);
    out.push(u);
  };
  for (const u of units) visit(u, new Set());
  return out;
}

export function diffTrees(current: Tree, next: Tree): TreeDiff {
  const curUnits = new Map(current.units.map((u) => [u.id, u]));
  const nextUnits = new Map(next.units.map((u) => [u.id, u]));
  const curPos = new Map(current.positions.map((p) => [p.id, p]));
  const nextPos = new Map(next.positions.map((p) => [p.id, p]));

  const unitsToInsert = parentsFirst(next.units.filter((u) => !curUnits.has(u.id)));
  const unitsToUpdate: UnitChange[] = [];
  for (const u of next.units) {
    const before = curUnits.get(u.id);
    if (before && unitChanged(before, u)) unitsToUpdate.push({ before, after: u });
  }
  const unitsToDelete = parentsFirst(current.units.filter((u) => !nextUnits.has(u.id))).reverse();

  const positionsToInsert = next.positions.filter((p) => !curPos.has(p.id));
  const positionsToUpdate: PositionChange[] = [];
  for (const p of next.positions) {
    const before = curPos.get(p.id);
    if (before && positionChanged(before, p)) positionsToUpdate.push({ before, after: p });
  }
  const positionsToDelete = current.positions.filter((p) => !nextPos.has(p.id));

  return { unitsToInsert, unitsToUpdate, unitsToDelete, positionsToInsert, positionsToUpdate, positionsToDelete };
}

export function isEmptyDiff(d: TreeDiff): boolean {
  return (
    d.unitsToInsert.length === 0 &&
    d.unitsToUpdate.length === 0 &&
    d.unitsToDelete.length === 0 &&
    d.positionsToInsert.length === 0 &&
    d.positionsToUpdate.length === 0 &&
    d.positionsToDelete.length === 0
  );
}

/** Id unit + semua turunannya dalam pohon `units`. */
export function subtreeIds(units: UnitNode[], rootIds: Iterable<string>): Set<string> {
  const children = new Map<string, string[]>();
  for (const u of units) {
    if (u.parentId) children.set(u.parentId, [...(children.get(u.parentId) ?? []), u.id]);
  }
  const result = new Set<string>();
  const stack = [...rootIds];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return result;
}

/**
 * Hak edit anggota: hanya unit tempat ia ditempatkan beserta turunannya
 * (`allowed`, dihitung dari pohon TERSIMPAN). Mengembalikan pesan galat untuk
 * perubahan pertama yang keluar dari cakupan itu, atau null bila semuanya di dalam.
 *
 * Aturan per jenis perubahan:
 * - ubah/hapus unit: unit itu harus di dalam cakupan;
 * - unit baru: induknya harus di dalam cakupan (atau unit baru lain yang induknya di dalam);
 *   akar baru (tanpa induk) tidak boleh;
 * - pindah unit: unit, induk lama, dan induk baru harus di dalam cakupan;
 * - posisi: unitnya (lama dan baru) harus di dalam cakupan.
 */
export function checkMemberEdit(diff: TreeDiff, next: Tree, allowed: Set<string>): string | null {
  const insertedIds = new Set(diff.unitsToInsert.map((u) => u.id));
  const nextById = new Map(next.units.map((u) => [u.id, u]));

  /** Unit di pohon baru yang dihitung "di dalam": yang tersimpan dan diizinkan, atau baru dengan leluhur terdekat yang diizinkan. */
  const insideNext = (unitId: string | null): boolean => {
    let cursor = unitId;
    const seen = new Set<string>();
    while (cursor) {
      if (seen.has(cursor)) return false;
      seen.add(cursor);
      if (!insertedIds.has(cursor)) return allowed.has(cursor);
      cursor = nextById.get(cursor)?.parentId ?? null;
    }
    return false;
  };

  for (const u of diff.unitsToInsert) {
    if (!insideNext(u.parentId)) return `Anda tidak berhak menambah unit "${u.name}" di luar unit Anda.`;
  }
  for (const { before, after } of diff.unitsToUpdate) {
    if (!allowed.has(before.id)) return `Anda tidak berhak mengubah unit "${before.name}".`;
    if (before.parentId !== after.parentId) {
      if (!before.parentId || !allowed.has(before.parentId) || !insideNext(after.parentId)) {
        return `Anda tidak berhak memindahkan unit "${before.name}" keluar dari cakupan Anda.`;
      }
    }
  }
  for (const u of diff.unitsToDelete) {
    if (!allowed.has(u.id)) return `Anda tidak berhak menghapus unit "${u.name}".`;
  }
  for (const p of diff.positionsToInsert) {
    if (!insideNext(p.unitId)) return `Anda tidak berhak menambah posisi "${p.title}" di luar unit Anda.`;
  }
  for (const { before, after } of diff.positionsToUpdate) {
    if (!allowed.has(before.unitId) || !insideNext(after.unitId)) {
      return `Anda tidak berhak mengubah posisi "${before.title}".`;
    }
  }
  for (const p of diff.positionsToDelete) {
    if (!allowed.has(p.unitId)) return `Anda tidak berhak menghapus posisi "${p.title}".`;
  }
  return null;
}
