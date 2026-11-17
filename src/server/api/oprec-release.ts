import { sql } from 'drizzle-orm';
import {
  application,
  applicationChoice,
  placement,
  recruitment,
} from '~/server/db/schema';

/**
 * Penempatan hasil oprec baru berlaku setelah hasilnya dirilis
 * (`results_released_at`) dan waktu tayangnya lewat. Sebelum itu penempatan hanya terlihat di halaman oprec dan oleh pengelola
 * organogram: tidak masuk daftar anggota, profil, maupun hak akses pengurus.
 * Penempatan manual/impor (tanpa pilihan oprec) selalu berlaku.
 */
/**
 * Gerbang tayang tunggal: hasil sudah dirilis DAN waktu tayang terjadwal
 * (bila ada) sudah lewat. Dihitung saat permintaan, tanpa cron.
 */
export function resultsPublished(
  row: { resultsReleasedAt: Date | null; resultsPublishAt: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    row.resultsReleasedAt !== null &&
    (row.resultsPublishAt === null || row.resultsPublishAt <= now)
  );
}

/** Padanan SQL `resultsPublished` untuk tabel `recruitment`. */
export const recruitmentPublished = sql<boolean>`(${recruitment.resultsReleasedAt} IS NOT NULL
  AND (${recruitment.resultsPublishAt} IS NULL OR ${recruitment.resultsPublishAt} <= now()))`;

export const placementReleased = sql<boolean>`(${placement.applicationChoiceId} IS NULL OR EXISTS (
  SELECT 1 FROM ${applicationChoice}
  INNER JOIN ${application} ON ${application.id} = ${applicationChoice.applicationId}
  INNER JOIN ${recruitment} ON ${recruitment.id} = ${application.recruitmentId}
  WHERE ${applicationChoice.id} = ${placement.applicationChoiceId}
    AND ${recruitmentPublished}
))`;
