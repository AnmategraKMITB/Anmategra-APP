import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '~/trpc/server';

import { canManageEventOprec } from './access';
import { type OprecBase } from './status';
import { SetupWizard } from './wizard/wizard';

/** Halaman wizard setup oprec; dipakai rute lembaga dan mahasiswa-admin. */
export async function SetupPage({
  kegiatanId,
  basePath,
}: {
  kegiatanId: string;
  basePath: OprecBase;
}) {
  if (!(await canManageEventOprec(kegiatanId))) notFound();
  const event = await api.event.getByID({ id: kegiatanId });
  if (!event) notFound();

  return (
    <main className="py-6 sm:py-8">
      <Link
        href={`${basePath}/kegiatan/${kegiatanId}/oprec`}
        className="text-sm text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        ← Daftar oprec
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold text-neutral-1000 sm:text-[32px]">
        Buat oprec
      </h1>
      <SetupWizard
        eventId={kegiatanId}
        eventName={event.name}
        lembagaId={event.lembaga?.id ?? null}
        basePath={basePath}
      />
    </main>
  );
}
