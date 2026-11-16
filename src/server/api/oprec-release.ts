import { sql } from 'drizzle-orm';
import {
  application,
  applicationChoice,
  placement,
  recruitment,
} from '~/server/db/schema';

/**
 * Penempatan hasil oprec baru berlaku setelah hasilnya dirilis
 * (`results_released_at`). Oprec yang hasilnya diumumkan di luar Anmategra
 * tidak bisa dirilis, jadi penempatannya berlaku begitu ditetapkan final.
 * Sebelum itu penempatan hanya terlihat di halaman oprec dan oleh pengelola
 * organogram: tidak masuk daftar anggota, profil, maupun hak akses pengurus.
 * Penempatan manual/impor (tanpa pilihan oprec) selalu berlaku.
 */
export const placementReleased = sql<boolean>`(${placement.applicationChoiceId} IS NULL OR EXISTS (
  SELECT 1 FROM ${applicationChoice}
  INNER JOIN ${application} ON ${application.id} = ${applicationChoice.applicationId}
  INNER JOIN ${recruitment} ON ${recruitment.id} = ${application.recruitmentId}
  WHERE ${applicationChoice.id} = ${placement.applicationChoiceId}
    AND (${recruitment.resultsReleasedAt} IS NOT NULL
      OR (${recruitment.placementState} = 'final' AND NOT ${recruitment.resultsVisibleToApplicants}))
))`;
