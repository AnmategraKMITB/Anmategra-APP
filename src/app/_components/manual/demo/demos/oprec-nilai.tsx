'use client';

// Simulasi halaman Nilai oprec: penilai memilih berkas dari antrean, memberi
// skor tiap kriteria, memasang label, dan mengubah status secara manual.

// Library Import
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { DEMO_DIVISIONS, DEMO_EVENT, divisionName } from '../data';
import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import {
  Btn,
  Field,
  inputClass,
  Pill,
  type PillTone,
  tdClass,
  thClass,
} from '../ui';
import {
  APPLICANTS,
  type ChoiceStatus,
  STATUS_LABEL,
  STATUS_TONE,
} from './oprec-data';

const STEPS: DemoStep[] = [
  {
    id: 'pilih',
    title: 'Pilih **Bima Arya Setiadi** dari antrean penilaian',
    hint: 'Titik di samping nama menunjukkan berapa kriteria yang sudah dinilai.',
  },
  {
    id: 'skor',
    title: 'Beri skor 1–5 untuk ketiga kriteria',
    hint: 'Skor akhir dihitung dari bobot tiap kriteria, lalu status semua pendaftar di divisi ini dihitung ulang.',
  },
  {
    id: 'sheet',
    title: 'Buka tampilan **Sheet** untuk membandingkan semua pendaftar',
    hint: 'Di Sheet, skor tiap kriteria diubah lewat daftar pilihan.',
  },
  {
    id: 'ubah',
    title:
      'Kembali ke **Per berkas**, klik **Ubah status**, tulis alasannya, lalu **Simpan**',
    hint: 'Perubahan manual wajib beralasan dan ditandai "diubah manual".',
  },
];

/** Bima Arya Setiadi; pendaftar yang jadi fokus langkah panduan. */
const FOCUS_ID = 'a3';

const SCOPE_ID = 'acara';
const SCOPE_LABEL = divisionName(SCOPE_ID);
const QUOTA =
  DEMO_DIVISIONS.find((division) => division.id === SCOPE_ID)?.quota ?? 2;
const MINIMUM = 75;

const CRITERIA = [
  {
    id: 'motivasi',
    name: 'Motivasi',
    weight: 40,
    expectation: 'Seberapa kuat alasan pendaftar ikut kepanitiaan ini.',
  },
  {
    id: 'pengalaman',
    name: 'Pengalaman',
    weight: 35,
    expectation: 'Pengalaman organisasi atau acara yang relevan dengan divisi.',
  },
  {
    id: 'komitmen',
    name: 'Komitmen waktu',
    weight: 25,
    expectation: 'Kesiapan menyisihkan waktu sampai rangkaian acara selesai.',
  },
] as const;
type CriterionId = (typeof CRITERIA)[number]['id'];

const RATINGS = [1, 2, 3, 4, 5] as const;

const SHORT_LABEL: Record<number, string> = {
  1: 'Kurang sekali',
  2: 'Kurang',
  3: 'Cukup',
  4: 'Baik',
  5: 'Sangat baik',
};

/** Jawaban yang tertaut ke tiap kriteria (indeks pada daftar jawaban). */
const CRITERION_FIELDS: Record<CriterionId, number[]> = {
  motivasi: [0],
  pengalaman: [1],
  komitmen: [2],
};

function waveTitle(wave: string): string {
  return `Gelombang ${wave}`;
}

type Ratings = Partial<Record<CriterionId, number>>;
type Scores = Record<string, Ratings>;
type Override = { status: ChoiceStatus; reason: string; sensitive: boolean };
type Flag = { name: string; tone: PillTone };

const INITIAL_SCORES: Scores = {
  a1: { motivasi: 5, pengalaman: 4, komitmen: 4 },
  a4: { motivasi: 4, pengalaman: 4, komitmen: 5 },
  a5: { motivasi: 3, pengalaman: 2, komitmen: 3 },
};

const INITIAL_FLAGS: Record<string, Flag[]> = {
  a2: [{ name: 'Prioritas', tone: 'teal' }],
};

const LABELS: Flag[] = [
  { name: 'Prioritas', tone: 'teal' },
  { name: 'Perlu dicek', tone: 'warning' },
  { name: 'Sudah dihubungi', tone: 'info' },
  { name: 'Tidak direkomendasikan', tone: 'danger' },
];

