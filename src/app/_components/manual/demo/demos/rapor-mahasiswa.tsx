'use client';

// Library Import
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import { Btn, Pill, tdClass, thClass, Toggle } from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'lembaga',
    title: 'Nyalakan **Visibilitas lembaga atau kegiatan**',
    hint: 'Pengaturan ini milik lembaga. Selama mati, tautan Rapor tidak muncul sama sekali.',
  },
  {
    id: 'rapor',
    title: 'Klik tautan **Rapor** pada kartu kepanitiaan',
  },
  {
    id: 'pribadi',
    title: 'Matikan **Visibilitas pribadi mahasiswa**',
    hint: 'Tautan Rapor hilang lagi. Keduanya harus aktif agar rapor terlihat.',
  },
];

const SCORES: [string, number][] = [
  ['Tanggung jawab', 92],
  ['Kerja sama', 88],
  ['Inisiatif', 85],
];

export default function RaporMahasiswaDemo() {
  return (
    <DemoFrame
      title="Kapan rapor terlihat di profil"
      location="Mahasiswa › Profil › kartu kepanitiaan"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [lembaga, setLembaga] = useState(false);
  const [pribadi, setPribadi] = useState(true);
  const [open, setOpen] = useState(false);

  const visible = lembaga && pribadi;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3 rounded-lg border border-dashed border-secondary-400 bg-secondary-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-800">
          Dua pengaturan yang bekerja bersama
        </p>
        <div>
          <Toggle
            label="Visibilitas lembaga atau kegiatan"
            checked={lembaga}
            onChange={(next) => {
              setLembaga(next);
              if (!next) setOpen(false);
              if (next) guide.complete('lembaga');
            }}
            className={guide.spot('lembaga')}
          />
          <p className="mt-1 text-xs text-neutral-700">
            Diatur lembaga dari halaman rapor.
          </p>
        </div>
        <div>
          <Toggle
            label="Visibilitas pribadi mahasiswa"
            checked={pribadi}
            onChange={(next) => {
              setPribadi(next);
              if (!next) {
                setOpen(false);
                guide.complete('pribadi');
              }
            }}
            className={guide.spot('pribadi')}
          />
          <p className="mt-1 text-xs text-neutral-700">
            Diatur mahasiswa dari profilnya.
          </p>
        </div>
        <Pill tone={visible ? 'success' : 'neutral'}>
          {visible ? 'Rapor terlihat dari profil' : 'Rapor tidak terlihat'}
        </Pill>
      </div>

      <div>
        <div className="rounded-lg border border-neutral-400 p-3">
          <p className="font-semibold">Festival Karya 2026</p>
          <p className="text-xs text-neutral-700">Divisi Acara · Staf</p>
          {visible ? (
            <Btn
              small
              tone="outline"
              className={cn('mt-2', guide.spot('rapor'))}
              onClick={() => {
                setOpen(true);
                guide.complete('rapor');
              }}
            >
              Rapor
            </Btn>
          ) : (
            <p className="mt-2 text-xs text-neutral-700">
              Tautan Rapor tidak muncul.
            </p>
          )}
        </div>
        {open && visible ? (
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-400">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>Profil ketercapaian</th>
                  <th className={thClass}>Nilai</th>
                </tr>
              </thead>
              <tbody>
                {SCORES.map(([label, score]) => (
                  <tr key={label}>
                    <td className={tdClass}>{label}</td>
                    <td className={cn(tdClass, 'font-semibold')}>{score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
