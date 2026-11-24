'use client';

// Bagian kecil yang dipakai ulang oleh simulasi manual. Di sini dipakai untuk
// meniru layar wizard setup oprec: pilih preset, empat pertanyaan kunci, dan
// ringkasan sebelum oprec dibuat. Semua state palsu, tanpa server.
// Library Import
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '~/lib/utils';

import { DEMO_DIVISIONS, DEMO_EVENT } from '../data';
import { DemoFrame, type DemoGuide, type DemoStep } from '../demo-frame';
import { Btn, Pill } from '../ui';

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
    id: 'penilai',
    title: 'Tentukan penilai, lalu klik **Periksa ringkasan**',
    hint: 'Pilih salah satu. Bisa diubah lagi nanti lewat tab Pengaturan.',
  },
  {
    id: 'buat',
    title: 'Periksa ringkasan, lalu klik **Buat oprec**',
  },
  {
    id: 'buka',
    title: 'Klik **Terbitkan formulir dan buka pendaftaran**',
    hint: 'Sebelum ini oprec masih berstatus draf dan belum bisa diisi pendaftar.',
  },
];

// Preset hasil salinan presets.ts; cukup bagian yang dipakai di demo.
type Rubrics = 'keduanya' | 'divisi' | 'umum';
type Assessors = 'ketua' | 'umum' | 'keduanya';
type PresetId = 'besar' | 'ami' | 'himpunan';

type Preset = {
  id: PresetId;
  title: string;
  example: string;
  blurb: string;
  maxChoices: number;
  useWaves: boolean;
  rubrics: Rubrics;
  assessors: 'ketua' | 'keduanya';
};

const PRESETS: Preset[] = [
  {
    id: 'besar',
    title: 'Kepanitiaan besar',
    example: 'OSKM, KAT',
    blurb:
      'Banyak divisi, pendaftaran bergelombang, penilaian ketua divisi dan penilai umum.',
    maxChoices: 3,
    useWaves: true,
    rubrics: 'keduanya',
    assessors: 'keduanya',
  },
  {
    id: 'ami',
    title: 'Acara dengan penilai ketua divisi',
    example: 'AMI',
    blurb:
      'Satu hingga dua pilihan divisi, rubrik per divisi, penempatan prioritas, tanpa gelombang pendaftaran.',
    maxChoices: 2,
    useWaves: false,
    rubrics: 'divisi',
    assessors: 'ketua',
  },
  {
    id: 'himpunan',
    title: 'Staf himpunan atau badan',
    example: 'Himpunan, UKM',
    blurb: 'Satu pilihan, rubrik umum, keputusan cepat untuk oprec kecil.',
    maxChoices: 1,
    useWaves: false,
    rubrics: 'umum',
    assessors: 'ketua',
  },
];

function presetHighlights(preset: Preset): string[] {
  return [
    preset.maxChoices === 1 ? '1 pilihan' : `${preset.maxChoices} pilihan`,
    preset.useWaves ? 'bergelombang' : 'tanpa gelombang',
    preset.rubrics === 'keduanya'
      ? 'rubrik umum + divisi'
      : preset.rubrics === 'divisi'
        ? 'rubrik divisi'
        : 'rubrik umum',
    preset.assessors === 'keduanya'
      ? 'pengurus divisi + penilai umum'
      : 'pengurus divisi',
  ];
}

const FIELD_CLASS =
  'h-9 w-full rounded-lg border border-neutral-400 bg-neutral-50 px-3 text-sm text-neutral-1000 placeholder:text-neutral-500 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50';

const ASSESSOR_LABEL: Record<Assessors, string> = {
  ketua: 'Pengurus divisi',
  umum: 'Penilai umum',
  keduanya: 'Penilai umum dan pengurus divisi',
};

const RUBRIC_LABEL: Record<Rubrics, string> = {
  keduanya: 'Umum dan per tujuan',
  divisi: 'Hanya per tujuan',
  umum: 'Hanya umum',
};

// Pertanyaan wizard yang benar-benar dijalani di demo ini.
const WIZARD = ['nama', 'tujuan', 'pilihan', 'penilai'] as const;
type WizardStep = (typeof WIZARD)[number];
type Screen = 'preset' | WizardStep | 'ringkasan' | 'selesai';

const GROUP: Record<WizardStep, string> = {
  nama: 'Dasar',
  tujuan: 'Dasar',
  pilihan: 'Isi form',
  penilai: 'Penilaian',
};

