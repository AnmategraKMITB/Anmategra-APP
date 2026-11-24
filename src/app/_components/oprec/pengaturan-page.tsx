import { notFound } from 'next/navigation';
import { api } from '~/trpc/server';

import {
  canOpenResults,
  loadAssessableOprec,
  loadDivisionSettingsOprec,
  loadManagedOprec,
} from './access';
import { OprecTabs } from './oprec-tabs';
import { DivisionSettingsView } from './settings/division-settings-view';
import { SettingsView } from './settings/settings-view';
import { type OprecBase } from './status';

/** Pengaturan divisi untuk pengurus yang bukan pengelola oprec. */
async function DivisionSettingsPage({
  kegiatanId,
  recruitmentId,
  basePath,
}: {
  kegiatanId: string;
  recruitmentId: string;
  basePath: OprecBase;
}) {
  const scoped = await loadDivisionSettingsOprec(recruitmentId);
  if (scoped?.periodId !== kegiatanId) notFound();
  const found = await loadAssessableOprec(recruitmentId);
  const event = await api.event.getByID({ id: kegiatanId });
  const showHasil = await canOpenResults(recruitmentId);

  return (
    <DivisionSettingsView
      recruitmentId={recruitmentId}
      periodName={event?.name ?? ''}
    >
      <OprecTabs
        basePath={basePath}
        kegiatanId={kegiatanId}
        recruitmentId={recruitmentId}
        current="pengaturan"
        showPendaftar={false}
        showPenempatan={(found?.access.deciderDivisionIds.size ?? 0) > 0}
        showHasil={showHasil}
      />
    </DivisionSettingsView>
  );
}

/**
 * Halaman Pengaturan satu oprec: penuh untuk pengelola oprec, atau Pengaturan
 * divisi (kriteria dan penilai divisinya) untuk pengurus.
 */
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
  if (!managed) {
    return (
      <DivisionSettingsPage
        kegiatanId={kegiatanId}
        recruitmentId={recruitmentId}
        basePath={basePath}
      />
    );
  }
  if (managed.periodId !== kegiatanId) notFound();
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
