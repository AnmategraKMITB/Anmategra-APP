import { slugify } from './announcement';

/**
 * Memilih tab bidang aktif dari query `?bidang=<slug-bidang>` (tahan terhadap
 * perubahan urutan); nilai tak dikenal jatuh ke tab pertama.
 */
export function resolveActiveIndex(
  param: string | null | undefined,
  labels: (string | null)[],
): number {
  if (!param) return 0;
  const index = labels.findIndex((l) => l !== null && slugify(l) === param);
  return index < 0 ? 0 : index;
}

/** Nilai query untuk satu tab bidang. */
export const tabParam = (label: string | null, index: number) =>
  label ? slugify(label) || String(index) : String(index);

/**
 * Tab tujuan saat mencari: tetap di tab aktif bila ia punya hasil; kalau tidak,
 * pindah ke tab pertama yang punya hasil. `null` = tidak ada hasil di mana pun
 * (tab tidak berubah).
 */
export function searchTarget(counts: number[], active: number): number | null {
  if ((counts[active] ?? 0) > 0) return active;
  const i = counts.findIndex((c) => c > 0);
  return i < 0 ? null : i;
}
