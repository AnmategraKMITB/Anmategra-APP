import { notFound } from 'next/navigation';
import { api } from '~/trpc/server';

import { loadAssessableOprec } from './access';
import { OprecTabs } from './oprec-tabs';
import { PlacementView } from './placement-view';
import { type OprecBase } from './status';

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
  const canDecide =
    isAdmin || found.access.deciderDivisionIds.size > 0;
  if (!canDecide) notFound();

  const event = await api.event.getByID({ id: kegiatanId });

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
        />
      }
    />
  );
}
