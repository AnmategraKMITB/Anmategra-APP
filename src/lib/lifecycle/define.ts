/**
 * Siklus hidup entitas berstatus, dideklarasikan sebagai data. Murni tanpa
 * akses basis data dan aman diimpor dari klien.
 *
 * Satu `Lifecycle` memuat semua perpindahan yang sah beserta syaratnya. Server
 * memeriksanya sebelum menulis (lihat `~/server/api/lifecycle`), dan UI kelak
 * memakai `nextMoves` untuk tahu tombol mana yang aktif dan mengapa tidak.
 * Fakta yang dibutuhkan syarat (jumlah jawaban, hasil sudah dirilis, dst.)
 * dimuat pemanggil ke `ctx`, jadi syarat bisa diuji tanpa basis data.
 */

export type Refusal = {
  code: 'BAD_REQUEST' | 'CONFLICT' | 'FORBIDDEN';
  message: string;
};

export type Verdict = { ok: true } | ({ ok: false } & Refusal);

export type Move<C> = {
  /** Penolakan bila syarat perpindahan belum terpenuhi; `null` bila boleh. */
  guard?: (ctx: C) => Refusal | null;
  /** Syarat `guard` dalam kalimat pendek, untuk dokumentasi hasil generate. */
  when?: string;
};

export type Lifecycle<S extends string, C> = {
  name: string;
  states: readonly S[];
  /** Perpindahan keluar dari tiap keadaan; yang tidak tercantum tidak sah. */
  moves: Record<S, Partial<Record<S, Move<C>>>>;
  /** Penolakan untuk perpindahan yang tidak tercantum di `moves`. */
  illegal: (from: S, to: S) => Refusal;
};

export function defineLifecycle<S extends string, C = void>(
  lifecycle: Lifecycle<S, C>,
): Lifecycle<S, C> {
  return lifecycle;
}

export function check<S extends string, C>(
  lifecycle: Lifecycle<S, C>,
  from: S,
  to: S,
  ctx: C,
): Verdict {
  const move = lifecycle.moves[from][to];
  if (!move) return { ok: false, ...lifecycle.illegal(from, to) };
  const refusal = move.guard?.(ctx) ?? null;
  return refusal ? { ok: false, ...refusal } : { ok: true };
}

export function nextMoves<S extends string, C>(
  lifecycle: Lifecycle<S, C>,
  from: S,
  ctx: C,
): { to: S; enabled: boolean; reason?: string }[] {
  return (Object.keys(lifecycle.moves[from]) as S[]).map((to) => {
    const verdict = check(lifecycle, from, to, ctx);
    return verdict.ok
      ? { to, enabled: true }
      : { to, enabled: false, reason: verdict.message };
  });
}
