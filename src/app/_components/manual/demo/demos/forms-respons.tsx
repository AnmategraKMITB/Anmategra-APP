'use client';

// Library Import
import { Download } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import {
  Btn,
  Modal,
  ScreenTitle,
  TabBar,
  tdClass,
  thClass,
  useFlash,
} from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'tabel',
    title: 'Baca **Ringkasan**, lalu buka tab **Tabel**',
    hint: 'Ringkasan merangkum tiap pertanyaan. Tabel menampilkan satu baris per pengisi.',
  },
  {
    id: 'detail',
    title: 'Klik satu baris untuk membaca jawaban lengkapnya',
  },
  { id: 'ekspor', title: 'Tutup, lalu klik **Ekspor CSV**' },
];

type Response = {
  id: string;
  name: string;
  nim: string;
  sentAt: string;
  pernah: 'Ya' | 'Tidak';
  siap: number;
  cerita: string;
};

const RESPONSES: Response[] = [
  { id: 'r1', name: 'Raka Pradipta', nim: '13524011', sentAt: '10 Nov 2026 09.12', pernah: 'Ya', siap: 5, cerita: 'Koordinator acara malam keakraban angkatan.' },
  { id: 'r2', name: 'Nadia Kusumawardhani', nim: '18224032', sentAt: '10 Nov 2026 10.40', pernah: 'Ya', siap: 4, cerita: 'Staf publikasi di dua acara himpunan.' },
  { id: 'r3', name: 'Bima Arya Setiadi', nim: '13224057', sentAt: '10 Nov 2026 13.05', pernah: 'Tidak', siap: 4, cerita: '' },
  { id: 'r4', name: 'Laras Ayuningtyas', nim: '15523018', sentAt: '11 Nov 2026 08.22', pernah: 'Ya', siap: 5, cerita: 'Ketua pelaksana lomba tingkat fakultas.' },
  { id: 'r5', name: 'Fajar Nugraha', nim: '10523044', sentAt: '11 Nov 2026 19.47', pernah: 'Tidak', siap: 2, cerita: '' },
];

const TABS = [
  ['ringkasan', 'Ringkasan'],
  ['tabel', 'Tabel'],
] as const;

export default function FormsResponsDemo() {
  return (
    <DemoFrame
      title="Melihat respons form"
      location="Lembaga › Forms › Survei Minat Panitia › Respons"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [tab, setTab] = useState<'ringkasan' | 'tabel'>('ringkasan');
  const [openId, setOpenId] = useState<string | null>(null);
  const { flash, node } = useFlash();

  const total = RESPONSES.length;
  const yes = RESPONSES.filter((row) => row.pernah === 'Ya').length;
  const scores = RESPONSES.map((row) => row.siap);
  const average = scores.reduce((sum, value) => sum + value, 0) / total;
  const opened = RESPONSES.find((row) => row.id === openId);

  const open = (id: string) => {
    setOpenId(id);
    guide.complete('detail');
  };

  return (
    <div>
      <ScreenTitle
        title="Survei Minat Panitia"
        subtitle={`Terbit · ${total} respons`}
        actions={
          <Btn
            small
            tone="outline"
            className={guide.spot('ekspor')}
            onClick={() => {
              guide.complete('ekspor');
              flash('respons.csv diunduh (simulasi).');
            }}
          >
            <Download aria-hidden /> Ekspor CSV
          </Btn>
        }
      />
      <TabBar
        label="Tampilan respons"
        tabs={TABS}
        value={tab}
        onChange={(next) => {
          setTab(next);
          if (next === 'tabel') guide.complete('tabel');
        }}
        spot={(id) => (id === 'tabel' ? guide.spot('tabel') : '')}
      />

      {tab === 'ringkasan' ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-neutral-400 p-3">
            <p className="font-semibold">1. Apakah Anda pernah menjadi panitia?</p>
            <p className="text-xs text-neutral-700">{total} jawaban</p>
            <ul className="mt-2 space-y-1.5">
              {(
                [
                  ['Ya', yes],
                  ['Tidak', total - yes],
                ] as const
              ).map(([label, count]) => {
                const percent = Math.round((count / total) * 100);
                return (
                  <li key={label} className="flex items-center gap-2 text-xs">
                    <span className="w-10 font-semibold">{label}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
                      <span
                        className="block h-full rounded-full bg-primary-400"
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                    <span className="w-20 text-right text-neutral-700">
                      {count} · {percent}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="rounded-lg border border-neutral-400 p-3">
            <p className="font-semibold">
              2. Ceritakan pengalaman kepanitiaan Anda
            </p>
            <p className="text-xs text-neutral-700">
              {yes} jawaban. Pertanyaan ini hanya tampil bagi yang menjawab Ya.
            </p>
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-neutral-800">
              {RESPONSES.filter((row) => row.cerita).map((row) => (
                <li key={row.id}>{row.cerita}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-neutral-400 p-3">
            <p className="font-semibold">3. Seberapa siap Anda berkomitmen?</p>
            <dl className="mt-2 flex flex-wrap gap-6 text-xs">
              {(
                [
                  ['Rata-rata', average.toFixed(1)],
                  ['Terendah', Math.min(...scores)],
                  ['Tertinggi', Math.max(...scores)],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-neutral-700">{label}</dt>
                  <dd className="text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-400">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Waktu kirim</th>
                <th className={thClass}>Nama</th>
                <th className={thClass}>NIM</th>
                <th className={thClass}>Pernah panitia</th>
                <th className={thClass}>Kesiapan</th>
              </tr>
            </thead>
            <tbody>
              {RESPONSES.map((row, index) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() => open(row.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') open(row.id);
                  }}
                  className={cn(
                    'cursor-pointer hover:bg-primary-100 focus-visible:bg-primary-100 focus-visible:outline-none',
                    index === 0 && guide.spot('detail'),
                  )}
                >
                  <td className={cn(tdClass, 'whitespace-nowrap text-xs')}>
                    {row.sentAt}
                  </td>
                  <td className={cn(tdClass, 'font-semibold')}>{row.name}</td>
                  <td className={tdClass}>{row.nim}</td>
                  <td className={tdClass}>{row.pernah}</td>
                  <td className={tdClass}>{row.siap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {opened ? (
        <Modal
          title={opened.name}
          description={`NIM ${opened.nim} · ${opened.sentAt}`}
          onClose={() => setOpenId(null)}
          footer={
            <Btn tone="outline" onClick={() => setOpenId(null)}>
              Tutup
            </Btn>
          }
        >
          <dl className="space-y-2">
            <div>
              <dt className="text-xs font-semibold text-neutral-700">
                Apakah Anda pernah menjadi panitia?
              </dt>
              <dd>{opened.pernah}</dd>
            </div>
            {opened.cerita ? (
              <div>
                <dt className="text-xs font-semibold text-neutral-700">
                  Ceritakan pengalaman kepanitiaan Anda
                </dt>
                <dd>{opened.cerita}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-semibold text-neutral-700">
                Seberapa siap Anda berkomitmen?
              </dt>
              <dd>{opened.siap} dari 5</dd>
            </div>
          </dl>
        </Modal>
      ) : null}
      {node}
    </div>
  );
}
