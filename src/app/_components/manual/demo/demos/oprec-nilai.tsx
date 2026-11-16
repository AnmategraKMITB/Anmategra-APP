'use client';

// Library Import
import { Check } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import {
  Btn,
  Field,
  inputClass,
  Pill,
  ScreenTitle,
  tdClass,
  thClass,
} from '../ui';
import { type ChoiceStatus, STATUS_LABEL, STATUS_TONE } from './oprec-data';

const STEPS: DemoStep[] = [
  {
    id: 'pilih',
    title: 'Pilih **Bima Arya Setiadi** dari antrean penilaian',
    hint: 'Pendaftar yang belum selesai dinilai tidak bertanda centang.',
  },
  {
    id: 'skor',
    title: 'Beri skor 1–5 untuk kedua kriteria',
    hint: 'Skor akhir dihitung dari bobot tiap kriteria, lalu status dihitung ulang untuk semua pendaftar di divisi ini.',
  },
  {
    id: 'sheet',
    title: 'Buka tampilan **Sheet** untuk membandingkan semua pendaftar',
  },
  {
    id: 'ubah',
    title:
      'Kembali ke **Per berkas**, klik **Ubah status**, tulis alasannya, lalu **Simpan**',
    hint: 'Perubahan manual wajib beralasan dan ditandai "diubah manual".',
  },
];

const CRITERIA = [
  { id: 'pengalaman', name: 'Pengalaman acara', weight: 60 },
  { id: 'ide', name: 'Ide dan kreativitas', weight: 40 },
] as const;
type CriterionId = (typeof CRITERIA)[number]['id'];

const SCALE = ['Kurang sekali', 'Kurang', 'Cukup', 'Baik', 'Sangat baik'];
const QUOTA = 2;
const MINIMUM = 75;

type Row = {
  id: string;
  name: string;
  nim: string;
  answers: [string, string][];
};

const ROWS: Row[] = [
  {
    id: 'raka',
    name: 'Raka Pradipta',
    nim: '13524011',
    answers: [
      ['Ceritakan pengalaman menyusun rundown', 'Menyusun rundown malam keakraban angkatan untuk 180 peserta.'],
      ['Ide acara pembuka menurut Anda', 'Parade karya tiap himpunan dengan narasi singkat dari pembawa acara.'],
    ],
  },
  {
    id: 'laras',
    name: 'Laras Ayuningtyas',
    nim: '15523018',
    answers: [
      ['Ceritakan pengalaman menyusun rundown', 'Koordinator acara lomba tingkat fakultas.'],
      ['Ide acara pembuka menurut Anda', 'Video kilas balik lalu sambutan singkat ketua pelaksana.'],
    ],
  },
  {
    id: 'bima',
    name: 'Bima Arya Setiadi',
    nim: '13224057',
    answers: [
      ['Ceritakan pengalaman menyusun rundown', 'Belum pernah, tetapi pernah jadi stage crew di dua acara himpunan.'],
      ['Ide acara pembuka menurut Anda', 'Pertunjukan perkusi dari barang bekas buatan peserta pameran.'],
    ],
  },
];

type Scores = Record<string, Partial<Record<CriterionId, number>>>;
type Override = { status: ChoiceStatus; reason: string; sensitive: boolean };

const INITIAL_SCORES: Scores = {
  raka: { pengalaman: 5, ide: 4 },
  laras: { pengalaman: 4, ide: 4 },
  bima: {},
};

function total(scores: Scores[string] | undefined): number | null {
  if (!scores) return null;
  let sum = 0;
  for (const criterion of CRITERIA) {
    const value = scores[criterion.id];
    if (value === undefined) return null;
    sum += (value / 5) * criterion.weight;
  }
  return Math.round(sum);
}

/** Peringkat dalam kuota dengan nilai minimum, seperti metode status bawaan. */
function computeStatus(scores: Scores): Record<string, ChoiceStatus> {
  const ranked = ROWS.map((row) => ({ id: row.id, score: total(scores[row.id]) }))
    .filter((row): row is { id: string; score: number } => row.score !== null)
    .sort((a, b) => b.score - a.score);
  const result: Record<string, ChoiceStatus> = {};
  for (const row of ROWS) result[row.id] = 'belum_lengkap';
  ranked.forEach((row, index) => {
    result[row.id] =
      index < QUOTA && row.score >= MINIMUM ? 'lolos' : 'tidak_lolos';
  });
  return result;
}

