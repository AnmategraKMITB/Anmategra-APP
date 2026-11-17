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

/**
 * Seret-lepas: pindahkan `block` (urutan relatifnya tetap) ke tempat `overId`.
 * Turun = sesudah `overId`, naik = sebelumnya, seperti satu baris diseret.
 * Bila `activeId` tidak ada di `block`, hanya `activeId` yang pindah.
 */
export function dropBlock(
  order: readonly string[],
  block: readonly string[],
  activeId: string,
  overId: string,
) {
  const blockSet = new Set(block.includes(activeId) ? block : [activeId]);
  const from = order.indexOf(activeId);
  const to = order.indexOf(overId);
  if (from === -1 || to === -1 || blockSet.has(overId)) return [...order];
  const moving = order.filter((id) => blockSet.has(id));
  const rest = order.filter((id) => !blockSet.has(id));
  const at = rest.indexOf(overId) + (from < to ? 1 : 0);
  return [...rest.slice(0, at), ...moving, ...rest.slice(at)];
}

export type SubmitSort = 'bawaan' | 'kirim_awal' | 'kirim_akhir';

type Submitted = { submittedAt: Date | string };

const timeOf = (row: Submitted) => new Date(row.submittedAt).getTime();

/** Salinan `rows` menurut waktu kirim; 'bawaan' mempertahankan urutan asal. */
export function bySubmitted<T extends Submitted>(
  rows: readonly T[],
  sort: SubmitSort,
) {
  if (sort === 'bawaan') return [...rows];
  const sign = sort === 'kirim_awal' ? 1 : -1;
  return [...rows].sort((a, b) => sign * (timeOf(a) - timeOf(b)));
}

type Candidate = Submitted & {
  applicationId: string;
  kind: 'pilihan' | 'dipindahkan';
  choiceRank: number | null;
  blocked: unknown;
};

/**
 * Calon pengisi sisa kuota: pendaftar yang memilih divisi ini sebagai
 * pilihan 1, belum diurutkan, dari yang paling awal mengirim. Kosong bila
 * kuota tanpa batas (0) atau sudah terisi.
 */
export function fillQuota<T extends Candidate>(
  rows: readonly T[],
  order: readonly string[],
  quota: number,
) {
  const room = quota - order.length;
  if (quota <= 0 || room <= 0) return [];
  const ordered = new Set(order);
  return bySubmitted(
    rows.filter(
      (row) =>
        !row.blocked &&
        row.kind === 'pilihan' &&
        row.choiceRank === 1 &&
        !ordered.has(row.applicationId),
    ),
    'kirim_awal',
  ).slice(0, room);
}
