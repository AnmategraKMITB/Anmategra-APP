/**
 * Aturan menu Hasil yang murni: siapa yang boleh membuka (S20) dan alasan
 * gugur yang aman ditampilkan bila tidak ada alasan override.
 */
import { type ComputedStatus } from '~/lib/oprec/scoring';

export type ResultsMode = 'admin' | 'admin_ketua' | 'semua';

/**
 * Mode akses menu Hasil dari kolom `recruitment.results_access`. Nilai tak
 * dikenal dianggap `admin_ketua` (bawaan wizard).
 */
export function resultsMode(
  recruitment: { resultsAccess: string } | null | undefined,
): ResultsMode {
  const value = recruitment?.resultsAccess;
  return value === 'admin' || value === 'semua' ? value : 'admin_ketua';
}

export function fallbackReason(status: ComputedStatus | null) {
  if (status === 'tidak_lolos') return 'Tidak lolos seleksi';
  if (status === 'perlu_ditinjau') return 'Perlu ditinjau';
  if (status === 'belum_lengkap') return 'Belum lengkap';
  return null;
}

export type ResultsFinalStatus =
  | 'diterima'
  | 'tidak_diterima'
  | 'belum_diputuskan';

export function finalStatus(
  accepted: boolean,
  hasPending: boolean,
): ResultsFinalStatus {
  if (accepted) return 'diterima';
  return hasPending ? 'belum_diputuskan' : 'tidak_diterima';
}
