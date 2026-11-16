'use client';

// Library Import
import { ArrowDown, ArrowUp, Lock, Plus, Trash2, Unlock } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import { Btn, Field, inputClass, Pill, Toggle } from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'skema',
    title: 'Pada **Skema siap pakai**, klik **Himpunan**',
    hint: 'Nama level berlaku per kedalaman. Lihat contoh di sebelah kanan ikut berubah.',
  },
  {
    id: 'level',
    title: 'Ubah nama salah satu level agar sesuai istilah lembaga Anda',
  },
  {
    id: 'rank',
    title: 'Klik **Tambah rank**, lalu beri nama **Sekretaris**',
  },
  {
    id: 'urut',
    title: 'Klik **Lebih senior** pada rank itu sampai berada tepat di bawah Wakil',
    hint: 'Urutan rank menentukan urutan jabatan di dalam satu bagian.',
  },
  {
    id: 'kunci',
    title: 'Nyalakan **Kunci edit**',
    hint: 'Anggota yang ditempatkan tidak bisa mengubah organogram saat dikunci. Pemilik dan admin tidak terpengaruh.',
  },
];

const PRESETS = [
  { name: 'Kepanitiaan ITB', labels: ['Bidang', 'Divisi', 'Subdivisi'] },
  { name: 'Himpunan', labels: ['Departemen', 'Divisi', 'Unit Kerja'] },
  { name: 'Kabinet KM', labels: ['Kemenkoan', 'Kementerian', 'Kedirjenan', 'Biro'] },
];

const SAMPLE_NAMES = ['Operasional', 'Acara', 'Rundown', 'Panggung'];
const DEFAULT_RANKS = ['Kepala', 'Wakil', 'Koordinator', 'Staf'];
const MAX_LEVELS = 4;

type Rank = { id: number; label: string };

