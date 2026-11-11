import { and, asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '~/server/db';
import {
  application,
  applicationChoice,
  mahasiswa,
  placementDecision,
  users,
} from '~/server/db/schema';
import { api } from '~/trpc/server';

import { canOpenResults, loadAssessableOprec } from './access';
import { HasilView } from './hasil/hasil-view';
import { OprecTabs } from './oprec-tabs';
import { type OprecBase } from './status';

/**
 * Halaman Hasil satu oprec; admin dan Kadiv (atau penilai tambahan saat S20
 * `semua`). Akses ditentukan oleh `resultsOverview`, sama seperti prosedurnya.
 */
export async function HasilPage({
  kegiatanId,
  recruitmentId,
  basePath,
}: {
  kegiatanId: string;
  recruitmentId: string;
  basePath: OprecBase;
}) {
  const found = await loadAssessableOprec(recruitmentId);
  if (found?.recruitment.periodId !== kegiatanId) notFound();
  if (!(await canOpenResults(recruitmentId))) notFound();

  const event = await api.event.getByID({ id: kegiatanId });
  const isAdmin = found.access.isAdmin;
  const canPlacement =
    isAdmin || found.access.deciderDivisionIds.size > 0;

  // Nama yang sudah diterima per divisi, lengkap (melewati paginasi tabel).
  const accepted = await db
    .select({
      divisionId: applicationChoice.divisionId,
      origin: applicationChoice.origin,
      name: users.name,
      studentName: mahasiswa.nama,
      nim: mahasiswa.nim,
    })
    .from(placementDecision)
    .innerJoin(
      applicationChoice,
      eq(applicationChoice.id, placementDecision.choiceId),
    )
    .innerJoin(
      application,
      eq(application.id, applicationChoice.applicationId),
    )
    .innerJoin(users, eq(users.id, application.userId))
    .leftJoin(mahasiswa, eq(mahasiswa.userId, users.id))
    .where(
      and(
        eq(application.recruitmentId, recruitmentId),
        eq(placementDecision.decision, 'terima'),
      ),
    )
    .orderBy(asc(users.name));
  const acceptedByDivision: Record<
    string,
    { name: string | null; nim: number | null; closerec: boolean }[]
  > = {};
  for (const row of accepted) {
    acceptedByDivision[row.divisionId] = [
      ...(acceptedByDivision[row.divisionId] ?? []),
      {
        name: row.studentName ?? row.name,
        nim: row.nim,
        closerec: row.origin === 'closerec',
      },
    ];
  }

  return (
    <HasilView
      recruitmentId={recruitmentId}
      periodName={event?.name ?? ''}
      backHref={
        isAdmin ? `${basePath}/kegiatan/${kegiatanId}/oprec` : undefined
      }
      penempatanHref={canPlacement
        ? `${basePath}/kegiatan/${kegiatanId}/oprec/${recruitmentId}/penempatan`
        : undefined}
      acceptedByDivision={acceptedByDivision}
      tabs={
        <OprecTabs
          basePath={basePath}
          kegiatanId={kegiatanId}
          recruitmentId={recruitmentId}
          current="hasil"
          showPendaftar={isAdmin}
          showPenempatan={canPlacement}
          showHasil
        />
      }
    />
  );
}
