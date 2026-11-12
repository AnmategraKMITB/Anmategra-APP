'use client';

// Library Import
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import { Btn, Field, inputClass, Pill } from '../ui';

const STEPS: DemoStep[] = [
  { id: 'edit', title: 'Klik **Edit Profile Lembaga**' },
  {
    id: 'ubah',
    title: 'Ubah **Deskripsi Lembaga** atau **Tipe Lembaga**',
  },
  { id: 'simpan', title: 'Klik **Simpan**' },
];

export default function ProfilLembagaDemo() {
  return (
    <DemoFrame
      title="Profil lembaga"
      location="Lembaga › Profil"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [saved, setSaved] = useState({
    name: 'Himpunan Mahasiswa Contoh',
    type: 'Himpunan',
    description: 'Wadah mahasiswa program studi untuk berkarya dan berkegiatan.',
  });
  const [draft, setDraft] = useState(saved);
  const [editing, setEditing] = useState(false);

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary-400 text-xl font-semibold text-white">
          HM
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className={cn('space-y-3 rounded-lg', guide.spot('ubah'))}>
              <Field label="Nama Lembaga">
                {(id) => (
                  <input
                    id={id}
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                    className={inputClass}
                  />
                )}
              </Field>
              <Field label="Tipe Lembaga">
                {(id) => (
                  <select
                    id={id}
                    value={draft.type}
                    onChange={(event) => {
                      setDraft({ ...draft, type: event.target.value });
                      guide.complete('ubah');
                    }}
                    className={inputClass}
                  >
                    <option>Himpunan</option>
                    <option>UKM</option>
                    <option>Kepanitiaan</option>
                  </select>
                )}
              </Field>
              <Field label="Deskripsi Lembaga">
                {(id) => (
                  <textarea
                    id={id}
                    rows={3}
                    value={draft.description}
                    onChange={(event) => {
                      setDraft({ ...draft, description: event.target.value });
                      guide.complete('ubah');
                    }}
                    className={cn(inputClass, 'h-auto py-2')}
                  />
                )}
              </Field>
            </div>
          ) : (
            <>
              <p className="text-lg font-semibold">{saved.name}</p>
              <Pill tone="info">{saved.type}</Pill>
              <p className="mt-2 text-neutral-800">{saved.description}</p>
            </>
          )}
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        {editing ? (
          <>
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
              disabled={draft.name.trim() === ''}
              className={guide.spot('simpan')}
              onClick={() => {
                setSaved(draft);
                setEditing(false);
                guide.complete('ubah');
                guide.complete('simpan');
              }}
            >
              Simpan
            </Btn>
          </>
        ) : (
          <Btn
            tone="outline"
            className={guide.spot('edit')}
            onClick={() => {
              setEditing(true);
              guide.complete('edit');
            }}
          >
            Edit Profile Lembaga
          </Btn>
        )}
      </div>
      <div className="mt-4 rounded-lg border border-neutral-400 p-3">
        <p className="text-xs font-semibold text-neutral-700">
          Highlighted Event
        </p>
        <p className="mt-1 font-semibold">Festival Karya 2026</p>
        <p className="text-xs text-neutral-700">
          Kegiatan yang disematkan dari menu Kegiatan tampil di sini.
        </p>
      </div>
    </div>
  );
}
