'use client';

// Simulasi halaman isi form seperti yang dilihat mahasiswa. Tampilan, warna,
// dan teks mengikuti halaman aslinya: kartu sudut 24px, bilah kemajuan
// antarbagian, penanda pertanyaan lanjutan, catatan draf, dan layar penutup.
// Library Import
import { CornerDownRight, Save } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { cn } from '~/lib/utils';

import { DEMO_DIVISIONS, DEMO_EVENT, DEMO_STUDENTS } from '../data';
import { DemoFrame, type DemoGuide, type DemoStep } from '../demo-frame';
import { Btn, Pill, inputClass } from '../ui';
import {
  type AnswerValue,
  type Answers,
  type DemoField,
  isAnswered,
  isVisible,
  showAnswer,
} from './form-shared';

const STEPS: DemoStep[] = [
  { id: 'mulai', title: 'Klik **Mulai** pada layar sambutan' },
  {
    id: 'cabang',
    title: 'Jawab **Pernah jadi panitia sebelumnya?** dengan **Ya**',
    hint: 'Pertanyaan lanjutan muncul di bawahnya karena syaratnya terpenuhi.',
  },
  {
    id: 'lanjut',
    title: 'Isi semua pertanyaan wajib (bertanda *), lalu klik **Lanjut**',
    hint: 'Coba klik Lanjut saat masih ada yang kosong untuk melihat pesannya.',
  },
  {
    id: 'kirim',
    title:
      'Isi bagian kedua, periksa **Tinjau jawabanmu**, lalu klik **Kirim**',
  },
  {
    id: 'ubah',
    title:
      'Klik **Ubah jawaban**, ganti satu jawaban, lalu **Simpan perubahan**',
    hint: 'Hanya tersedia bila pembuat form mengizinkan dan form belum ditutup.',
  },
];

// Warna aksen tema form; dipasang sebagai variabel CSS agar kelas
// `bg-[var(--form-accent)]` di bawah sama persis dengan halaman aslinya.
const ACCENT = '#2B6282';

const FORM_TITLE = `Open Recruitment Panitia ${DEMO_EVENT}`;
const FORM_DESCRIPTION = `Satu form, dua bagian. Kamu bisa kembali ke bagian sebelumnya kapan aja sebelum mengirim.`;

const WELCOME_TITLE = `Open Recruitment Panitia ${DEMO_EVENT}`;
const WELCOME_TEXT =
  'Haii! Makasii udah tertarik jadi bagian dari AMI 2027 🙌\nSebelum lanjut, jawab pertanyaan santai di bawah ini dulu ya. Gak ada jawaban yang salah kok, jadi jawab sejujurnya aja.\n\n± 2 menit aja!';

type DemoPage = {
  id: string;
  title: string;
  description: string;
  fields: DemoField[];
};

const DIVISION_OPTIONS = DEMO_DIVISIONS.map((division) => division.name);

const PAGES: DemoPage[] = [
  {
    id: 'tentang',
    title: 'Tentang Kamu',
    description: 'Bagian ini soal kamu, bukan soal pengalaman formal.',
    fields: [
      {
        id: 'nama',
        kind: 'short_text',
        label: 'Ummm.. boleh tau gak nama panggilannya siapaa??',
        required: true,
        options: [],
      },
      {
        id: 'mbti',
        kind: 'single_choice',
        label: 'MBTI kamu apaasichh??',
        required: true,
        options: ['ENFP', 'INFP', 'INTJ', 'ENFJ', 'ISTJ', 'Aku gak tau hehe'],
      },
      {
        id: 'pernah',
        kind: 'single_choice',
        label: 'Pernah jadi panitia sebelumnya?',
        required: true,
        options: ['Ya', 'Belum'],
      },
      {
        id: 'cerita',
        kind: 'long_text',
        label: 'Ceritain pengalaman kepanitiaanmu dong!',
        required: true,
        options: [],
        condition: { fieldId: 'pernah', op: 'sama_dengan', value: 'Ya' },
      },
    ],
  },
  {
    id: 'komitmen',
    title: 'Komitmen & Ketersediaan',
    description: 'Kepanitiaan AMI 2027 jalan dari Maret sampai Agustus.',
    fields: [
      {
        id: 'siap',
        kind: 'scale',
        label: 'Seberapa siap kamu commit sama AMI 2027?',
        required: true,
        options: [],
      },
      {
        id: 'divisi',
        kind: 'single_choice',
        label: 'Kalau boleh milih, kamu paling pengen di divisi mana?',
        required: true,
        options: DIVISION_OPTIONS,
      },
      {
        id: 'hari',
        kind: 'multiple_choice',
        label: 'Hari apa aja kamu biasanya luang buat rapat?',
        required: false,
        options: [
          'Senin',
          'Selasa',
          'Rabu',
          'Kamis',
          'Jumat',
          'Sabtu',
          'Minggu',
        ],
      },
    ],
  },
];

