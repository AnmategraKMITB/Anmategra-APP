import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getServerAuthSession } from '~/server/auth';
import { api } from '~/trpc/server';

import { CreatePeriodButton } from './_components/create-period-button';

const STATUS_LABEL: Record<string, string> = {
  'Coming Soon': 'Akan datang',
  'On going': 'Berlangsung',
  Ended: 'Selesai',
};

const OrganogramPeriodPickerPage = async () => {
  const events = await api.kegiatan.getAllByLembaga();
  const session = await getServerAuthSession();
  const lembagaId = session?.user.lembagaId;
  const hasKepengurusan = events.some((e) => e.kind === 'kepengurusan');

  return (
    <main className="py-6 sm:py-8">
      <h1 className="text-[32px] font-semibold text-neutral-1000">
        Organogram
      </h1>
      <p className="mt-1 text-neutral-700">
        Pilih periode atau kegiatan untuk melihat atau menyusun organogramnya.
      </p>

      {lembagaId && !hasKepengurusan ? (
        <CreatePeriodButton lembagaId={lembagaId} />
      ) : null}

      {events.length === 0 ? (
        <p className="mt-8 text-neutral-700">
          Belum ada periode atau kegiatan. Buat kegiatan dulu di halaman
          Kegiatan.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-400 border-y border-neutral-400">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/lembaga/kegiatan/${event.id}/organogram`}
                className="flex items-center justify-between gap-4 px-2 py-4 transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-neutral-1000">
                    {event.name}
                  </span>
                  <span className="block text-sm text-neutral-700">
                    {STATUS_LABEL[event.status] ?? event.status}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-neutral-700" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default OrganogramPeriodPickerPage;
