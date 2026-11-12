'use client';

// Library Import
import { useState } from 'react';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import { Btn } from '../ui';
import {
  type Answers,
  type DemoField,
  isAnswered,
  isVisible,
  Question,
  showAnswer,
} from './form-shared';

const STEPS: DemoStep[] = [
  { id: 'mulai', title: 'Klik **Mulai** pada layar sambutan' },
  {
    id: 'cabang',
    title: 'Jawab pertanyaan 2 dengan **Ya**',
    hint: 'Pertanyaan lanjutan muncul di bawahnya karena syaratnya terpenuhi.',
  },
  {
    id: 'lanjut',
    title: 'Isi semua pertanyaan wajib (bertanda *), lalu klik **Lanjut**',
    hint: 'Coba klik Lanjut saat masih ada yang kosong untuk melihat pesannya.',
  },
  {
    id: 'kirim',
    title: 'Isi bagian kedua, periksa **Tinjau jawabanmu**, lalu klik **Kirim**',
  },
  {
    id: 'ubah',
    title: 'Klik **Ubah jawaban**, ganti satu jawaban, lalu **Simpan perubahan**',
    hint: 'Hanya tersedia bila pembuat form mengizinkan dan form belum ditutup.',
  },
];

const PAGES: { title: string; fields: DemoField[] }[] = [
  {
    title: 'Tentang Anda',
    fields: [
      { id: 'nama', kind: 'short_text', label: 'Nama panggilan', required: true, options: [] },
      { id: 'pernah', kind: 'single_choice', label: 'Apakah Anda pernah menjadi panitia?', required: true, options: ['Ya', 'Tidak'] },
      {
        id: 'cerita',
        kind: 'long_text',
        label: 'Ceritakan pengalaman kepanitiaan Anda',
        required: true,
        options: [],
        condition: { fieldId: 'pernah', op: 'sama_dengan', value: 'Ya' },
      },
    ],
  },
  {
    title: 'Ketersediaan',
    fields: [
      { id: 'siap', kind: 'scale', label: 'Seberapa siap Anda berkomitmen?', required: true, options: [] },
      { id: 'hari', kind: 'multiple_choice', label: 'Hari apa saja Anda luang?', required: false, options: ['Senin–Rabu', 'Kamis–Jumat', 'Akhir pekan'] },
    ],
  },
];

const ALL_FIELDS = PAGES.flatMap((page) => page.fields);

type Screen = 'sambutan' | 0 | 1 | 'tinjau' | 'terkirim';