export default function OprecSetupDemo() {
  return (
    <DemoFrame
      title="Setup oprec"
      location={`Lembaga › Oprec › ${DEMO_EVENT} › Buat oprec`}
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [screen, setScreen] = useState<Screen>('preset');
  const [preset, setPreset] = useState<Preset | null>(null);
  const [chosen, setChosen] = useState(false);
  const [name, setName] = useState(`Open Recruitment Panitia ${DEMO_EVENT}`);
  const [open, setOpen] = useState<string[]>([]);
  const [maxChoices, setMaxChoices] = useState(3);
  const [assessors, setAssessors] = useState<Assessors>('keduanya');
  const [opened, setOpened] = useState(false);

  const pickPreset = (next: Preset | null) => {
    setPreset(next);
    setChosen(true);
    if (next) {
      setMaxChoices(next.maxChoices);
      setAssessors(next.assessors);
      if (next.id === 'besar') guide.complete('preset');
    }
    setScreen('nama');
  };

  const toggleDivision = (id: string) => {
    const next = open.includes(id)
      ? open.filter((x) => x !== id)
      : [...open, id];
    setOpen(next);
    // Jumlah pilihan tidak boleh melebihi jumlah divisi yang dibuka.
    if (maxChoices > next.length) {
      setMaxChoices(Math.max(next.length, 1));
    }
  };

  const index = WIZARD.indexOf(screen as WizardStep);
  const problem =
    screen === 'nama' && name.trim() === ''
      ? 'Beri nama oprec ini.'
      : screen === 'tujuan' && open.length < 2
        ? 'Pilih minimal dua divisi.'
        : screen === 'pilihan' && maxChoices > Math.max(open.length, 1)
          ? `Jumlah pilihan melebihi jumlah divisi yang dibuka (${open.length}).`
          : null;

  const next = () => {
    if (problem) return;
    // Tandai langkah yang sedang dijawab sebagai selesai.
    if (screen === 'nama') guide.complete('nama');
    if (screen === 'tujuan') {
      guide.complete('tujuan');
      // Selaraskan jumlah pilihan dengan divisi yang dibuka.
      setMaxChoices((prev) => Math.min(prev, Math.max(open.length, 1)));
    }
    if (screen === 'pilihan') guide.complete('pilihan');
    if (screen === 'penilai') guide.complete('penilai');
    const following = WIZARD[index + 1];
    setScreen(following ?? 'ringkasan');
  };

  // --- Kepala + progres wizard, dipakai bersama oleh langkah dan ringkasan. ---
  const renderHeader = () => {
    if (screen === 'preset' || screen === 'selesai') return null;
    const isSummary = screen === 'ringkasan';
    const percent = isSummary ? 100 : Math.round((index / WIZARD.length) * 100);
    return (
      <header className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-700">
          <span className="font-semibold text-primary-400">
            {isSummary ? 'Ringkasan' : GROUP[screen]}
          </span>
          <div className="flex items-center gap-3">
            <span>
              {isSummary
                ? `${WIZARD.length} langkah`
                : `Langkah ${index + 1} dari ${WIZARD.length}`}
            </span>
            <button
              type="button"
              onClick={() => setScreen('preset')}
              className="text-xs font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              Ganti preset
            </button>
          </div>
        </div>
        <div
          role="progressbar"
          aria-label="Kemajuan setup"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200"
        >
          <div
            className="h-full rounded-full bg-primary-400 transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </header>
    );
  };

  // --- Layar pertama: pilih preset. ---
  if (screen === 'preset') {
    return (
      <div>
        <p className="text-sm font-semibold text-primary-400">Setup oprec</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-1000 sm:text-[32px]">
          Mulai dari mana?
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-700">
          Pilih preset yang paling dekat dengan oprec ini. Preset hanya mengisi
          pengaturan; daftar divisi, tanggal gelombang, dan bagian penilai tetap
          kamu pilih di langkah berikutnya.
        </p>

        <div
          role="group"
          aria-label="Pilihan preset"
          className="mt-6 grid gap-3 sm:grid-cols-2"
        >
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pickPreset(item)}
              className={cn(
                'grid content-start gap-2 rounded-[20px] border bg-neutral-50 p-4 text-left transition-colors duration-150 hover:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                chosen && preset?.id === item.id
                  ? 'border-primary-400 bg-primary-100'
                  : 'border-neutral-400',
                item.id === 'besar' && guide.spot('preset'),
              )}
            >
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="text-base font-semibold text-neutral-1000">
                  {item.title}
                </span>
                <span className="text-xs text-neutral-700">{item.example}</span>
              </span>
              <span className="text-sm text-neutral-700">{item.blurb}</span>
              <span className="mt-1 flex flex-wrap gap-1">
                {presetHighlights(item).map((text) => (
                  <span
                    key={text}
                    className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] text-neutral-700"
                  >
                    {text}
                  </span>
                ))}
              </span>
              <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary-400">
                Pakai preset <ArrowRight className="size-4" />
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => pickPreset(null)}
            className={cn(
              'grid content-start gap-2 rounded-[20px] border border-dashed bg-neutral-50 p-4 text-left transition-colors duration-150 hover:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
              chosen && preset === null
                ? 'border-primary-400 bg-primary-100'
                : 'border-neutral-400',
            )}
          >
            <span className="text-base font-semibold text-neutral-1000">
              Atur sendiri
            </span>
            <span className="text-sm text-neutral-700">
              Mulai dari bawaan dan jawab semua pertanyaan satu per satu.
            </span>
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary-400">
              Atur sendiri <ArrowRight className="size-4" />
            </span>
          </button>
        </div>

        <div className="mt-6">
          <Btn tone="ghost">Batal</Btn>
        </div>
      </div>
    );
  }

  // --- Layar selesai: oprec sudah dibuat, tinggal menerbitkan formulir. ---
  if (screen === 'selesai') {
    return (
      <div className="mx-auto max-w-md py-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-light text-success-dark">
          <Check className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-2xl font-semibold text-neutral-1000">
          Oprec sudah dibuat
        </h2>
        <p className="mt-2 text-neutral-700">
          {opened
            ? 'Formulir terbit dan pendaftaran dibuka.'
            : 'Statusnya draf. Lengkapi formulir bila perlu, lalu buka pendaftaran.'}
        </p>
        <div className="mt-3 flex justify-center">
          <Pill tone={opened ? 'success' : 'neutral'}>
            {opened ? 'Dibuka' : 'Draf'}
          </Pill>
        </div>
        <div className="mt-6 flex flex-col items-stretch gap-2">
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

  // --- Ringkasan sebelum dibuat. ---
  if (screen === 'ringkasan') {
    const chosenDivisions = DEMO_DIVISIONS.filter((d) => open.includes(d.id));
    const divisionValue =
      chosenDivisions.length === 0
        ? 'Belum dipilih'
        : `${chosenDivisions.length} dipilih: ${chosenDivisions.map((d) => d.name).join(', ')}`;

    const rubricsValue = preset
      ? RUBRIC_LABEL[preset.rubrics]
      : RUBRIC_LABEL.keduanya;

    const groups: {
      group: string;
      rows: { label: string; value: string }[];
    }[] = [
      {
        group: 'Dasar',
        rows: [
          {
            label: 'Nama dan periode',
            value: `${name || '—'} · ${DEMO_EVENT}`,
          },
          {
            label: 'Bidang atau divisi yang dibuka',
            value: divisionValue,
          },
        ],
      },
      {
        group: 'Isi form',
        rows: [
          {
            label: 'Jumlah pilihan divisi',
            value: maxChoices === 1 ? '1 pilihan' : `1–${maxChoices} pilihan`,
          },
        ],
      },
      {
        group: 'Penilaian',
        rows: [
          { label: 'Rubrik penilaian', value: rubricsValue },
          { label: 'Cara memutuskan', value: 'Dinilai dengan skor' },
          { label: 'Penilai', value: ASSESSOR_LABEL[assessors] },
        ],
      },
      {
        group: 'Publikasi',
        rows: [
          { label: 'Rilis ke pendaftar', value: 'Ya, saat admin merilis' },
        ],
      },
    ];

    return (
      <div>
        {renderHeader()}
        <h2 className="text-2xl font-semibold text-neutral-1000 sm:text-[28px] sm:leading-9">
          Periksa dulu sebelum dibuat
        </h2>
        <p className="mt-2 max-w-prose text-neutral-700">
          Oprec dibuat berstatus draf. Pendaftaran baru dibuka setelah formulir
          terbit dan kamu membukanya.
        </p>
        <p className="mt-1 text-sm text-neutral-700">
          Preset: <strong>{preset?.title ?? 'Atur sendiri'}</strong>.
        </p>

        <div className="mt-6 grid gap-4">
          {groups.map((group) => (
            <section
              key={group.group}
              className="overflow-hidden rounded-[20px] border border-neutral-400 bg-neutral-50"
            >
              <h3 className="border-b border-neutral-400 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700">
                {group.group}
              </h3>
              <ul className="divide-y divide-neutral-400">
                {group.rows.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-start justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-neutral-700">{row.label}</p>
                      <p className="break-words font-medium text-neutral-1000">
                        {row.value}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <Btn
            tone="primary"
            className={guide.spot('buat')}
            onClick={() => {
              guide.complete('buat');
              setScreen('selesai');
            }}
          >
            <Check aria-hidden /> Buat oprec
          </Btn>
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-400 pt-5">
          <Btn
            tone="outline"
            onClick={() => setScreen(WIZARD[WIZARD.length - 1] ?? 'nama')}
          >
            <ArrowLeft aria-hidden /> Kembali
          </Btn>
        </footer>
      </div>
    );
  }

  // --- Langkah wizard: satu pertanyaan per layar. ---
  return (
    <div>
      {renderHeader()}

      {screen === 'nama' ? (
        <>
          <h2 className="text-2xl font-semibold text-neutral-1000 sm:text-[28px] sm:leading-9">
            Oprec ini untuk periode yang mana?
          </h2>
          <p className="mt-2 max-w-prose text-neutral-700">
            Oprec dimiliki satu periode. Pemilihan periode dilakukan sebelum
            wizard dibuka; beri nama supaya mudah dikenali.
          </p>
          <div className="mt-6 grid max-w-md gap-4">
            <div className="rounded-xl bg-neutral-200 px-4 py-3 text-sm">
              <span className="text-neutral-700">Periode: </span>
              <span className="font-semibold text-neutral-1000">
                {DEMO_EVENT}
              </span>
            </div>
            <div className="grid gap-1">
              <label
                htmlFor="oprec-setup-name"
                className="text-sm font-semibold text-neutral-1000"
              >
                Nama oprec
              </label>
              <input
                id="oprec-setup-name"
                className={cn(FIELD_CLASS, guide.spot('nama'))}
                value={name}
                maxLength={255}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </div>
        </>
      ) : null}

      {screen === 'tujuan' ? (
        <>
          <h2 className="text-2xl font-semibold text-neutral-1000 sm:text-[28px] sm:leading-9">
            Bidang atau Divisi mana yang dibuka?
          </h2>
          <p className="mt-2 max-w-prose text-neutral-700">
            Centang tujuan yang menerima staf. Kuota diambil dari kuota jabatan
            di organogram. Divisi di dalamnya tidak bisa dibuka bersamaan.
          </p>
          <div className="mt-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Btn
                tone="outline"
                small
                onClick={() => setOpen(DEMO_DIVISIONS.map((d) => d.id))}
              >
                Semua divisi
              </Btn>
              <Btn tone="outline" small onClick={() => setOpen([])}>
                Kosongkan
              </Btn>
              <span className="text-sm text-neutral-700">
                {open.length} dipilih
              </span>
            </div>

            <section
              className={cn(
                'rounded-[20px] border border-neutral-400 bg-neutral-50 p-3',
                guide.spot('tujuan'),
              )}
            >
              <ul>
                {DEMO_DIVISIONS.map((division) => {
                  const picked = open.includes(division.id);
                  return (
                    <li key={division.id}>
                      <div
                        className={cn(
                          'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg py-1.5 pl-2 pr-2',
                          picked && 'bg-primary-100',
                        )}
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            className="size-4 shrink-0 accent-primary-400"
                            checked={picked}
                            onChange={() => toggleDivision(division.id)}
                          />
                          <span className="truncate text-sm font-medium text-neutral-1000">
                            {division.name}
                          </span>
                        </label>
                        <span className="text-xs text-neutral-700">
                          kuota {division.quota}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <p className="mt-4 rounded-xl bg-neutral-200 px-4 py-3 text-sm text-neutral-700">
              Daftar divisi dan kuotanya berasal dari organogram kegiatan.
              Ubahnya lewat menu <strong>Organogram</strong>.
            </p>
          </div>
        </>
      ) : null}

      {screen === 'pilihan' ? (
        <>
          <h2 className="text-2xl font-semibold text-neutral-1000 sm:text-[28px] sm:leading-9">
            Pendaftar boleh memilih berapa divisi?
          </h2>
          <p className="mt-2 max-w-prose text-neutral-700">
            Menentukan jumlah pilihan di formulir: pilihan 1, 2, 3, dst. Tidak
            boleh melebihi jumlah divisi yang dibuka.
          </p>
          <div className="mt-6 grid max-w-md gap-4">
            <div
              role="radiogroup"
              aria-label="Jumlah pilihan divisi"
              className={cn('grid gap-3', guide.spot('pilihan'))}
            >
              {[1, 2, 3].map((count) => {
                const selected = maxChoices === count;
                return (
                  <button
                    key={count}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMaxChoices(count)}
                    className={cn(
                      'flex items-start gap-3 rounded-[20px] border bg-neutral-50 p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                      selected
                        ? 'border-primary-400 bg-primary-100'
                        : 'border-neutral-400 hover:border-primary-300 hover:bg-neutral-100',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                        selected
                          ? 'border-primary-400 bg-primary-400 text-neutral-50'
                          : 'border-neutral-500',
                      )}
                    >
                      {selected ? (
                        <Check className="size-3.5" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-neutral-1000">
                        {count === 1 ? '1 pilihan' : `1–${count} pilihan`}
                      </span>
                      <span className="mt-0.5 block text-sm text-neutral-700">
                        {count === 1
                          ? 'Pendaftar hanya memilih satu divisi.'
                          : `Pendaftar memilih divisi utama dan cadangan hingga ${count} divisi.`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="rounded-xl bg-neutral-200 px-4 py-3 text-sm text-neutral-700">
              {open.length === 0
                ? 'Belum ada divisi yang dibuka.'
                : `${open.length} divisi dibuka: ${DEMO_DIVISIONS.filter((d) =>
                    open.includes(d.id),
                  )
                    .map((d) => d.name)
                    .join(', ')}.`}
            </p>
          </div>
        </>
      ) : null}

      {screen === 'penilai' ? (
        <>
          <h2 className="text-2xl font-semibold text-neutral-1000 sm:text-[28px] sm:leading-9">
            Siapa yang menilai pendaftar?
          </h2>
          <p className="mt-2 max-w-prose text-neutral-700">
            Penilai memberi skor untuk tiap pendaftar. Pilih siapa saja yang
            boleh menilai.
          </p>
          <div className="mt-6 grid max-w-md gap-4">
            <div
              role="radiogroup"
              aria-label="Penilai"
              className={cn('grid gap-3', guide.spot('penilai'))}
            >
              {[
                {
                  value: 'ketua' as const,
                  label: 'Pengurus divisi',
                  description:
                    'Pengurus divisi memberi skor untuk pendaftar yang memilih divisinya.',
                },
                {
                  value: 'umum' as const,
                  label: 'Penilai umum',
                  description:
                    'Penilai umum memberi skor untuk semua pendaftar, dari satu bagian yang sama.',
                },
                {
                  value: 'keduanya' as const,
                  label: 'Penilai umum dan pengurus divisi',
                  description:
                    'Keduanya memberi skor, nilainya digabung dengan bobot rubrik.',
                },
              ].map((option) => {
                const selected = assessors === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setAssessors(option.value)}
                    className={cn(
                      'flex items-start gap-3 rounded-[20px] border bg-neutral-50 p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                      selected
                        ? 'border-primary-400 bg-primary-100'
                        : 'border-neutral-400 hover:border-primary-300 hover:bg-neutral-100',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                        selected
                          ? 'border-primary-400 bg-primary-400 text-neutral-50'
                          : 'border-neutral-500',
                      )}
                    >
                      {selected ? (
                        <Check className="size-3.5" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-neutral-1000">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-sm text-neutral-700">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      {problem ? (
        <p role="status" className="mt-6 text-sm text-danger-dark">
          {problem}
        </p>
      ) : null}

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-400 pt-5">
        <div className="flex items-center gap-2">
          {index > 0 ? (
            <Btn
              tone="outline"
              onClick={() => setScreen(WIZARD[index - 1] ?? 'nama')}
            >
              <ArrowLeft aria-hidden /> Kembali
            </Btn>
          ) : (
            <>
              <Btn tone="ghost" onClick={() => setScreen('preset')}>
                Pilih preset
              </Btn>
              <Btn tone="ghost">Batal</Btn>
            </>
          )}
        </div>
        <Btn
          tone="primary"
          disabled={problem !== null}
          className={guide.spot(screen)}
          onClick={next}
        >
          {index === WIZARD.length - 1 ? 'Periksa ringkasan' : 'Lanjut'}{' '}
          <ArrowRight aria-hidden />
        </Btn>
      </footer>
    </div>
  );
}