export default function OprecNilaiDemo() {
  return (
    <DemoFrame
      title="Menilai berkas pendaftar"
      location="Lembaga › Oprec › Festival Karya 2026 › Nilai"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [view, setView] = useState<'berkas' | 'sheet'>('berkas');
  const [activeId, setActiveId] = useState('raka');
  const [scores, setScores] = useState(INITIAL_SCORES);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Override>({
    status: 'lolos',
    reason: '',
    sensitive: false,
  });
  const [reasonError, setReasonError] = useState(false);

  const computed = computeStatus(scores);
  const effective = (id: string): ChoiceStatus =>
    overrides[id]?.status ?? computed[id] ?? 'belum_lengkap';
  const active = ROWS.find((row) => row.id === activeId) ?? ROWS[0]!;
  const activeTotal = total(scores[active.id]);
  const override = overrides[active.id];

  const setScore = (criterion: CriterionId, value: number) => {
    const next = {
      ...scores,
      [active.id]: { ...scores[active.id], [criterion]: value },
    };
    setScores(next);
    if (active.id === 'bima' && total(next.bima) !== null) {
      guide.complete('skor');
    }
  };

  const saveOverride = () => {
    if (draft.reason.trim() === '') {
      setReasonError(true);
      return;
    }
    setOverrides((prev) => ({ ...prev, [active.id]: draft }));
    setEditing(false);
    guide.complete('ubah');
  };

  return (
    <div>
      <ScreenTitle
        title="Nilai"
        subtitle={`Kuota ${QUOTA} · nilai minimum ${MINIMUM} · peringkat dalam kuota dengan nilai minimum`}
        actions={
          <>
            <select
              aria-label="Lingkup penilaian"
              defaultValue="acara"
              className={cn(inputClass, 'h-8 w-36 text-xs')}
            >
              <option value="acara">Divisi Acara</option>
            </select>
            <div
              role="group"
              aria-label="Tampilan"
              className="flex rounded-lg border border-neutral-400 p-0.5"
            >
              {(
                [
                  ['berkas', 'Per berkas'],
                  ['sheet', 'Sheet'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={view === id}
                  onClick={() => {
                    setView(id);
                    if (id === 'sheet') guide.complete('sheet');
                  }}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                    view === id
                      ? 'bg-primary-400 text-white'
                      : 'text-neutral-800 hover:bg-neutral-200',
                    id === 'sheet' && guide.spot('sheet'),
                    id === 'berkas' && view === 'sheet' && guide.spot('ubah'),
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        }
      />

      {view === 'sheet' ? (
        <div className="overflow-x-auto rounded-lg border border-neutral-400">
          <table className="w-full min-w-[480px] border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Pendaftar</th>
                {CRITERIA.map((criterion) => (
                  <th key={criterion.id} className={thClass}>
                    {criterion.name}
                    <span className="block font-normal text-neutral-700">
                      bobot {criterion.weight}%
                    </span>
                  </th>
                ))}
                <th className={thClass}>Nilai</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.id}>
                  <td className={tdClass}>
                    <span className="font-semibold">{row.name}</span>
                  </td>
                  {CRITERIA.map((criterion) => (
                    <td key={criterion.id} className={tdClass}>
                      {scores[row.id]?.[criterion.id] ?? '—'}
                    </td>
                  ))}
                  <td className={cn(tdClass, 'font-semibold')}>
                    {total(scores[row.id]) ?? '—'}
                  </td>
                  <td className={tdClass}>
                    <Pill tone={STATUS_TONE[effective(row.id)]}>
                      {STATUS_LABEL[effective(row.id)]}
                    </Pill>
                    {overrides[row.id] ? (
                      <span className="ml-1 text-xs text-neutral-700">
                        diubah manual
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[190px_1fr]">
          <div>
            <p className="mb-1 text-xs font-semibold text-neutral-700">
              Antrean penilaian
            </p>
            <ul className="space-y-1">
              {ROWS.map((row) => {
                const complete = total(scores[row.id]) !== null;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      aria-current={row.id === active.id}
                      onClick={() => {
                        setActiveId(row.id);
                        setEditing(false);
                        if (row.id === 'bima') guide.complete('pilih');
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                        row.id === active.id
                          ? 'border-primary-400 bg-primary-100'
                          : 'border-neutral-400 hover:border-primary-400',
                        row.id === 'bima' && guide.spot('pilih'),
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded-full border',
                          complete
                            ? 'border-success-dark bg-success-dark text-white'
                            : 'border-neutral-500',
                        )}
                      >
                        {complete ? (
                          <Check className="size-3" aria-label="Selesai dinilai" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">
                          {row.name}
                        </span>
                        <span className="block text-[11px] text-neutral-700">
                          {STATUS_LABEL[effective(row.id)]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{active.name}</p>
                <p className="text-xs text-neutral-700">
                  NIM {active.nim} · Pilihan 1: Divisi Acara
                </p>
              </div>
              <span className="text-xs text-neutral-700">
                {activeTotal === null ? 'Belum dihitung' : `Skor ${activeTotal}`}
              </span>
              <Pill tone={STATUS_TONE[effective(active.id)]}>
                {STATUS_LABEL[effective(active.id)]}
              </Pill>
              {override ? <Pill tone="warning">diubah manual</Pill> : null}
            </div>

            <dl className="space-y-2 rounded-lg bg-neutral-100 p-3">
              {active.answers.map(([question, answer]) => (
                <div key={question}>
                  <dt className="text-xs font-semibold text-neutral-700">
                    {question}
                  </dt>
                  <dd>{answer}</dd>
                </div>
              ))}
            </dl>

            {CRITERIA.map((criterion) => {
              const value = scores[active.id]?.[criterion.id];
              return (
                <div
                  key={criterion.id}
                  className={cn(
                    'rounded-lg border border-neutral-400 p-3',
                    active.id === 'bima' &&
                      value === undefined &&
                      guide.spot('skor'),
                  )}
                >
                  <div className="flex items-center gap-2">
                    <p className="flex-1 font-semibold">{criterion.name}</p>
                    <span className="text-xs text-neutral-700">
                      bobot {criterion.weight}%
                    </span>
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={`Skor ${criterion.name}`}
                    className="mt-2 flex flex-wrap gap-1.5"
                  >
                    {SCALE.map((label, index) => (
                      <button
                        key={label}
                        type="button"
                        role="radio"
                        aria-checked={value === index + 1}
                        title={label}
                        onClick={() => setScore(criterion.id, index + 1)}
                        className={cn(
                          'flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                          value === index + 1
                            ? 'border-primary-400 bg-primary-400 text-white'
                            : 'border-neutral-400 hover:border-primary-400',
                        )}
                      >
                        {index + 1}
                      </button>
                    ))}
                    {value ? (
                      <span className="self-center text-xs text-neutral-700">
                        {SCALE[value - 1]}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}

            <div className="rounded-lg border border-neutral-400 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-neutral-700">Hitungan</span>
                <Pill tone={STATUS_TONE[computed[active.id] ?? 'belum_lengkap']}>
                  {STATUS_LABEL[computed[active.id] ?? 'belum_lengkap']}
                </Pill>
                <span className="text-neutral-700">Efektif</span>
                <Pill tone={STATUS_TONE[effective(active.id)]}>
                  {STATUS_LABEL[effective(active.id)]}
                </Pill>
                <span className="ml-auto flex gap-2">
                  {override ? (
                    <Btn
                      small
                      tone="ghost"
                      onClick={() =>
                        setOverrides((prev) => {
                          const next = { ...prev };
                          delete next[active.id];
                          return next;
                        })
                      }
                    >
                      Kembalikan ke hitungan
                    </Btn>
                  ) : null}
                  <Btn
                    small
                    tone="outline"
                    className={editing ? '' : guide.spot('ubah')}
                    onClick={() => {
                      setDraft({
                        status:
                          effective(active.id) === 'lolos'
                            ? 'tidak_lolos'
                            : 'lolos',
                        reason: '',
                        sensitive: false,
                      });
                      setReasonError(false);
                      setEditing(true);
                    }}
                  >
                    {override ? 'Ubah lagi' : 'Ubah status'}
                  </Btn>
                </span>
              </div>
              {override && !editing ? (
                <p className="mt-2 text-xs text-neutral-800">
                  Alasan:{' '}
                  {override.sensitive ? 'Alasan disembunyikan' : override.reason}
                </p>
              ) : null}
              {editing ? (
                <div className="mt-3 space-y-2">
                  <Field label="Status baru" className="max-w-[180px]">
                    {(id) => (
                      <select
                        id={id}
                        value={draft.status}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            status: event.target.value as ChoiceStatus,
                          })
                        }
                        className={inputClass}
                      >
                        <option value="lolos">Lolos</option>
                        <option value="tidak_lolos">Tidak lolos</option>
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
                          setDraft({ ...draft, reason: event.target.value });
                          setReasonError(false);
                        }}
                        className={cn(inputClass, 'h-auto py-2', guide.spot('ubah'))}
                      />
                    )}
                  </Field>
                  {reasonError ? (
                    <p role="alert" className="text-xs font-semibold text-danger-dark">
                      Alasan wajib diisi.
                    </p>
                  ) : null}
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={draft.sensitive}
                      onChange={(event) =>
                        setDraft({ ...draft, sensitive: event.target.checked })
                      }
                      className="size-4 accent-[#2B6282]"
                    />
                    Alasan sensitif (hanya terlihat pengambil keputusan)
                  </label>
                  <div className="flex justify-end gap-2">
                    <Btn small tone="ghost" onClick={() => setEditing(false)}>
                      Batal
                    </Btn>
                    <Btn small onClick={saveOverride}>
                      Simpan
                    </Btn>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
