'use client';

// Library Import
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Search,
  Sparkles,
} from 'lucide-react';
import { type ReactNode, useDeferredValue, useState } from 'react';

import { cn } from '~/lib/utils';

import {
  DEMO_DIVISIONS,
  DEMO_EVENT,
  DEMO_LEMBAGA,
  divisionName,
  type DemoDivision,
} from '../data';
import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import {
  Btn,
  Empty,
  Field,
  inputClass,
  Modal,
  Pill,
  tdClass,
  thClass,
  useFlash,
} from '../ui';
import {
  APPLICANTS,
  STATUS_LABEL,
  STATUS_TONE,
  type Applicant,
  type ChoiceStatus,
} from './oprec-data';

const STEPS: DemoStep[] = [
  {
    id: 'isi',
    title: 'Klik **Isi dari penilaian**, periksa pratinjaunya, lalu **Terapkan**',
    hint: 'Hanya yang belum diputuskan yang diisi. Keputusan yang sudah ada tidak ditimpa.',
  },
  {
    id: 'putus',
    title: 'Putuskan pendaftar yang masih **Menunggu** dengan **Terima** atau **Tolak**',
    hint: 'Coba terima saat kuota sudah penuh: Anmategra meminta konfirmasi lebih dulu.',
  },
  {
    id: 'banding',
    title: 'Klik **Masuk masa banding**, lalu **Lanjutkan**',
  },
  {
    id: 'terima-banding',
    title: 'Pada pendaftar yang ditolak, klik **Terima lewat banding** dan isi alasannya',
  },
  {
    id: 'final',
    title: 'Klik **Tetapkan final**, lalu **Lanjutkan**',
    hint: 'Setelah final, keputusan tidak bisa diubah.',
  },
];

const TABS = [
  ['pendaftar', 'Pendaftar'],
  ['nilai', 'Nilai'],
  ['prioritas', 'Prioritas'],
  ['penempatan', 'Penempatan'],
  ['hasil', 'Hasil'],
  ['pengaturan', 'Pengaturan'],
] as const;

const textareaClass =
  'min-h-24 w-full rounded-lg border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm text-neutral-1000 placeholder:text-neutral-500 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400';

type Decision = 'menunggu' | 'terima' | 'tolak';
type PlacementState = 'berjalan' | 'masa_banding' | 'final';

const STATE_LABEL: Record<PlacementState, string> = {
  berjalan: 'Berjalan',
  masa_banding: 'Masa banding',
  final: 'Final',
};

const STATE_HELP: Record<PlacementState, string> = {
  berjalan: 'Keputusan masih bisa diubah selama belum masuk masa banding.',
  masa_banding:
    'Pendaftar yang ditolak bisa diterima lewat banding, dan pengurus divisi bisa meminta pindah divisi.',
  final: 'Penempatan sudah final. Semua perubahan dikunci.',
};

type ChipTone = 'primary' | 'success' | 'danger' | 'warning' | 'muted';

const CHIP_TONE: Record<ChipTone, string> = {
  primary: 'bg-primary-100 text-primary-500',
  success: 'bg-success-light text-success-dark',
  danger: 'bg-danger-light text-danger-dark',
  warning: 'bg-warning-light text-neutral-1000',
  muted: 'bg-neutral-200 text-neutral-700',
};

/** Chip kecil, meniru komponen Chip di halaman penempatan asli. */
function Chip({
  children,
  tone = 'primary',
  title,
}: {
  children: ReactNode;
  tone?: ChipTone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        CHIP_TONE[tone],
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Catatan netral pembungkus, dipakai untuk keadaan kosong. */
function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4 text-sm text-neutral-700">
      {children}
    </p>
  );
}

type ApplicantChoice = Applicant['choices'][number];

type DivisionRow = {
  key: string;
  applicant: Applicant;
  choiceIndex: number;
  divisionId: string;
  score: number | null;
  status: ChoiceStatus;
  rank: number;
};

type Stage =
  | { kind: 'aktif'; label: string }
  | { kind: 'menunggu_pilihan_sebelumnya'; label: string }
  | { kind: 'ditolak'; label: string }
  | { kind: 'diterima'; label: string }
  | { kind: 'diterima_di_lain'; label: string };

function keyOf(applicantId: string, divisionId: string) {
  return `${applicantId}:${divisionId}`;
}

function getDecision(
  decisions: Record<string, Decision>,
  key: string,
): Decision {
  return decisions[key] ?? 'menunggu';
}

