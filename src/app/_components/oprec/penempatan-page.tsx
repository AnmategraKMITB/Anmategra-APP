import { count, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { db } from '~/server/db';
import { application } from '~/server/db/schema';
import { api } from '~/trpc/server';

import { canOpenResults, loadAssessableOprec } from './access';
import { OprecTabs } from './oprec-tabs';
import { PlacementView } from './placement-view';
import { type OprecBase, placementLockReason } from './status';

/** Halaman Penempatan satu oprec; admin dan Kadiv (Kadiv lewat jalur mahasiswa). */
export async function PenempatanPage({
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
  const isAdmin = found.access.isAdmin;
  const canDecide = isAdmin || found.access.deciderDivisionIds.size > 0;
  if (!canDecide) notFound();

  const [applicants] = await db
    .select({ n: count() })
    .from(application)
    .where(eq(application.recruitmentId, recruitmentId));
  if (placementLockReason(found.recruitment.status, applicants?.n ?? 0))
    redirect(
      isAdmin
        ? `${basePath}/kegiatan/${kegiatanId}/oprec/${recruitmentId}/pendaftar`
        : `${basePath}/kegiatan/${kegiatanId}/oprec`,
    );

  const event = await api.event.getByID({ id: kegiatanId });
  const showHasil = await canOpenResults(recruitmentId);

  return (
    <PlacementView
      recruitmentId={recruitmentId}
      periodName={event?.name ?? ''}
      backHref={
        isAdmin ? `${basePath}/kegiatan/${kegiatanId}/oprec` : undefined
      }
      tabs={
        <OprecTabs
          basePath={basePath}
          kegiatanId={kegiatanId}
          recruitmentId={recruitmentId}
          current="penempatan"
          showPendaftar={isAdmin}
          showPenempatan
          showHasil={showHasil}
          manage={
            isAdmin
              ? {
                  formId: found.recruitment.formId,
                  status: found.recruitment.status,
                }
              : undefined
          }
        />
      }
    />
  );
}
