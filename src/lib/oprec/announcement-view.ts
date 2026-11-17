/** Memilih tab bidang aktif dari query `?bidang=<indeks>`; nilai tak sah jatuh ke tab pertama. */
export function resolveActiveIndex(
  param: string | null | undefined,
  length: number,
): number {
  if (param == null || !/^\d{1,4}$/.test(param)) return 0;
  const index = Number(param);
  return index < length ? index : 0;
}
