import { notFound } from 'next/navigation';
import { api } from '~/trpc/server';

import { canOpenResults, loadAssessableOprec } from './access';
import { OprecTabs } from './oprec-tabs';
import { PriorityView } from './priority/priority-view';
import { type OprecBase } from './status';

/**
 * Halaman Prioritas satu oprec: penyusun daftar (admin, penilai, Kadiv) pada
 * metode prioritas; admin juga melihatnya pada metode manual untuk
 * menyalakannya.
 */
export async function PrioritasPage({
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
  const { isAdmin } = found.access;
  if (!isAdmin && found.recruitment.placementMethod !== 'prioritas') {
    notFound();
  }
  const showHasil = await canOpenResults(recruitmentId);
  const event = await api.event.getByID({ id: kegiatanId });

  return (
    <PriorityView
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
          current="prioritas"
          showPendaftar={isAdmin}
          showPenempatan={isAdmin || found.access.deciderDivisionIds.size > 0}
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
