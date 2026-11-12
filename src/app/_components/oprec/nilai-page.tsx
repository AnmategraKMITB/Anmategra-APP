import { notFound } from 'next/navigation';
import { api } from '~/trpc/server';

import { canOpenResults, loadAssessableOprec } from './access';
import { NilaiView } from './nilai/nilai-view';
import { OprecTabs } from './oprec-tabs';
import { type OprecBase } from './status';

/** Halaman Nilai satu oprec; dipakai rute lembaga dan mahasiswa (penilai). */
export async function NilaiPage({
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
  const showHasil = await canOpenResults(recruitmentId);

  const event = await api.event.getByID({ id: kegiatanId });
  const { isAdmin } = found.access;

  return (
    <NilaiView
      recruitmentId={recruitmentId}
      periodName={event?.name ?? ''}
      basePath={
        isAdmin ? `${basePath}/kegiatan/${kegiatanId}/oprec` : undefined
      }
      tabs={
        <OprecTabs
          basePath={basePath}
          kegiatanId={kegiatanId}
          recruitmentId={recruitmentId}
          current="nilai"
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
