'use client';

// Simulasi layar Hasil oprec: keadaan hasil, rilis ke pendaftar, rekap per
// divisi, dan tabel seluruh pendaftar. Semua data hanya ada di memori.
// Library Import
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '~/lib/utils';

import {
  DEMO_DIVISIONS,
  DEMO_EVENT,
  DEMO_LEMBAGA,
  type DemoDivision,
} from '../data';
import { DemoFrame, type DemoGuide, type DemoStep } from '../demo-frame';
import {
  Btn,
  Empty,
  Field,
  Modal,
  Pill,
  TabBar,
  inputClass,
  tdClass,
  thClass,
  useFlash,
} from '../ui';
import { APPLICANTS, type ChoiceStatus } from './oprec-data';

const STEPS: DemoStep[] = [
  {
    id: 'rekap',
    title:
      'Pada **Rekap per divisi**, buka **Lihat 2 nama diterima** di Event Organizer',
  },
  {
    id: 'saring',
    title: 'Ubah saringan **Status akhir** menjadi **Tidak diterima**',
  },
  {
    id: 'rilis',
    title: 'Klik **Rilis hasil ke pendaftar**, lalu **Rilis sekarang**',
    hint: 'Rilis hanya tersedia saat penempatan sudah final.',
  },
  {
    id: 'lihat',
    title:
      'Klik satu baris di tabel untuk melihat apa yang tampil bagi pendaftar itu',
    hint: 'Kembalikan saringan ke **Semua status** bila perlu. Pendaftar hanya melihat diterima di divisi mana atau belum diterima, tanpa nilai maupun alasan.',
  },
  {
    id: 'tarik',
    title: 'Klik **Tarik rilis**, isi alasannya, lalu konfirmasi',
  },
];

const OPREC_NAME = `Open Recruitment Panitia ${DEMO_EVENT}`;
const RELEASED_AT = '17 Nov 2026 10.20';

// Tab mengikuti peran panitia: pengelola saja yang melihat Pendaftar dan
// Pengaturan.
const TABS = [
  ['nilai', 'Nilai'],
  ['penempatan', 'Penempatan'],
  ['hasil', 'Hasil'],
] as const;

// Di demo ukuran halaman dikecilkan supaya penomoran halaman ikut terlihat.
const PAGE_SIZE = 4;

const selectClass = cn(inputClass, 'pr-8');

type FinalStatus = 'diterima' | 'tidak_diterima' | 'belum_diputuskan';

const FINAL: Record<
  FinalStatus,
  { label: string; tone: 'success' | 'danger' | 'warning' }
> = {
  diterima: { label: 'Diterima', tone: 'success' },
  tidak_diterima: { label: 'Tidak diterima', tone: 'danger' },
  belum_diputuskan: { label: 'Belum diputuskan', tone: 'warning' },
};

const FINAL_OPTIONS: [FinalStatus, string][] = [
  ['diterima', 'Diterima'],
  ['tidak_diterima', 'Tidak diterima'],
  ['belum_diputuskan', 'Belum diputuskan'],
];

type ResultChoice = {
  id: string;
  rank: number;
  divisionId: string;
  label: string;
  decision: 'terima' | 'tolak' | null;
  reason: string | undefined;
};

type ResultRow = {
  id: string;
  name: string;
  nim: string;
  prodi: string;
  angkatan: number;
  waveLabel: string;
  finalStatus: FinalStatus;
  acceptedDivisionId: string | null;
  acceptedAt: string | null;
  choices: ResultChoice[];
};

const divisionLabel = (id: string) =>
  DEMO_DIVISIONS.find((division) => division.id === id)?.name ?? id;

// Alasan penolakan hanya untuk pengelola; pendaftar tidak pernah melihatnya.
const REASONS: Record<string, string> = {
  'a1:publikasi': 'Kalah prioritas dari pendaftar berskor lebih tinggi.',
  'a5:logistik': 'Hasil tinjauan: komitmen waktu belum mencukupi.',
  'a5:acara': 'Skor di bawah penerima lain di divisi ini.',
  'a6:publikasi': 'Pilihan kedua; kuota divisi sudah terisi.',
};

const ACCEPTED_AT: Record<string, string> = {
  a1: '17 Nov 2026 10.12',
  a2: '17 Nov 2026 10.12',
  a3: '17 Nov 2026 10.14',
  a4: '17 Nov 2026 10.14',
  a6: '17 Nov 2026 10.15',
};

