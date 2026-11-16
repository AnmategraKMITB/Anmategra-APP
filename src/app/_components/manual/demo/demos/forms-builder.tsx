'use client';

// Library Import
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import { Btn, Empty, inputClass, Pill, TabBar, Toggle } from '../ui';
import {
  type Answers,
  type DemoField,
  FIELD_KINDS,
  type FieldKind,
  hasOptions,
  kindLabel,
  Question,
} from './form-shared';

const STEPS: DemoStep[] = [
  { id: 'judul', title: 'Ubah **Judul form** di bagian atas' },
  {
    id: 'tambah',
    title: 'Klik **Tambah konten**, lalu pilih **Pilihan tunggal**',
  },
  {
    id: 'isi',
    title: 'Tulis pertanyaannya, lalu ubah teks salah satu pilihan',
    hint: 'Tekan tombol **Tambah pilihan** bila butuh lebih dari dua.',
  },
  { id: 'wajib', title: 'Nyalakan **Wajib diisi** pada pertanyaan itu' },
  {
    id: 'pratinjau',
    title: 'Buka tab **Pratinjau** untuk melihat form seperti yang dilihat pengisi',
  },
];

const TABS = [
  ['konten', 'Konten'],
  ['alur', 'Alur'],
  ['pratinjau', 'Pratinjau'],
] as const;
type Tab = (typeof TABS)[number][0];

const INITIAL: DemoField[] = [
  {
    id: 'f1',
    kind: 'short_text',
    label: 'Nama panggilan',
    required: true,
    options: [],
  },
];

