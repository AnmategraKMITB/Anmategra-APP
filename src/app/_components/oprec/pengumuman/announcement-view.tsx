'use client';

import { CalendarClock, ExternalLink, Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import {
  type AnnouncementSection,
  anchorSlugs,
  filterAnnouncement,
} from '~/lib/oprec/announcement';
import {
  resolveActiveIndex,
  searchTarget,
  tabParam,
} from '~/lib/oprec/announcement-view';
import { cn } from '~/lib/utils';
import { api } from '~/trpc/react';

import { ErrorNote, Loading, inputClass } from '../placement/shared';

const formatDate = (d: Date) =>
  `${new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(d)} WIB`;

export function AnnouncementView({ recruitmentId }: { recruitmentId: string }) {
  const query = api.oprec.announcement.useQuery(
    { recruitmentId },
    { refetchOnWindowFocus: true },
  );

  if (query.isLoading) {
    return (
      <Shell>
        <Loading label="Memuat pengumuman…" />
      </Shell>
    );
  }
  if (query.error || !query.data) {
    return (
      <Shell>
        <ErrorNote message="Pengumuman tidak dapat dimuat. Muat ulang halaman atau coba lagi nanti." />
      </Shell>
    );
  }
  const data = query.data;
  if (!data.published) {
    return (
      <Shell name={data.name}>
        <div className="flex flex-col items-center gap-3 rounded-[24px] border border-neutral-400 bg-neutral-50 px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-primary-400">
            <CalendarClock className="size-6" aria-hidden />
          </span>
          <h2 className="text-xl font-semibold text-neutral-1000">
            Hasil belum diumumkan
          </h2>
          <p className="max-w-sm text-sm text-neutral-700">
            {data.publishAt
              ? `Daftar penerima tayang pada ${formatDate(new Date(data.publishAt))}. Kembali lagi pada waktu itu.`
              : 'Daftar penerima akan tampil di halaman ini setelah pengelola oprec mengumumkan hasilnya.'}
          </p>
        </div>
      </Shell>
    );
  }
  return (
    <Shell name={data.name}>
      {!data.final ? (
        <p
          role="status"
          className="mb-4 rounded-xl bg-warning-light px-4 py-3 text-sm text-neutral-1000"
        >
          <strong>Hasil sementara.</strong> Masa banding sedang berjalan, daftar
          ini masih bisa berubah. Pengumuman akhir menyusul setelah penempatan
          final.
        </p>
      ) : null}
      <Published sections={data.sections} />
    </Shell>
  );
}

function Shell({
  name,
  children,
}: {
  name?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <header>
        <h1 className="break-words text-2xl font-semibold text-neutral-1000 sm:text-[32px]">
          Pengumuman hasil oprec
        </h1>
        {name ? (
          <p className="mt-1 break-words text-sm text-neutral-700">{name}</p>
        ) : null}
      </header>
      <div className="mt-6">{children}</div>
    </main>
  );
}

function Published({ sections }: { sections: AnnouncementSection[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState('');

  const slugs = useMemo(() => anchorSlugs(sections), [sections]);
  const filtered = useMemo(
    () => sections.map((s) => filterAnnouncement([s], q)),
    [sections, q],
  );
  const searching = q.trim() !== '';
  const total = filtered.reduce((n, f) => n + f.count, 0);
  const active = resolveActiveIndex(
    params.get('bidang'),
    sections.map((s) => s.label),
  );
  const showTabs = !(sections.length === 1 && sections[0]?.label === null);

  const selectTab = (i: number) => {
    const next = new URLSearchParams(params.toString());
    next.set('bidang', tabParam(sections[i]?.label ?? null, i));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const current = sections[active];
  const currentFiltered = filtered[active]?.sections[0];
  // Tanpa pencarian, divisi kosong tetap tampil; saat mencari, hanya yang ada hasil.
  const divisions =
    (searching ? currentFiltered?.divisions : current?.divisions) ?? [];
  const slugOf = (id: string) =>
    slugs[active]?.[current?.divisions.findIndex((x) => x.id === id) ?? -1];

  // Mencari: bila tab aktif kosong, loncat ke tab yang berisi hasil, lalu
  // gulir ke divisi pertama yang cocok. Hanya bereaksi pada perubahan kata kunci.
  const counts = filtered.map((f) => f.count);
  const jump = useRef<string | null>(null);
  useEffect(() => {
    if (!searching) {
      jump.current = null;
      return;
    }
    const target = searchTarget(counts, active);
    if (target === null) return;
    if (target !== active) selectTab(target);
    const first = filtered[target]?.sections[0]?.divisions[0];
    const idx = first
      ? sections[target]?.divisions.findIndex((d) => d.id === first.id)
      : -1;
    const slug = idx !== undefined && idx >= 0 ? slugs[target]?.[idx] : null;
    jump.current = slug ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Tab baru sudah dirender: gulir ke divisi pertama yang cocok.
  useEffect(() => {
    if (!jump.current) return;
    const el = document.getElementById(jump.current);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      jump.current = null;
    }
  }, [active, q, divisions.length]);

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 border-b border-neutral-400 bg-neutral-100/95 px-4 py-3 backdrop-blur-sm sm:-mx-8 sm:px-8">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-600"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama atau NIM"
            aria-label="Cari nama atau NIM"
            className={cn(inputClass, 'h-11 pl-9 pr-10 sm:h-10')}
          />
          {searching ? (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Hapus pencarian"
              className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-neutral-700 transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <p
          className="mt-2 text-xs text-neutral-700 tabular-nums"
          aria-live="polite"
        >
          {searching
            ? `${total} hasil untuk “${q.trim()}”`
            : `${total} penerima`}
        </p>

        {showTabs ? (
          <div
            role="tablist"
            aria-label="Bidang"
            className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sections.map((s, i) => {
              const count = filtered[i]?.count ?? 0;
              const selected = i === active;
              return (
                <button
                  key={s.label ?? i}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => selectTab(i)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                    selected
                      ? 'border-primary-400 bg-primary-400 text-neutral-50'
                      : 'border-neutral-400 bg-neutral-50 text-neutral-800 hover:border-neutral-500 hover:bg-neutral-200',
                    searching && count === 0 && !selected && 'opacity-60',
                  )}
                >
                  {s.label}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-xs tabular-nums',
                      selected
                        ? 'bg-neutral-50/20 text-neutral-50'
                        : 'bg-neutral-200 text-neutral-700',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {divisions.length > 1 ? (
          <nav
            aria-label="Loncat ke divisi"
            className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {divisions.map((d) => (
              <a
                key={d.id}
                href={`#${slugOf(d.id)}`}
                className="shrink-0 rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-500 transition-colors hover:bg-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                {d.label}
              </a>
            ))}
          </nav>
        ) : null}
      </div>

      {divisions.length === 0 ? (
        <p className="mt-6 rounded-[20px] border border-neutral-400 bg-neutral-50 p-6 text-center text-sm text-neutral-700">
          Tidak ada hasil yang sesuai dengan pencarianmu.
        </p>
      ) : null}

      <div className="mt-6 grid gap-8">
        {divisions.map((d) => (
          <section
            key={d.id}
            id={slugOf(d.id)}
            aria-label={d.label || undefined}
            className="scroll-mt-52"
          >
            {d.label ? (
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="break-words text-xl font-semibold text-neutral-1000">
                  {d.label}
                </h2>
                <span className="shrink-0 text-sm text-neutral-700 tabular-nums">
                  {d.rows.length} orang
                </span>
              </div>
            ) : null}
            {d.inviteUrl ? (
              <a
                href={d.inviteUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mb-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-primary-400 px-4 py-2 text-sm font-semibold text-neutral-50 transition-colors hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
              >
                Gabung grup LINE/WhatsApp
                <ExternalLink className="size-4" aria-hidden />
              </a>
            ) : null}
            {d.rows.length === 0 ? (
              <p className="rounded-[20px] border border-neutral-400 bg-neutral-50 px-4 py-5 text-sm text-neutral-700">
                Belum ada yang diterima
              </p>
            ) : (
              <div className="overflow-hidden rounded-[24px] border border-neutral-400 bg-neutral-50">
                <Table className="min-w-[560px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="sticky left-0 z-10 min-w-44 bg-neutral-50 px-4 text-xs font-semibold text-neutral-700 shadow-[1px_0_0_0_theme(colors.neutral.400)]">
                        Nama
                      </TableHead>
                      <TableHead className="px-4 text-xs font-semibold text-neutral-700">
                        NIM
                      </TableHead>
                      <TableHead className="px-4 text-xs font-semibold text-neutral-700">
                        Prodi
                      </TableHead>
                      <TableHead className="px-4 text-xs font-semibold text-neutral-700">
                        Angkatan
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.rows.map((r, i) => (
                      <TableRow
                        key={`${r.nim}-${i}`}
                        className="group hover:bg-primary-100/60"
                      >
                        <TableCell className="sticky left-0 z-10 bg-neutral-50 px-4 py-3 font-semibold text-neutral-1000 shadow-[1px_0_0_0_theme(colors.neutral.400)] group-hover:bg-primary-100">
                          {r.name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-4 py-3 text-neutral-800 tabular-nums">
                          {r.nim}
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-4 py-3 text-neutral-800">
                          {r.prodi}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-neutral-800 tabular-nums">
                          {r.angkatan}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        ))}
      </div>

      <p className="mt-10 text-sm text-neutral-700">
        Ada data yang keliru? Hubungi pengelola oprec untuk koreksi.
      </p>
    </>
  );
}