/** Usulan penempatan: pilihan yang lolos diterima, sisanya ditolak saat final. */
function decisionOf(status: ChoiceStatus): 'terima' | 'tolak' {
  return status === 'lolos' ? 'terima' : 'tolak';
}

const ROWS: ResultRow[] = APPLICANTS.map((applicant) => {
  const choices: ResultChoice[] = applicant.choices.map((choice, index) => ({
    id: `${applicant.id}-${choice.division}`,
    rank: index + 1,
    divisionId: choice.division,
    label: divisionLabel(choice.division),
    decision: decisionOf(choice.status),
    reason: REASONS[`${applicant.id}:${choice.division}`],
  }));
  const accepted = choices.find((choice) => choice.decision === 'terima');
  return {
    id: applicant.id,
    name: applicant.name,
    nim: applicant.nim,
    prodi: applicant.prodi,
    angkatan: applicant.angkatan,
    waveLabel: `Gelombang ${applicant.wave}`,
    finalStatus: accepted ? 'diterima' : 'tidak_diterima',
    acceptedDivisionId: accepted?.divisionId ?? null,
    acceptedAt: accepted ? (ACCEPTED_AT[applicant.id] ?? null) : null,
    choices,
  };
});

export default function OprecHasilDemo() {
  return (
    <DemoFrame
      title="Hasil dan rilis ke pendaftar"
      location="Lembaga › Oprec › Aku Masuk ITB 2027 › Hasil"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [released, setReleased] = useState(false);
  const [dialog, setDialog] = useState<'rilis' | 'tarik' | null>(null);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [status, setStatus] = useState<FinalStatus | ''>('');
  const [page, setPage] = useState(1);
  const [viewId, setViewId] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const { flash, node } = useFlash();

  const query = search.trim().toLowerCase();
  const rows = ROWS.filter(
    (row) =>
      (divisionId === '' || row.acceptedDivisionId === divisionId) &&
      (status === '' || row.finalStatus === status) &&
      (query === '' ||
        row.name.toLowerCase().includes(query) ||
        row.nim.includes(query)),
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const paged = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const accepted = ROWS.filter((row) => row.finalStatus === 'diterima').length;
  const undecided = ROWS.filter(
    (row) => row.finalStatus === 'belum_diputuskan',
  ).length;
  const notAccepted = ROWS.filter(
    (row) => row.finalStatus === 'tidak_diterima',
  ).length;

  const hasFilter = search !== '' || divisionId !== '' || status !== '';
  const viewed = viewId
    ? (ROWS.find((row) => row.id === viewId) ?? null)
    : null;

  const openViewer = (id: string) => {
    setViewId(id);
    if (released) guide.complete('lihat');
  };

  const showDivision = (id: string) => {
    setDivisionId(id);
    setStatus('');
    setPage(1);
    const box = scroller.current;
    const target = tableRef.current;
    if (!box || !target) return;
    box.scrollTo({
      top:
        target.getBoundingClientRect().top -
        box.getBoundingClientRect().top +
        box.scrollTop -
        8,
      behavior: 'smooth',
    });
  };

  const clearFilters = () => {
    setSearch('');
    setDivisionId('');
    setStatus('');
    setPage(1);
  };

  return (
    <>
      <div ref={scroller} className="h-[560px] overflow-y-auto pr-1">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xl font-semibold text-neutral-1000">Hasil</p>
            <p className="mt-1 text-sm text-neutral-700">
              {OPREC_NAME} · {DEMO_LEMBAGA}. Rekap akhir dan rilis ke pendaftar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['csv', 'xlsx'] as const).map((format) => (
              <Btn
                key={format}
                small
                tone="outline"
                onClick={() =>
                  flash(
                    `${format.toUpperCase()} diunduh (simulasi). Tanpa data sensitif di ekspor.`,
                  )
                }
              >
                <Download aria-hidden /> Ekspor {format.toUpperCase()}
              </Btn>
            ))}
          </div>
        </header>

        <div className="mt-4">
          <TabBar
            tabs={TABS}
            value="hasil"
            onChange={() => flash('Hanya tab Hasil yang disimulasikan.')}
            label="Bagian oprec"
          />
        </div>

        <section
          aria-label="Keadaan hasil"
          className="mt-4 grid gap-2 rounded-[24px] border border-neutral-400 bg-neutral-50 p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-neutral-1000">
              Keadaan
            </span>
            <Pill tone="success">Final</Pill>
            {released ? (
              <Pill tone="success">Dirilis {RELEASED_AT}</Pill>
            ) : (
              <Pill tone="neutral">Belum dirilis</Pill>
            )}
          </div>
          <p className="text-sm text-neutral-700">
            Semua pilihan aktif sudah diputuskan.
          </p>
        </section>

        <section
          aria-label="Rilis hasil"
          className="mt-4 rounded-[24px] border border-neutral-400 bg-neutral-50 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-neutral-1000">
                Rilis ke pendaftar
              </p>
              {released ? (
                <p className="mt-1 text-sm text-neutral-700">
                  Dirilis pada {RELEASED_AT} WIB.
                </p>
              ) : (
                <p className="mt-1 text-sm text-neutral-700">
                  Pendaftar baru bisa melihat hasil setelah rilis. Rilis hanya
                  tersedia saat penempatan sudah final.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {released ? (
                <Pill tone="success">Sudah dirilis</Pill>
              ) : (
                <Pill tone="neutral">Belum dirilis</Pill>
              )}
              {!released ? (
                <Btn
                  className={guide.spot('rilis')}
                  onClick={() => setDialog('rilis')}
                >
                  Rilis hasil ke pendaftar
                </Btn>
              ) : (
                <Btn
                  tone="outline"
                  className={guide.spot('tarik')}
                  onClick={() => {
                    setReason('');
                    setDialog('tarik');
                  }}
                >
                  Tarik rilis
                </Btn>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="rekap-divisi" className="mt-6">
          <p
            id="rekap-divisi"
            className="text-lg font-semibold text-neutral-1000"
          >
            Rekap per divisi
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {DEMO_DIVISIONS.map((division) => (
              <DivisionCard
                key={division.id}
                division={division}
                names={ROWS.filter(
                  (row) => row.acceptedDivisionId === division.id,
                )}
                spot={division.id === 'acara' ? guide.spot('rekap') : ''}
                onOpenNames={() => {
                  if (division.id === 'acara') guide.complete('rekap');
                }}
                onPickDivision={() => showDivision(division.id)}
              />
            ))}
          </div>
        </section>

        <section
          ref={tableRef}
          aria-label="Semua pendaftar"
          className="mt-6 scroll-mt-4"
        >
          <p className="text-lg font-semibold text-neutral-1000">
            Semua pendaftar
          </p>
          <div className="mt-3 grid gap-3 rounded-[24px] border border-neutral-400 bg-neutral-50 p-4">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Cari nama atau NIM"
                aria-label="Cari nama atau NIM"
                className={cn(inputClass, 'pl-9')}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Divisi
                <select
                  className={selectClass}
                  value={divisionId}
                  onChange={(event) => {
                    setDivisionId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Semua divisi</option>
                  {DEMO_DIVISIONS.map((division) => (
                    <option key={division.id} value={division.id}>
                      {division.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Status akhir
                <select
                  className={cn(selectClass, guide.spot('saring'))}
                  value={status}
                  onChange={(event) => {
                    const value = event.target.value as FinalStatus | '';
                    setStatus(value);
                    setPage(1);
                    if (value === 'tidak_diterima') guide.complete('saring');
                  }}
                >
                  <option value="">Semua status</option>
                  {FINAL_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {hasFilter ? (
              <div>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  <X className="size-4" aria-hidden /> Hapus semua saringan
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-4" role="region" aria-label="Tabel hasil">
            {rows.length === 0 ? (
              <Empty>
                {hasFilter
                  ? 'Tidak ada pendaftar yang cocok dengan saringan.'
                  : 'Belum ada pendaftar di oprec ini.'}
              </Empty>
            ) : (
              <>
                <p className="mb-2 text-sm text-neutral-700">
                  Tanpa data sensitif di ekspor.
                </p>
                <div className="overflow-x-auto rounded-[24px] border border-neutral-400 bg-neutral-50">
                  <table className="w-full min-w-[620px] border-collapse">
                    <caption className="sr-only">Tabel hasil</caption>
                    <thead>
                      <tr>
                        <th className={cn(thClass, 'min-w-44')}>Pendaftar</th>
                        <th className={cn(thClass, 'min-w-32')}>
                          Status akhir
                        </th>
                        <th className={cn(thClass, 'min-w-52')}>Pilihan</th>
                        <th className={cn(thClass, 'min-w-36')}>Diterima di</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((row, index) => {
                        const final = FINAL[row.finalStatus];
                        return (
                          <tr
                            key={row.id}
                            tabIndex={0}
                            onClick={() => openViewer(row.id)}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter' && event.key !== ' ') {
                                return;
                              }
                              event.preventDefault();
                              openViewer(row.id);
                            }}
                            className={cn(
                              'cursor-pointer align-top hover:bg-primary-100 focus-visible:bg-primary-100 focus-visible:outline-none',
                              index === 0 && guide.spot('lihat'),
                            )}
                          >
                            <td className={tdClass}>
                              <span className="font-semibold text-neutral-1000">
                                {row.name}
                              </span>
                              <span className="mt-0.5 block text-xs text-neutral-700">
                                {[row.nim, row.prodi, row.angkatan].join(' · ')}
                              </span>
                              <span className="mt-1 flex flex-wrap gap-1">
                                <Pill tone="neutral">{row.waveLabel}</Pill>
                              </span>
                            </td>

                            <td className={tdClass}>
                              <Pill tone={final.tone}>{final.label}</Pill>
                              {row.acceptedAt ? (
                                <span className="mt-1 block text-xs text-neutral-700">
                                  {row.acceptedAt}
                                </span>
                              ) : null}
                            </td>

                            <td className={tdClass}>
                              <ul className="grid gap-1.5">
                                {row.choices.map((choice) => (
                                  <li key={choice.id} className="text-sm">
                                    <div className="flex flex-wrap items-center gap-1">
                                      <Pill
                                        tone={
                                          choice.decision === 'terima'
                                            ? 'success'
                                            : choice.decision === 'tolak'
                                              ? 'danger'
                                              : 'neutral'
                                        }
                                      >
                                        Pilihan {choice.rank} · {choice.label}
                                      </Pill>
                                      <span className="text-xs text-neutral-700">
                                        {choice.decision === 'terima'
                                          ? 'Diterima'
                                          : choice.decision === 'tolak'
                                            ? 'Ditolak'
                                            : 'Belum diputuskan'}
                                      </span>
                                    </div>
                                    {choice.reason &&
                                    choice.decision !== 'terima' ? (
                                      <span className="mt-0.5 block text-xs text-neutral-700">
                                        {choice.reason}
                                      </span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            </td>

                            <td className={tdClass}>
                              {row.acceptedDivisionId ? (
                                <Pill tone="success">
                                  {divisionLabel(row.acceptedDivisionId)}
                                </Pill>
                              ) : (
                                <span className="text-neutral-500">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Btn
                    small
                    tone="outline"
                    disabled={safePage <= 1}
                    onClick={() => setPage(safePage - 1)}
                  >
                    <ChevronLeft aria-hidden /> Sebelumnya
                  </Btn>
                  <Btn
                    small
                    tone="outline"
                    disabled={safePage >= pages}
                    onClick={() => setPage(safePage + 1)}
                  >
                    Berikutnya <ChevronRight aria-hidden />
                  </Btn>
                  <span className="text-sm text-neutral-700">
                    {rows.length} pendaftar · halaman {safePage} dari {pages}
                  </span>
                </div>

                <p className="mt-2 text-xs text-neutral-700">
                  Khusus simulasi: klik satu baris untuk melihat hasil yang
                  tampil bagi pendaftar itu.
                </p>
              </>
            )}
          </div>
        </section>
      </div>

      {dialog === 'rilis' ? (
        <Modal
          title="Rilis hasil ke pendaftar?"
          description="Setelah dirilis, pendaftar hanya melihat diterima di divisi mana atau belum diterima."
          onClose={() => setDialog(null)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setDialog(null)}>
                Batal
              </Btn>
              <Btn
                className={guide.spot('rilis')}
                onClick={() => {
                  setReleased(true);
                  setDialog(null);
                  guide.complete('rilis');
                  flash('Hasil dirilis ke pendaftar.');
                }}
              >
                Rilis sekarang
              </Btn>
            </>
          }
        >
          <ul className="grid gap-1 text-sm text-neutral-1000">
            <li>{accepted} diterima</li>
            <li>{undecided} belum diputuskan</li>
            <li>{notAccepted} tidak diterima</li>
          </ul>
          {undecided > 0 ? (
            <p className="rounded-xl bg-warning-light px-3 py-2 text-sm text-neutral-1000">
              Masih ada {undecided} pilihan aktif yang belum diputuskan. Hasil
              tetap bisa dirilis, tetapi keputusan itu akan tampil sebagai belum
              diputuskan di data pengelola dan belum diterima bagi pendaftar.
            </p>
          ) : null}
          <p className="text-sm text-neutral-700">
            Pendaftar yang diterima otomatis masuk ke organogram kepanitiaan.
          </p>
          <p className="text-sm text-neutral-700">
            Data yang diekspor tidak memuat alasan, flag, atau catatan sensitif.
          </p>
        </Modal>
      ) : null}

      {dialog === 'tarik' ? (
        <Modal
          title="Tarik rilis hasil?"
          description="Pendaftar tidak lagi melihat hasil sampai dirilis ulang."
          onClose={() => setDialog(null)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setDialog(null)}>
                Batal
              </Btn>
              <Btn
                tone="danger"
                disabled={reason.trim().length < 3}
                onClick={() => {
                  setReleased(false);
                  setDialog(null);
                  setReason('');
                  guide.complete('tarik');
                  flash('Rilis hasil ditarik.');
                }}
              >
                Tarik rilis
              </Btn>
            </>
          }
        >
          <Field label="Alasan penarikan (wajib)">
            {(id) => (
              <textarea
                id={id}
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={cn(inputClass, 'h-auto py-2', guide.spot('tarik'))}
              />
            )}
          </Field>
        </Modal>
      ) : null}

      {viewed ? (
        <Modal
          title="Tampilan pendaftar"
          description={`${viewed.name} · ${viewed.nim}`}
          onClose={() => setViewId(null)}
          footer={
            <Btn tone="ghost" onClick={() => setViewId(null)}>
              Tutup
            </Btn>
          }
        >
          <div className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
              Hasil pendaftaran
            </p>
            {!released ? (
              <>
                <p className="mt-1 font-semibold text-neutral-1000">
                  Pendaftaranmu sudah kami terima
                </p>
                <p className="mt-1 text-sm text-neutral-700">
                  Hasil akan diumumkan oleh panitia. Pantau halaman ini lagi
                  nanti.
                </p>
              </>
            ) : viewed.acceptedDivisionId ? (
              <>
                <p className="mt-1 font-semibold text-success-dark">
                  Selamat, kamu diterima!
                </p>
                <p className="mt-1 text-sm text-neutral-800">
                  Diterima di{' '}
                  <strong>{divisionLabel(viewed.acceptedDivisionId)}</strong>.
                  Kamu akan dihubungi panitia dan otomatis masuk ke organogram
                  kepanitiaan.
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 font-semibold text-neutral-1000">
                  Belum diterima
                </p>
                <p className="mt-1 text-sm text-neutral-700">
                  Terima kasih sudah mendaftar. Kamu belum diterima di oprec
                  ini.
                </p>
              </>
            )}
          </div>
        </Modal>
      ) : null}
      {node}
    </>
  );
}

function DivisionCard({
  division,
  names,
  spot,
  onOpenNames,
  onPickDivision,
}: {
  division: DemoDivision;
  names: ResultRow[];
  /** Kelas sorotan untuk mode Ikuti langkah. */
  spot: string;
  onOpenNames: () => void;
  onPickDivision: () => void;
}) {
  const quota = division.quota === 0 ? 'Tanpa batas' : String(division.quota);
  const overQuota = division.quota > 0 && names.length > division.quota;
  return (
    <article className="grid gap-2 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
      <p className="text-base font-semibold text-neutral-1000">
        {division.name}
      </p>

      <p className="text-sm text-neutral-700">
        <span className="text-lg font-semibold text-neutral-1000">
          {names.length}
        </span>{' '}
        diterima / {quota}
      </p>
      {overQuota ? (
        <p className="rounded-xl bg-warning-light px-3 py-2 text-sm text-neutral-1000">
          Diterima melebihi kuota ({names.length} dari {division.quota}).
        </p>
      ) : null}

      <details className="group" onToggle={onOpenNames}>
        <summary
          className={cn(
            'cursor-pointer text-sm font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
            spot,
          )}
        >
          {names.length === 0
            ? 'Belum ada yang diterima'
            : `Lihat ${names.length} nama diterima`}
        </summary>
        {names.length > 0 ? (
          <ul className="mt-2 max-h-56 overflow-y-auto pr-1">
            {names.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 border-b border-neutral-200 py-1.5 text-sm last:border-0"
              >
                <span className="min-w-0 flex-1 truncate font-semibold text-neutral-1000">
                  {row.name}
                </span>
                <span className="text-xs text-neutral-700">{row.nim}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </details>

      <div>
        <Btn small tone="ghost" onClick={onPickDivision}>
          Lihat pendaftar divisi ini <ArrowRight aria-hidden />
        </Btn>
      </div>
    </article>
  );
}
