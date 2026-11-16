/**
 * Operasi murni pada urutan prioritas (daftar id, indeks 0 = urutan 1),
 * dipakai papan prioritas untuk isian angka dan pintasan keyboard.
 */

/** Pindahkan (atau masukkan) `id` ke urutan `position` (mulai 1), dijepit ke rentang sah. */
export function moveTo(order: readonly string[], id: string, position: number) {
  const rest = order.filter((x) => x !== id);
  const index = Math.min(Math.max(Math.trunc(position) - 1, 0), rest.length);
  return [...rest.slice(0, index), id, ...rest.slice(index)];
}

/** Geser `id` sejauh `delta` (negatif = naik). Tidak berubah bila `id` tidak ada. */
export function shift(order: readonly string[], id: string, delta: number) {
  const index = order.indexOf(id);
  if (index === -1) return [...order];
  return moveTo(order, id, index + 1 + delta);
}

export function remove(order: readonly string[], id: string) {
  return order.filter((x) => x !== id);
}

/** Tafsir isian angka: kosong = keluarkan dari urutan, angka ≥ 1 = posisi. */
export function parsePosition(value: string): number | null | 'invalid' {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed)) return 'invalid';
  const n = Number(trimmed);
  return n >= 1 ? n : 'invalid';
}