/** Tahap satu pilihan: aktif, menunggu pilihan sebelumnya, atau sudah diputuskan. */
function stageOf(
  applicant: Applicant,
  index: number,
  decisions: Record<string, Decision>,
): Stage {
  const choice = applicant.choices[index];
  if (!choice) return { kind: 'aktif', label: 'siap diputuskan' };

  const decision = getDecision(decisions, keyOf(applicant.id, choice.division));
  if (decision === 'terima') return { kind: 'diterima', label: 'diterima' };
  if (decision === 'tolak') return { kind: 'ditolak', label: 'ditolak' };

  for (let i = 0; i < index; i += 1) {
    const previous = applicant.choices[i];
    if (!previous) continue;
    const previousDecision = getDecision(
      decisions,
      keyOf(applicant.id, previous.division),
    );
    if (previousDecision === 'terima') {
      return {
        kind: 'diterima_di_lain',
        label: 'sudah diterima di pilihan lain',
      };
    }
    if (previousDecision === 'menunggu') {
      return {
        kind: 'menunggu_pilihan_sebelumnya',
        label: 'menunggu pilihan sebelumnya',
      };
    }
  }

  return { kind: 'aktif', label: 'siap diputuskan' };
}

function rowsForDivision(divisionId: string): DivisionRow[] {
  const rows: DivisionRow[] = [];
  for (const applicant of APPLICANTS) {
    applicant.choices.forEach((choice, index) => {
      if (choice.division !== divisionId) return;
      rows.push({
        key: keyOf(applicant.id, choice.division),
        applicant,
        choiceIndex: index,
        divisionId,
        score: choice.score,
        status: choice.status,
        rank: index + 1,
      });
    });
  }
  return rows.sort(
    (a, b) => a.rank - b.rank || (b.score ?? 0) - (a.score ?? 0),
  );
}

function acceptedCount(
  divisionId: string,
  decisions: Record<string, Decision>,
): number {
  let count = 0;
  for (const applicant of APPLICANTS) {
    for (const choice of applicant.choices) {
      if (choice.division !== divisionId) continue;
      if (getDecision(decisions, keyOf(applicant.id, choice.division)) === 'terima') {
        count += 1;
      }
    }
  }
  return count;
}

function acceptedChoiceOf(
  applicant: Applicant,
  decisions: Record<string, Decision>,
): ApplicantChoice | null {
  for (const choice of applicant.choices) {
    if (getDecision(decisions, keyOf(applicant.id, choice.division)) === 'terima') {
      return choice;
    }
  }
  return null;
}

function acceptedApplicantsFor(
  divisionId: string,
  decisions: Record<string, Decision>,
): { applicant: Applicant; choice: ApplicantChoice }[] {
  const result: { applicant: Applicant; choice: ApplicantChoice }[] = [];
  for (const applicant of APPLICANTS) {
    for (const choice of applicant.choices) {
      if (choice.division !== divisionId) continue;
      if (getDecision(decisions, keyOf(applicant.id, choice.division)) === 'terima') {
        result.push({ applicant, choice });
      }
    }
  }
  return result;
}

type AutofillPlan = {
  next: Record<string, Decision>;
  applied: number;
  skipped: Set<string>;
  rows: {
    division: DemoDivision;
    terima: number;
    tolak: number;
    dilewati: number;
    remaining: number;
  }[];
};

/** Hitung isi otomatis tanpa menimpa keputusan yang sudah ada. */
function computeAutofill(
  decisions: Record<string, Decision>,
  skipKey: string,
): AutofillPlan {
  const next: Record<string, Decision> = { ...decisions };
  const skipped = new Set<string>();
  let applied = 0;

  for (const applicant of APPLICANTS) {
    for (let index = 0; index < applicant.choices.length; index += 1) {
      const choice = applicant.choices[index];
      if (!choice) continue;

      const key = keyOf(applicant.id, choice.division);
      if (getDecision(next, key) !== 'menunggu') continue;
      if (key === skipKey) {
        skipped.add(key);
        continue;
      }

      const stage = stageOf(applicant, index, next);
      if (stage.kind !== 'aktif') {
        skipped.add(key);
        continue;
      }

      next[key] = choice.status === 'lolos' ? 'terima' : 'tolak';
      applied += 1;
    }
  }

  const rows = DEMO_DIVISIONS.map((division) => {
    let terima = 0;
    let tolak = 0;
    let dilewati = 0;

    for (const applicant of APPLICANTS) {
      for (const choice of applicant.choices) {
        if (choice.division !== division.id) continue;
        const key = keyOf(applicant.id, choice.division);
        if (getDecision(decisions, key) !== 'menunggu') continue;

        const after = getDecision(next, key);
        if (after === 'terima') terima += 1;
        else if (after === 'tolak') tolak += 1;
        else if (skipped.has(key)) dilewati += 1;
      }
    }

    const acceptedBefore = acceptedCount(division.id, decisions);
    return {
      division,
      terima,
      tolak,
      dilewati,
      remaining: division.quota - (acceptedBefore + terima),
    };
  });

  return { next, applied, skipped, rows };
}

