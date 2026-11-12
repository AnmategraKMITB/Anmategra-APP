'use client';

// Library Import
import { Download, Lock } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { DEMO_DIVISIONS } from '../data';
import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import {
  Btn,
  Field,
  inputClass,
  Modal,
  Pill,
  ScreenTitle,
  tdClass,
  thClass,
  useFlash,
} from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'rekap',
    title: 'Pada **Rekap per divisi**, klik **Lihat 2 nama diterima** di Divisi Acara',
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
    title: 'Klik satu baris di tabel untuk melihat apa yang tampil bagi pendaftar itu',
    hint: 'Pendaftar hanya melihat diterima di divisi mana atau belum diterima, tanpa nilai maupun alasan.',
  },
  {
    id: 'tarik',
    title: 'Klik **Tarik rilis**, isi alasannya, lalu konfirmasi',
  },
];

type Result = { id: string; name: string; nim: string; division: string | null };

const RESULTS: Result[] = [
  { id: 'raka', name: 'Raka Pradipta', nim: '13524011', division: 'acara' },
  { id: 'nadia', name: 'Nadia Kusumawardhani', nim: '18224032', division: 'publikasi' },
  { id: 'bima', name: 'Bima Arya Setiadi', nim: '13224057', division: 'logistik' },
  { id: 'laras', name: 'Laras Ayuningtyas', nim: '15523018', division: 'acara' },
  { id: 'fajar', name: 'Fajar Nugraha', nim: '10523044', division: null },
  { id: 'citra', name: 'Citra Maharani', nim: '19623009', division: 'danus' },
];

const nameOf = (id: string | null) =>
  DEMO_DIVISIONS.find((division) => division.id === id)?.name ?? '';

