import { ChevronRight, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { type RouterOutputs } from '~/trpc/react';

/** Daftar tautan ke pengumuman hasil oprec yang sudah tayang. Kosong = tidak tampil. */
export function PengumumanList({
  items,
}: {
  items: RouterOutputs['oprec']['lembagaAnnouncements'];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-4 pb-12">
      <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600">
        Pengumuman Oprec
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((p) => (
          <li key={p.id}>
            <Link
              href={`/pengumuman/${p.ref}`}
              className="flex items-center gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4 transition-colors hover:bg-primary-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-400">
                <Megaphone className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-neutral-1000">
                  {p.name}
                </span>
                <span className="block text-xs text-neutral-700">
                  Diumumkan{' '}
                  {p.publishedAt.toLocaleDateString('id-ID', {
                    dateStyle: 'long',
                    timeZone: 'Asia/Jakarta',
                  })}
                </span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-neutral-700"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
