import { notFound } from 'next/navigation';
import { api } from '~/trpc/server';

import { canOpenResults, loadManagedOprec } from './access';
import { ApplicantsView } from './applicants-view';
import { OprecStatusBar } from './oprec-status-bar';
import { OprecTabs } from './oprec-tabs';
import { type OprecBase } from './status';

/** Halaman Pendaftar satu oprec; dipakai rute lembaga dan mahasiswa-admin. */
export async function ApplicantsPage({
  kegiatanId,
  recruitmentId,
  basePath,
}: {
  kegiatanId: string;
  recruitmentId: string;
  basePath: OprecBase;
}) {
  const managed = await loadManagedOprec(recruitmentId);
  if (managed?.periodId !== kegiatanId) notFound();
  const event = await api.event.getByID({ id: kegiatanId });
  const showHasil = await canOpenResults(recruitmentId);

  return (
    <ApplicantsView
      recruitmentId={recruitmentId}
      name={managed.name}
      periodName={event?.name ?? ''}
      backHref={`${basePath}/kegiatan/${kegiatanId}/oprec`}
      tabs={
        <>
          <OprecStatusBar
            recruitmentId={recruitmentId}
            status={managed.status}
            formHref={`${basePath}/forms/${managed.formId}`}
            canManage
          />
          <OprecTabs
            basePath={basePath}
            kegiatanId={kegiatanId}
            recruitmentId={recruitmentId}
            current="pendaftar"
            showPendaftar
            showPenempatan
            showHasil={showHasil}
          />
        </>
      }
    />
  );
}
