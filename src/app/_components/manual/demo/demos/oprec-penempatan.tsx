'use client';

// Library Import
import { Lock, Wand2 } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import {
  Btn,
  Field,
  inputClass,
  Modal,
  Pill,
  type PillTone,
  ScreenTitle,
  tdClass,
  thClass,
  useFlash,
} from '../ui';

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

const QUOTA = 2;

type Decision = 'menunggu' | 'terima' | 'tolak';
type PlacementState = 'berjalan' | 'banding' | 'final';

type Row = {
  id: string;
  name: string;
  nim: string;
  rank: number;
  score: number;
  status: 'Lolos' | 'Tidak lolos';
  willing: boolean;
  /** Pilihan 2 baru aktif setelah pilihan 1 pendaftar itu diputuskan. */
  skippedByAutofill?: boolean;
};

const ROWS: Row[] = [
  { id: 'raka', name: 'Raka Pradipta', nim: '13524011', rank: 1, score: 88, status: 'Lolos', willing: true },
  { id: 'laras', name: 'Laras Ayuningtyas', nim: '15523018', rank: 1, score: 82, status: 'Lolos', willing: true },
  { id: 'bima', name: 'Bima Arya Setiadi', nim: '13224057', rank: 1, score: 76, status: 'Tidak lolos', willing: true },
  { id: 'fajar', name: 'Fajar Nugraha', nim: '10523044', rank: 2, score: 58, status: 'Tidak lolos', willing: false, skippedByAutofill: true },
];

const DECISION_LABEL: Record<Decision, string> = {
  menunggu: 'Menunggu',
  terima: 'Diterima',
  tolak: 'Ditolak',
};
const DECISION_TONE: Record<Decision, PillTone> = {
  menunggu: 'neutral',
  terima: 'success',
  tolak: 'danger',
};
const STATE_LABEL: Record<PlacementState, string> = {
  berjalan: 'Berjalan',
  banding: 'Masa banding',
  final: 'Final',
};
const STATE_NOTE: Record<PlacementState, string> = {
  berjalan: 'Keputusan masih bisa diubah selama belum masuk masa banding.',
  banding:
    'Pendaftar yang ditolak bisa diterima lewat banding, dan Kadiv bisa meminta pindah divisi.',
  final: 'Penempatan sudah final. Semua perubahan dikunci.',
};

type Dialog =
  | { kind: 'autofill' }
  | { kind: 'quota'; rowId: string }
  | { kind: 'appeal'; rowId: string }
  | { kind: 'state'; to: PlacementState };

