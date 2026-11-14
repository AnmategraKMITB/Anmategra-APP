import { lastAcceptedAt } from '~/lib/forms/grace';

/**
 * Pendaftaran sudah berakhir: oprec ditutup, atau masih berstatus dibuka
 * tetapi tenggat formulir atau semua gelombangnya (beserta masa tambahan
 * submisi) sudah lewat, sehingga tidak ada pendaftar baru yang bisa masuk.
 */
export function registrationEnded(input: {
  status: 'draft' | 'open' | 'closed';
  formClosesAt: Date | null;
  waveEndsAt: readonly Date[];
  now: Date;
}): boolean {
  if (input.status === 'closed') return true;
  if (input.status !== 'open') return false;
  const passed = (deadline: Date) =>
    lastAcceptedAt(deadline).getTime() <= input.now.getTime();
  if (input.formClosesAt && passed(input.formClosesAt)) return true;
  return input.waveEndsAt.length > 0 && input.waveEndsAt.every(passed);
}
