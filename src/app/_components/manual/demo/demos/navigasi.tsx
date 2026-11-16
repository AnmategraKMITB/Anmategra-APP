'use client';

// Library Import
import { Search } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import { inputClass, Pill } from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'peran',
    title: 'Ganti peran ke **Lembaga** dan lihat menu sidebar bertambah',
  },
  { id: 'menu', title: 'Klik menu **Organogram** di sidebar' },
  {
    id: 'cari',
    title: 'Ketik "festival" pada kolom pencarian di navbar',
    hint: 'Pratinjau hasil muncul setelah beberapa karakter.',
  },
  { id: 'hasil', title: 'Pilih salah satu hasil pencarian' },
];

type Role = 'mahasiswa' | 'lembaga';

const MENUS: Record<Role, readonly string[]> = {
  mahasiswa: ['Beranda', 'Kegiatan', 'Laporan', 'Inbox', 'Manual'],
  lembaga: [
    'Beranda',
    'Kegiatan',
    'Anggota',
    'Organogram',
    'Forms',
    'Oprec',
    'Inbox',
    'Laporan',
    'Manual',
  ],
};

const PAGES: Record<string, string> = {
  Beranda: 'Ringkasan kegiatan dan lembaga terbaru.',
  Kegiatan: 'Daftar kegiatan. Lembaga mengelola kegiatannya di sini.',
  Anggota: 'Daftar anggota lembaga, rapor komunal, dan Best Staff.',
  Organogram: 'Susunan bagian dan jabatan tiap periode atau kegiatan.',
  Forms: 'Form buatan lembaga beserta responsnya.',
  Oprec: 'Rekrutmen: pendaftar, penilaian, penempatan, dan hasil.',
  Inbox: 'Pengajuan asosiasi yang menunggu atau sudah diputuskan.',
  Laporan: 'Laporan masalah teknis untuk admin.',
  Manual: 'Dokumentasi yang sedang Anda baca.',
};

const RESULTS = [
  { type: 'Kegiatan', name: 'Festival Karya 2026' },
  { type: 'Kegiatan', name: 'Festival Olahraga Kampus' },
  { type: 'Lembaga', name: 'Himpunan Mahasiswa Contoh' },
  { type: 'Mahasiswa', name: 'Raka Pradipta' },
  { type: 'Mahasiswa', name: 'Citra Maharani' },
];

export default function NavigasiDemo() {
  return (
    <DemoFrame
      title="Sidebar, navbar, dan pencarian"
      location="Tampilan utama setelah masuk"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [role, setRole] = useState<Role>('mahasiswa');
  const [page, setPage] = useState('Beranda');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const matches =
    q.length >= 3
      ? RESULTS.filter((item) => item.name.toLowerCase().includes(q))
      : [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-400 bg-neutral-100 p-2">
        <div
          role="group"
          aria-label="Peran akun"
          className={cn(
            'flex rounded-lg border border-neutral-400 bg-white p-0.5',
            guide.spot('peran'),
          )}
        >
          {(['mahasiswa', 'lembaga'] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={role === item}
              onClick={() => {
                setRole(item);
                setPage('Beranda');
                if (item === 'lembaga') guide.complete('peran');
              }}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                role === item
                  ? 'bg-primary-400 text-white'
                  : 'text-neutral-800 hover:bg-neutral-200',
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="relative min-w-40 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-neutral-600"
            aria-hidden
          />
          <input
            aria-label="Pencarian Lembaga, Kegiatan, atau Mahasiswa"
            placeholder="Pencarian Lembaga, Kegiatan, atau Mahasiswa"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPicked(null);
              if (event.target.value.trim().length >= 3) guide.complete('cari');
            }}
            className={cn(inputClass, 'pl-8', guide.spot('cari'))}
          />
          {matches.length > 0 && !picked ? (
            <ul className="absolute inset-x-0 top-10 z-10 divide-y divide-neutral-300 rounded-lg border border-neutral-400 bg-white shadow-md">
              {matches.map((item, index) => (
                <li key={item.name}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(item.name);
                      guide.complete('hasil');
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                      index === 0 && guide.spot('hasil'),
                    )}
                  >
                    <Pill tone="info">{item.type}</Pill>
                    <span className="font-semibold">{item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr]">
        <ul className="space-y-0.5 rounded-lg border border-neutral-400 p-2">
          {MENUS[role].map((item) => (
            <li key={item}>
              <button
                type="button"
                aria-current={page === item && !picked}
                onClick={() => {
                  setPage(item);
                  setPicked(null);
                  if (item === 'Organogram') guide.complete('menu');
                }}
                className={cn(
                  'w-full rounded-md px-2 py-1 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  page === item && !picked
                    ? 'bg-primary-100 font-semibold text-primary-600'
                    : 'hover:bg-neutral-200',
                  item === 'Organogram' && guide.spot('menu'),
                )}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
        <div className="rounded-lg border border-neutral-400 p-4">
          {picked ? (
            <>
              <p className="text-xs text-neutral-700">Hasil pencarian</p>
              <p className="text-lg font-semibold">{picked}</p>
              <p className="mt-1 text-neutral-700">
                Di aplikasi, Anda dibawa ke halaman profilnya.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">{page}</p>
              <p className="mt-1 text-neutral-700">{PAGES[page]}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
