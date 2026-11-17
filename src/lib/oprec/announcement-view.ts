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
