import { ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { api } from '~/trpc/server';

import { canManageEventOprec } from './access';
import {
  type OprecBase,
  RECRUITMENT_STATUS_LABEL,
  RECRUITMENT_STATUS_STYLE,
  pendaftarHref,
} from './status';

/** Daftar oprec satu kegiatan/periode; dipakai rute lembaga dan mahasiswa-admin. */
export async function OprecListPage({
  kegiatanId,
  basePath,
}: {
  kegiatanId: string;
  basePath: OprecBase;
}) {
  if (!(await canManageEventOprec(kegiatanId))) notFound();
  const [event, items] = await Promise.all([
    api.event.getByID({ id: kegiatanId }),
    api.oprec.list({ eventId: kegiatanId }),
  ]);
  if (!event) notFound();

  const backHref =
    basePath === '/lembaga'
      ? '/lembaga/oprec'
      : basePath === '/manage'
        ? '/manage'
        : '/mahasiswa/kegiatan';
  const backLabel =
    basePath === '/lembaga'
      ? 'Semua periode'
      : basePath === '/manage'
        ? 'Kelola'
        : 'Kegiatan';

  return (
    <main className="py-6 sm:py-8">
      <Link
        href={backHref}
        className="text-sm text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        ← {backLabel}
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold text-neutral-1000">Oprec</h1>
          <p className="mt-1 text-neutral-700">{event.name}</p>
        </div>
        <Button asChild variant="light_blue">
          <Link href={`${basePath}/kegiatan/${kegiatanId}/oprec/baru`}>
            <Plus /> Buat oprec
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="mt-8 rounded-[24px] border border-neutral-400 bg-neutral-50 p-8 text-center text-neutral-700">
          Belum ada oprec di {event.name}. Mulai dengan “Buat oprec”.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-400 overflow-hidden rounded-[24px] border border-neutral-400 bg-neutral-50">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={pendaftarHref(basePath, kegiatanId, item.id)}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-neutral-1000">
                    {item.name}
                  </span>
                  <span className="mt-0.5 block text-sm text-neutral-700">
                    {item.applicationCount} pendaftar · {item.divisionCount}{' '}
                    tujuan
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-semibold',
                      RECRUITMENT_STATUS_STYLE[item.status],
                    )}
                  >
                    {RECRUITMENT_STATUS_LABEL[item.status]}
                  </span>
                  <ChevronRight className="size-5 text-neutral-700" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
