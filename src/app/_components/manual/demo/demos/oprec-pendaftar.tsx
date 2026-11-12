'use client';

// Library Import
import { Download, Search } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { DEMO_DIVISIONS, divisionName } from '../data';
import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import {
  Btn,
  Empty,
  inputClass,
  Modal,
  Pill,
  ScreenTitle,
  TabBar,
  tdClass,
  thClass,
  useFlash,
} from '../ui';
import {
  APPLICANTS,
  type ChoiceStatus,
  STATUS_LABEL,
  STATUS_TONE,
} from './oprec-data';

const STEPS: DemoStep[] = [
  {
    id: 'ringkasan',
    title: 'Klik batang **Acara** pada ringkasan **Per pilihan**',
    hint: 'Tabel langsung tersaring ke pendaftar yang memilih Acara di pilihan mana pun.',
  },
  {
    id: 'status',
    title: 'Ubah saringan **Status pilihan** menjadi **Lolos**',
  },
  {
    id: 'berkas',
    title: 'Klik satu baris pendaftar untuk membuka berkasnya',
    hint: 'Berkas memuat jawaban formulir, pilihan, dan status tiap pilihan.',
  },
  { id: 'ekspor', title: 'Tutup berkas, lalu klik **Ekspor CSV**' },
];

const TABS = [
  ['pendaftar', 'Pendaftar'],
  ['penempatan', 'Penempatan'],
  ['nilai', 'Nilai'],
  ['hasil', 'Hasil'],
] as const;

