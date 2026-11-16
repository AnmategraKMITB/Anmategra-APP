'use client';

// Library Import
import { Copy, Settings, Share2 } from 'lucide-react';
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
  Toggle,
  useFlash,
} from '../ui';

const STEPS: DemoStep[] = [
  {
    id: 'pengaturan',
    title: 'Buka **Pengaturan**, lalu nyalakan **Izinkan pengisi mengubah jawaban**',
  },
  {
    id: 'batas',
    title: 'Isi **Batas jumlah respons**, misalnya 50, lalu tutup panelnya',
    hint: 'Setelah batas tercapai, form berhenti menerima jawaban baru.',
  },
  {
    id: 'terbit',
    title: 'Klik **Terbitkan**',
    hint: 'Selama masih draf, tautan untuk mengisi belum bisa dipakai.',
  },
  {
    id: 'share',
    title: 'Buka **Share**, isi **Slug kustom**, lalu salin **Tautan untuk mengisi**',
  },
  { id: 'tutup', title: 'Klik **Tutup form** untuk berhenti menerima jawaban' },
];

type Status = 'Draft' | 'Published' | 'Closed';
const STATUS_LABEL: Record<Status, string> = {
  Draft: 'Draf',
  Published: 'Terbit',
  Closed: 'Ditutup',
};
const STATUS_TONE: Record<Status, PillTone> = {
  Draft: 'neutral',
  Published: 'success',
  Closed: 'warning',
};
const RESPONDENT_VIEW: Record<Status, string> = {
  Draft: 'Tautan untuk mengisi belum aktif. Pengisi belum bisa membuka form ini.',
  Published: 'Form menerima jawaban dari mahasiswa aktif yang sudah login.',
  Closed: 'Form ini sudah ditutup dan tidak menerima jawaban lagi.',
};

