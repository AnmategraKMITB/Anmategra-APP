'use client';

// Library Import
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { DEMO_DIVISIONS, divisionName } from '../data';
import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import { Btn, Field, inputClass } from '../ui';

const STEPS: DemoStep[] = [
  { id: 'p1', title: 'Pilih divisi untuk **Pilihan 1**' },
  {
    id: 'p2',
    title: 'Pilih divisi lain untuk **Pilihan 2**',
    hint: 'Perhatikan bagian pertanyaan di bawahnya: hanya bagian divisi yang Anda pilih yang muncul.',
  },
  {
    id: 'isi',
    title: 'Jawab semua pertanyaan wajib, lalu klik **Lanjut**',
    hint: 'Lampiran diisi sebagai tautan (Google Drive, OneDrive, dan sejenisnya), bukan unggahan berkas.',
  },
  { id: 'kirim', title: 'Periksa **Tinjau jawabanmu**, lalu klik **Kirim**' },
  {
    id: 'hasil',
    title: 'Klik **Simulasikan rilis hasil** untuk melihat tampilan setelah panitia merilis',
  },
];

const DIVISION_QUESTION: Record<string, string> = {
  acara: 'Ceritakan pengalaman Anda menyusun rundown',
  publikasi: 'Tautan portofolio desain',
  logistik: 'Peralatan apa yang pernah Anda kelola?',
  danus: 'Ide dana usaha yang ingin Anda jalankan',
};

type Answers = {
  motivation: string;
  first: string;
  second: string;
  willing: boolean;
  cv: string;
  perDivision: Record<string, string>;
};

const EMPTY: Answers = {
  motivation: '',
  first: '',
  second: '',
  willing: false,
  cv: '',
  perDivision: {},
};