type Row = {
  id: string;
  name: string;
  nim: string;
  prodi: string;
  angkatan: number;
  wave: string;
  willing: boolean;
  /** Peringkat pilihan yang dinilai penilai pada lingkup ini. */
  rank: number;
  choiceLabel: string;
  /** Pilihan lain pendaftar, hanya ditampilkan tanpa panel ubah status. */
  otherChoices: {
    rank: number;
    label: string;
    score: number | null;
    status: ChoiceStatus;
  }[];
  answers: [string, string][];
};

const ROWS: Row[] = APPLICANTS.flatMap((applicant) => {
  const index = applicant.choices.findIndex(
    (choice) => choice.division === SCOPE_ID,
  );
  const choice = applicant.choices[index];
  if (!choice) return [];
  const otherChoices = applicant.choices
    .map((item, itemIndex) => ({
      rank: itemIndex + 1,
      label: divisionName(item.division),
      score: item.score,
      status: item.status,
    }))
    .filter((item) => item.rank !== index + 1);
  return [
    {
      id: applicant.id,
      name: applicant.name,
      nim: applicant.nim,
      prodi: applicant.prodi,
      angkatan: applicant.angkatan,
      wave: applicant.wave,
      willing: applicant.willing,
      rank: index + 1,
      choiceLabel: divisionName(choice.division),
      otherChoices,
      answers: applicant.answers,
    },
  ];
});

function scoreOf(ratings: Ratings | undefined): number | null {
  if (!ratings) return null;
  let sum = 0;
  for (const criterion of CRITERIA) {
    const value = ratings[criterion.id];
    if (value === undefined) return null;
    sum += (value / 5) * criterion.weight;
  }
  return Math.round(sum);
}

function progressOf(ratings: Ratings | undefined): {
  done: number;
  total: number;
} {
  const done = CRITERIA.filter(
    (criterion) => ratings?.[criterion.id] !== undefined,
  ).length;
  return { done, total: CRITERIA.length };
}

/** Peringkat dalam kuota dengan nilai minimum, seperti metode status bawaan. */
function computedStatuses(scores: Scores): Record<string, ChoiceStatus> {
  const result: Record<string, ChoiceStatus> = {};
  for (const row of ROWS) result[row.id] = 'belum_lengkap';
  const ranked = ROWS.map((row) => ({
    id: row.id,
    score: scoreOf(scores[row.id]),
  }))
    .filter((entry): entry is { id: string; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score);
  ranked.forEach((entry, index) => {
    result[entry.id] =
      index < QUOTA && entry.score >= MINIMUM ? 'lolos' : 'tidak_lolos';
  });
  return result;
}

const selectClass =
  'h-9 w-full min-w-20 rounded-lg border border-neutral-400 bg-neutral-50 px-2 text-sm text-neutral-1000 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400';

export default function OprecNilaiDemo() {
  return (
    <DemoFrame
      title="Menilai berkas pendaftar"
      location="Lembaga › Oprec › Aku Masuk ITB 2027 › Nilai"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function ProgressDots({ done, total }: { done: number; total: number }) {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            'size-1.5 rounded-full',
            index < done ? 'bg-primary-400' : 'bg-neutral-200',
          )}
        />
      ))}
    </span>
  );
}

