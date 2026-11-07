import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '~/trpc/server';

import { canManageEventForms } from './access';
import { FormsList } from './forms-list';

/** Daftar form satu kegiatan; dipakai rute lembaga dan mahasiswa-admin. */
export async function EventFormsPage({
  kegiatanId,
  basePath,
}: {
  kegiatanId: string;
  basePath: '/lembaga' | '/mahasiswa';
}) {
  if (!(await canManageEventForms(kegiatanId))) notFound();
  const event = await api.event.getByID({ id: kegiatanId });
  if (!event) notFound();

  const backHref =
    basePath === '/lembaga' ? '/lembaga/forms' : '/mahasiswa/kegiatan';
  const backLabel = basePath === '/lembaga' ? 'Semua form' : 'Kegiatan';

  return (
    <main className="py-6 sm:py-8">
      <Link
        href={backHref}
        className="text-sm text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        ← {backLabel}
      </Link>
      <h1 className="mt-2 text-[32px] font-semibold text-neutral-1000">
        Form kegiatan
      </h1>
      <p className="mt-1 text-neutral-700">{event.name}</p>
      <div className="mt-6">
        <FormsList
          scope={{ type: 'event', eventId: kegiatanId }}
          basePath={basePath}
        />
      </div>
    </main>
  );
}
