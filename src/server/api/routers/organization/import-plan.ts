import type {
  OrganizationPositionKind,
  OrganizationPositionRank,
} from '~/server/db/schema';

/**
 * Impor teks `division`/`position` dari keanggotaan dan kehimpunan menjadi
 * usulan unit, posisi, dan placement (Fase 2D). Fungsi murni: hasilnya hanya
 * usulan untuk lembar tinjauan, tidak menulis apa pun.
 */

export type LegacyRow = {
  userId: string;
  division: string;
  position: string;
  /** Urutan lama (`index`); jadi `sort_order` penempatan. */
  index?: number;
};

export type PlannedUnit = {
  key: string;
  name: string;
  /** Ejaan asli yang dilipat ke unit ini, untuk ditampilkan di lembar tinjauan. */
  variants: string[];
};

export type PlannedPosition = {
  key: string;
  unitKey: string;
  title: string;
  rank: OrganizationPositionRank;
  kind: OrganizationPositionKind;
  variants: string[];
};

export type PlannedPlacement = {
  userId: string;
  positionKey: string;
  order: number;
};

export type ImportPlan = {
  units: PlannedUnit[];
  positions: PlannedPosition[];
  placements: PlannedPlacement[];
  /** Baris "-"/"-": hanya keanggotaan lembaga, tidak menjadi placement. */
  membershipOnly: number;
  /** Baris yang menunjuk pengguna dan posisi yang sama dengan baris sebelumnya. */
  duplicates: number;
};

/** Nama unit untuk baris yang punya posisi tetapi divisinya "-" atau kosong. */
export const GENERAL_UNIT_NAME = 'Umum';
/** Nama posisi untuk baris yang punya divisi tetapi posisinya "-" atau kosong. */
export const DEFAULT_POSITION_TITLE = 'Anggota';

// Ejaan yang dilipat ke satu bentuk baku (kunci sudah huruf kecil).
const POSITION_SYNONYMS: Record<string, string> = {
  staff: 'Staf',
  staf: 'Staf',
  member: 'Anggota',
  anggota: 'Anggota',
};

export function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function isBlank(text: string): boolean {
  const value = collapse(text);
  return value === '' || /^[-–—]+$/.test(value);
}

