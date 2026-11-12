/** Logika murni wizard yang dipisahkan dari komponen supaya dapat diuji. */

type UnitLike = { id: string; level: number };
type PositionLike = { id: string; unitId: string; rank: string };

/** Jabatan bawaan tujuan: Staf bila ada, selain itu jabatan pertama. */
export function defaultPositionId(positions: PositionLike[]) {
  return (positions.find((p) => p.rank === 'staff') ?? positions[0])?.id;
}

/**
 * Unit yang dipilih tombol "Semua <level 2>" (M-04). Level 2 dipakai bila ada
 * unit berjabatan di sana; bila tidak (organogram satu tingkat, atau tingkat
 * kedua tanpa jabatan), jatuh ke level terdangkal yang punya unit berjabatan
 * agar tombol tidak diam saja. `level` ialah level yang dipakai.
 */
export function allTargetUnits<U extends UnitLike>(
  units: U[],
  positions: PositionLike[],
): { level: number; units: U[] } {
  const withPosition = units.filter((u) =>
    positions.some((p) => p.unitId === u.id),
  );
  const levels = [...new Set(withPosition.map((u) => u.level))].sort(
    (a, b) => a - b,
  );
  const level = levels.includes(2) ? 2 : (levels[0] ?? 2);
  return { level, units: withPosition.filter((u) => u.level === level) };
}

/** Bobot kriteria: bilangan bulat 0-100, sama dengan skema server (K-05). */
export const WEIGHT_MAX = 100;

export function clampWeight(raw: string | number) {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.min(WEIGHT_MAX, Math.max(0, Math.round(n)));
}

/** Pesan bila isian bobot melewati batas server; `null` bila wajar. */
export function weightNote(raw: string | number) {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && (n > WEIGHT_MAX || n < 0)
    ? `Bobot harus 0 sampai ${WEIGHT_MAX}; nilai dibatasi.`
    : null;
}

/** Cari lampiran tanpa membedakan huruf besar/kecil (M-07). */
export function findAttachment(list: readonly string[], name: string) {
  const key = name.trim().toLocaleLowerCase('id');
  return list.find((a) => a.trim().toLocaleLowerCase('id') === key);
}
