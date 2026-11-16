'use client';

// Library Import
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { DEMO_DIVISIONS, DEMO_EVENT } from '../data';
import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import { Btn, Field, inputClass, Pill } from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'preset',
    title: 'Pilih preset **Kepanitiaan besar**',
    hint: 'Preset hanya mengisi pengaturan awal. Semuanya masih bisa diubah di langkah berikutnya.',
  },
  {
    id: 'nama',
    title: 'Beri nama oprec, lalu klik **Lanjut**',
  },
  {
    id: 'tujuan',
    title: 'Centang minimal dua divisi yang dibuka, lalu klik **Lanjut**',
    hint: 'Kuota tiap divisi diambil dari kuota jabatan di organogram.',
  },
  {
    id: 'pilihan',
    title: 'Tentukan jumlah pilihan divisi, lalu klik **Lanjut**',
  },
  {
    id: 'ringkasan',
    title: 'Klik **Periksa ringkasan**',
    hint: 'Sisa pertanyaan dilewati dengan jawaban bawaan dari preset.',
  },
  { id: 'buat', title: 'Periksa ringkasan, lalu klik **Buat oprec**' },
  {
    id: 'buka',
    title: 'Klik **Terbitkan formulir dan buka pendaftaran**',
    hint: 'Sebelum ini oprec masih berstatus draf dan belum bisa diisi pendaftar.',
  },
];

type Preset = {
  id: 'besar' | 'ami' | 'himpunan';
  title: string;
  example: string;
  blurb: string;
  highlights: string[];
  maxChoices: number;
  attachments: string[];
  rubrics: string;
  assessors: string;
};

const PRESETS: Preset[] = [
  {
    id: 'besar',
    title: 'Kepanitiaan besar',
    example: 'OSKM, KAT',
    blurb:
      'Banyak divisi, pendaftaran bergelombang, penilaian ketua divisi dan penilai umum.',
    highlights: ['3 pilihan', 'bergelombang', 'rubrik umum + divisi'],
    maxChoices: 3,
    attachments: ['CV', 'Portofolio', 'Surat izin'],
    rubrics: 'Umum dan per tujuan',
    assessors: 'Penilai umum dan ketua divisi',
  },
  {
    id: 'ami',
    title: 'Acara dengan penilai ketua divisi',
    example: 'AMI',
    blurb:
      'Satu hingga dua pilihan divisi, rubrik per divisi, tanpa gelombang pendaftaran.',
    highlights: ['2 pilihan', 'tanpa gelombang', 'rubrik divisi'],
    maxChoices: 2,
    attachments: ['CV'],
    rubrics: 'Hanya per tujuan',
    assessors: 'Ketua divisi',
  },
  {
    id: 'himpunan',
    title: 'Staf himpunan atau badan',
    example: 'Himpunan, UKM',
    blurb: 'Satu pilihan, rubrik umum, keputusan cepat untuk oprec kecil.',
    highlights: ['1 pilihan', 'tanpa gelombang', 'rubrik umum'],
    maxChoices: 1,
    attachments: ['CV', 'Transkrip'],
    rubrics: 'Hanya umum',
    assessors: 'Ketua divisi',
  },
];

const ATTACHMENTS = ['Twibbon', 'Portofolio', 'CV', 'Transkrip', 'Surat izin'];
const WIZARD = ['nama', 'tujuan', 'pilihan', 'lampiran'] as const;
type WizardStep = (typeof WIZARD)[number];
type Screen = 'preset' | WizardStep | 'ringkasan' | 'selesai';

const GROUP: Record<WizardStep, string> = {
  nama: 'Dasar',
  tujuan: 'Dasar',
  pilihan: 'Isi form',
  lampiran: 'Isi form',
};