const ALL_FIELDS = PAGES.flatMap((page) => page.fields);

/** Mahasiswa fiktif yang sedang mengisi; di aplikasi asli diambil dari akun ITB. */
const STUDENT = DEMO_STUDENTS[0]!;
const INITIALS = STUDENT.name
  .split(' ')
  .slice(0, 2)
  .map((word) => word.charAt(0))
  .join('');

/** Gaya kelas yang sama dengan `renderer-inputs.tsx`. */
const choiceRow =
  'flex items-center gap-3 rounded-xl border border-neutral-400 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-1000 transition-colors duration-150 hover:bg-neutral-200 has-[:checked]:border-[var(--form-accent)] has-[:checked]:bg-neutral-100 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--form-accent)]';

const primaryButton =
  'bg-[var(--form-accent)] text-white hover:bg-[var(--form-accent)] hover:opacity-90';

export default function FormsIsiDemo() {
  return (
    <DemoFrame
      title="Mengisi form sebagai mahasiswa"
      location={`Mahasiswa › ${DEMO_EVENT} › Open Recruitment Panitia`}
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

type Screen = 'sambutan' | 'pertanyaan' | 'tinjau' | 'terkirim';

function Body({ guide }: { guide: DemoGuide }) {
  const [screen, setScreen] = useState<Screen>('sambutan');
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const answer = (id: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      if (!(id in prev)) return prev;
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
    const ok = Object.keys(found).length === 0;
    setFormError(ok ? null : 'Ada jawaban yang perlu diperbaiki.');
    return ok;
  };

  const back = () => {
    setErrors({});
    setFormError(null);
    if (screen === 'tinjau') {
      setScreen('pertanyaan');
      setPageIndex(PAGES.length - 1);
      return;
    }
    if (pageIndex > 0) setPageIndex(pageIndex - 1);
    else setScreen('sambutan');
  };

  const primary = () => {
    if (screen === 'sambutan') {
      guide.complete('mulai');
      setScreen('pertanyaan');
      setPageIndex(0);
      return;
    }
    if (screen === 'tinjau') {
      guide.complete('kirim');
      if (editing) {
        guide.complete('ubah');
        setSaved(true);
      }
      setEditing(false);
      setScreen('terkirim');
      return;
    }
    const current = PAGES[pageIndex]!;
    if (!validate(current.fields)) return;
    // Yang menjawab "Belum" tetap boleh lanjut; panduan ikut maju.
    guide.complete('cabang');
    guide.complete('lanjut');
    if (pageIndex < PAGES.length - 1) setPageIndex(pageIndex + 1);
    else setScreen('tinjau');
  };

  const style = {
    '--form-accent': ACCENT,
  } as CSSProperties;

  const page = PAGES[pageIndex]!;
  const visibleOnPage = page.fields.filter((field) =>
    isVisible(field, answers),
  );
  const visibleAll = ALL_FIELDS.filter((field) => isVisible(field, answers));
  const numberOf = (field: DemoField) =>
    ALL_FIELDS.filter((item) => isVisible(item, answers)).indexOf(field) + 1;

  const primaryLabel =
    screen === 'sambutan'
      ? 'Mulai'
      : screen === 'tinjau'
        ? editing
          ? 'Simpan perubahan'
          : 'Kirim'
        : 'Lanjut';

  return (
    <div style={style} className="mx-auto w-full max-w-2xl">
      {/* Baris identitas: nama dan NIM diambil dari akun ITB yang sedang masuk. */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-400 bg-neutral-100 px-3 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-xs font-semibold text-secondary-800">
          {INITIALS}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-1000">
            {STUDENT.name}
          </p>
          <p className="truncate text-xs text-neutral-700">
            NIM {STUDENT.nim} · {STUDENT.prodi}
          </p>
        </div>
        <Pill tone="info">Akun ITB</Pill>
      </div>

      {/* Isi form bisa digulir sendiri; tinggi dijaga tetap seperti jendela demo. */}
      <div className="max-h-[520px] overflow-y-auto">
        {screen === 'terkirim' ? (
          <div
            role="status"
            className="rounded-[24px] border border-neutral-400 bg-white p-8 text-center"
          >
            <h2 className="text-2xl font-semibold text-neutral-1000">
              Terima kasih!
            </h2>
            <p className="mt-2 whitespace-pre-line text-neutral-700">
              {saved
                ? 'Perubahan jawabanmu sudah tersimpan.'
                : 'Jawabanmu sudah terkirim.'}
            </p>
            {/* Hanya muncul bila pembuat form mengizinkan perubahan dan form belum ditutup. */}
            <div className="mt-6 flex flex-col items-center gap-2">
              <Btn
                className={cn(primaryButton, guide.spot('ubah'))}
                onClick={() => {
                  setEditing(true);
                  setSaved(false);
                  setScreen('pertanyaan');
                  setPageIndex(0);
                }}
              >
                Ubah jawaban
              </Btn>
              <p className="text-xs text-neutral-700">
                Kamu masih bisa mengubah jawaban selama formulir belum ditutup.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-neutral-400 bg-white p-5 sm:p-8">
            {screen === 'sambutan' ? (
              <div>
                <h2 className="text-3xl font-semibold text-neutral-1000">
                  {WELCOME_TITLE}
                </h2>
                <p className="mt-3 whitespace-pre-line text-neutral-700">
                  {WELCOME_TEXT}
                </p>
              </div>
            ) : null}

            {screen === 'pertanyaan' ? (
              <>
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-neutral-700">
                    <span>
                      Bagian {pageIndex + 1} dari {PAGES.length}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={PAGES.length}
                    aria-valuenow={pageIndex + 1}
                    aria-label="Kemajuan pengisian"
                    className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-200"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--form-accent)]"
                      style={{
                        width: `${((pageIndex + 1) / PAGES.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-5">
                  {pageIndex === 0 ? (
                    <header>
                      <h2 className="text-2xl font-semibold text-neutral-1000">
                        {FORM_TITLE}
                      </h2>
                      <p className="mt-2 whitespace-pre-line text-neutral-700">
                        {FORM_DESCRIPTION}
                      </p>
                    </header>
                  ) : null}
                  <div>
                    <h3 className="text-xl font-semibold text-neutral-1000">
                      {page.title}
                    </h3>
                    <p className="mt-1 text-neutral-700">{page.description}</p>
                  </div>
                  {visibleOnPage.map((field) => (
                    <FieldRow
                      key={field.id}
                      field={field}
                      number={numberOf(field)}
                      value={answers[field.id]}
                      error={errors[field.id]}
                      onChange={(value) => answer(field.id, value)}
                      className={
                        field.id === 'pernah' ? guide.spot('cabang') : ''
                      }
                    />
                  ))}
                </div>

                <p className="mt-5 flex items-center gap-1.5 text-xs text-neutral-700">
                  <Save className="size-3.5" aria-hidden />
                  Draf jawabanmu tersimpan otomatis di perangkat ini.
                </p>
              </>
            ) : null}

            {screen === 'tinjau' ? (
              <div>
                <h2 className="text-2xl font-semibold text-neutral-1000">
                  Tinjau jawabanmu
                </h2>
                <dl className="mt-4 grid gap-3">
                  {visibleAll.map((field) => (
                    <div
                      key={field.id}
                      className="rounded-xl bg-neutral-100 p-3"
                    >
                      <dt className="text-sm text-neutral-700">
                        {field.label}
                      </dt>
                      <dd className="mt-0.5 text-neutral-1000">
                        {showAnswer(answers[field.id])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            <p
              role={formError ? 'alert' : undefined}
              className="mt-6 min-h-5 text-sm text-danger-dark"
            >
              {formError}
            </p>

            <div className="mt-8 flex flex-wrap justify-between gap-3">
              <Btn
                tone="outline"
                disabled={screen === 'sambutan'}
                onClick={back}
              >
                Kembali
              </Btn>
              <Btn
                className={cn(
                  primaryButton,
                  guide.spot('mulai', 'lanjut', 'kirim', 'ubah'),
                )}
                onClick={primary}
              >
                {primaryLabel}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Satu pertanyaan: penanda lanjutan, label bernomor, masukan, dan galat. */
function FieldRow({
  field,
  number,
  value,
  error,
  onChange,
  className,
}: {
  field: DemoField;
  number: number;
  value: AnswerValue;
  error?: string;
  onChange: (next: AnswerValue) => void;
  className?: string;
}) {
  const inputId = `fill-${field.id}`;
  return (
    <div id={`field-${field.id}`} className={cn('grid gap-2', className)}>
      {field.condition ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-secondary-800">
          <CornerDownRight className="size-3.5" aria-hidden />
          Pertanyaan lanjutan dari jawabanmu
        </p>
      ) : null}
      <label
        id={`label-${field.id}`}
        htmlFor={inputId}
        className="font-semibold text-neutral-1000"
      >
        {`${number}. `}
        {field.label}
        {field.required ? (
          <>
            <span aria-hidden className="ml-1 text-tomato">
              *
            </span>
            <span className="sr-only"> (wajib diisi)</span>
          </>
        ) : null}
      </label>
      <AnswerInput
        field={field}
        value={value}
        onChange={onChange}
        inputId={inputId}
        invalid={!!error}
      />
      {/* Ruang pesan galat dipesan agar tata letak tidak bergeser. */}
      <p
        id={`err-${field.id}`}
        role={error ? 'alert' : undefined}
        className="min-h-5 text-sm text-danger-dark"
      >
        {error}
      </p>
    </div>
  );
}

/** Kolom jawaban untuk satu pertanyaan, mengikuti jenisnya. */
function AnswerInput({
  field,
  value,
  onChange,
  inputId,
  invalid,
}: {
  field: DemoField;
  value: AnswerValue;
  onChange: (next: AnswerValue) => void;
  inputId: string;
  invalid: boolean;
}) {
  const describedBy = invalid ? `err-${field.id}` : undefined;

  switch (field.kind) {
    case 'long_text':
      return (
        <textarea
          id={inputId}
          rows={4}
          value={typeof value === 'string' ? value : ''}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, 'h-auto min-h-24 py-2')}
        />
      );
    case 'single_choice':
      return (
        <div
          role="radiogroup"
          aria-labelledby={`label-${field.id}`}
          aria-describedby={describedBy}
          className="grid gap-2"
        >
          {field.options.map((option) => (
            <label key={option} className={choiceRow}>
              <input
                type="radio"
                name={inputId}
                className="size-4 accent-[var(--form-accent)]"
                checked={value === option}
                onChange={() => onChange(option)}
              />
              {option}
            </label>
          ))}
          {typeof value === 'string' && value !== '' ? (
            <ClearChoice onClick={() => onChange(undefined)} />
          ) : null}
        </div>
      );
    case 'multiple_choice': {
      const picked = Array.isArray(value) ? value : [];
      return (
        <div
          role="group"
          aria-labelledby={`label-${field.id}`}
          aria-describedby={describedBy}
          className="grid gap-2"
        >
          {field.options.map((option) => (
            <label key={option} className={choiceRow}>
              <input
                type="checkbox"
                className="size-4 accent-[var(--form-accent)]"
                checked={picked.includes(option)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...picked, option]
                    : picked.filter((item) => item !== option);
                  onChange(next.length > 0 ? next : undefined);
                }}
              />
              {option}
            </label>
          ))}
          {picked.length > 0 ? (
            <ClearChoice onClick={() => onChange(undefined)} />
          ) : null}
        </div>
      );
    }
    case 'scale':
      return (
        <ScaleInput fieldId={field.id} value={value} onChange={onChange} />
      );
    default:
      return (
        <input
          id={inputId}
          type="text"
          value={typeof value === 'string' ? value : ''}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      );
  }
}

function ClearChoice({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-fit text-sm font-medium text-neutral-700 underline-offset-4 hover:text-danger-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
    >
      Kosongkan pilihan
    </button>
  );
}

/** Skala 1–5 dengan tombol angka, sama seperti bawaan halaman isi form. */
function ScaleInput({
  fieldId,
  value,
  onChange,
}: {
  fieldId: string;
  value: AnswerValue;
  onChange: (next: AnswerValue) => void;
}) {
  const current = typeof value === 'number' ? value : undefined;
  return (
    <div>
      <div
        role="radiogroup"
        aria-labelledby={`label-${fieldId}`}
        className="flex flex-wrap gap-2"
      >
        {[1, 2, 3, 4, 5].map((score) => {
          const active = current === score;
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${score} dari 5`}
              onClick={() => onChange(score)}
              className={cn(
                'flex size-10 items-center justify-center rounded-xl border text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--form-accent)]',
                active
                  ? 'border-[var(--form-accent)] bg-[var(--form-accent)] text-white'
                  : 'border-neutral-400 bg-neutral-50 text-neutral-1000 hover:bg-neutral-200',
              )}
            >
              {score}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-sm text-neutral-700">
        <span>Belum siap</span>
        <span>Siap banget</span>
      </div>
    </div>
  );
}