export default function FormsTerbitDemo() {
  return (
    <DemoFrame
      title="Menerbitkan dan membagikan form"
      location="Lembaga › Forms › Survei Minat Panitia"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [status, setStatus] = useState<Status>('Draft');
  const [panel, setPanel] = useState<'pengaturan' | 'share' | null>(null);
  const [onePerAccount, setOnePerAccount] = useState(true);
  const [allowEdit, setAllowEdit] = useState(false);
  const [limit, setLimit] = useState('');
  const [deadline, setDeadline] = useState('');
  const [preview, setPreview] = useState(false);
  const [slug, setSlug] = useState('');
  const { flash, node } = useFlash();

  const cleanSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-');
  const fillUrl = `anmategra.com/forms/${cleanSlug || 'k3f9x2a1'}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-lg font-semibold">
          Survei Minat Panitia
        </p>
        <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn
          tone="outline"
          className={guide.spot('pengaturan', 'batas')}
          onClick={() => setPanel('pengaturan')}
        >
          <Settings aria-hidden /> Pengaturan
        </Btn>
        <Btn
          tone="outline"
          className={guide.spot('share')}
          onClick={() => setPanel('share')}
        >
          <Share2 aria-hidden /> Share
        </Btn>
        <span className="ml-auto flex flex-wrap gap-2">
          {status === 'Draft' ? (
            <Btn
              tone="teal"
              className={guide.spot('terbit')}
              onClick={() => {
                setStatus('Published');
                guide.complete('terbit');
              }}
            >
              Terbitkan
            </Btn>
          ) : null}
          {status !== 'Draft' ? (
            <Btn tone="outline" onClick={() => setStatus('Draft')}>
              Kembali ke draf
            </Btn>
          ) : null}
          {status === 'Published' ? (
            <Btn
              tone="dangerOutline"
              className={guide.spot('tutup')}
              onClick={() => {
                setStatus('Closed');
                guide.complete('tutup');
              }}
            >
              Tutup form
            </Btn>
          ) : null}
          {status === 'Closed' ? (
            <Btn tone="teal" onClick={() => setStatus('Published')}>
              Buka kembali
            </Btn>
          ) : null}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-400 p-3">
          <p className="text-xs font-semibold text-neutral-700">
            Pengaturan saat ini
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            <li>Satu respons per akun: {onePerAccount ? 'ya' : 'tidak'}</li>
            <li>Pengisi boleh mengubah jawaban: {allowEdit ? 'ya' : 'tidak'}</li>
            <li>Batas jumlah respons: {limit || 'tanpa batas'}</li>
            <li>Tenggat: {deadline || 'tidak ada'}</li>
            <li>Tautan pratinjau publik: {preview ? 'aktif' : 'mati'}</li>
          </ul>
        </div>
        <div className="rounded-lg border border-dashed border-secondary-400 bg-secondary-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-800">
            Yang dialami pengisi
          </p>
          <p className="mt-2">{RESPONDENT_VIEW[status]}</p>
        </div>
      </div>

      {panel === 'pengaturan' ? (
        <Modal
          title="Pengaturan form"
          description="Perubahan tersimpan otomatis."
          onClose={() => {
            setPanel(null);
            if (limit) guide.complete('batas');
          }}
          footer={
            <Btn
              tone="outline"
              className={guide.spot('batas')}
              onClick={() => {
                setPanel(null);
                if (limit) guide.complete('batas');
              }}
            >
              Tutup
            </Btn>
          }
        >
          <Field label="Tenggat (opsional)" hint="Setelah tenggat, form tidak menerima jawaban lagi.">
            {(id) => (
              <input
                id={id}
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                className={inputClass}
              />
            )}
          </Field>
          <Toggle
            label="Satu respons per akun"
            checked={onePerAccount}
            onChange={(next) => {
              setOnePerAccount(next);
              if (!next) setAllowEdit(false);
            }}
          />
          <div>
            <Toggle
              label="Izinkan pengisi mengubah jawaban"
              checked={allowEdit}
              onChange={(next) => {
                if (!onePerAccount) return;
                setAllowEdit(next);
                if (next) guide.complete('pengaturan');
              }}
              className={guide.spot('pengaturan')}
            />
            <p className="mt-1 text-xs text-neutral-700">
              Hanya untuk form satu respons dan selama form masih menerima
              jawaban.
            </p>
          </div>
          <Field label="Batas jumlah respons (opsional)" hint="Kosongkan untuk tanpa batas.">
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                value={limit}
                placeholder="Tanpa batas"
                onChange={(event) => setLimit(event.target.value)}
                className={cn(inputClass, guide.spot('batas'))}
              />
            )}
          </Field>
        </Modal>
      ) : null}

      {panel === 'share' ? (
        <Modal
          title="Share"
          onClose={() => setPanel(null)}
          footer={
            <Btn tone="outline" onClick={() => setPanel(null)}>
              Tutup
            </Btn>
          }
        >
          <div>
            <Toggle
              label="Tautan pratinjau publik"
              checked={preview}
              onChange={setPreview}
            />
            <p className="mt-1 text-xs text-neutral-700">
              Siapa pun yang punya tautan bisa melihat form ini tanpa login,
              tetapi tidak bisa mengirim jawaban.
            </p>
          </div>
          <Field label="Slug kustom (opsional)" hint="Huruf kecil, angka, dan tanda hubung. Kosongkan untuk memakai id formulir.">
            {(id) => (
              <input
                id={id}
                value={slug}
                placeholder="survei-minat-panitia"
                onChange={(event) => setSlug(event.target.value)}
                className={cn(inputClass, guide.spot('share'))}
              />
            )}
          </Field>
          <div>
            <p className="text-xs font-semibold text-neutral-800">
              Tautan untuk mengisi
            </p>
            <div className="mt-1 flex gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-neutral-200 px-2 py-2 text-xs">
                {fillUrl}
              </code>
              <Btn
                small
                className={cn('h-auto', guide.spot('share'))}
                disabled={status !== 'Published'}
                onClick={() => {
                  flash('Tautan disalin (simulasi).');
                  if (cleanSlug) guide.complete('share');
                }}
              >
                <Copy aria-hidden /> Salin tautan untuk mengisi
              </Btn>
            </div>
            <p className="mt-1 text-xs text-neutral-700">
              {status === 'Published'
                ? 'Pengisi harus login dan berstatus mahasiswa aktif.'
                : 'Tautan ini baru bisa dipakai setelah form diterbitkan.'}
            </p>
          </div>
        </Modal>
      ) : null}
      {node}
    </div>
  );
}