export default function FormsIsiDemo() {
  return (
    <DemoFrame
      title="Mengisi form sebagai mahasiswa"
      location="Mahasiswa › tautan form › Survei Minat Panitia"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [screen, setScreen] = useState<Screen>('sambutan');
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const answer = (id: string, value: Answers[string]) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (id === 'pernah' && value === 'Ya') guide.complete('cabang');
  };

  /** Pertanyaan wajib yang tersembunyi tidak ikut diperiksa. */
  const validate = (fields: DemoField[]) => {
    const found: Record<string, string> = {};
    for (const field of fields) {
      if (
        field.required &&
        isVisible(field, answers) &&
        !isAnswered(answers[field.id])
      ) {
        found[field.id] = 'Wajib diisi.';
      }
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  if (screen === 'sambutan') {
    return (
      <div className="mx-auto max-w-md py-8 text-center">
        <p className="text-xl font-semibold">Survei Minat Panitia</p>
        <p className="mt-2 text-neutral-700">
          Bantu kami mengenal minat Anda sebelum rekrutmen dibuka. Butuh sekitar
          dua menit.
        </p>
        <Btn
          className={`mt-4 ${guide.spot('mulai')}`}
          onClick={() => {
            guide.complete('mulai');
            setScreen(0);
          }}
        >
          Mulai
        </Btn>
      </div>
    );
  }

  if (screen === 'terkirim') {
    return (
      <div className="mx-auto max-w-md py-6 text-center">
        <p className="text-xl font-semibold">Terima kasih!</p>
        <p className="mt-2 text-neutral-700">
          {saved
            ? 'Perubahan jawabanmu sudah tersimpan.'
            : 'Jawabanmu sudah terkirim.'}
        </p>
        <div className="mt-4 rounded-lg border border-neutral-400 p-3 text-left">
          <p className="font-semibold">Kamu sudah mengirim jawaban</p>
          <p className="mt-1 text-xs text-neutral-700">
            Kamu masih bisa mengubah jawaban selama formulir belum ditutup.
          </p>
          <Btn
            small
            tone="outline"
            className={`mt-2 ${guide.spot('ubah')}`}
            onClick={() => {
              setEditing(true);
              setScreen(0);
            }}
          >
            Ubah jawaban
          </Btn>
        </div>
      </div>
    );
  }

  if (screen === 'tinjau') {
    return (
      <div className="mx-auto max-w-md">
        <p className="text-lg font-semibold">Tinjau jawabanmu</p>
        <dl className="mt-3 space-y-2">
          {ALL_FIELDS.filter((field) => isVisible(field, answers)).map(
            (field) => (
              <div key={field.id}>
                <dt className="text-xs font-semibold text-neutral-700">
                  {field.label}
                </dt>
                <dd>{showAnswer(answers[field.id])}</dd>
              </div>
            ),
          )}
        </dl>
        <div className="mt-4 flex justify-between gap-2">
          <Btn tone="ghost" onClick={() => setScreen(1)}>
            Kembali
          </Btn>
          <Btn
            className={guide.spot('kirim', 'ubah')}
            onClick={() => {
              guide.complete('kirim');
              if (editing) {
                guide.complete('ubah');
                setSaved(true);
              }
              setEditing(false);
              setScreen('terkirim');
            }}
          >
            {editing ? 'Simpan perubahan' : 'Kirim'}
          </Btn>
        </div>
      </div>
    );
  }

  const page = PAGES[screen]!;
  const visible = page.fields.filter((field) => isVisible(field, answers));
  const numberOf = (field: DemoField) =>
    ALL_FIELDS.filter((item) => isVisible(item, answers)).indexOf(field) + 1;

  return (
    <div className="mx-auto max-w-md">
      {editing ? (
        <p className="mb-2 rounded-lg bg-warning-light px-3 py-2 text-xs">
          Mengubah jawaban yang sudah dikirim.
        </p>
      ) : null}
      <div
        role="progressbar"
        aria-label="Kemajuan pengisian"
        aria-valuenow={(screen + 1) * 50}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 overflow-hidden rounded-full bg-neutral-200"
      >
        <div
          className="h-full rounded-full bg-secondary-400 transition-all"
          style={{ width: `${(screen + 1) * 50}%` }}
        />
      </div>
      <p className="mt-3 text-xs font-semibold text-neutral-700">
        Bagian {screen + 1} dari {PAGES.length}
      </p>
      <p className="text-lg font-semibold">{page.title}</p>

      <div className="mt-3 space-y-4">
        {visible.map((field) => (
          <Question
            key={field.id}
            field={field}
            number={numberOf(field)}
            value={answers[field.id]}
            onChange={(value) => answer(field.id, value)}
            error={errors[field.id]}
            inputClassName={field.id === 'pernah' ? guide.spot('cabang') : ''}
          />
        ))}
      </div>

      {Object.keys(errors).length > 0 ? (
        <p role="alert" className="mt-3 text-xs font-semibold text-danger-dark">
          Ada jawaban yang perlu diperbaiki.
        </p>
      ) : null}

      <div className="mt-4 flex justify-between gap-2">
        <Btn
          tone="ghost"
          disabled={screen === 0}
          onClick={() => setScreen(0)}
        >
          Kembali
        </Btn>
        <Btn
          className={guide.spot('lanjut', 'kirim', 'ubah')}
          onClick={() => {
            if (!validate(page.fields)) return;
            if (screen === 0) {
              // Yang menjawab Tidak tetap boleh lanjut; panduan ikut maju.
              guide.complete('cabang');
              guide.complete('lanjut');
              setScreen(1);
            } else {
              setScreen('tinjau');
            }
          }}
        >
          Lanjut
        </Btn>
      </div>
    </div>
  );
}
