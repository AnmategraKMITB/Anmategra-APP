'use client';

// Library Import
import { EyeOff, GitBranch } from 'lucide-react';
import { useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import { Btn, Field, inputClass } from '../ui';
import {
  type Answers,
  type Condition,
  type DemoField,
  isVisible,
  kindLabel,
  Question,
} from './form-shared';

const STEPS: DemoStep[] = [
  {
    id: 'buka',
    title: 'Pada pertanyaan 2, klik **Tampil jika…**',
  },
  {
    id: 'aturan',
    title:
      'Pilih acuan pertanyaan 1, operator **adalah**, dan nilai **Ya**',
    hint: 'Kondisi hanya bisa mengacu pada pertanyaan yang letaknya lebih awal.',
  },
  {
    id: 'tidak',
    title: 'Di pratinjau, jawab pertanyaan 1 dengan **Tidak**',
    hint: 'Pertanyaan 2 tetap tersembunyi, dan pengisi tidak dihalangi walaupun pertanyaan itu wajib.',
  },
  {
    id: 'ya',
    title: 'Sekarang ganti jawabannya menjadi **Ya**',
    hint: 'Pertanyaan 2 langsung muncul di halaman yang sama.',
  },
];

const INITIAL: DemoField[] = [
  {
    id: 'q1',
    kind: 'single_choice',
    label: 'Apakah Anda pernah menjadi panitia?',
    required: true,
    options: ['Ya', 'Tidak'],
  },
  {
    id: 'q2',
    kind: 'long_text',
    label: 'Ceritakan pengalaman kepanitiaan Anda',
    required: true,
    options: [],
  },
  {
    id: 'q3',
    kind: 'scale',
    label: 'Seberapa siap Anda berkomitmen?',
    required: false,
    options: [],
  },
];

const OPERATORS = [
  ['sama_dengan', 'adalah'],
  ['bukan', 'bukan'],
] as const;

function describe(condition: Condition, fields: DemoField[]): string {
  const source = fields.find((field) => field.id === condition.fieldId);
  const op = OPERATORS.find(([id]) => id === condition.op)?.[1] ?? '';
  return `${source?.label ?? ''} ${op} ${condition.value}`;
}

export default function FormsKondisiDemo() {
  return (
    <DemoFrame
      title="Pertanyaan bersyarat"
      location="Lembaga › Forms › Survei Minat Panitia › tab Konten"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [fields, setFields] = useState(INITIAL);
  const [editing, setEditing] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});

  const setCondition = (id: string, condition: Condition | undefined) => {
    setFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, condition } : field)),
    );
    if (
      id === 'q2' &&
      condition?.fieldId === 'q1' &&
      condition.op === 'sama_dengan' &&
      condition.value === 'Ya'
    ) {
      guide.complete('aturan');
    }
  };

  const answer = (id: string, value: Answers[string]) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    const rule = fields.find((field) => field.id === 'q2')?.condition;
    if (id === 'q1' && rule) {
      if (value === 'Tidak') guide.complete('tidak');
      if (value === 'Ya') guide.complete('ya');
    }
  };

  const visible = fields.filter((field) => isVisible(field, answers));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <p className="text-xs font-semibold text-neutral-700">Konten</p>
        {fields.map((field, index) => {
          // Hanya pertanyaan pilihan yang lebih awal yang bisa jadi acuan.
          const sources = fields
            .slice(0, index)
            .filter((item) => item.options.length > 0);
          const condition = field.condition;
          const open = editing === field.id;
          return (
            <div
              key={field.id}
              className="rounded-lg border border-neutral-400 p-3"
            >
              <p className="text-xs font-semibold text-neutral-700">
                Pertanyaan {index + 1} · {kindLabel(field.kind)}
                {field.required ? ' · wajib' : ''}
              </p>
              <p className="mt-1 font-semibold">{field.label}</p>
              {index > 0 ? (
                <Btn
                  small
                  tone={condition ? 'outline' : 'ghost'}
                  aria-expanded={open}
                  className={cn(
                    'mt-2 max-w-full',
                    field.id === 'q2' && !open && guide.spot('buka', 'aturan'),
                  )}
                  onClick={() => {
                    setEditing(open ? null : field.id);
                    if (field.id === 'q2') guide.complete('buka');
                  }}
                >
                  <GitBranch aria-hidden />
                  <span className="truncate">
                    {condition
                      ? `Tampil jika ${describe(condition, fields)}`
                      : 'Tampil jika…'}
                  </span>
                </Btn>
              ) : (
                <p className="mt-2 text-xs text-neutral-700">
                  Selalu tampil. Pertanyaan pertama tidak punya acuan.
                </p>
              )}
              {open ? (
                <div
                  className={cn(
                    'mt-2 space-y-2 rounded-lg bg-neutral-100 p-2',
                    field.id === 'q2' && guide.spot('aturan'),
                  )}
                >
                  {sources.length === 0 ? (
                    <p className="text-xs text-neutral-700">
                      Belum ada pertanyaan sebelumnya yang bisa dijadikan acuan.
                    </p>
                  ) : (
                    <>
                      <Field label="Pertanyaan acuan">
                        {(id) => (
                          <select
                            id={id}
                            value={condition?.fieldId ?? ''}
                            onChange={(event) => {
                              const fieldId = event.target.value;
                              setCondition(
                                field.id,
                                fieldId
                                  ? {
                                      fieldId,
                                      op: condition?.op ?? 'sama_dengan',
                                      value: '',
                                    }
                                  : undefined,
                              );
                            }}
                            className={inputClass}
                          >
                            <option value="">Pilih…</option>
                            {sources.map((source) => (
                              <option key={source.id} value={source.id}>
                                {source.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </Field>
                      {condition ? (
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Operator">
                            {(id) => (
                              <select
                                id={id}
                                value={condition.op}
                                onChange={(event) =>
                                  setCondition(field.id, {
                                    ...condition,
                                    op: event.target.value as Condition['op'],
                                  })
                                }
                                className={inputClass}
                              >
                                {OPERATORS.map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </Field>
                          <Field label="Nilai">
                            {(id) => (
                              <select
                                id={id}
                                value={condition.value}
                                onChange={(event) =>
                                  setCondition(field.id, {
                                    ...condition,
                                    value: event.target.value,
                                  })
                                }
                                className={inputClass}
                              >
                                <option value="">Pilih…</option>
                                {fields
                                  .find((item) => item.id === condition.fieldId)
                                  ?.options.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                              </select>
                            )}
                          </Field>
                        </div>
                      ) : null}
                      {condition ? (
                        <Btn
                          small
                          tone="ghost"
                          onClick={() => setCondition(field.id, undefined)}
                        >
                          Hapus kondisi
                        </Btn>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div>
        <p className="text-xs font-semibold text-neutral-700">Pratinjau</p>
        <div
          className={cn(
            'mt-3 space-y-4 rounded-lg border border-neutral-400 p-4',
            guide.spot('tidak', 'ya'),
          )}
        >
          <p className="text-base font-semibold">Survei Minat Panitia</p>
          {visible.map((field, index) => (
            <Question
              key={field.id}
              field={field}
              number={index + 1}
              value={answers[field.id]}
              onChange={(value) => answer(field.id, value)}
            />
          ))}
          {fields.length > visible.length ? (
            <p className="flex items-center gap-1.5 text-xs text-neutral-700">
              <EyeOff className="size-3.5" aria-hidden />
              {fields.length - visible.length} pertanyaan tersembunyi karena
              syaratnya belum terpenuhi.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
