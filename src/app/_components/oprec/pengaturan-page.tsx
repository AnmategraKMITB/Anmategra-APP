import { notFound } from 'next/navigation';
import { api } from '~/trpc/server';

import { canOpenResults, loadManagedOprec } from './access';
import { OprecTabs } from './oprec-tabs';
import { SettingsView } from './settings/settings-view';
import { type OprecBase } from './status';

/** Halaman Pengaturan satu oprec; hanya untuk pengelola oprec. */
export async function PengaturanPage({
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
    <SettingsView
      recruitmentId={recruitmentId}
      eventId={kegiatanId}
      lembagaId={event?.lembaga?.id ?? null}
      periodName={event?.name ?? ''}
      basePath={basePath}
      backHref={`${basePath}/kegiatan/${kegiatanId}/oprec`}
      tabs={
        <OprecTabs
          basePath={basePath}
          kegiatanId={kegiatanId}
          recruitmentId={recruitmentId}
          current="pengaturan"
          showPendaftar
          showPenempatan
          showHasil={showHasil}
          manage={{ formId: managed.formId, status: managed.status }}
        />
      }
    />
  );
}
