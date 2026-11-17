'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { api } from '~/trpc/react';
import { cn } from '~/lib/utils';
import {
  anchorSlugs,
  filterAnnouncement,
  type AnnouncementSection,
} from '~/lib/oprec/announcement';
import { resolveActiveIndex } from '~/lib/oprec/announcement-view';

const formatDate = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(d) + ' WIB';

export function AnnouncementView({ recruitmentId }: { recruitmentId: string }) {
  const query = api.oprec.announcement.useQuery(
    { recruitmentId },
    { refetchOnWindowFocus: true },
  );

  if (query.isLoading) {
    return <Shell><p className="text-sm text-neutral-600">Memuat...</p></Shell>;
  }
  if (query.error || !query.data) {
    return (
      <Shell>
        <p className="text-sm text-red-600">Pengumuman tidak dapat dimuat.</p>
      </Shell>
    );
  }
  const data = query.data;
  if (!data.published) {
    return (
      <Shell title={data.name}>
        <div className="rounded-xl border bg-white p-6 text-center">
          <p className="text-lg font-semibold">Hasil belum diumumkan</p>
          {data.publishAt && (
            <p className="mt-2 text-sm text-neutral-600">
              Dijadwalkan pada {formatDate(new Date(data.publishAt))}.
            </p>
          )}
        </div>
      </Shell>
    );
  }
  return (
    <Shell title={data.name}>
      <Published sections={data.sections} />
    </Shell>
  );
}

function Shell({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6">
      <h1 className="mb-3 text-xl font-bold sm:text-2xl">
        Pengumuman Hasil Oprec{title ? `: ${title}` : ''}
      </h1>
      {children}
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
  const total = filtered.reduce((n, f) => n + f.count, 0);
  const active = resolveActiveIndex(params.get('bidang'), sections.length);
  const showTabs = !(sections.length === 1 && sections[0]?.label === null);

  const selectTab = (i: number) => {
    const next = new URLSearchParams(params.toString());
    next.set('bidang', String(i));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const current = sections[active];
  const currentFiltered = filtered[active]?.sections[0];
  // Tanpa pencarian, divisi kosong tetap tampil; saat mencari, hanya yang ada hasil.
  const divisions = (q.trim() === '' ? current?.divisions : currentFiltered?.divisions) ?? [];

  return (
    <>
      <div className="sticky top-0 z-20 -mx-3 space-y-2 border-b bg-white px-3 py-3 sm:mx-0 sm:px-0">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama atau NIM"
          aria-label="Cari nama atau NIM"
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
        />
        <p className="text-xs text-neutral-600" aria-live="polite">
          {q.trim() === ''
            ? `${total} penerima`
            : `${total} hasil untuk "${q.trim()}"`}
        </p>
        {showTabs && (
          <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl bg-neutral-100 p-1">
            {sections.map((s, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === active}
                onClick={() => selectTab(i)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium sm:text-sm',
                  i === active ? 'bg-white shadow' : 'text-neutral-600',
                )}
              >
                {s.label} ({filtered[i]?.count ?? 0})
              </button>
            ))}
          </div>
        )}
        {divisions.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {divisions.map((d) => {
              const slug = slugs[active]?.[current?.divisions.findIndex((x) => x.id === d.id) ?? -1];
              return (
                <a
                  key={d.id}
                  href={`#${slug}`}
                  className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs"
                >
                  {d.label}
                </a>
              );
            })}
          </div>
        )}
      </div>

      {showTabs && current?.label && (
        <h2 className="mt-4 text-lg font-semibold">{current.label}</h2>
      )}
      {divisions.length === 0 && (
        <p className="mt-6 text-sm text-neutral-600">Tidak ada hasil yang sesuai.</p>
      )}
      {divisions.map((d) => {
        const slug = slugs[active]?.[current?.divisions.findIndex((x) => x.id === d.id) ?? -1];
        return (
          <section key={d.id} id={slug} className="mt-4 scroll-mt-40">
            {d.label && (
              <h3 className="mb-1 text-sm font-medium text-neutral-700">
                {d.label} ({d.rows.length})
              </h3>
            )}
            {d.rows.length === 0 ? (
              <p className="rounded-lg border bg-white px-3 py-3 text-sm text-neutral-600">
                Belum ada yang diterima
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="bg-neutral-100 text-left text-xs">
                      <th className="sticky left-0 z-10 w-40 min-w-[10rem] bg-neutral-100 px-3 py-2 shadow-[2px_0_0_0_#e5e5e5]">Nama</th>
                      <th className="px-3 py-2">NIM</th>
                      <th className="px-3 py-2">Prodi</th>
                      <th className="px-3 py-2">Angkatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.map((r, i) => (
                      <tr key={`${r.nim}-${i}`}>
                        <td className="sticky left-0 border-t bg-white px-3 py-2 font-medium shadow-[2px_0_0_0_#e5e5e5]">{r.name}</td>
                        <td className="whitespace-nowrap border-t px-3 py-2">{r.nim}</td>
                        <td className="whitespace-nowrap border-t px-3 py-2">{r.prodi}</td>
                        <td className="border-t px-3 py-2">{r.angkatan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
      <p className="mt-8 text-xs text-neutral-500">
        Untuk koreksi data, hubungi pengelola oprec.
      </p>
    </>
  );
}
