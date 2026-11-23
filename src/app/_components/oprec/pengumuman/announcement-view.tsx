'use client';

import {
  CalendarClock,
  ChevronDown,
  ExternalLink,
  Search,
  X,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
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

const PILL =
  'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 sm:min-h-10';
const PILL_ON = 'border-primary-400 bg-primary-400 text-neutral-50';
const PILL_OFF =
  'border-neutral-400 bg-neutral-50 text-neutral-800 hover:border-neutral-500 hover:bg-neutral-200';

function Count({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 text-xs tabular-nums',
        on
          ? 'bg-neutral-50/20 text-neutral-50'
          : 'bg-neutral-200 text-neutral-700',
      )}
    >
      {children}
    </span>
  );
}

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
  // null = tab "Semua": seluruh bidang sekaligus.
  const active = resolveActiveIndex(
    params.get('bidang'),
    sections.map((s) => s.label),
  );
  const showTabs = !(sections.length === 1 && sections[0]?.label === null);

  const selectTab = (i: number | null) => {
    const next = new URLSearchParams(params.toString());
    if (i === null) next.delete('bidang');
    else next.set('bidang', tabParam(sections[i]?.label ?? null, i));
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Bidang yang tampil: semua (Semua) atau satu. Saat mencari, hanya divisi yang ada hasil.
  const groups = (active === null ? sections.map((_, i) => i) : [active]).map(
    (si) => ({
      si,
      label: sections[si]?.label ?? null,
      divisions:
        (searching
          ? filtered[si]?.sections[0]?.divisions
          : sections[si]?.divisions) ?? [],
    }),
  );
  const visible = groups.flatMap((g) =>
    g.divisions.map((d, i) => ({
      d,
      si: g.si,
      // Judul bidang hanya di mode Semua, sekali di divisi pertama tiap bidang.
      heading: active === null && i === 0 ? g.label : null,
    })),
  );
  const slugOf = (si: number, id: string) =>
    slugs[si]?.[sections[si]?.divisions.findIndex((x) => x.id === id) ?? -1];

  // Mencari: bila bidang terpilih kosong, pindah ke bidang yang berisi hasil;
  // lalu gulir ke divisi pertama yang cocok. Hanya bereaksi pada kata kunci.
  const counts = filtered.map((f) => f.count);
  const jump = useRef<string | null>(null);
  useEffect(() => {
    if (!searching) {
      jump.current = null;
      return;
    }
    const target =
      active === null ? searchTarget(counts, 0) : searchTarget(counts, active);
    if (target === null) return;
    if (active !== null && target !== active) selectTab(target);
    const first = filtered[target]?.sections[0]?.divisions[0];
    const idx = first
      ? sections[target]?.divisions.findIndex((d) => d.id === first.id)
      : -1;
    jump.current =
      (idx !== undefined && idx >= 0 ? slugs[target]?.[idx] : null) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Hasil sudah dirender: gulir ke divisi pertama yang cocok.
  useEffect(() => {
    if (!jump.current) return;
    const el = document.getElementById(jump.current);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      jump.current = null;
    }
  }, [active, q, visible.length]);

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
            className={cn(
              inputClass,
              'h-11 pl-9 pr-12 text-base sm:h-10 sm:pr-10 sm:text-sm',
              '[&::-webkit-search-cancel-button]:appearance-none',
            )}
          />
          {searching ? (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Hapus pencarian"
              className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-neutral-700 transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 sm:right-1.5 sm:size-8"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
        <p
          className="mt-2 text-xs tabular-nums text-neutral-700"
          aria-live="polite"
        >
          {searching
            ? `${total} hasil untuk “${q.trim()}”`
            : `${total} penerima`}
        </p>

        {showTabs ? (
          <div
            aria-label="Filter bidang"
            className="mt-3 flex flex-wrap items-center justify-center gap-2"
          >
            <button
              type="button"
              aria-pressed={active === null}
              onClick={() => selectTab(null)}
              className={cn(PILL, active === null ? PILL_ON : PILL_OFF)}
            >
              Semua
              <Count on={active === null}>{total}</Count>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(PILL, active !== null ? PILL_ON : PILL_OFF)}
              >
                <span className="max-w-[16rem] truncate">
                  {active === null
                    ? 'Bidang'
                    : (sections[active]?.label ?? 'Bidang')}
                </span>
                <ChevronDown className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className="max-h-72 w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[16px] border-neutral-400 bg-neutral-50 p-1.5"
              >
                <DropdownMenuRadioGroup
                  value={active === null ? '' : String(active)}
                  onValueChange={(v) => selectTab(Number(v))}
                >
                  {sections.map((s, i) => {
                    const count = filtered[i]?.count ?? 0;
                    return (
                      <DropdownMenuRadioItem
                        key={s.label ?? i}
                        value={String(i)}
                        className={cn(
                          'min-h-10 cursor-pointer rounded-lg pr-3 text-sm font-semibold text-neutral-1000 focus:bg-primary-100',
                          searching && count === 0 && 'opacity-60',
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {s.label}
                        </span>
                        <span className="ml-3 text-xs font-normal tabular-nums text-neutral-700">
                          {count}
                        </span>
                      </DropdownMenuRadioItem>
                    );
                  })}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}

        {visible.length > 1 ? (
          <nav
            aria-label="Loncat ke divisi"
            className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {visible.map(({ d, si }) => (
              <a
                key={`${si}-${d.id}`}
                href={`#${slugOf(si, d.id)}`}
                className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary-100 px-3.5 py-1.5 text-xs font-semibold text-primary-500 transition-colors hover:bg-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 sm:min-h-8 sm:px-3 sm:py-1"
              >
                {d.label}
              </a>
            ))}
          </nav>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 rounded-[20px] border border-neutral-400 bg-neutral-50 p-6 text-center text-sm text-neutral-700">
          Tidak ada hasil yang sesuai dengan pencarianmu.
        </p>
      ) : null}

      <div className="mt-6 grid gap-8">
        {visible.map(({ d, si, heading }) => (
          <section
            key={`${si}-${d.id}`}
            id={slugOf(si, d.id)}
            aria-label={d.label || undefined}
            className="scroll-mt-60 sm:scroll-mt-52"
          >
            {heading ? (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-400">
                {heading}
              </p>
            ) : null}
            {d.label ? (
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="min-w-0 break-words text-xl font-semibold text-neutral-1000">
                  {d.label}
                </h2>
                <span className="shrink-0 text-sm tabular-nums text-neutral-700">
                  {d.rows.length} orang
                </span>
              </div>
            ) : null}
            {d.inviteUrl ? (
              <a
                href={d.inviteUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mb-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary-400 px-4 py-2 text-sm font-semibold text-neutral-50 transition-colors hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 sm:min-h-10 sm:w-auto"
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
              <>
                <ul className="grid gap-2 sm:hidden">
                  {d.rows.map((r, i) => (
                    <li
                      key={`${r.nim}-${i}`}
                      className="rounded-[20px] border border-neutral-400 bg-neutral-50 px-4 py-3.5"
                    >
                      <p className="break-words font-semibold text-neutral-1000">
                        {r.name}
                      </p>
                      <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm text-neutral-700">
                        <span className="tabular-nums">NIM {r.nim}</span>
                        <span className="min-w-0 break-words">{r.prodi}</span>
                        <span className="tabular-nums">
                          Angkatan {r.angkatan}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-hidden rounded-[24px] border border-neutral-400 bg-neutral-50 sm:block">
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
                          <TableCell className="whitespace-nowrap px-4 py-3 tabular-nums text-neutral-800">
                            {r.nim}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-4 py-3 text-neutral-800">
                            {r.prodi}
                          </TableCell>
                          <TableCell className="px-4 py-3 tabular-nums text-neutral-800">
                            {r.angkatan}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
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
