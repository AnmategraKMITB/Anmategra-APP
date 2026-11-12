/** Tambahan waktu mengisi dan mengirim setelah tenggat resmi. */
export const SUBMIT_GRACE_MS = 10 * 60 * 1000;

/** Pemberitahuan baru muncul sekian lama sebelum tenggat resmi. */
export const GRACE_NOTICE_LEAD_MS = 5 * 60 * 1000;

/** Batas terakhir submisi diterima: tenggat resmi + tambahan waktu. */
export function lastAcceptedAt(deadline: Date): Date {
  return new Date(deadline.getTime() + SUBMIT_GRACE_MS);
}

/** Masih boleh mengirim pada `now` (tenggat null = tanpa tenggat). */
export function isWithinDeadline(deadline: Date | null, now: Date): boolean {
  return (
    deadline === null || now.getTime() <= lastAcceptedAt(deadline).getTime()
  );
}

/** Pemberitahuan tampil dari 5 menit sebelum tenggat sampai batas akhir. */
export function shouldShowGraceNotice(deadline: Date, now: Date): boolean {
  const t = now.getTime();
  return (
    t >= deadline.getTime() - GRACE_NOTICE_LEAD_MS &&
    t <= lastAcceptedAt(deadline).getTime()
  );
}