export default function OprecDaftarDemo() {
  return (
    <DemoFrame
      title="Mendaftar oprec sebagai mahasiswa"
      location="Mahasiswa › tautan formulir › Pendaftaran Oprec Festival Karya 2026"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [screen, setScreen] = useState<'isi' | 'tinjau' | 'terkirim'>('isi');
  const [answers, setAnswers] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [released, setReleased] = useState(false);

  const chosen = [answers.first, answers.second].filter(Boolean);
  const patch = (next: Partial<Answers>) =>
    setAnswers((prev) => ({ ...prev, ...next }));

  const validate = () => {
    const found: Record<string, string> = {};
    if (answers.motivation.trim() === '') found.motivation = 'Wajib diisi.';
    if (!answers.first) found.first = 'Pilih minimal satu tujuan.';
    for (const id of chosen) {
      if ((answers.perDivision[id] ?? '').trim() === '') {
        found[`div-${id}`] = 'Wajib diisi.';
      }
    }
    if (!/^https?:\/\/\S+\.\S+/.test(answers.cv.trim())) {
      found.cv = 'Isi tautan yang sah, diawali http:// atau https://.';
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const error = (key: string) =>
    errors[key] ? (
      <p role="alert" className="text-xs font-semibold text-danger-dark">
        {errors[key]}
      </p>
    ) : null;

  if (screen === 'terkirim') {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <div className="rounded-lg border border-neutral-400 p-4">
          <p className="text-base font-semibold">Kamu sudah mengirim jawaban</p>
          <p className="mt-1 text-xs text-neutral-700">
            Jawabanmu untuk “Pendaftaran Oprec Festival Karya 2026” terkirim
            pada 12 Nov 2026 19.04 WIB.
          </p>
          <p className="mt-2 text-xs text-neutral-700">
            Kamu masih bisa mengubah jawaban selama formulir belum ditutup.
          </p>
          <Btn
            small
            tone="outline"
            className="mt-2"
            onClick={() => setScreen('isi')}
          >
            Ubah jawaban
          </Btn>
        </div>
        <div className="rounded-lg border border-neutral-400 p-4">
          <p className="text-xs font-semibold text-neutral-700">
            Hasil pendaftaran
          </p>
          {released ? (
            <>
              <p className="mt-1 text-base font-semibold text-success-dark">
                Selamat, kamu diterima!
              </p>
              <p className="mt-1">
                Diterima di <strong>Divisi {divisionName(answers.first)}</strong>.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-base font-semibold">
                Pendaftaranmu sudah kami terima
              </p>
              <p className="mt-1 text-xs text-neutral-700">
                Hasil akan diumumkan oleh panitia. Pantau halaman ini lagi
                nanti.
              </p>
            </>
          )}
        </div>
        <div className="rounded-lg border border-dashed border-secondary-400 bg-secondary-50 p-3 text-xs">
          <p className="text-neutral-800">
            Di aplikasi, hasil berubah setelah panitia merilisnya. Di simulasi
            ini Anda yang menekan tombolnya.
          </p>
          <Btn
            small
            tone="teal"
            className={cn('mt-2', guide.spot('hasil'))}
            disabled={released}
            onClick={() => {
              setReleased(true);
              guide.complete('hasil');
            }}
          >
            Simulasikan rilis hasil
          </Btn>
        </div>
      </div>
    );
  }

  if (screen === 'tinjau') {
    const rows: [string, string][] = [
      ['Mengapa Anda ingin bergabung?', answers.motivation],
      [
        'Pilihan tujuan',
        chosen.map((id, index) => `${index + 1}. ${divisionName(id)}`).join(' · '),
      ],
      ['Bersedia dipindahkan', answers.willing ? 'Ya' : 'Tidak'],
      ...chosen.map(
        (id): [string, string] => [
          DIVISION_QUESTION[id] ?? id,
          answers.perDivision[id] ?? '',
        ],
      ),
      ['Tautan CV', answers.cv],
    ];
    return (
      <div className="mx-auto max-w-md">
        <p className="text-lg font-semibold">Tinjau jawabanmu</p>
        <dl className="mt-3 space-y-2">
          {rows.map(([question, answer]) => (
            <div key={question}>
              <dt className="text-xs font-semibold text-neutral-700">
                {question}
              </dt>
              <dd className="break-words">{answer}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex justify-between gap-2">
          <Btn tone="ghost" onClick={() => setScreen('isi')}>
            Kembali
          </Btn>
          <Btn
            className={guide.spot('kirim')}
            onClick={() => {
              guide.complete('kirim');
              setScreen('terkirim');
            }}
          >
            Kirim
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <p className="text-lg font-semibold">
          Pendaftaran Oprec Festival Karya 2026
        </p>
        <p className="mt-1 text-xs text-neutral-700">
          Identitas diambil dari akun Anda: Raka Pradipta · 13524011. Satu akun
          hanya bisa mengirim satu pendaftaran.
        </p>
      </div>

      <Field label="1. Mengapa Anda ingin bergabung? *">
        {(id) => (
          <>
            <textarea
              id={id}
              rows={2}
              value={answers.motivation}
              onChange={(event) => patch({ motivation: event.target.value })}
              className={cn(inputClass, 'h-auto py-2')}
            />
            {error('motivation')}
          </>
        )}
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-neutral-800">
          2. Pilihan tujuan *
        </legend>
        <p className="text-xs text-neutral-700">
          Pilih 1–2 tujuan, berurutan dari yang paling Anda inginkan.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            aria-label="Pilihan 1"
            value={answers.first}
            onChange={(event) => {
              const value = event.target.value;
              patch({
                first: value,
                second: answers.second === value ? '' : answers.second,
              });
              if (value) guide.complete('p1');
            }}
            className={cn(inputClass, guide.spot('p1'))}
          >
            <option value="">Pilihan 1: pilih tujuan</option>
            {DEMO_DIVISIONS.map((division) => (
              <option key={division.id} value={division.id}>
                {division.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Pilihan 2"
            value={answers.second}
            disabled={!answers.first}
            title={answers.first ? undefined : 'Isi pilihan sebelumnya dulu'}
            onChange={(event) => {
              patch({ second: event.target.value });
              if (event.target.value) guide.complete('p2');
            }}
            className={cn(inputClass, answers.first && guide.spot('p2'))}
          >
            <option value="">
              {answers.first
                ? 'Pilihan 2: kosongkan pilihan'
                : 'Isi pilihan sebelumnya dulu'}
            </option>
            {DEMO_DIVISIONS.filter(
              (division) => division.id !== answers.first,
            ).map((division) => (
              <option key={division.id} value={division.id}>
                {division.name}
              </option>
            ))}
          </select>
        </div>
        {error('first')}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={answers.willing}
            onChange={(event) => patch({ willing: event.target.checked })}
            className="size-4 accent-[#2B6282]"
          />
          Saya bersedia dipindahkan ke divisi di luar pilihan saya
        </label>
      </fieldset>

      {chosen.map((id) => (
        <div
          key={id}
          className="rounded-lg border border-secondary-300 bg-secondary-50 p-3"
        >
          <p className="text-xs font-semibold text-secondary-800">
            Bagian Divisi {divisionName(id)} · tampil karena Anda memilihnya
          </p>
          <Field label={`${DIVISION_QUESTION[id]} *`} className="mt-2">
            {(fieldId) => (
              <>
                <input
                  id={fieldId}
                  value={answers.perDivision[id] ?? ''}
                  onChange={(event) =>
                    patch({
                      perDivision: {
                        ...answers.perDivision,
                        [id]: event.target.value,
                      },
                    })
                  }
                  className={inputClass}
                />
                {error(`div-${id}`)}
              </>
            )}
          </Field>
        </div>
      ))}

      <Field label="Tautan CV *" hint="Pastikan tautan bisa dibuka oleh panitia.">
        {(id) => (
          <>
            <input
              id={id}
              type="url"
              placeholder="https://drive.google.com/…"
              value={answers.cv}
              onChange={(event) => patch({ cv: event.target.value })}
              className={inputClass}
            />
            {error('cv')}
          </>
        )}
      </Field>

      {Object.keys(errors).length > 0 ? (
        <p role="alert" className="text-xs font-semibold text-danger-dark">
          Ada jawaban yang perlu diperbaiki.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Btn
          className={guide.spot('isi')}
          onClick={() => {
            if (!validate()) return;
            ['p1', 'p2', 'isi'].forEach(guide.complete);
            setScreen('tinjau');
          }}
        >
          Lanjut
        </Btn>
      </div>
    </div>
  );
}
