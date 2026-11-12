'use client';

// Library Import
import { LogOut } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import { Btn, Pill } from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'mahasiswa',
    title: 'Klik **Microsoft | @mahasiswa.itb.ac.id**',
    hint: 'Akun mahasiswa selalu masuk lewat Microsoft ITB.',
  },
  { id: 'keluar', title: 'Klik **Keluar** di bagian bawah sidebar' },
  {
    id: 'lembaga',
    title: 'Sekarang masuk dengan **Google | @km.itb.ac.id**',
    hint: 'Perhatikan menu sidebar yang berbeda untuk akun lembaga.',
  },
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

export default function MasukDemo() {
  return (
    <DemoFrame
      title="Masuk dan keluar"
      location="Halaman autentikasi"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [role, setRole] = useState<Role | null>(null);

  if (!role) {
    return (
      <div className="mx-auto max-w-xs py-8 text-center">
        <p className="text-lg font-semibold">Masuk ke Anmategra</p>
        <p className="mt-1 text-neutral-700">Pilih akun sesuai peran Anda.</p>
        <div className="mt-4 flex flex-col gap-2">
          <Btn
            tone="outline"
            className={guide.spot('mahasiswa')}
            onClick={() => {
              setRole('mahasiswa');
              guide.complete('mahasiswa');
            }}
          >
            Microsoft | @mahasiswa.itb.ac.id
          </Btn>
          <Btn
            tone="outline"
            className={guide.spot('lembaga')}
            onClick={() => {
              setRole('lembaga');
              guide.complete('lembaga');
            }}
          >
            Google | @km.itb.ac.id
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[170px_1fr]">
      <div className="flex flex-col rounded-lg border border-neutral-400 p-2">
        <ul className="space-y-0.5">
          {MENUS[role].map((item, index) => (
            <li
              key={item}
              className={cn(
                'rounded-md px-2 py-1 text-xs',
                index === 0 && 'bg-primary-100 font-semibold text-primary-600',
              )}
            >
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-neutral-300 pt-2">
          <p className="truncate text-xs font-semibold">
            {role === 'mahasiswa' ? 'Raka Pradipta' : 'Himpunan Mahasiswa Contoh'}
          </p>
          <Btn
            small
            tone="ghost"
            className={cn('mt-1', guide.spot('keluar'))}
            onClick={() => {
              setRole(null);
              guide.complete('keluar');
            }}
          >
            <LogOut aria-hidden /> Keluar
          </Btn>
        </div>
      </div>
      <div className="rounded-lg border border-neutral-400 p-4">
        <Pill tone="teal">
          {role === 'mahasiswa' ? 'Halaman mahasiswa' : 'Halaman lembaga'}
        </Pill>
        <p className="mt-2 text-lg font-semibold">
          Selamat datang,{' '}
          {role === 'mahasiswa' ? 'Raka' : 'Himpunan Mahasiswa Contoh'}
        </p>
        <p className="mt-1 text-neutral-700">
          {role === 'mahasiswa'
            ? 'Anda masuk dengan akun Microsoft ITB. Menu yang tersedia adalah menu mahasiswa.'
            : 'Anda masuk dengan akun Google KM ITB. Menu pengelolaan lembaga tersedia di sidebar.'}
        </p>
      </div>
    </div>
  );
}