function AnswerItems({
  items,
  highlight = false,
}: {
  items: [string, string][];
  highlight?: boolean;
}) {
  return (
    <dl className="grid gap-3">
      {items.map(([question, answer]) => (
        <div
          key={question}
          className={
            highlight
              ? 'rounded-xl border-l-4 border-primary-400 bg-primary-100 px-3 py-2'
              : 'rounded-xl bg-neutral-100 px-3 py-2'
          }
        >
          <dt className="text-sm text-neutral-700">{question}</dt>
          <dd className="mt-0.5 whitespace-pre-line break-words text-sm text-neutral-1000">
            {answer}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function AnswerList({
  answers,
  linkedIds,
  linkedLabel,
}: {
  answers: [string, string][];
  linkedIds: number[];
  linkedLabel: string;
}) {
  const related = linkedIds
    .map((index) => answers[index])
    .filter((item): item is [string, string] => item !== undefined);
  if (related.length === 0) return <AnswerItems items={answers} />;
  const others = answers.filter((_, index) => !linkedIds.includes(index));
  return (
    <div className="grid gap-3">
      <p className="text-sm text-neutral-700">
        Untuk kriteria{' '}
        <span className="font-semibold text-neutral-1000">{linkedLabel}</span>
      </p>
      <AnswerItems items={related} highlight />
      {others.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
            Jawaban lainnya ({others.length})
          </summary>
          <div className="mt-3">
            <AnswerItems items={others} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [view, setView] = useState<'berkas' | 'sheet'>('berkas');
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [sheetSearch, setSheetSearch] = useState('');
  const [sheetOnlyIncomplete, setSheetOnlyIncomplete] = useState(false);
  const [scores, setScores] = useState<Scores>(INITIAL_SCORES);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Override>({
    status: 'lolos',
    reason: '',
    sensitive: false,
  });
  const [reasonError, setReasonError] = useState(false);
  const [activeCriterionId, setActiveCriterionId] =
    useState<CriterionId>('motivasi');
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, Flag[]>>(INITIAL_FLAGS);
  const [labelOpen, setLabelOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const computed = computedStatuses(scores);
  const effective = (id: string): ChoiceStatus =>
    overrides[id]?.status ?? computed[id] ?? 'belum_lengkap';

  const filterRows = (query: string, incomplete: boolean) => {
    const q = query.trim().toLowerCase();
    return ROWS.filter((row) => {
      const match =
        q === '' ||
        row.name.toLowerCase().includes(q) ||
        row.nim.includes(q);
      const progress = progressOf(scores[row.id]);
      return match && (!incomplete || progress.done < progress.total);
    });
  };

  const queueRows = filterRows(search, onlyIncomplete);
  const sheetRows = filterRows(sheetSearch, sheetOnlyIncomplete);

  const defaultId =
    queueRows.find(
      (row) => progressOf(scores[row.id]).done < CRITERIA.length,
    )?.id ??
    queueRows[0]?.id ??
    null;
  const selectedId =
    chosenId !== null && queueRows.some((row) => row.id === chosenId)
      ? chosenId
      : defaultId;

  const active = ROWS.find((row) => row.id === selectedId) ?? null;
  const activeScore = active ? scoreOf(scores[active.id]) : null;
  const override = active ? overrides[active.id] : undefined;
  const activeFlags = active ? (flags[active.id] ?? []) : [];
  const availableLabels = LABELS.filter(
    (label) => !activeFlags.some((flag) => flag.name === label.name),
  );
  const activeCriterion =
    CRITERIA.find((criterion) => criterion.id === activeCriterionId) ??
    CRITERIA[0];

  const setRating = (
    applicantId: string,
    criterion: CriterionId,
    value: number | null,
  ) => {
    const ratings: Ratings = { ...(scores[applicantId] ?? {}) };
    if (value === null) delete ratings[criterion];
    else ratings[criterion] = value;
    const next: Scores = { ...scores, [applicantId]: ratings };
    setScores(next);
    if (applicantId === FOCUS_ID && scoreOf(next[applicantId]) !== null) {
      guide.complete('skor');
    }
  };

  const selectRow = (id: string) => {
    setChosenId(id);
    setEditing(false);
    setLabelOpen(false);
    const unrated = CRITERIA.find(
      (criterion) => scores[id]?.[criterion.id] === undefined,
    );
    setActiveCriterionId(unrated?.id ?? 'motivasi');
    if (id === FOCUS_ID) guide.complete('pilih');
  };

  const startEdit = () => {
    if (!active) return;
    setDraft({
      status: effective(active.id) === 'lolos' ? 'tidak_lolos' : 'lolos',
      reason: '',
      sensitive: false,
    });
    setReasonError(false);
    setEditing(true);
  };

  const saveOverride = () => {
    if (!active) return;
    if (draft.reason.trim() === '') {
      setReasonError(true);
      return;
    }
    setOverrides((prev) => ({
      ...prev,
      [active.id]: { ...draft, reason: draft.reason.trim() },
    }));
    setEditing(false);
    setToast('Tersimpan');
    window.setTimeout(() => setToast(null), 1800);
    guide.complete('ubah');
  };

  const clearOverride = () => {
    if (!active) return;
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[active.id];
      return next;
    });
  };

  const applyLabel = (label: Flag) => {
    if (!active) return;
    setFlags((prev) => {
      const list = prev[active.id] ?? [];
      if (list.some((flag) => flag.name === label.name)) return prev;
      return { ...prev, [active.id]: [...list, label] };
    });
    setLabelOpen(false);
  };

  const removeLabel = (name: string) => {
    if (!active) return;
    setFlags((prev) => ({
      ...prev,
      [active.id]: (prev[active.id] ?? []).filter((flag) => flag.name !== name),
    }));
  };

  return (
    <div className="flex h-[560px] flex-col">
      <header className="min-w-0">
        <span className="text-sm text-primary-400">← Kembali ke oprec</span>
        <h1 className="mt-2 break-words text-2xl font-semibold text-neutral-1000">
          Nilai
        </h1>
        <p className="mt-1 break-words text-sm text-neutral-700">
          Open Recruitment Panitia {DEMO_EVENT} · 2026/2027.
        </p>
      </header>

      <nav
        aria-label="Bagian oprec"
        className="mt-4 flex flex-wrap gap-1 border-b border-neutral-400"
      >
        <span
          aria-current="page"
          className="-mb-px whitespace-nowrap border-b-2 border-primary-400 px-4 py-2 text-sm font-semibold text-primary-400"
        >
          Nilai
        </span>
        <span
          aria-disabled="true"
          title="Masih ada pendaftar yang belum selesai dinilai."
          className="-mb-px cursor-not-allowed whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-semibold text-neutral-500"
        >
          Penempatan
        </span>
        <span
          aria-disabled="true"
          title="Hasil dibuka setelah penempatan selesai."
          className="-mb-px cursor-not-allowed whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-semibold text-neutral-500"
        >
          Hasil
        </span>
      </nav>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Lingkup penilaian"
              className="flex flex-wrap gap-1.5"
            >
              <button
                type="button"
                aria-pressed
                className="inline-flex h-9 items-center rounded-full border border-primary-300 bg-primary-100 px-3 text-sm font-semibold text-primary-500 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                {SCOPE_LABEL}
              </button>
            </div>

            <div
              role="group"
              aria-label="Tampilan"
              className="inline-flex rounded-full border border-neutral-400 bg-neutral-50 p-1"
            >
              {(['berkas', 'sheet'] as const).map((mode) => {
                const selected = view === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setView(mode);
                      if (mode === 'sheet') guide.complete('sheet');
                    }}
                    className={cn(
                      'inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                      selected
                        ? 'bg-primary-100 text-primary-500'
                        : 'text-neutral-700 hover:bg-neutral-100',
                      mode === 'sheet' && guide.spot('sheet'),
                      mode === 'berkas' &&
                        view === 'sheet' &&
                        guide.spot('pilih', 'skor', 'ubah'),
                    )}
                  >
                    {mode === 'berkas' ? 'Per berkas' : 'Sheet'}
                  </button>
                );
              })}
            </div>
          </div>

          {view === 'berkas' ? (
            <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
              <aside
                aria-label="Antrean penilaian"
                className="rounded-[24px] border border-neutral-400 bg-neutral-50 p-3 sm:p-4"
              >
                <div className="grid gap-2">
                  <div className="relative">
                    <Search
                      aria-hidden
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Cari nama atau NIM"
                      aria-label="Cari nama atau NIM"
                      className="h-9 w-full rounded-lg border border-neutral-400 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-1000 placeholder:text-neutral-500 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    />
                  </div>
                  <button
                    type="button"
                    aria-pressed={onlyIncomplete}
                    onClick={() => setOnlyIncomplete((value) => !value)}
                    className={cn(
                      'inline-flex h-8 w-fit items-center rounded-full border px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                      onlyIncomplete
                        ? 'border-primary-300 bg-primary-100 text-primary-500'
                        : 'border-neutral-400 bg-neutral-50 text-neutral-700 hover:border-primary-300',
                    )}
                  >
                    Belum selesai
                  </button>
                </div>

                {queueRows.length === 0 ? (
                  <p className="mt-3 text-sm text-neutral-700">
                    Tidak ada pendaftar yang cocok.
                  </p>
                ) : (
                  <ul className="mt-3 grid max-h-72 gap-1.5 overflow-y-auto lg:max-h-[calc(100vh-20rem)]">
                    {queueRows.map((row) => {
                      const progress = progressOf(scores[row.id]);
                      const selected = row.id === selectedId;
                      return (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => selectRow(row.id)}
                            aria-current={selected ? 'true' : undefined}
                            className={cn(
                              'w-full rounded-xl border px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                              selected
                                ? 'border-primary-300 bg-primary-100'
                                : 'border-transparent hover:bg-neutral-100',
                              row.id === FOCUS_ID && guide.spot('pilih'),
                            )}
                          >
                            <span className="flex items-start justify-between gap-2">
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-neutral-1000">
                                  {row.name}
                                </span>
                                <span className="mt-0.5 block text-sm text-neutral-700">
                                  {waveTitle(row.wave)}
                                </span>
                              </span>
                              <span className="flex shrink-0 items-center gap-1 text-xs text-neutral-700">
                                <ProgressDots
                                  done={progress.done}
                                  total={progress.total}
                                />
                                <span>
                                  {progress.done}/{progress.total}
                                </span>
                              </span>
                            </span>
                            <span className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className="text-sm text-neutral-700">
                                {row.choiceLabel}
                              </span>
                              <Pill tone={STATUS_TONE[effective(row.id)]}>
                                {STATUS_LABEL[effective(row.id)]}
                              </Pill>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-700">
                  <span>
                    {ROWS.length} pendaftar · halaman 1 dari 1
                  </span>
                  <div className="flex gap-1.5">
                    <Btn small tone="outline" disabled>
                      <ChevronLeft /> Sebelumnya
                    </Btn>
                    <Btn small tone="outline" disabled>
                      Berikutnya <ChevronRight />
                    </Btn>
                  </div>
                </div>
              </aside>

              <section
                aria-label="Berkas penilaian"
                className="min-w-0 rounded-[24px] border border-neutral-400 bg-neutral-50 p-4 sm:p-6"
              >
                <p
                  role="status"
                  aria-live="polite"
                  className="h-5 text-sm font-semibold text-success-dark"
                >
                  {toast ?? ''}
                </p>

                {!active ? (
                  <p className="text-sm text-neutral-700">
                    Pilih pendaftar dari antrean untuk mulai menilai.
                  </p>
                ) : (
                  <div className="grid gap-5">
                    <header className="border-b border-neutral-200 pb-3">
                      <h2 className="break-words text-xl font-semibold text-neutral-1000">
                        {active.name}
                      </h2>
                      <p className="mt-1 text-sm text-neutral-700">
                        {`NIM ${active.nim} · ${active.prodi} · Angkatan ${active.angkatan}`}
                      </p>
                      <p className="mt-0.5 text-sm text-neutral-700">
                        {[
                          waveTitle(active.wave),
                          active.willing ? 'Bersedia dipindahkan' : null,
                        ]
                          .filter((text): text is string => text !== null)
                          .join(' · ')}
                      </p>
                    </header>

                    <div className="grid gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {activeFlags.map((flag) => (
                          <Pill key={flag.name} tone={flag.tone}>
                            {flag.name}
                            <button
                              type="button"
                              aria-label={`Hapus label ${flag.name}`}
                              onClick={() => removeLabel(flag.name)}
                              className="ml-1 inline-flex size-4 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                            >
                              <X className="size-3" aria-hidden />
                            </button>
                          </Pill>
                        ))}
                        <Btn
                          small
                          tone="outline"
                          aria-expanded={labelOpen}
                          onClick={() => setLabelOpen((value) => !value)}
                        >
                          + Label
                        </Btn>
                      </div>
                      {labelOpen ? (
                        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-neutral-400 bg-white p-2">
                          {availableLabels.length === 0 ? (
                            <p className="text-sm text-neutral-700">
                              Semua label sudah dipakai.
                            </p>
                          ) : (
                            availableLabels.map((label) => (
                              <button
                                key={label.name}
                                type="button"
                                onClick={() => applyLabel(label)}
                                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                              >
                                <Pill tone={label.tone}>{label.name}</Pill>
                              </button>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>

                    <section aria-labelledby="nilai-pilihan">
                      <h3
                        id="nilai-pilihan"
                        className="text-sm font-semibold text-neutral-1000"
                      >
                        Pilihan
                      </h3>
                      <div className="mt-2 grid gap-3">
                        <article className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm text-neutral-700">
                                Pilihan {active.rank}
                              </p>
                              <h4 className="break-words text-base font-semibold text-neutral-1000">
                                {active.choiceLabel}
                              </h4>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {override ? (
                                <span className="inline-flex items-center rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-500">
                                  diubah manual
                                </span>
                              ) : null}
                              <Pill
                                tone={STATUS_TONE[effective(active.id)]}
                              >
                                {STATUS_LABEL[effective(active.id)]}
                              </Pill>
                            </div>
                          </div>
                          <p className="mt-1 text-sm text-neutral-700">
                            Skor {activeScore ?? '—'}
                          </p>

                          {editing ? (
                            <div className="mt-3 grid gap-2">
                              <Field
                                label="Status baru"
                                className="max-w-[200px]"
                              >
                                {(id) => (
                                  <select
                                    id={id}
                                    value={draft.status}
                                    onChange={(event) =>
                                      setDraft({
                                        ...draft,
                                        status: event.target
                                          .value as ChoiceStatus,
                                      })
                                    }
                                    className={inputClass}
                                  >
                                    <option value="lolos">Lolos</option>
                                    <option value="tidak_lolos">
                                      Tidak lolos
                                    </option>
                                  </select>
                                )}
                              </Field>
                              <Field label="Alasan">
                                {(id) => (
                                  <textarea
                                    id={id}
                                    rows={2}
                                    value={draft.reason}
                                    placeholder="Tuliskan alasan perubahan status"
                                    onChange={(event) => {
                                      setDraft({
                                        ...draft,
                                        reason: event.target.value,
                                      });
                                      setReasonError(false);
                                    }}
                                    className={cn(
                                      inputClass,
                                      'h-auto py-2',
                                      guide.spot('ubah'),
                                    )}
                                  />
                                )}
                              </Field>
                              {reasonError ? (
                                <p
                                  role="alert"
                                  className="text-sm font-semibold text-danger-dark"
                                >
                                  Alasan wajib diisi.
                                </p>
                              ) : null}
                              <label className="flex items-start gap-2 text-sm text-neutral-700">
                                <input
                                  type="checkbox"
                                  checked={draft.sensitive}
                                  onChange={(event) =>
                                    setDraft({
                                      ...draft,
                                      sensitive: event.target.checked,
                                    })
                                  }
                                  className="mt-0.5 size-4 rounded border-neutral-400 accent-primary-400"
                                />
                                <span>
                                  Sensitif (hanya terlihat pengambil keputusan)
                                </span>
                              </label>
                              <div className="flex justify-end gap-2">
                                <Btn
                                  small
                                  tone="ghost"
                                  onClick={() => setEditing(false)}
                                >
                                  Batal
                                </Btn>
                                <Btn small onClick={saveOverride}>
                                  Simpan
                                </Btn>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Btn
                                small
                                tone="outline"
                                onClick={startEdit}
                                className={guide.spot('ubah')}
                              >
                                {override ? 'Ubah lagi' : 'Ubah status'}
                              </Btn>
                              {override ? (
                                <Btn
                                  small
                                  tone="ghost"
                                  onClick={clearOverride}
                                >
                                  Kembalikan ke hitungan
                                </Btn>
                              ) : null}
                              {override ? (
                                <span className="text-sm text-neutral-700">
                                  Alasan:{' '}
                                  {override.sensitive
                                    ? 'Alasan disembunyikan'
                                    : override.reason}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </article>

                        {active.otherChoices.map((choice) => (
                          <article
                            key={choice.label}
                            className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm text-neutral-700">
                                  Pilihan {choice.rank}
                                </p>
                                <h4 className="break-words text-base font-semibold text-neutral-1000">
                                  {choice.label}
                                </h4>
                              </div>
                              <Pill tone={STATUS_TONE[choice.status]}>
                                {STATUS_LABEL[choice.status]}
                              </Pill>
                            </div>
                            <p className="mt-1 text-sm text-neutral-700">
                              Skor{' '}
                              {choice.score === null
                                ? '—'
                                : Math.round(choice.score)}
                            </p>
                          </article>
                        ))}
                      </div>
                    </section>

                    <section aria-labelledby="nilai-kriteria">
                      <h3
                        id="nilai-kriteria"
                        className="text-sm font-semibold text-neutral-1000"
                      >
                        Kriteria
                      </h3>
                      <div className="mt-2 grid gap-3">
                        {CRITERIA.map((criterion) => {
                          const value = scores[active.id]?.[criterion.id];
                          const noteKey = `${active.id}:${criterion.id}`;
                          return (
                            <section
                              key={criterion.id}
                              onClick={() =>
                                setActiveCriterionId(criterion.id)
                              }
                              onFocusCapture={() =>
                                setActiveCriterionId(criterion.id)
                              }
                              className={cn(
                                'rounded-[24px] border bg-neutral-50 p-4 sm:p-5',
                                activeCriterion.id === criterion.id
                                  ? 'border-primary-300 ring-2 ring-primary-400'
                                  : 'border-neutral-400',
                                active.id === FOCUS_ID &&
                                  value === undefined &&
                                  guide.spot('skor'),
                              )}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h4 className="text-base font-semibold text-neutral-1000">
                                    {criterion.name}
                                  </h4>
                                  <p className="mt-0.5 text-xs font-semibold text-neutral-700">
                                    bobot {criterion.weight}%
                                  </p>
                                  <p className="mt-1 text-sm text-neutral-700">
                                    {criterion.expectation}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  aria-expanded={openNote === noteKey}
                                  onClick={() =>
                                    setOpenNote(
                                      openNote === noteKey ? null : noteKey,
                                    )
                                  }
                                  className="text-sm font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                                >
                                  Catatan
                                </button>
                              </div>

                              <div
                                role="radiogroup"
                                aria-label={`Skor ${criterion.name}`}
                                className="mt-4 flex flex-wrap gap-2"
                              >
                                {RATINGS.map((rating) => {
                                  const selected = value === rating;
                                  return (
                                    <div
                                      key={rating}
                                      className="flex flex-col items-center gap-1"
                                    >
                                      <button
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        title={SHORT_LABEL[rating]}
                                        onClick={() =>
                                          setRating(
                                            active.id,
                                            criterion.id,
                                            selected ? null : rating,
                                          )
                                        }
                                        className={cn(
                                          'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                                          selected
                                            ? 'border-primary-400 bg-primary-400 text-neutral-50'
                                            : 'border-neutral-400 bg-neutral-50 text-neutral-1000 hover:border-primary-300 hover:bg-primary-100',
                                        )}
                                      >
                                        {rating}
                                      </button>
                                      {selected ? (
                                        <span className="text-xs text-neutral-700">
                                          {SHORT_LABEL[rating]}
                                        </span>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>

                              {openNote === noteKey ? (
                                <div className="mt-3">
                                  <label
                                    htmlFor={noteKey}
                                    className="text-xs font-semibold text-neutral-700"
                                  >
                                    Catatan
                                  </label>
                                  <textarea
                                    id={noteKey}
                                    value={notes[noteKey] ?? ''}
                                    rows={3}
                                    placeholder="Catatan untuk kriteria ini"
                                    onChange={(event) =>
                                      setNotes((prev) => ({
                                        ...prev,
                                        [noteKey]: event.target.value,
                                      }))
                                    }
                                    className="mt-1 w-full rounded-lg border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm text-neutral-1000 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                                  />
                                </div>
                              ) : null}
                            </section>
                          );
                        })}
                      </div>
                    </section>

                    <section aria-labelledby="nilai-jawaban">
                      <h3
                        id="nilai-jawaban"
                        className="text-sm font-semibold text-neutral-1000"
                      >
                        Jawaban
                      </h3>
                      <div className="mt-2">
                        <AnswerList
                          answers={active.answers}
                          linkedIds={CRITERION_FIELDS[activeCriterion.id]}
                          linkedLabel={activeCriterion.name}
                        />
                      </div>
                    </section>
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-56 flex-1">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
                  />
                  <input
                    type="search"
                    value={sheetSearch}
                    onChange={(event) => setSheetSearch(event.target.value)}
                    placeholder="Cari nama atau NIM"
                    aria-label="Cari nama atau NIM"
                    className="h-9 w-full rounded-lg border border-neutral-400 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-1000 placeholder:text-neutral-500 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  />
                </div>
                <button
                  type="button"
                  aria-pressed={sheetOnlyIncomplete}
                  onClick={() => setSheetOnlyIncomplete((value) => !value)}
                  className={cn(
                    'inline-flex h-8 items-center rounded-full border px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                    sheetOnlyIncomplete
                      ? 'border-primary-300 bg-primary-100 text-primary-500'
                      : 'border-neutral-400 bg-neutral-50 text-neutral-700 hover:border-primary-300',
                  )}
                >
                  Belum selesai
                </button>
              </div>

              {sheetRows.length === 0 ? (
                <p className="rounded-[24px] border border-neutral-400 bg-neutral-50 p-8 text-center text-sm text-neutral-700">
                  Tidak ada pendaftar yang cocok.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-[24px] border border-neutral-400 bg-neutral-50">
                  <table className="w-full min-w-[640px] border-collapse">
                    <thead>
                      <tr>
                        <th
                          className={cn(thClass, 'sticky left-0 z-10 min-w-48')}
                        >
                          Pendaftar
                        </th>
                        <th className={thClass}>Gelombang</th>
                        {CRITERIA.map((criterion) => (
                          <th
                            key={criterion.id}
                            className={cn(thClass, 'whitespace-nowrap')}
                          >
                            {criterion.name}
                          </th>
                        ))}
                        <th className={thClass}>Nilai</th>
                        <th className={thClass}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheetRows.map((row) => {
                        const progress = progressOf(scores[row.id]);
                        const score = scoreOf(scores[row.id]);
                        return (
                          <tr key={row.id}>
                            <td
                              className={cn(
                                tdClass,
                                'sticky left-0 z-10 min-w-48 bg-neutral-50',
                              )}
                            >
                              <span className="block text-sm font-semibold text-neutral-1000">
                                {row.name}
                              </span>
                              <span className="mt-0.5 block text-xs text-neutral-700">
                                {progress.done}/{progress.total} dinilai
                              </span>
                            </td>
                            <td
                              className={cn(
                                tdClass,
                                'whitespace-nowrap text-sm text-neutral-700',
                              )}
                            >
                              {waveTitle(row.wave)}
                            </td>
                            {CRITERIA.map((criterion) => {
                              const value = scores[row.id]?.[criterion.id];
                              return (
                                <td key={criterion.id} className={tdClass}>
                                  <select
                                    aria-label={`${criterion.name} ${row.name}`}
                                    value={value === undefined ? '' : String(value)}
                                    onChange={(event) => {
                                      const raw = event.target.value;
                                      setRating(
                                        row.id,
                                        criterion.id,
                                        raw === '' ? null : Number(raw),
                                      );
                                    }}
                                    className={cn(
                                      selectClass,
                                      row.id === FOCUS_ID &&
                                        value === undefined &&
                                        guide.spot('skor'),
                                    )}
                                  >
                                    <option value="">—</option>
                                    {RATINGS.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              );
                            })}
                            <td
                              className={cn(
                                tdClass,
                                'whitespace-nowrap text-sm font-semibold text-neutral-1000',
                              )}
                            >
                              {score ?? '—'}
                            </td>
                            <td className={tdClass}>
                              <Pill tone={STATUS_TONE[effective(row.id)]}>
                                {STATUS_LABEL[effective(row.id)]}
                              </Pill>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-700">
                <span>{ROWS.length} pendaftar · halaman 1 dari 1</span>
                <div className="flex gap-2">
                  <Btn small tone="outline" disabled>
                    <ChevronLeft /> Sebelumnya
                  </Btn>
                  <Btn small tone="outline" disabled>
                    Berikutnya <ChevronRight />
                  </Btn>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