type Dialog =
  | { kind: 'autofill' }
  | { kind: 'quota'; choiceKey: string }
  | { kind: 'appeal'; choiceKey: string }
  | { kind: 'state'; to: PlacementState };

export default function OprecPenempatanDemo() {
  return (
    <DemoFrame
      title="Penempatan pendaftar"
      location="Lembaga › Oprec › Aku Masuk ITB 2027 › Penempatan"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [state, setState] = useState<PlacementState>('berjalan');
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [appealed, setAppealed] = useState<string[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [reason, setReason] = useState('');
  const [pickedDivision, setPickedDivision] = useState(
    DEMO_DIVISIONS[0]?.id ?? '',
  );
  const [rank, setRank] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const { flash, node } = useFlash();

  const activeDivision =
    DEMO_DIVISIONS.find((division) => division.id === pickedDivision) ??
    DEMO_DIVISIONS[0];

  if (!activeDivision) {
    return (
      <div className="relative h-[560px]">
        <Empty>Belum ada divisi tujuan. Tambahkan divisi lewat pengaturan oprec.</Empty>
        {node}
      </div>
    );
  }

  const divisionRows = rowsForDivision(activeDivision.id);
  const accepted = acceptedCount(activeDivision.id, decisions);
  const remaining = activeDivision.quota - accepted;
  const isFinal = state === 'final';

  let pending = 0;
  let waiting = 0;
  for (const row of divisionRows) {
    if (getDecision(decisions, row.key) !== 'menunggu') continue;
    const stage = stageOf(row.applicant, row.choiceIndex, decisions);
    if (stage.kind === 'aktif') pending += 1;
    else if (stage.kind === 'menunggu_pilihan_sebelumnya') waiting += 1;
  }

  const ranks = Array.from(new Set(divisionRows.map((row) => row.rank))).sort(
    (a, b) => a - b,
  );

  const query = deferredSearch.toLowerCase();
  const searchedRows = divisionRows.filter((row) => {
    if (rank !== null && row.rank !== rank) return false;
    return (
      query === '' ||
      row.applicant.name.toLowerCase().includes(query) ||
      row.applicant.nim.includes(query)
    );
  });

  const autofillSkipKey =
    divisionRows.find((row) => {
      const stage = stageOf(row.applicant, row.choiceIndex, decisions);
      return getDecision(decisions, row.key) === 'menunggu' && stage.kind === 'aktif';
    })?.key ?? '';

  const autofill = computeAutofill(decisions, autofillSkipKey);

  const firstWaitingKey =
    searchedRows.find((row) => {
      const stage = stageOf(row.applicant, row.choiceIndex, decisions);
      return (
        getDecision(decisions, row.key) === 'menunggu' &&
        stage.kind === 'aktif' &&
        acceptedChoiceOf(row.applicant, decisions) === null
      );
    })?.key ?? null;

  const dialogRow =
    dialog && 'choiceKey' in dialog
      ? divisionRows.find((row) => row.key === dialog.choiceKey)
      : undefined;

  const decide = (key: string, decision: Decision) => {
    setDecisions((prev) => ({ ...prev, [key]: decision }));
    flash('Keputusan disimpan.');
    guide.complete('putus');
  };

  const accept = (row: DivisionRow) => {
    const other = acceptedChoiceOf(row.applicant, decisions);
    if (other && other.division !== row.divisionId) {
      flash(
        `${row.applicant.name} sudah diterima di ${divisionName(other.division)}. Satu pendaftar hanya bisa diterima di satu divisi.`,
      );
      return;
    }

    if (
      activeDivision.quota > 0 &&
      acceptedCount(row.divisionId, decisions) >= activeDivision.quota
    ) {
      setDialog({ kind: 'quota', choiceKey: row.key });
      return;
    }

    decide(row.key, 'terima');
  };

  const applyAutofill = () => {
    setDecisions(autofill.next);
    setDialog(null);
    guide.complete('isi');
    flash(`${autofill.applied} keputusan diisi dari penilaian.`);
  };

  const submitAppeal = () => {
    if (!dialogRow || reason.trim() === '') return;

    const other = acceptedChoiceOf(dialogRow.applicant, decisions);
    if (other && other.division !== dialogRow.divisionId) {
      flash(
        `${dialogRow.applicant.name} sudah diterima di ${divisionName(other.division)}. Satu pendaftar hanya bisa diterima di satu divisi.`,
      );
      setDialog(null);
      return;
    }

    setDecisions((prev) => ({ ...prev, [dialogRow.key]: 'terima' }));
    setAppealed((prev) =>
      prev.includes(dialogRow.key) ? prev : [...prev, dialogRow.key],
    );
    setReason('');
    setDialog(null);
    guide.complete('terima-banding');
    flash('Penerimaan lewat banding disimpan.');
  };

  const changeState = (to: PlacementState) => {
    setState(to);
    if (to === 'masa_banding') {
      // Langkah yang sudah terlewat ditandai selesai agar panduan tidak macet.
      guide.complete('isi');
      guide.complete('putus');
      guide.complete('banding');
    } else if (to === 'final') {
      STEPS.forEach((step) => guide.complete(step.id));
    }
    flash(`Keadaan penempatan diubah menjadi ${STATE_LABEL[to]}.`);
    setDialog(null);
  };

  return (
    <div className="relative h-[560px]">
      <div className="h-full overflow-y-auto pr-1">
        <header>
          <h1 className="mt-2 break-words text-2xl font-semibold text-neutral-1000 sm:text-[32px]">
            Penempatan
          </h1>
          <p className="mt-1 text-sm text-neutral-700">
            {DEMO_EVENT} · {DEMO_LEMBAGA}. Putuskan tiap pilihan dan pantau
            kuota divisi.
          </p>
          <p className="mt-1 text-xs text-neutral-700">
            2.641 pendaftar · 30 divisi
          </p>
        </header>

        <div className="mt-4 grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-success-light px-3 py-1 text-sm font-semibold text-success-dark">
              Dibuka
            </span>
            <Btn
              small
              tone="outline"
              onClick={() =>
                flash('Formulir oprec dibuka di tab lain pada aplikasi asli.')
              }
            >
              <FileText aria-hidden /> Formulir
            </Btn>
            <Btn
              small
              tone="outline"
              onClick={() => flash('Status oprec tidak diubah di simulasi.')}
            >
              Tutup pendaftaran
            </Btn>
          </div>
        </div>

        <nav
          aria-label="Bagian oprec"
          className="mt-6 flex flex-wrap gap-1 border-b border-neutral-400"
        >
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={id === 'penempatan' ? 'page' : undefined}
              onClick={() => {
                if (id !== 'penempatan') {
                  flash('Hanya tab Penempatan yang disimulasikan.');
                }
              }}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                id === 'penempatan'
                  ? 'border-primary-400 text-primary-400'
                  : 'border-transparent text-neutral-700 hover:text-neutral-1000',
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        <section
          aria-label="Keadaan penempatan"
          className="mt-6 grid gap-3 rounded-[24px] border border-neutral-400 bg-neutral-50 p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-neutral-1000">
              Keadaan
            </span>
            <Chip tone={state === 'final' ? 'success' : 'primary'}>
              {STATE_LABEL[state]}
            </Chip>
          </div>
          <p className="text-sm text-neutral-700">{STATE_HELP[state]}</p>

          <div className="flex flex-wrap gap-2">
            {state === 'berjalan' ? (
              <Btn
                small
                className={guide.spot('banding')}
                onClick={() => setDialog({ kind: 'state', to: 'masa_banding' })}
              >
                Masuk masa banding
              </Btn>
            ) : null}
            {state === 'masa_banding' ? (
              <>
                <Btn
                  small
                  tone="outline"
                  onClick={() => setDialog({ kind: 'state', to: 'berjalan' })}
                >
                  Kembali ke berjalan
                </Btn>
                <Btn
                  small
                  className={guide.spot('final')}
                  onClick={() => setDialog({ kind: 'state', to: 'final' })}
                >
                  Tetapkan final
                </Btn>
              </>
            ) : null}
            {state === 'final' ? (
              <>
                <Btn
                  small
                  tone="outline"
                  onClick={() => setDialog({ kind: 'state', to: 'masa_banding' })}
                >
                  Buka masa banding lagi
                </Btn>
                <p
                  role="status"
                  className="rounded-xl bg-warning-light px-3 py-2 text-sm text-neutral-1000"
                >
                  Penempatan sudah final. Semua kontrol pengubahan nonaktif.
                </p>
              </>
            ) : null}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
          <nav aria-label="Divisi" className="flex flex-wrap gap-1">
            {DEMO_DIVISIONS.map((division) => {
              const active = division.id === activeDivision.id;
              return (
                <button
                  key={division.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setPickedDivision(division.id);
                    setSearch('');
                    setRank(null);
                  }}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                    active
                      ? 'bg-primary-200 text-primary-400'
                      : 'border border-neutral-400 text-neutral-700 hover:bg-neutral-200',
                  )}
                >
                  {division.name}
                </button>
              );
            })}
          </nav>
          <Btn
            small
            tone="outline"
            disabled={isFinal}
            className={guide.spot('isi')}
            onClick={() => setDialog({ kind: 'autofill' })}
          >
            <Sparkles aria-hidden /> Isi dari penilaian
          </Btn>
        </div>

        <div className="mt-4 grid gap-2 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
              Kuota
            </p>
            <p className="text-lg font-semibold text-neutral-1000">
              {activeDivision.quota === 0 ? 'Tanpa batas' : activeDivision.quota}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
              Diterima
            </p>
            <p className="text-lg font-semibold text-neutral-1000">{accepted}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
              Sisa
            </p>
            <p className="text-lg font-semibold text-neutral-1000">
              {activeDivision.quota === 0 ? 'Tanpa batas' : Math.max(0, remaining)}
            </p>
          </div>

          {activeDivision.quota > 0 && accepted > activeDivision.quota ? (
            <p className="rounded-xl bg-warning-light px-3 py-2 text-sm text-neutral-1000 sm:col-span-3">
              Diterima melebihi kuota ({accepted} dari {activeDivision.quota}).
              Penerimaan tetap sah, tetapi perlu ditinjau.
            </p>
          ) : null}

          <p className="text-sm text-neutral-700 sm:col-span-3">
            {pending} pilihan aktif belum diputuskan · {waiting} menunggu pilihan
            sebelumnya.
          </p>

          <div className="flex items-center gap-2 sm:col-span-3">
            <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-neutral-200">
              <div
                className={cn(
                  'h-full rounded-full',
                  activeDivision.quota > 0 && accepted > activeDivision.quota
                    ? 'bg-tomato'
                    : 'bg-secondary-400',
                )}
                style={{
                  width: `${
                    activeDivision.quota === 0
                      ? 0
                      : Math.min(100, (accepted / activeDivision.quota) * 100)
                  }%`,
                }}
              />
            </div>
            <span className="text-xs text-neutral-700">
              {accepted}/{activeDivision.quota === 0 ? '∞' : activeDivision.quota}{' '}
              terisi
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1">
          <button
            type="button"
            aria-pressed={rank === null}
            onClick={() => setRank(null)}
            className={cn(
              'rounded-full px-3 py-1 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
              rank === null
                ? 'bg-primary-200 text-primary-400'
                : 'border border-neutral-400 text-neutral-700 hover:bg-neutral-200',
            )}
          >
            Semua
          </button>
          {ranks.map((value) => {
            const rankRows = divisionRows.filter((row) => row.rank === value);
            const pendingRank = rankRows.filter((row) => {
              const stage = stageOf(row.applicant, row.choiceIndex, decisions);
              return (
                getDecision(decisions, row.key) === 'menunggu' &&
                stage.kind === 'aktif'
              );
            }).length;
            const doneRank = rankRows.filter(
              (row) => getDecision(decisions, row.key) !== 'menunggu',
            ).length;

            return (
              <button
                key={value}
                type="button"
                aria-pressed={rank === value}
                onClick={() => setRank(value)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  rank === value
                    ? 'bg-primary-200 text-primary-400'
                    : 'border border-neutral-400 text-neutral-700 hover:bg-neutral-200',
                )}
              >
                Pilihan {value}
                {pendingRank > 0 ? (
                  <Chip tone="warning">{pendingRank}</Chip>
                ) : doneRank === rankRows.length && rankRows.length > 0 ? (
                  <span aria-label="selesai" className="text-success-dark">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
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
              className={cn(
                inputClass,
                'rounded-lg border-neutral-400 bg-neutral-50 pl-9',
              )}
            />
          </div>
        </div>

        <div className="mt-4" role="region" aria-label="Daftar pendaftar divisi">
          {searchedRows.length === 0 ? (
            <Notice>
              Tidak ada pendaftar yang cocok di divisi dan pilihan ini.
            </Notice>
          ) : (
            <>
              <div className="overflow-x-auto rounded-[24px] border border-neutral-400 bg-neutral-50">
                <table className="w-full min-w-[760px] border-collapse">
                  <caption className="sr-only">
                    Daftar pendaftar divisi {activeDivision.name}
                  </caption>
                  <thead>
                    <tr>
                      <th className={thClass}>Pendaftar</th>
                      <th className={cn(thClass, 'whitespace-nowrap')}>
                        Skor &amp; status
                      </th>
                      <th className={thClass}>Pilihan</th>
                      <th className={thClass}>Keputusan</th>
                      <th className={thClass}>Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchedRows.map((row) => {
                      const decision = getDecision(decisions, row.key);
                      const targetStage = stageOf(
                        row.applicant,
                        row.choiceIndex,
                        decisions,
                      );
                      const acceptedChoice = acceptedChoiceOf(
                        row.applicant,
                        decisions,
                      );
                      const acceptedElsewhere =
                        acceptedChoice !== null &&
                        acceptedChoice.division !== row.divisionId;
                      const isAppealed = appealed.includes(row.key);
                      const canDecide =
                        state === 'berjalan' &&
                        targetStage.kind === 'aktif' &&
                        !acceptedElsewhere;
                      const canAppeal =
                        state === 'masa_banding' &&
                        decision !== 'terima' &&
                        !acceptedElsewhere &&
                        targetStage.kind !== 'menunggu_pilihan_sebelumnya' &&
                        (decision === 'tolak' || row.status !== 'lolos');
                      const spotClass =
                        row.key === firstWaitingKey ? guide.spot('putus') : '';

                      return (
                        <tr key={row.key} className="align-top">
                          <td className={cn(tdClass, 'min-w-52')}>
                            <span className="font-semibold text-neutral-1000">
                              {row.applicant.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-neutral-700">
                              {[
                                row.applicant.nim,
                                row.applicant.prodi,
                                row.applicant.angkatan,
                              ].join(' · ')}
                            </span>
                            <span className="mt-1 flex flex-wrap gap-1">
                              {row.applicant.willing ? (
                                <Chip tone="muted" title="Bersedia dipindahkan">
                                  bersedia pindah
                                </Chip>
                              ) : null}
                              {acceptedElsewhere && acceptedChoice ? (
                                <Chip tone="warning">
                                  diterima di {divisionName(acceptedChoice.division)}
                                </Chip>
                              ) : null}
                            </span>
                          </td>

                          <td className={cn(tdClass, 'whitespace-nowrap')}>
                            <div className="grid gap-1">
                              <span className="text-sm font-semibold text-neutral-1000">
                                {row.score ?? '—'}
                              </span>
                              <Pill tone={STATUS_TONE[row.status]}>
                                {STATUS_LABEL[row.status]}
                              </Pill>
                            </div>
                          </td>

                          <td className={cn(tdClass, 'min-w-56')}>
                            <ul className="grid gap-1">
                              {row.applicant.choices.map((choice, index) => {
                                const choiceKey = keyOf(
                                  row.applicant.id,
                                  choice.division,
                                );
                                const choiceDecision = getDecision(
                                  decisions,
                                  choiceKey,
                                );
                                const stage = stageOf(
                                  row.applicant,
                                  index,
                                  decisions,
                                );
                                const tone: ChipTone =
                                  choiceDecision === 'terima'
                                    ? 'success'
                                    : choiceDecision === 'tolak'
                                      ? 'danger'
                                      : stage.kind ===
                                          'menunggu_pilihan_sebelumnya'
                                        ? 'muted'
                                        : 'primary';

                                return (
                                  <li
                                    key={choiceKey}
                                    className="flex flex-wrap items-center gap-1"
                                  >
                                    <Chip tone={tone} title={stage.label}>
                                      Pilihan {index + 1} ·{' '}
                                      {divisionName(choice.division)}
                                    </Chip>
                                    {choiceDecision === 'menunggu' &&
                                    stage.kind !== 'aktif' ? (
                                      <span className="text-xs text-neutral-700">
                                        {stage.label}
                                      </span>
                                    ) : null}
                                    {appealed.includes(choiceKey) ? (
                                      <Chip tone="warning">lewat banding</Chip>
                                    ) : null}
                                  </li>
                                );
                              })}
                            </ul>
                          </td>

                          <td className={cn(tdClass, 'min-w-44')}>
                            {canDecide ? (
                              <div
                                role="group"
                                aria-label="Keputusan pilihan ini"
                                className="flex flex-wrap gap-1"
                              >
                                <Btn
                                  small
                                  tone="outline"
                                  className={spotClass}
                                  onClick={() => accept(row)}
                                >
                                  Terima
                                </Btn>
                                <Btn
                                  small
                                  tone="dangerOutline"
                                  className={spotClass}
                                  onClick={() => decide(row.key, 'tolak')}
                                >
                                  Tolak
                                </Btn>
                              </div>
                            ) : decision === 'terima' ? (
                              <div className="flex flex-wrap items-center gap-1">
                                <Chip tone="success">Diterima</Chip>
                                {isAppealed ? (
                                  <Chip tone="warning">lewat banding</Chip>
                                ) : null}
                              </div>
                            ) : decision === 'tolak' ? (
                              <Chip tone="danger">Ditolak</Chip>
                            ) : (
                              <span className="text-xs text-neutral-700">
                                {targetStage.label}
                              </span>
                            )}
                          </td>

                          <td className={cn(tdClass, 'min-w-36')}>
                            <div className="flex flex-wrap gap-1">
                              {canAppeal ? (
                                <Btn
                                  small
                                  tone="outline"
                                  className={guide.spot('terima-banding')}
                                  onClick={() => {
                                    setReason('');
                                    setDialog({
                                      kind: 'appeal',
                                      choiceKey: row.key,
                                    });
                                  }}
                                >
                                  Terima lewat banding
                                </Btn>
                              ) : (
                                <span className="text-xs text-neutral-700">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Btn small tone="outline" disabled>
                  <ChevronLeft /> Sebelumnya
                </Btn>
                <Btn small tone="outline" disabled>
                  Berikutnya <ChevronRight />
                </Btn>
                <span className="text-sm text-neutral-700">
                  {searchedRows.length} pendaftar · halaman 1 dari 1
                </span>
              </div>
            </>
          )}
        </div>

        <section
          aria-label="Divisi lain yang boleh dilihat"
          className="mt-6 grid gap-2"
        >
          <h2 className="text-lg font-semibold text-neutral-1000">
            Lihat divisi lain
          </h2>
          <p className="text-sm text-neutral-700">
            Kamu hanya bisa melihat nama yang sudah diterima, tanpa mengubah apa
            pun. Satu pendaftar hanya bisa diterima di satu divisi.
          </p>

          {DEMO_DIVISIONS.filter(
            (division) => division.id !== activeDivision.id,
          ).map((division) => {
            const acceptedRows = acceptedApplicantsFor(
              division.id,
              decisions,
            );
            return (
              <details
                key={division.id}
                className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
              >
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-semibold text-neutral-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
                  {division.name}
                  {acceptedRows.length > 0 ? (
                    <Chip tone="success">{acceptedRows.length} diterima</Chip>
                  ) : null}
                </summary>
                <div className="mt-3">
                  {acceptedRows.length === 0 ? (
                    <Notice>Belum ada yang diterima di divisi ini.</Notice>
                  ) : (
                    <ul className="grid gap-2">
                      {acceptedRows.map(({ applicant }) => (
                        <li
                          key={applicant.id}
                          className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-2 last:border-0 last:pb-0"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-neutral-1000">
                              {applicant.name}
                            </span>
                            <span className="block text-xs text-neutral-700">
                              {[
                                applicant.nim,
                                applicant.prodi,
                                applicant.angkatan,
                              ].join(' · ')}
                            </span>
                          </span>
                          <Chip tone="success">diterima</Chip>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            );
          })}
        </section>
      </div>

      {dialog?.kind === 'autofill' ? (
        <Modal
          title="Isi dari penilaian"
          description="Hanya sel aktif yang belum diputuskan yang diisi. Keputusan yang sudah ada tidak ditimpa."
          onClose={() => setDialog(null)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setDialog(null)}>
                Batal
              </Btn>
              <Btn className={guide.spot('isi')} onClick={applyAutofill}>
                Terapkan
              </Btn>
            </>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>Divisi</th>
                  <th className={thClass}>Terima</th>
                  <th className={thClass}>Tolak</th>
                  <th className={thClass}>Dilewati</th>
                  <th className={thClass}>Sisa kuota</th>
                </tr>
              </thead>
              <tbody>
                {autofill.rows.map((row) => (
                  <tr key={row.division.id}>
                    <td className={tdClass}>{row.division.name}</td>
                    <td className={tdClass}>{row.terima}</td>
                    <td className={tdClass}>{row.tolak}</td>
                    <td className={tdClass}>{row.dilewati}</td>
                    <td className={tdClass}>{Math.max(0, row.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-700">
            Pilihan yang menunggu pilihan sebelumnya ikut dilewati. Satu pilihan
            pada divisi {activeDivision.name} dibiarkan agar keputusan manual tetap
            bisa dicoba.
          </p>
        </Modal>
      ) : null}

      {dialog?.kind === 'quota' && dialogRow ? (
        <Modal
          title="Kuota divisi sudah terisi"
          description={`Kuota ${activeDivision.quota} sudah terisi ${acceptedCount(
            dialogRow.divisionId,
            decisions,
          )}. Tetap terima pendaftar ini?`}
          onClose={() => setDialog(null)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setDialog(null)}>
                Batal
              </Btn>
              <Btn
                onClick={() => {
                  decide(dialogRow.key, 'terima');
                  setDialog(null);
                }}
              >
                Tetap terima
              </Btn>
            </>
          }
        >
          <p className="text-sm text-neutral-700">
            Penerimaan di atas kuota tercatat dan ditandai untuk ditinjau.
          </p>
        </Modal>
      ) : null}

      {dialog?.kind === 'appeal' && dialogRow ? (
        <Modal
          title="Terima lewat banding"
          description={`Pilihan ${dialogRow.rank} untuk ${dialogRow.applicant.name} sudah ditolak atau tidak lolos. Alasan wajib diisi.`}
          onClose={() => setDialog(null)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setDialog(null)}>
                Batal
              </Btn>
              <Btn disabled={reason.trim() === ''} onClick={submitAppeal}>
                Terima
              </Btn>
            </>
          }
        >
          <Field label="Alasan">
            {(id) => (
              <textarea
                id={id}
                rows={2}
                value={reason}
                maxLength={2000}
                onChange={(event) => setReason(event.target.value)}
                className={cn(textareaClass, guide.spot('terima-banding'))}
              />
            )}
          </Field>

          {activeDivision.quota > 0 &&
          acceptedCount(dialogRow.divisionId, decisions) >=
            activeDivision.quota ? (
            <p className="rounded-lg bg-warning-light p-2 text-xs text-neutral-1000">
              Kuota {activeDivision.quota} sudah terisi{' '}
              {acceptedCount(dialogRow.divisionId, decisions)}. Alasan banding
              tetap tersimpan dan penerimaan melewati kuota.
            </p>
          ) : null}
        </Modal>
      ) : null}

      {dialog?.kind === 'state' ? (
        <Modal
          title={
            dialog.to === 'final'
              ? 'Tetapkan penempatan final?'
              : dialog.to === 'masa_banding'
                ? 'Ubah keadaan penempatan?'
                : 'Kembali ke berjalan?'
          }
          description={
            dialog.to === 'final'
              ? 'Setelah final, keputusan tidak bisa diubah. Permintaan pindah yang masih terbuka harus diselesaikan dulu.'
              : dialog.to === 'masa_banding'
                ? 'Masa banding membuka permintaan pindah dan penerimaan lewat banding.'
                : 'Permintaan pindah yang terbuka akan dibatalkan saat keluar dari masa banding.'
          }
          onClose={() => setDialog(null)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setDialog(null)}>
                Batal
              </Btn>
              <Btn
                className={guide.spot('banding', 'final')}
                onClick={() => changeState(dialog.to)}
              >
                Lanjutkan
              </Btn>
            </>
          }
        >
          <p className="text-sm text-neutral-700">
            Keadaan sekarang: <strong>{STATE_LABEL[state]}</strong>.
          </p>
        </Modal>
      ) : null}

      {node}
    </div>
  );
}