export default function OrganogramPengaturanDemo() {
  return (
    <DemoFrame
      title="Pengaturan organogram"
      location="Lembaga › Organogram › Festival Karya 2026 › tab Pengaturan"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [name, setName] = useState('Organogram Festival Karya 2026');
  const [levels, setLevels] = useState(PRESETS[0]!.labels);
  const [ranks, setRanks] = useState<Rank[]>(
    DEFAULT_RANKS.map((label, id) => ({ id, label })),
  );
  const [counter, setCounter] = useState(10);
  const [locked, setLocked] = useState(false);

  const checkOrder = (next: Rank[]) => {
    const wakil = next.findIndex((rank) => rank.label === 'Wakil');
    const sekretaris = next.findIndex(
      (rank) => rank.label.trim().toLowerCase() === 'sekretaris',
    );
    if (sekretaris !== -1) guide.complete('rank');
    if (wakil !== -1 && sekretaris === wakil + 1) guide.complete('urut');
  };

  const moveRank = (index: number, delta: number) => {
    const next = [...ranks];
    const item = next[index];
    const other = next[index + delta];
    if (!item || !other) return;
    next[index] = other;
    next[index + delta] = item;
    setRanks(next);
    checkOrder(next);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_200px]">
      <div className="space-y-4">
        <Field label="Nama organogram">
          {(id) => (
            <input
              id={id}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          )}
        </Field>

        <section aria-label="Nama level">
          <p className="text-xs font-semibold text-neutral-800">Nama level</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-neutral-700">Skema siap pakai:</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setLevels(preset.labels);
                  if (preset.name === 'Himpunan') guide.complete('skema');
                }}
                className={cn(
                  'rounded-full border border-neutral-400 px-2.5 py-0.5 text-xs font-semibold hover:border-primary-400 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  preset.name === 'Himpunan' && guide.spot('skema'),
                )}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <ol className={cn('mt-2 space-y-1.5', guide.spot('level'))}>
            {levels.map((label, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs text-neutral-700">
                  Level {index + 1}
                </span>
                <input
                  aria-label={`Nama level ${index + 1}`}
                  value={label}
                  placeholder="Bagian"
                  onChange={(event) => {
                    setLevels((prev) =>
                      prev.map((item, i) =>
                        i === index ? event.target.value : item,
                      ),
                    );
                    guide.complete('level');
                  }}
                  className={cn(inputClass, 'h-8')}
                />
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn
              small
              tone="ghost"
              disabled={levels.length >= MAX_LEVELS}
              onClick={() => setLevels((prev) => [...prev, ''])}
            >
              <Plus aria-hidden /> Tambah level
            </Btn>
            <Btn
              small
              tone="ghost"
              disabled={levels.length <= 1}
              onClick={() => setLevels((prev) => prev.slice(0, -1))}
            >
              Hapus level terakhir
            </Btn>
          </div>
          <p className="mt-1 text-xs text-neutral-700">
            Kolom yang dikosongkan memakai sebutan bawaan, yaitu Bagian.
          </p>
        </section>

        <section aria-label="Rank jabatan">
          <p className="text-xs font-semibold text-neutral-800">Rank jabatan</p>
          <p className="text-xs text-neutral-700">
            Dari yang paling senior (atas) ke yang paling junior (bawah).
          </p>
          <ol className="mt-2 space-y-1.5">
            {ranks.map((rank, index) => {
              const isDefault = rank.id < DEFAULT_RANKS.length;
              return (
                <li key={rank.id} className="flex items-center gap-1.5">
                  <input
                    aria-label={`Nama rank urutan ${index + 1}`}
                    value={rank.label}
                    placeholder="Rank baru"
                    onChange={(event) => {
                      const next = ranks.map((item) =>
                        item.id === rank.id
                          ? { ...item, label: event.target.value }
                          : item,
                      );
                      setRanks(next);
                      checkOrder(next);
                    }}
                    className={cn(
                      inputClass,
                      'h-8',
                      !isDefault && guide.spot('rank'),
                    )}
                  />
                  <Btn
                    small
                    tone="ghost"
                    title="Lebih senior"
                    aria-label={`Lebih senior: ${rank.label}`}
                    disabled={index === 0}
                    className={!isDefault ? guide.spot('urut') : ''}
                    onClick={() => moveRank(index, -1)}
                  >
                    <ArrowUp aria-hidden />
                  </Btn>
                  <Btn
                    small
                    tone="ghost"
                    title="Lebih junior"
                    aria-label={`Lebih junior: ${rank.label}`}
                    disabled={index === ranks.length - 1}
                    onClick={() => moveRank(index, 1)}
                  >
                    <ArrowDown aria-hidden />
                  </Btn>
                  <Btn
                    small
                    tone="ghost"
                    title={isDefault ? 'Masih dipakai jabatan' : 'Hapus rank'}
                    aria-label={`Hapus rank ${rank.label}`}
                    disabled={isDefault}
                    onClick={() =>
                      setRanks((prev) =>
                        prev.filter((item) => item.id !== rank.id),
                      )
                    }
                  >
                    <Trash2 aria-hidden />
                  </Btn>
                </li>
              );
            })}
          </ol>
          <Btn
            small
            tone="outline"
            className={cn('mt-2', guide.spot('rank'))}
            onClick={() => {
              setRanks((prev) => [...prev, { id: counter, label: '' }]);
              setCounter((value) => value + 1);
            }}
          >
            <Plus aria-hidden /> Tambah rank
          </Btn>
        </section>

        <section aria-label="Kunci edit">
          <p className="text-xs font-semibold text-neutral-800">Kunci edit</p>
          <Toggle
            label={locked ? 'Terkunci' : 'Tidak terkunci'}
            checked={locked}
            onChange={(next) => {
              setLocked(next);
              if (next) guide.complete('kunci');
            }}
            className={cn('mt-1', guide.spot('kunci'))}
          />
        </section>
      </div>

      <aside className="h-fit rounded-lg border border-dashed border-secondary-400 bg-secondary-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-800">
          Hasilnya di organogram
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs font-semibold">
          {locked ? (
            <Lock className="size-3.5" aria-hidden />
          ) : (
            <Unlock className="size-3.5" aria-hidden />
          )}
          {name || 'Tanpa nama'}
        </p>
        <ul className="mt-2 space-y-1">
          {levels.map((label, index) => (
            <li
              key={index}
              style={{ marginLeft: index * 10 }}
              className="rounded-md border border-neutral-400 bg-white px-2 py-1"
            >
              <span className="block text-[9px] font-semibold uppercase tracking-wide text-secondary-800">
                {label || 'Bagian'}
              </span>
              <span className="block text-xs font-semibold">
                {SAMPLE_NAMES[index]}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs font-semibold text-neutral-700">
          Urutan jabatan
        </p>
        <ol className="mt-1 flex flex-wrap gap-1">
          {ranks
            .filter((rank) => rank.label.trim() !== '')
            .map((rank) => (
              <li key={rank.id}>
                <Pill tone="info">{rank.label}</Pill>
              </li>
            ))}
        </ol>
        {locked ? (
          <p className="mt-3 text-xs text-neutral-800">
            Organogram sedang dikunci. Anggota hanya dapat melihatnya.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