export default function OprecPendaftarDemo() {
  return (
    <DemoFrame
      title="Daftar pendaftar oprec"
      location="Lembaga › Oprec › Festival Karya 2026 › Pendaftar"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [query, setQuery] = useState('');
  const [division, setDivision] = useState('');
  const [status, setStatus] = useState<ChoiceStatus | ''>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const { flash, node } = useFlash();

  const rows = APPLICANTS.filter((row) => {
    const q = query.trim().toLowerCase();
    if (q && !row.name.toLowerCase().includes(q) && !row.nim.includes(q)) {
      return false;
    }
    const scoped = division
      ? row.choices.filter((choice) => choice.division === division)
      : row.choices;
    if (division && scoped.length === 0) return false;
    return status === '' || scoped.some((choice) => choice.status === status);
  });

  const counts = DEMO_DIVISIONS.map((item) => ({
    ...item,
    count: APPLICANTS.filter((row) =>
      row.choices.some((choice) => choice.division === item.id),
    ).length,
  }));
  const peak = Math.max(...counts.map((item) => item.count));
  const opened = APPLICANTS.find((row) => row.id === openId);

  return (
    <div>
      <ScreenTitle
        title="Oprec Festival Karya 2026"
        subtitle="Klik baris untuk membuka berkasnya."
        actions={
          <Btn
            small
            tone="outline"
            className={guide.spot('ekspor')}
            onClick={() => {
              guide.complete('ekspor');
              flash('pendaftar.csv diunduh (simulasi).');
            }}
          >
            <Download aria-hidden /> Ekspor CSV
          </Btn>
        }
      />
      <TabBar
        label="Bagian oprec"
        tabs={TABS}
        value="pendaftar"
        onChange={() => flash('Tab lain dijelaskan di halaman manual berikutnya.')}
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr]">
        <div className="rounded-lg border border-neutral-400 p-3">
          <p className="text-xs text-neutral-700">Total pendaftar</p>
          <p className="text-2xl font-semibold">{APPLICANTS.length}</p>
          <p className="mt-1 text-xs text-neutral-700">
            Gelombang 1: 3 · Gelombang 2: 3
          </p>
        </div>
        <div className="rounded-lg border border-neutral-400 p-3">
          <p className="text-xs font-semibold text-neutral-700">Per pilihan</p>
          <ul className="mt-2 space-y-1.5">
            {counts.map((item) => {
              const active = division === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    title={
                      active
                        ? 'Hapus saringan tujuan ini'
                        : 'Saring tabel ke tujuan ini'
                    }
                    onClick={() => {
                      setDivision(active ? '' : item.id);
                      if (item.id === 'acara') guide.complete('ringkasan');
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                      active ? 'bg-primary-100' : 'hover:bg-neutral-100',
                      item.id === 'acara' && guide.spot('ringkasan'),
                    )}
                  >
                    <span className="w-20 shrink-0 font-semibold">
                      {item.name}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
                      <span
                        className="block h-full rounded-full bg-primary-400"
                        style={{ width: `${(item.count / peak) * 100}%` }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right text-neutral-700">
                      {item.count} · kuota {item.quota}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div
        role="search"
        aria-label="Saringan pendaftar"
        className="mt-3 flex flex-wrap gap-2"
      >
        <div className="relative min-w-40 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-neutral-600"
            aria-hidden
          />
          <input
            aria-label="Cari nama atau NIM"
            placeholder="Cari nama atau NIM"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={cn(inputClass, 'pl-8')}
          />
        </div>
        <select
          aria-label="Tujuan"
          value={division}
          onChange={(event) => setDivision(event.target.value)}
          className={cn(inputClass, 'w-36')}
        >
          <option value="">Semua tujuan</option>
          {DEMO_DIVISIONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Status pilihan"
          value={status}
          onChange={(event) => {
            const value = event.target.value as ChoiceStatus | '';
            setStatus(value);
            if (value === 'lolos') guide.complete('status');
          }}
          className={cn(inputClass, 'w-40', guide.spot('status'))}
        >
          <option value="">Semua status</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-400">
        <table className="w-full min-w-[560px] border-collapse">
          <caption className="sr-only">Daftar pendaftar</caption>
          <thead>
            <tr>
              <th className={thClass}>Pendaftar</th>
              <th className={thClass}>Gelombang</th>
              <th className={thClass}>Pilihan 1</th>
              <th className={thClass}>Pilihan 2</th>
              <th className={thClass}>Flag</th>
              <th className={thClass}>Dikirim</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id}
                tabIndex={0}
                onClick={() => {
                  setOpenId(row.id);
                  guide.complete('berkas');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    setOpenId(row.id);
                    guide.complete('berkas');
                  }
                }}
                className={cn(
                  'cursor-pointer hover:bg-primary-100 focus-visible:bg-primary-100 focus-visible:outline-none',
                  index === 0 && guide.spot('berkas'),
                )}
              >
                <td className={tdClass}>
                  <span className="block font-semibold">{row.name}</span>
                  <span className="text-xs text-neutral-700">
                    {row.nim} · {row.angkatan}
                  </span>
                </td>
                <td className={tdClass}>{row.wave}</td>
                {row.choices.map((choice) => (
                  <td key={choice.division} className={tdClass}>
                    <span className="block text-xs">
                      {divisionName(choice.division)}
                    </span>
                    <Pill tone={STATUS_TONE[choice.status]}>
                      {STATUS_LABEL[choice.status]}
                    </Pill>
                  </td>
                ))}
                <td className={tdClass}>
                  {row.flag ? <Pill tone="teal">{row.flag}</Pill> : '—'}
                </td>
                <td className={cn(tdClass, 'whitespace-nowrap text-xs')}>
                  {row.sentAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div className="p-3">
            <Empty>Tidak ada pendaftar yang cocok dengan saringan.</Empty>
          </div>
        ) : null}
      </div>

      {opened ? (
        <Modal
          wide
          title="Berkas pendaftar"
          description={`NIM ${opened.nim} · Angkatan ${opened.angkatan} · ${opened.prodi}`}
          onClose={() => setOpenId(null)}
          footer={
            <Btn tone="outline" onClick={() => setOpenId(null)}>
              Tutup
            </Btn>
          }
        >
          <p className="text-base font-semibold">{opened.name}</p>
          <p className="text-xs text-neutral-700">
            Gelombang {opened.wave}
            {opened.willing ? ' · Bersedia dipindahkan' : ''}
          </p>
          <div>
            <p className="text-xs font-semibold text-neutral-700">
              Pilihan dan status
            </p>
            <ul className="mt-1 space-y-1">
              {opened.choices.map((choice, index) => (
                <li key={choice.division} className="flex items-center gap-2">
                  <span className="w-16 text-xs text-neutral-700">
                    Pilihan {index + 1}
                  </span>
                  <span className="flex-1 font-semibold">
                    {divisionName(choice.division)}
                  </span>
                  <span className="text-xs text-neutral-700">
                    {choice.score === null ? 'Belum dinilai' : `Skor ${choice.score}`}
                  </span>
                  <Pill tone={STATUS_TONE[choice.status]}>
                    {STATUS_LABEL[choice.status]}
                  </Pill>
                </li>
              ))}
            </ul>
          </div>
          <dl className="space-y-2">
            {opened.answers.map(([question, answer]) => (
              <div key={question}>
                <dt className="text-xs font-semibold text-neutral-700">
                  {question}
                </dt>
                <dd>{answer}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      ) : null}
      {node}
    </div>
  );
}