export default function OprecSetupDemo() {
  return (
    <DemoFrame
      title="Setup oprec"
      location="Lembaga › Oprec › Festival Karya 2026 › Buat oprec"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [screen, setScreen] = useState<Screen>('preset');
  const [preset, setPreset] = useState<Preset | null>(null);
  const [name, setName] = useState(`Oprec ${DEMO_EVENT}`);
  const [open, setOpen] = useState<string[]>([]);
  const [maxChoices, setMaxChoices] = useState(3);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [opened, setOpened] = useState(false);

  const pickPreset = (next: Preset | null) => {
    setPreset(next);
    if (next) {
      setMaxChoices(next.maxChoices);
      setAttachments(next.attachments);
      if (next.id === 'besar') guide.complete('preset');
    }
    setScreen('nama');
  };

  const index = WIZARD.indexOf(screen as WizardStep);
  const problem =
    screen === 'nama' && name.trim() === ''
      ? 'Beri nama oprec ini.'
      : screen === 'tujuan' && open.length === 0
        ? 'Pilih minimal satu divisi.'
        : screen === 'pilihan' && maxChoices > Math.max(open.length, 1)
          ? `Jumlah pilihan melebihi jumlah divisi yang dibuka (${open.length}).`
          : null;

  // Ringkasan baru boleh dibuka bila isian wajib di semua langkah sudah sah.
  const canSummarize =
    name.trim() !== '' && open.length > 0 && maxChoices <= open.length;

  const next = () => {
    if (problem) return;
    if (screen === 'nama') guide.complete('nama');
    if (screen === 'tujuan') guide.complete('tujuan');
    if (screen === 'pilihan') guide.complete('pilihan');
    const following = WIZARD[index + 1];
    setScreen(following ?? 'ringkasan');
    if (!following) guide.complete('ringkasan');
  };

  if (screen === 'preset') {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
          Setup oprec
        </p>
        <p className="mt-1 text-lg font-semibold">Mulai dari mana?</p>
        <p className="mt-1 text-neutral-700">
          Pilih preset yang paling dekat dengan oprec ini.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pickPreset(item)}
              className={cn(
                'flex flex-col items-start rounded-lg border border-neutral-400 p-3 text-left transition-colors hover:border-primary-400 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                item.id === 'besar' && guide.spot('preset'),
              )}
            >
              <p className="font-semibold">{item.title}</p>
              <p className="text-xs text-neutral-700">{item.example}</p>
              <p className="mt-2 text-xs text-neutral-800">{item.blurb}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {item.highlights.map((text) => (
                  <Pill key={text} tone="info">
                    {text}
                  </Pill>
                ))}
              </div>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => pickPreset(null)}
          className="mt-3 w-full rounded-lg border border-dashed border-neutral-400 p-3 text-left hover:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <p className="font-semibold">Atur sendiri</p>
          <p className="text-xs text-neutral-700">
            Mulai dari bawaan dan jawab semua pertanyaan satu per satu.
          </p>
        </button>
      </div>
    );
  }

  if (screen === 'selesai') {
    return (
      <div className="mx-auto max-w-md py-6 text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-success-light text-success-dark">
          <Check className="size-5" aria-hidden />
        </span>
        <p className="mt-3 text-lg font-semibold">Oprec sudah dibuat</p>
        <p className="mt-1 text-neutral-700">
          {opened
            ? 'Formulir terbit dan pendaftaran dibuka.'
            : 'Statusnya draf. Lengkapi formulir bila perlu, lalu buka pendaftaran.'}
        </p>
        <div className="mt-2">
          <Pill tone={opened ? 'success' : 'neutral'}>
            {opened ? 'Dibuka' : 'Draf'}
          </Pill>
        </div>
        <div className="mt-4 flex flex-col items-stretch gap-2">
          {opened ? (
            <Btn>Lihat pendaftar</Btn>
          ) : (
            <Btn
              tone="teal"
              className={guide.spot('buka')}
              onClick={() => {
                setOpened(true);
                guide.complete('buka');
              }}
            >
              Terbitkan formulir dan buka pendaftaran
            </Btn>
          )}
          <Btn tone="outline">Buka pembuat formulir</Btn>
        </div>
      </div>
    );
  }

  if (screen === 'ringkasan') {
    const rows: [string, string][] = [
      ['Nama dan periode', `${name} · ${DEMO_EVENT}`],
      [
        'Bidang atau divisi yang dibuka',
        `${open.length} dipilih: ${DEMO_DIVISIONS.filter((d) => open.includes(d.id))
          .map((d) => d.name)
          .join(', ')}`,
      ],
      ['Jumlah pilihan divisi', maxChoices === 1 ? '1 pilihan' : `1–${maxChoices} pilihan`],
      ['Lampiran wajib', attachments.length ? attachments.join(', ') : 'Tanpa lampiran'],
      ['Rubrik penilaian', preset?.rubrics ?? 'Umum dan per tujuan'],
      ['Cara memutuskan', 'Dinilai dengan skor'],
      ['Penilai', preset?.assessors ?? 'Ketua divisi'],
      ['Rilis ke pendaftar', 'Ya, saat admin merilis'],
    ];
    return (
      <div>
        <p className="text-lg font-semibold">Periksa dulu sebelum dibuat</p>
        <p className="mt-1 text-neutral-700">
          Oprec dibuat berstatus draf. Pendaftaran baru dibuka setelah formulir
          terbit dan Anda membukanya.
        </p>
        <dl className="mt-3 divide-y divide-neutral-300 rounded-lg border border-neutral-400">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-wrap gap-x-4 px-3 py-2">
              <dt className="w-52 shrink-0 text-xs font-semibold text-neutral-700">
                {label}
              </dt>
              <dd className="min-w-0 flex-1">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex justify-between gap-2">
          <Btn tone="ghost" onClick={() => setScreen('lampiran')}>
            <ArrowLeft aria-hidden /> Kembali
          </Btn>
          <Btn
            className={guide.spot('buat')}
            onClick={() => {
              guide.complete('buat');
              setScreen('selesai');
            }}
          >
            <Check aria-hidden /> Buat oprec
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-700">
        <span className="font-semibold text-primary-400">{GROUP[screen]}</span>
        <span>
          Langkah {index + 1} dari {WIZARD.length}
        </span>
        <button
          type="button"
          onClick={() => setScreen('preset')}
          className="ml-auto font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          Ganti preset
        </button>
      </div>
      <div
        role="progressbar"
        aria-label="Kemajuan setup"
        aria-valuenow={Math.round(((index + 1) / WIZARD.length) * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200"
      >
        <div
          className="h-full rounded-full bg-secondary-400 transition-all"
          style={{ width: `${((index + 1) / WIZARD.length) * 100}%` }}
        />
      </div>

      <div className="mt-4 min-h-[190px]">
        {screen === 'nama' ? (
          <>
            <p className="text-lg font-semibold">
              Oprec ini untuk periode yang mana?
            </p>
            <p className="mt-1 text-neutral-700">
              Oprec dimiliki satu periode. Beri nama supaya mudah dikenali.
            </p>
            <p className="mt-3 text-xs text-neutral-700">
              Periode: <strong>{DEMO_EVENT}</strong>
            </p>
            <Field label="Nama oprec" className="mt-2 max-w-sm">
              {(id) => (
                <input
                  id={id}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={cn(inputClass, guide.spot('nama'))}
                />
              )}
            </Field>
          </>
        ) : null}

        {screen === 'tujuan' ? (
          <>
            <p className="text-lg font-semibold">
              Bidang atau Divisi mana yang dibuka?
            </p>
            <p className="mt-1 text-neutral-700">
              Centang tujuan yang menerima staf. Kuota diambil dari kuota
              jabatan di organogram.
            </p>
            <ul
              className={cn(
                'mt-3 divide-y divide-neutral-300 rounded-lg border border-neutral-400',
                guide.spot('tujuan'),
              )}
            >
              {DEMO_DIVISIONS.map((division) => {
                const picked = open.includes(division.id);
                return (
                  <li key={division.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-3 py-2',
                        picked && 'bg-primary-100',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={picked}
                        onChange={() =>
                          setOpen((prev) =>
                            picked
                              ? prev.filter((id) => id !== division.id)
                              : [...prev, division.id],
                          )
                        }
                        className="size-4 accent-[#2B6282]"
                      />
                      <span className="flex-1 font-medium">
                        Divisi {division.name}
                      </span>
                      <span className="text-xs text-neutral-700">
                        Staf · kuota {division.quota}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {screen === 'pilihan' ? (
          <>
            <p className="text-lg font-semibold">
              Pendaftar boleh memilih berapa divisi?
            </p>
            <p className="mt-1 text-neutral-700">
              Menentukan jumlah pilihan di formulir: pilihan 1, 2, 3, dan
              seterusnya.
            </p>
            <div
              role="radiogroup"
              aria-label="Jumlah pilihan"
              className={cn('mt-3 flex flex-wrap gap-2', guide.spot('pilihan'))}
            >
              {[1, 2, 3].map((count) => (
                <button
                  key={count}
                  type="button"
                  role="radio"
                  aria-checked={maxChoices === count}
                  onClick={() => setMaxChoices(count)}
                  className={cn(
                    'rounded-lg border px-4 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                    maxChoices === count
                      ? 'border-primary-400 bg-primary-100 text-primary-400'
                      : 'border-neutral-400 hover:border-primary-400',
                  )}
                >
                  {count === 1 ? '1' : `1-${count}`}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-700">
              Hanya {open.length} divisi yang dibuka.
            </p>
          </>
        ) : null}

        {screen === 'lampiran' ? (
          <>
            <p className="text-lg font-semibold">
              Persyaratan umum apa yang perlu dilampirkan?
            </p>
            <p className="mt-1 text-neutral-700">
              Setiap lampiran menjadi kolom tautan wajib di formulir (Google
              Drive, OneDrive, dan sejenisnya), bukan unggahan ke server.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ATTACHMENTS.map((item) => {
                const picked = attachments.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={picked}
                    onClick={() =>
                      setAttachments((prev) =>
                        picked ? prev.filter((x) => x !== item) : [...prev, item],
                      )
                    }
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                      picked
                        ? 'border-primary-400 bg-primary-400 text-white'
                        : 'border-neutral-400 hover:border-primary-400',
                    )}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-neutral-700">
              Tanpa lampiran bila tidak ada yang dipilih.
            </p>
          </>
        ) : null}
      </div>

      {problem ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-danger-dark">
          {problem}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-neutral-300 pt-3">
        <Btn
          tone="ghost"
          onClick={() => setScreen(WIZARD[index - 1] ?? 'preset')}
        >
          <ArrowLeft aria-hidden /> Kembali
        </Btn>
        <div className="flex flex-wrap gap-2">
          <Btn
            tone="outline"
            disabled={!canSummarize}
            title="Lewati sisa pertanyaan dengan jawaban bawaan dan periksa ringkasan"
            className={guide.spot('ringkasan')}
            onClick={() => {
              guide.complete('ringkasan');
              setScreen('ringkasan');
            }}
          >
            Periksa ringkasan
          </Btn>
          <Btn
            disabled={problem !== null}
            className={guide.spot('nama', 'tujuan', 'pilihan')}
            onClick={next}
          >
            Lanjut <ArrowRight aria-hidden />
          </Btn>
        </div>
      </div>
    </div>
  );
}