export default function OprecPenempatanDemo() {
  return (
    <DemoFrame
      title="Penempatan pendaftar"
      location="Lembaga › Oprec › Festival Karya 2026 › Penempatan"
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
  const { flash, node } = useFlash();

  const decisionOf = (id: string): Decision => decisions[id] ?? 'menunggu';
  const accepted = ROWS.filter((row) => decisionOf(row.id) === 'terima').length;
  const waiting = ROWS.filter((row) => decisionOf(row.id) === 'menunggu');
  const locked = state === 'final';

  const decide = (id: string, decision: Decision) => {
    setDecisions((prev) => ({ ...prev, [id]: decision }));
    flash('Keputusan disimpan.');
    if (id === 'fajar' || waiting.length <= 1) guide.complete('putus');
  };

  const accept = (id: string) => {
    if (accepted >= QUOTA) setDialog({ kind: 'quota', rowId: id });
    else decide(id, 'terima');
  };

  const applyAutofill = () => {
    const next = { ...decisions };
    let applied = 0;
    for (const row of ROWS) {
      if (row.skippedByAutofill || next[row.id]) continue;
      next[row.id] = row.status === 'Lolos' ? 'terima' : 'tolak';
      applied += 1;
    }
    setDecisions(next);
    setDialog(null);
    guide.complete('isi');
    flash(`${applied} keputusan diisi dari penilaian.`);
  };

  const dialogRow =
    dialog && 'rowId' in dialog
      ? ROWS.find((row) => row.id === dialog.rowId)
      : undefined;

  return (
    <div>
      <ScreenTitle
        title="Penempatan"
        subtitle="Putuskan tiap pilihan dan pantau kuota divisi."
        actions={
          <Btn
            small
            tone="outline"
            disabled={state !== 'berjalan'}
            className={guide.spot('isi')}
            onClick={() => setDialog({ kind: 'autofill' })}
          >
            <Wand2 aria-hidden /> Isi dari penilaian
          </Btn>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-400 bg-neutral-100 px-3 py-2">
        <span className="text-xs font-semibold text-neutral-700">
          Keadaan penempatan
        </span>
        <Pill
          tone={
            state === 'final' ? 'success' : state === 'banding' ? 'warning' : 'info'
          }
        >
          {locked ? <Lock className="mr-1 size-3" aria-hidden /> : null}
          {STATE_LABEL[state]}
        </Pill>
        <span className="min-w-0 flex-1 text-xs text-neutral-700">
          {STATE_NOTE[state]}
        </span>
        {state === 'berjalan' ? (
          <Btn
            small
            className={guide.spot('banding')}
            onClick={() => setDialog({ kind: 'state', to: 'banding' })}
          >
            Masuk masa banding
          </Btn>
        ) : null}
        {state === 'banding' ? (
          <>
            <Btn
              small
              tone="ghost"
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
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Divisi"
          defaultValue="acara"
          className={cn(inputClass, 'w-40')}
        >
          <option value="acara">Divisi Acara</option>
        </select>
        <span className="text-xs text-neutral-700">
          Kuota {QUOTA} · terisi{' '}
          <strong className={accepted > QUOTA ? 'text-danger-dark' : ''}>
            {accepted}
          </strong>
        </span>
        <div className="h-2 w-24 overflow-hidden rounded-full bg-neutral-200">
          <div
            className={cn(
              'h-full rounded-full',
              accepted > QUOTA ? 'bg-tomato' : 'bg-secondary-400',
            )}
            style={{ width: `${Math.min(100, (accepted / QUOTA) * 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-400">
        <table className="w-full min-w-[640px] border-collapse">
          <caption className="sr-only">Daftar pendaftar divisi</caption>
          <thead>
            <tr>
              <th className={thClass}>Pendaftar</th>
              <th className={thClass}>Skor &amp; status</th>
              <th className={thClass}>Pilihan</th>
              <th className={thClass}>Keputusan</th>
              <th className={thClass}>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const decision = decisionOf(row.id);
              const isAppeal = appealed.includes(row.id);
              return (
                <tr key={row.id}>
                  <td className={tdClass}>
                    <span className="block font-semibold">{row.name}</span>
                    <span className="text-xs text-neutral-700">
                      {row.nim}
                      {row.willing ? ' · bersedia pindah' : ''}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <span className="mr-1.5 font-semibold">{row.score}</span>
                    <Pill tone={row.status === 'Lolos' ? 'success' : 'danger'}>
                      {row.status}
                    </Pill>
                  </td>
                  <td className={cn(tdClass, 'whitespace-nowrap')}>
                    Pilihan {row.rank}
                  </td>
                  <td className={tdClass}>
                    <Pill tone={DECISION_TONE[decision]}>
                      {DECISION_LABEL[decision]}
                    </Pill>
                    {isAppeal ? (
                      <span className="mt-0.5 block text-xs text-neutral-700">
                        lewat banding
                      </span>
                    ) : null}
                  </td>
                  <td className={tdClass}>
                    <div className="flex gap-1.5">
                      {state === 'berjalan' ? (
                        <>
                          <Btn
                            small
                            tone="outline"
                            disabled={decision === 'terima'}
                            className={
                              decision === 'menunggu' ? guide.spot('putus') : ''
                            }
                            onClick={() => accept(row.id)}
                          >
                            Terima
                          </Btn>
                          <Btn
                            small
                            tone="dangerOutline"
                            disabled={decision === 'tolak'}
                            onClick={() => decide(row.id, 'tolak')}
                          >
                            Tolak
                          </Btn>
                        </>
                      ) : null}
                      {state === 'banding' && decision === 'tolak' ? (
                        <Btn
                          small
                          tone="outline"
                          className={guide.spot('terima-banding')}
                          onClick={() => {
                            setReason('');
                            setDialog({ kind: 'appeal', rowId: row.id });
                          }}
                        >
                          Terima lewat banding
                        </Btn>
                      ) : null}
                      {locked ||
                      (state === 'banding' && decision !== 'tolak') ? (
                        <span className="text-xs text-neutral-700">—</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
              <tr>
                <td className={tdClass}>Acara</td>
                <td className={tdClass}>2</td>
                <td className={tdClass}>1</td>
                <td className={tdClass}>1</td>
                <td className={tdClass}>0</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-neutral-700">
            Satu pendaftar dilewati karena Acara adalah pilihan keduanya dan
            pilihan pertamanya belum diputuskan.
          </p>
        </Modal>
      ) : null}

      {dialog?.kind === 'quota' && dialogRow ? (
        <Modal
          title="Kuota divisi sudah terisi"
          description={`Kuota ${QUOTA} sudah terisi ${accepted}. Tetap terima pendaftar ini?`}
          onClose={() => setDialog(null)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setDialog(null)}>
                Batal
              </Btn>
              <Btn
                onClick={() => {
                  decide(dialogRow.id, 'terima');
                  setDialog(null);
                }}
              >
                Tetap terima
              </Btn>
            </>
          }
        >
          <p className="text-xs text-neutral-700">
            Penerimaan di atas kuota tercatat dan ditandai untuk ditinjau.
          </p>
        </Modal>
      ) : null}

      {dialog?.kind === 'appeal' && dialogRow ? (
        <Modal
          title="Terima lewat banding"
          description={`Pilihan ${dialogRow.rank} untuk ${dialogRow.name} sudah ditolak. Alasan wajib diisi.`}
          onClose={() => setDialog(null)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setDialog(null)}>
                Batal
              </Btn>
              <Btn
                disabled={reason.trim() === ''}
                onClick={() => {
                  setDecisions((prev) => ({ ...prev, [dialogRow.id]: 'terima' }));
                  setAppealed((prev) => [...prev, dialogRow.id]);
                  setDialog(null);
                  guide.complete('terima-banding');
                  flash('Penerimaan lewat banding disimpan.');
                }}
              >
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
                onChange={(event) => setReason(event.target.value)}
                className={cn(inputClass, 'h-auto py-2', guide.spot('terima-banding'))}
              />
            )}
          </Field>
          {accepted >= QUOTA ? (
            <p className="rounded-lg bg-warning-light p-2 text-xs">
              Kuota {QUOTA} sudah terisi {accepted}. Alasan banding tetap
              tersimpan dan penerimaan melewati kuota.
            </p>
          ) : null}
        </Modal>
      ) : null}

      {dialog?.kind === 'state' ? (
        <Modal
          title={
            dialog.to === 'final'
              ? 'Tetapkan penempatan final?'
              : dialog.to === 'berjalan'
                ? 'Kembali ke berjalan?'
                : 'Ubah keadaan penempatan?'
          }
          description={
            dialog.to === 'final'
              ? 'Setelah final, keputusan tidak bisa diubah. Permintaan pindah yang masih terbuka harus diselesaikan dulu.'
              : dialog.to === 'berjalan'
                ? 'Permintaan pindah yang terbuka akan dibatalkan saat keluar dari masa banding.'
                : 'Masa banding membuka permintaan pindah dan penerimaan lewat banding.'
          }
          onClose={() => setDialog(null)}
          footer={
            <>
              <Btn tone="ghost" onClick={() => setDialog(null)}>
                Batal
              </Btn>
              <Btn
                className={guide.spot('banding', 'final')}
                onClick={() => {
                  setState(dialog.to);
                  // Melangkah maju berarti langkah sebelumnya dianggap selesai,
                  // supaya panduan tidak menunjuk tombol yang sudah tidak ada.
                  const passed =
                    dialog.to === 'banding'
                      ? ['isi', 'putus', 'banding']
                      : dialog.to === 'final'
                        ? STEPS.map((step) => step.id)
                        : [];
                  passed.forEach(guide.complete);
                  flash(
                    `Keadaan penempatan diubah menjadi ${STATE_LABEL[dialog.to]}.`,
                  );
                  setDialog(null);
                }}
              >
                Lanjutkan
              </Btn>
            </>
          }
        />
      ) : null}
      {node}
    </div>
  );
}