export function foldKey(text: string): string {
  return collapse(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Bentuk baku sebuah nama posisi (Staff dan Staf sama, Member dan Anggota sama). */
export function canonicalPositionTitle(title: string): string {
  const cleaned = collapse(title);
  return POSITION_SYNONYMS[foldKey(cleaned)] ?? cleaned;
}

export function guessRank(title: string): OrganizationPositionRank {
  const words = foldKey(title).split(/[^a-z0-9]+/);
  const has = (...names: string[]) => names.some((n) => words.includes(n));
  if (has('wakil', 'deputy', 'vice', 'wk')) return 'vice';
  if (has('ketua', 'kepala', 'head', 'direktur', 'presiden', 'kadep')) {
    return 'head';
  }
  if (has('koordinator', 'coordinator', 'korlap', 'koor')) return 'coordinator';
  return 'staff';
}

/** Pilih ejaan paling sering dipakai; seri dipecah menurut urutan abjad. */
function pickLabel(counts: Map<string, number>): string {
  let best = '';
  let bestCount = -1;
  for (const [label, count] of counts) {
    if (count > bestCount || (count === bestCount && label < best)) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

function tally(map: Map<string, number>, label: string): void {
  map.set(label, (map.get(label) ?? 0) + 1);
}

export function planImport(rows: LegacyRow[]): ImportPlan {
  const unitCounts = new Map<string, Map<string, number>>();
  const positionCounts = new Map<string, Map<string, number>>();
  const positionUnit = new Map<string, string>();
  const unitOrder: string[] = [];
  const positionOrder: string[] = [];
  const keyed: {
    userId: string;
    unitKey: string;
    positionKey: string;
    order: number;
  }[] = [];
  let membershipOnly = 0;

  for (const row of rows) {
    const noDivision = isBlank(row.division);
    const noPosition = isBlank(row.position);
    if (noDivision && noPosition) {
      membershipOnly += 1;
      continue;
    }

    const divisionLabel = noDivision
      ? GENERAL_UNIT_NAME
      : collapse(row.division);
    const unitKey = foldKey(divisionLabel);
    if (!unitCounts.has(unitKey)) {
      unitCounts.set(unitKey, new Map());
      unitOrder.push(unitKey);
    }
    tally(unitCounts.get(unitKey)!, divisionLabel);

    const rawPosition = noPosition
      ? DEFAULT_POSITION_TITLE
      : collapse(row.position);
    const positionName = foldKey(rawPosition);
    const canonical = POSITION_SYNONYMS[positionName];
    const positionKey = `${unitKey}\u0000${canonical ? foldKey(canonical) : positionName}`;
    if (!positionCounts.has(positionKey)) {
      positionCounts.set(positionKey, new Map());
      positionUnit.set(positionKey, unitKey);
      positionOrder.push(positionKey);
    }
    tally(positionCounts.get(positionKey)!, canonical ?? rawPosition);

    keyed.push({
      userId: row.userId,
      unitKey,
      positionKey,
      order: row.index ?? 0,
    });
  }

  // Kunci internal (hasil lipatan teks) diganti kunci pendek berurutan agar
  // aman dibawa bolak-balik ke lembar tinjauan.
  const unitKeyOf = new Map(unitOrder.map((key, i) => [key, `u${i + 1}`]));
  const positionKeyOf = new Map(
    positionOrder.map((key, i) => [key, `p${i + 1}`]),
  );

  const units: PlannedUnit[] = unitOrder.map((key) => {
    const counts = unitCounts.get(key)!;
    return {
      key: unitKeyOf.get(key)!,
      name: pickLabel(counts),
      variants: [...counts.keys()].sort(),
    };
  });

  const positions: PlannedPosition[] = positionOrder.map((key) => {
    const counts = positionCounts.get(key)!;
    const title = pickLabel(counts);
    return {
      key: positionKeyOf.get(key)!,
      unitKey: unitKeyOf.get(positionUnit.get(key)!)!,
      title,
      rank: guessRank(title),
      kind: 'struktural',
      variants: [...counts.keys()].sort(),
    };
  });

  const seen = new Set<string>();
  const placements: PlannedPlacement[] = [];
  let duplicates = 0;
  for (const { userId, positionKey, order } of keyed) {
    const id = `${positionKey}\u0001${userId}`;
    if (seen.has(id)) {
      duplicates += 1;
      continue;
    }
    seen.add(id);
    placements.push({
      userId,
      positionKey: positionKeyOf.get(positionKey)!,
      order,
    });
  }

  return { units, positions, placements, membershipOnly, duplicates };
}

export type UnitDecision = {
  key: string;
  name: string;
  /** Lipat unit ini ke unit lain (kunci tujuan). */
  mergeInto?: string;
  skip?: boolean;
};

export type PositionDecision = {
  key: string;
  title: string;
  rank: OrganizationPositionRank;
  kind: OrganizationPositionKind;
  /** Lipat posisi ini ke posisi lain (kunci tujuan). */
  mergeInto?: string;
  skip?: boolean;
};

export type FinalPlan = {
  units: { key: string; name: string }[];
  positions: {
    key: string;
    unitKey: string;
    title: string;
    rank: OrganizationPositionRank;
    kind: OrganizationPositionKind;
  }[];
  placements: PlannedPlacement[];
  skippedPlacements: number;
};

/**
 * Menerapkan keputusan lembar tinjauan ke usulan. Kunci yang tidak dikenal atau
 * rantai penggabungan yang berputar ditolak dengan galat, bukan diabaikan.
 */
export function applyDecisions(
  plan: ImportPlan,
  decisions: { units: UnitDecision[]; positions: PositionDecision[] },
): FinalPlan {
  const unitDecision = new Map(decisions.units.map((d) => [d.key, d]));
  const positionDecision = new Map(decisions.positions.map((d) => [d.key, d]));

  for (const unit of plan.units) {
    if (!unitDecision.has(unit.key)) {
      throw new Error(`Keputusan untuk unit ${unit.key} tidak ada.`);
    }
  }
  for (const position of plan.positions) {
    if (!positionDecision.has(position.key)) {
      throw new Error(`Keputusan untuk posisi ${position.key} tidak ada.`);
    }
  }
  for (const key of [...unitDecision.keys(), ...positionDecision.keys()]) {
    const known =
      plan.units.some((u) => u.key === key) ||
      plan.positions.some((p) => p.key === key);
    if (!known) throw new Error(`Kunci ${key} tidak dikenal.`);
  }

  const resolve = <T extends { key: string; mergeInto?: string }>(
    start: string,
    byKey: Map<string, T>,
  ): T => {
    const seen = new Set<string>();
    let current = byKey.get(start);
    while (current?.mergeInto !== undefined) {
      if (seen.has(current.key)) throw new Error('Penggabungan berputar.');
      seen.add(current.key);
      const next = byKey.get(current.mergeInto);
      if (!next)
        throw new Error(`Tujuan gabung ${current.mergeInto} tidak ada.`);
      current = next;
    }
    if (!current) throw new Error(`Kunci ${start} tidak dikenal.`);
    return current;
  };

  const unitName = (d: UnitDecision) => collapse(d.name);
  const finalUnits = new Map<string, { key: string; name: string }>();
  const unitSkipped = new Set<string>();
  for (const unit of plan.units) {
    const target = resolve(unit.key, unitDecision);
    const own = unitDecision.get(unit.key)!;
    if (own.skip || target.skip) unitSkipped.add(unit.key);
    if (target.skip || finalUnits.has(target.key)) continue;
    const name = unitName(target);
    if (name === '') throw new Error('Nama unit tidak boleh kosong.');
    finalUnits.set(target.key, { key: target.key, name });
  }

  const finalPositions = new Map<string, FinalPlan['positions'][number]>();
  const positionTarget = new Map<string, string | null>();
  const mergedByTitle = new Map<string, string>();
  for (const position of plan.positions) {
    const own = positionDecision.get(position.key)!;
    const target = resolve(position.key, positionDecision);
    const unitTarget = resolve(position.unitKey, unitDecision);
    if (
      own.skip ||
      target.skip ||
      unitSkipped.has(position.unitKey) ||
      unitTarget.skip
    ) {
      positionTarget.set(position.key, null);
      continue;
    }
    const title = collapse(target.title);
    if (title === '') throw new Error('Nama posisi tidak boleh kosong.');
    const targetBase = plan.positions.find((p) => p.key === target.key)!;
    const finalUnitKey = resolve(targetBase.unitKey, unitDecision).key;
    const identity = `${finalUnitKey}\u0000${foldKey(title)}`;
    const existing = mergedByTitle.get(identity);
    if (existing !== undefined) {
      positionTarget.set(position.key, existing);
      continue;
    }
    mergedByTitle.set(identity, target.key);
    positionTarget.set(position.key, target.key);
    if (!finalPositions.has(target.key)) {
      finalPositions.set(target.key, {
        key: target.key,
        unitKey: finalUnitKey,
        title,
        rank: target.rank,
        kind: target.kind,
      });
    }
  }

  const seen = new Set<string>();
  const placements: PlannedPlacement[] = [];
  let skippedPlacements = 0;
  for (const { userId, positionKey, order } of plan.placements) {
    const target = positionTarget.get(positionKey);
    if (target === null || target === undefined) {
      skippedPlacements += 1;
      continue;
    }
    const id = `${target}\u0001${userId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    placements.push({ userId, positionKey: target, order });
  }

  return {
    units: [...finalUnits.values()],
    positions: [...finalPositions.values()],
    placements,
    skippedPlacements,
  };
}
