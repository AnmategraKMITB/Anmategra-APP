'use client';

// Library Import
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import { Btn, Field, inputClass, Toggle } from '../ui';

const STEPS: DemoStep[] = [
  { id: 'edit', title: 'Klik **Edit Profile Info**' },
  {
    id: 'simpan',
    title: 'Isi **ID Line** dan **Nomor WhatsApp**, lalu klik **Simpan**',
    hint: 'Nama, NIM, jurusan, dan angkatan berasal dari data akademik dan tidak bisa diubah.',
  },
  {
    id: 'rapor',
    title: 'Ubah toggle **Rapor Visible to Public**',
  },
];

export default function ProfilMahasiswaDemo() {
  return (
    <DemoFrame
      title="Profil mahasiswa"
      location="Mahasiswa › Profil"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [saved, setSaved] = useState({ line: '', whatsapp: '' });
  const [draft, setDraft] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [visible, setVisible] = useState(true);

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-secondary-400 text-xl font-semibold text-white">
          RP
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">Raka Pradipta</p>
          <p className="text-xs text-neutral-700">
            13524011 · Teknik Informatika · Angkatan 2024
          </p>
          {editing ? (
            <div className={cn('mt-3 grid gap-3 rounded-lg sm:grid-cols-2', guide.spot('simpan'))}>
              <Field label="ID Line">
                {(id) => (
                  <input
                    id={id}
                    value={draft.line}
                    onChange={(event) =>
                      setDraft({ ...draft, line: event.target.value })
                    }
                    className={inputClass}
                  />
                )}
              </Field>
              <Field label="Nomor WhatsApp">
                {(id) => (
                  <input
                    id={id}
                    inputMode="tel"
                    value={draft.whatsapp}
                    onChange={(event) =>
                      setDraft({ ...draft, whatsapp: event.target.value })
                    }
                    className={inputClass}
                  />
                )}
              </Field>
            </div>
          ) : (
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-neutral-700">ID Line</dt>
                <dd className="font-semibold">{saved.line || '—'}</dd>
              </div>
              <div>
                <dt className="text-neutral-700">Nomor WhatsApp</dt>
                <dd className="font-semibold">{saved.whatsapp || '—'}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Toggle
          label="Rapor Visible to Public"
          checked={visible}
          onChange={(next) => {
            setVisible(next);
            guide.complete('rapor');
          }}
          className={guide.spot('rapor')}
        />
        {editing ? (
          <span className="flex gap-2">
            <Btn
              tone="ghost"
              onClick={() => {
                setDraft(saved);
                setEditing(false);
              }}
            >
              Batal Edit
            </Btn>
            <Btn
              className={guide.spot('simpan')}
              onClick={() => {
                setSaved(draft);
                setEditing(false);
                guide.complete('simpan');
              }}
            >
              Simpan
            </Btn>
          </span>
        ) : (
          <Btn
            tone="outline"
            className={guide.spot('edit')}
            onClick={() => {
              setEditing(true);
              guide.complete('edit');
            }}
          >
            Edit Profile Info
          </Btn>
        )}
      </div>
      <div className="mt-4 rounded-lg border border-neutral-400 p-3">
        <p className="font-semibold">Festival Karya 2026</p>
        <p className="text-xs text-neutral-700">Divisi Acara · Staf</p>
        <p className="mt-1 text-xs">
          {visible
            ? 'Tautan Rapor tampil di kartu ini bila lembaga juga membuka rapornya.'
            : 'Rapor Anda disembunyikan dari profil, apa pun pengaturan lembaga.'}
        </p>
      </div>
    </div>
  );
}