export default function FormsBuilderDemo() {
  return (
    <DemoFrame
      title="Pembuat form"
      location="Lembaga › Forms › Form baru"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [tab, setTab] = useState<Tab>('konten');
  const [title, setTitle] = useState('Form tanpa judul');
  const [fields, setFields] = useState(INITIAL);
  const [menuOpen, setMenuOpen] = useState(false);
  const [counter, setCounter] = useState(2);
  const [answers, setAnswers] = useState<Answers>({});
  const [narrow, setNarrow] = useState(false);

  const update = (id: string, patch: Partial<DemoField>) =>
    setFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, ...patch } : field)),
    );

  const add = (kind: FieldKind) => {
    const id = `f${counter}`;
    setCounter((value) => value + 1);
    setFields((prev) => [
      ...prev,
      {
        id,
        kind,
        label: kind === 'text_block' ? 'Penjelasan' : '',
        required: false,
        options: hasOptions(kind) ? ['Pilihan 1', 'Pilihan 2'] : [],
      },
    ]);
    setMenuOpen(false);
    if (kind === 'single_choice') guide.complete('tambah');
  };

  const move = (index: number, delta: number) =>
    setFields((prev) => {
      const next = [...prev];
      const target = index + delta;
      const item = next[index];
      const other = next[target];
      if (!item || !other) return prev;
      next[index] = other;
      next[target] = item;
      return next;
    });

  // Langkah "isi" selesai begitu ada pilihan tunggal berjudul dengan opsi yang
  // sudah diganti dari teks bawaannya.
  const checkFilled = (field: DemoField) => {
    if (
      field.kind === 'single_choice' &&
      field.label.trim() !== '' &&
      field.options.some((option) => !/^Pilihan \d+$/.test(option))
    ) {
      guide.complete('isi');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Judul form"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (event.target.value.trim() !== '') guide.complete('judul');
          }}
          className={cn(
            inputClass,
            'h-10 min-w-40 flex-1 text-base font-semibold',
            guide.spot('judul'),
          )}
        />
        <Pill>Draf</Pill>
        <span className="text-xs text-neutral-700">Tersimpan</span>
      </div>

      <div className="mt-3">
        <TabBar
          label="Bagian builder"
          tabs={TABS}
          value={tab}
          onChange={(next) => {
            setTab(next);
            if (next === 'pratinjau') guide.complete('pratinjau');
          }}
          spot={(id) => (id === 'pratinjau' ? guide.spot('pratinjau') : '')}
        />
      </div>

      {tab === 'konten' ? (
        <div className="mt-3 space-y-3">
          {fields.length === 0 ? (
            <Empty>Form ini belum berisi apa pun. Tambahkan pertanyaan.</Empty>
          ) : null}
          {fields.map((field, index) => {
            const isQuestion = field.kind !== 'text_block';
            const questionNumber = fields
              .slice(0, index + 1)
              .filter((item) => item.kind !== 'text_block').length;
            return (
              <div
                key={field.id}
                className="rounded-lg border border-neutral-400 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-700">
                    {isQuestion ? `Pertanyaan ${questionNumber}` : 'Blok teks'}
                  </span>
                  <select
                    aria-label="Jenis pertanyaan"
                    value={field.kind}
                    onChange={(event) => {
                      const kind = event.target.value as FieldKind;
                      update(field.id, {
                        kind,
                        options:
                          hasOptions(kind) && field.options.length === 0
                            ? ['Pilihan 1', 'Pilihan 2']
                            : field.options,
                      });
                    }}
                    className={cn(inputClass, 'ml-auto h-8 w-40 text-xs')}
                  >
                    {FIELD_KINDS.map(([kind, label]) => (
                      <option key={kind} value={kind}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  aria-label={isQuestion ? 'Pertanyaan' : 'Isi penjelasan'}
                  placeholder={isQuestion ? 'Pertanyaan' : 'Isi penjelasan'}
                  value={field.label}
                  onChange={(event) => {
                    const next = { ...field, label: event.target.value };
                    update(field.id, { label: event.target.value });
                    checkFilled(next);
                  }}
                  className={cn(
                    inputClass,
                    'mt-2',
                    field.kind === 'single_choice' && guide.spot('isi'),
                  )}
                />
                {hasOptions(field.kind) ? (
                  <div className="mt-2 space-y-1.5">
                    {field.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <span
                          className={cn(
                            'size-3.5 shrink-0 border border-neutral-600',
                            field.kind === 'multiple_choice'
                              ? 'rounded-sm'
                              : 'rounded-full',
                          )}
                        />
                        <input
                          aria-label={`Pilihan ${optionIndex + 1}`}
                          value={option}
                          onChange={(event) => {
                            const options = field.options.map((item, i) =>
                              i === optionIndex ? event.target.value : item,
                            );
                            update(field.id, { options });
                            checkFilled({ ...field, options });
                          }}
                          className={cn(inputClass, 'h-8')}
                        />
                        <Btn
                          small
                          tone="ghost"
                          aria-label={`Hapus pilihan ${optionIndex + 1}`}
                          disabled={field.options.length <= 1}
                          onClick={() =>
                            update(field.id, {
                              options: field.options.filter(
                                (_, i) => i !== optionIndex,
                              ),
                            })
                          }
                        >
                          <Trash2 aria-hidden />
                        </Btn>
                      </div>
                    ))}
                    <Btn
                      small
                      tone="ghost"
                      onClick={() =>
                        update(field.id, {
                          options: [
                            ...field.options,
                            `Pilihan ${field.options.length + 1}`,
                          ],
                        })
                      }
                    >
                      <Plus aria-hidden /> Tambah pilihan
                    </Btn>
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-neutral-300 pt-2">
                  {isQuestion ? (
                    <Toggle
                      label="Wajib diisi"
                      checked={field.required}
                      onChange={(required) => {
                        update(field.id, { required });
                        if (required && field.kind === 'single_choice') {
                          guide.complete('wajib');
                        }
                      }}
                      className={cn(
                        'text-xs',
                        field.kind === 'single_choice' && guide.spot('wajib'),
                      )}
                    />
                  ) : null}
                  <span className="ml-auto flex gap-1">
                    <Btn small tone="ghost" aria-label="Naikkan" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp aria-hidden />
                    </Btn>
                    <Btn small tone="ghost" aria-label="Turunkan" disabled={index === fields.length - 1} onClick={() => move(index, 1)}>
                      <ArrowDown aria-hidden />
                    </Btn>
                    <Btn
                      small
                      tone="ghost"
                      aria-label="Duplikat"
                      onClick={() => {
                        setCounter((value) => value + 1);
                        setFields((prev) => [
                          ...prev.slice(0, index + 1),
                          { ...field, id: `f${counter}` },
                          ...prev.slice(index + 1),
                        ]);
                      }}
                    >
                      <Copy aria-hidden />
                    </Btn>
                    <Btn
                      small
                      tone="ghost"
                      aria-label="Hapus"
                      onClick={() =>
                        setFields((prev) =>
                          prev.filter((item) => item.id !== field.id),
                        )
                      }
                    >
                      <Trash2 aria-hidden />
                    </Btn>
                  </span>
                </div>
              </div>
            );
          })}

          <div className="relative">
            <Btn
              tone="outline"
              aria-expanded={menuOpen}
              className={guide.spot('tambah')}
              onClick={() => setMenuOpen((value) => !value)}
            >
              <Plus aria-hidden /> Tambah konten
            </Btn>
            {menuOpen ? (
              <ul
                role="menu"
                className="mt-2 grid max-w-md grid-cols-2 gap-1 rounded-lg border border-neutral-400 bg-white p-2 shadow-md sm:grid-cols-3"
              >
                {FIELD_KINDS.map(([kind, label]) => (
                  <li key={kind} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => add(kind)}
                      className={cn(
                        'w-full rounded-md px-2 py-1.5 text-left text-xs font-medium hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                        kind === 'single_choice' && guide.spot('tambah'),
                      )}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'alur' ? (
        <div className="mt-3">
          <p className="text-xs text-neutral-700">
            Tab Alur menggambar urutan pertanyaan. Klik kotak untuk mengatur
            kondisinya.
          </p>
          <ol className="mt-3 flex flex-col items-start gap-1">
            {fields.map((field, index) => (
              <li key={field.id} className="flex flex-col items-start gap-1">
                {index > 0 ? (
                  <ArrowDown className="ml-6 size-4 text-neutral-600" aria-hidden />
                ) : null}
                <div className="rounded-lg border border-neutral-400 px-3 py-2">
                  <p className="font-semibold">
                    {field.label || 'Pertanyaan tanpa judul'}
                  </p>
                  <p className="text-xs text-neutral-700">
                    {kindLabel(field.kind)} · Selalu tampil (tanpa kondisi)
                  </p>
                </div>
              </li>
            ))}
            <li className="flex flex-col items-start gap-1">
              <ArrowDown className="ml-6 size-4 text-neutral-600" aria-hidden />
              <div className="rounded-lg border border-dashed border-neutral-500 px-3 py-2">
                <p className="font-semibold">Ending</p>
                <p className="text-xs text-neutral-700">Terima kasih!</p>
              </div>
            </li>
          </ol>
        </div>
      ) : null}

      {tab === 'pratinjau' ? (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-700">
              Ini pratinjau: jawaban tidak dikirim.
            </span>
            <div
              role="group"
              aria-label="Ukuran layar"
              className="ml-auto flex rounded-lg border border-neutral-400 p-0.5"
            >
              {(
                [
                  [false, 'Desktop'],
                  [true, 'Ponsel'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={narrow === value}
                  onClick={() => setNarrow(value)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                    narrow === value
                      ? 'bg-primary-400 text-white'
                      : 'text-neutral-800 hover:bg-neutral-200',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div
            className={cn(
              'mx-auto mt-3 space-y-4 rounded-lg border border-neutral-400 p-4 transition-all',
              narrow ? 'max-w-[300px]' : 'max-w-lg',
            )}
          >
            <p className="text-lg font-semibold">{title || 'Form tanpa judul'}</p>
            {fields.length === 0 ? (
              <p className="text-neutral-700">Form ini belum punya pertanyaan.</p>
            ) : null}
            {fields.map((field, index) => (
              <Question
                key={field.id}
                field={field}
                number={
                  field.kind === 'text_block'
                    ? undefined
                    : fields
                        .slice(0, index + 1)
                        .filter((item) => item.kind !== 'text_block').length
                }
                value={answers[field.id]}
                onChange={(value) =>
                  setAnswers((prev) => ({ ...prev, [field.id]: value }))
                }
              />
            ))}
            <Btn disabled>Kirim</Btn>
          </div>
        </div>
      ) : null}
    </div>
  );
}