export default function OprecHasilDemo() {
  return (
    <DemoFrame
      title="Hasil dan rilis ke pendaftar"
      location="Lembaga › Oprec › Festival Karya 2026 › Hasil"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [released, setReleased] = useState(false);
  const [status, setStatus] = useState<'' | 'diterima' | 'tidak'>('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'rilis' | 'tarik' | null>(null);
  const [reason, setReason] = useState('');
  const { flash, node } = useFlash();

  const rows = RESULTS.filter(
    (row) =>
      status === '' ||
      (status === 'diterima' ? row.division !== null : row.division === null),
  );
  const viewed = RESULTS.find((row) => row.id === viewId);

  return (
    <div>
      <ScreenTitle
        title="Hasil"
        subtitle="Status akhir tiap pendaftar setelah penempatan."
        actions={
          <Btn
            small
            tone="outline"
            onClick={() => flash('hasil.csv diunduh (simulasi). Tanpa data sensitif di ekspor.')}
          >
            <Download aria-hidden /> Ekspor CSV
          </Btn>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-400 bg-neutral-100 px-3 py-2">
        <span className="text-xs font-semibold text-neutral-700">
          Keadaan hasil
        </span>
        <Pill tone="success">
          <Lock className="mr-1 size-3" aria-hidden />
          Final
        </Pill>
        <Pill tone={released ? 'teal' : 'neutral'}>
          {released ? 'Sudah dirilis' : 'Belum dirilis'}
        </Pill>
        <span className="min-w-0 flex-1 text-xs text-neutral-700">
          Pendaftar baru bisa melihat hasil setelah rilis.
        </span>
        {released ? (
          <Btn
            small
            tone="dangerOutline"
            className={guide.spot('tarik')}
            onClick={() => {
              setReason('');
              setDialog('tarik');
            }}
          >
            Tarik rilis
          </Btn>
        ) : (
          <Btn
            small
            tone="teal"
            className={guide.spot('rilis')}
            onClick={() => setDialog('rilis')}
          >
            Rilis hasil ke pendaftar
          </Btn>
        )}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_220px]">
        <div className="min-w-0 space-y-3">
          <div className="rounded-lg border border-neutral-400">
            <p className="border-b border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700">
              Rekap per divisi
            </p>
            <ul className="divide-y divide-neutral-300">
              {DEMO_DIVISIONS.map((division) => {
                const names = RESULTS.filter(
                  (row) => row.division === division.id,
                );
                const open = expanded === division.id;
                return (
                  <li key={division.id} className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-24 font-semibold">{division.name}</span>
                      <span className="text-xs text-neutral-700">
                        {names.length}/{division.quota} terisi
                      </span>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => {
                          setExpanded(open ? null : division.id);
                          if (division.id === 'acara') guide.complete('rekap');
                        }}
                        className={cn(
                          'ml-auto rounded text-xs font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                          division.id === 'acara' && guide.spot('rekap'),
                        )}
                      >
                        {names.length === 0
                          ? 'Belum ada yang diterima'
                          : `Lihat ${names.length} nama diterima`}
                      </button>
                    </div>
                    {open ? (
                      <ul className="mt-1 list-inside list-disc text-xs text-neutral-800">
                        {names.map((row) => (
                          <li key={row.id}>
                            {row.name} ({row.nim})
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-neutral-700">
              Semua pendaftar
            </span>
            <select
              aria-label="Status akhir"
              value={status}
              onChange={(event) => {
                const value = event.target.value as typeof status;
                setStatus(value);
                if (value === 'tidak') guide.complete('saring');
              }}
              className={cn(inputClass, 'ml-auto w-40', guide.spot('saring'))}
            >
              <option value="">Semua status</option>
              <option value="diterima">Diterima</option>
              <option value="tidak">Tidak diterima</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-neutral-400">
            <table className="w-full min-w-[380px] border-collapse">
              <caption className="sr-only">Tabel hasil</caption>
              <thead>
                <tr>
                  <th className={thClass}>Pendaftar</th>
                  <th className={thClass}>Status akhir</th>
                  <th className={thClass}>Diterima di</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    aria-selected={viewId === row.id}
                    onClick={() => {
                      setViewId(row.id);
                      if (released) guide.complete('lihat');
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      setViewId(row.id);
                      if (released) guide.complete('lihat');
                    }}
                    className={cn(
                      'cursor-pointer hover:bg-primary-100 focus-visible:bg-primary-100 focus-visible:outline-none',
                      viewId === row.id && 'bg-primary-100',
                      index === 0 && guide.spot('lihat'),
                    )}
                  >
                    <td className={tdClass}>
                      <span className="block font-semibold">{row.name}</span>
                      <span className="text-xs text-neutral-700">{row.nim}</span>
                    </td>
                    <td className={tdClass}>
                      <Pill tone={row.division ? 'success' : 'danger'}>
                        {row.division ? 'Diterima' : 'Tidak diterima'}
                      </Pill>
                    </td>
                    <td className={tdClass}>
                      {row.division ? `Divisi ${nameOf(row.division)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-lg border border-dashed border-secondary-400 bg-secondary-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-800">
            Tampilan pendaftar
          </p>
          <p className="mt-0.5 text-xs text-neutral-700">
            {viewed ? viewed.name : 'Klik satu baris untuk melihatnya.'}
          </p>
          {viewed ? (
            <div className="mt-2 rounded-lg border border-neutral-400 bg-white p-3">
              <p className="text-xs font-semibold text-neutral-700">
                Hasil pendaftaran
              </p>
              {!released ? (
                <>
                  <p className="mt-1 font-semibold">
                    Pendaftaranmu sudah kami terima
                  </p>
                  <p className="mt-1 text-xs text-neutral-700">
                    Hasil akan diumumkan oleh panitia. Pantau halaman ini lagi
                    nanti.
                  </p>
                </>
              ) : viewed.division ? (
                <>
                  <p className="mt-1 font-semibold text-success-dark">
                    Selamat, kamu diterima!
                  </p>
                  <p className="mt-1 text-xs text-neutral-800">
                    Diterima di <strong>Divisi {nameOf(viewed.division)}</strong>.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 font-semibold">Belum diterima</p>
                  <p className="mt-1 text-xs text-neutral-700">
                    Terima kasih sudah mendaftar. Kamu belum diterima di oprec
                    ini.
                  </p>
                </>
              )}
            </div>
          ) : null}
        </aside>
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
                tone="teal"
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
          <p className="text-xs text-neutral-700">
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
                disabled={reason.trim() === ''}
                onClick={() => {
                  setReleased(false);
                  setDialog(null);
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
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={cn(inputClass, 'h-auto py-2', guide.spot('tarik'))}
              />
            )}
          </Field>
        </Modal>
      ) : null}
      {node}
    </div>
  );
}
