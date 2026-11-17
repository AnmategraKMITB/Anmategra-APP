'use client';

// Library Import
import {
  AlertTriangle,
  AlignLeft,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleDot,
  EyeOff,
  Flag,
  GitBranch,
  Hash,
  Layers,
  Maximize2,
  Minus,
  Plus,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import { cn } from '~/lib/utils';

import { type DemoGuide, DemoFrame, type DemoStep } from '../demo-frame';
import { Btn, inputClass, Modal, Pill, TabBar, Toggle } from '../ui';
import { type DemoField, kindLabel, Question } from './form-shared';

const STEPS: DemoStep[] = [
  {
    id: 'buka',
    title: 'Pada pertanyaan 3, klik **Tampil jika…**',
  },
  {
    id: 'aturan',
    title:
      'Pilih acuan **Pernah jadi panitia sebelumnya?**, operator **adalah**, nilai **Ya**, lalu **Simpan**',
    hint: 'Acuan cuma bisa pertanyaan yang letaknya lebih atas.',
  },
  {
    id: 'ya',
    title: 'Di pratinjau, jawab pertanyaan 2 dengan **Ya**',
    hint: 'Pertanyaan lanjutan langsung muncul di bawahnya.',
  },
  {
    id: 'divisi',
    title: 'Pilih divisi **Grafis**',
    hint: 'Pakai operator **salah satu dari**: link portofolio cuma diminta ke Grafis dan Publikasi.',
  },
  {
    id: 'mentor',
    title: 'Isi angkatan **2024**, lalu jawab tawaran mentor dengan **Ya**',
    hint: 'Tawaran mentor pakai dua aturan sekaligus: angkatan ≤ 2024 **dan** pernah jadi panitia. Layar penutupnya ikut berubah.',
  },
  {
    id: 'alur',
    title: 'Buka tab **Alur** untuk lihat semua cabangnya',
  },
  {
    id: 'tidaksah',
    title:
      'Kembali ke **Konten**, lalu turunkan pertanyaan 1 sampai di bawah tawaran mentor',
    hint: 'Aturan yang acuannya jadi di bawah otomatis diabaikan dan ditandai merah.',
  },
];

/* ---------------------------------------------------------------------------
   Model: kondisi boleh berisi beberapa aturan, operatornya ikut jenis acuan.
   ------------------------------------------------------------------------- */

type Kind = 'number' | 'single_choice' | 'long_text' | 'short_text';

type Rule = { fieldId: string; op: string; value: string; value2?: string };
type Condition = { join: 'semua' | 'salah_satu'; rules: Rule[] };

type Field = {
  id: string;
  kind: Kind;
  label: string;
  required: boolean;
  options: string[];
  condition: Condition | null;
};

type Ending = { id: string; title: string; rule: Rule | null };

type Answers = Record<string, string | undefined>;
type Tab = 'konten' | 'alur';

const MAX_RULES = 4;

const OPERATORS: Record<Kind, string[]> = {
  number: ['=', '≠', '>', '≥', '<', '≤', 'di antara'],
  short_text: ['mengandung', 'tidak mengandung', 'terisi', 'kosong'],
  long_text: ['mengandung', 'tidak mengandung', 'terisi', 'kosong'],
  single_choice: ['adalah', 'bukan', 'salah satu dari'],
};

/** Operator yang tidak butuh nilai jawaban. */
const NO_VALUE = new Set(['terisi', 'kosong']);

const ENDING_MENTOR: Ending = {
  id: 'e-mentor',
  title: 'Makasih! Tim Mentor bakal ngehubungin kamu juga.',
  rule: { fieldId: 'q-mentor', op: 'adalah', value: 'Ya' },
};

const ENDING_DEFAULT: Ending = {
  id: 'e-default',
  title: 'Makasih udah daftar! Tunggu pengumumannya, ya.',
  rule: null,
};

const ENDINGS: Ending[] = [ENDING_MENTOR, ENDING_DEFAULT];

const INITIAL: Field[] = [
  {
    id: 'q-angkatan',
    kind: 'number',
    label: 'Kamu angkatan berapa?',
    required: true,
    options: [],
    condition: null,
  },
  {
    id: 'q-panitia',
    kind: 'single_choice',
    label: 'Pernah jadi panitia sebelumnya?',
    required: true,
    options: ['Ya', 'Belum'],
    condition: null,
  },
  {
    id: 'q-cerita',
    kind: 'long_text',
    label: 'Ceritain pengalaman kepanitiaanmu dong!',
    required: true,
    options: [],
    condition: null,
  },
  {
    id: 'q-divisi',
    kind: 'single_choice',
    label: 'Divisi pilihan pertama kamu?',
    required: true,
    options: ['Event Organizer', 'Grafis', 'Publikasi', 'Logistik', 'Sponsorship'],
    condition: null,
  },
  {
    id: 'q-porto',
    kind: 'short_text',
    label: 'Link portofolio desainmu',
    required: false,
    options: [],
    condition: {
      join: 'semua',
      rules: [{ fieldId: 'q-divisi', op: 'salah satu dari', value: 'Grafis,Publikasi' }],
    },
  },
  {
    id: 'q-mentor',
    kind: 'single_choice',
    label: 'Mau sekalian daftar jadi mentor?',
    required: false,
    options: ['Ya', 'Ga dulu'],
    condition: {
      join: 'semua',
      rules: [
        { fieldId: 'q-angkatan', op: '≤', value: '2024' },
        { fieldId: 'q-panitia', op: 'adalah', value: 'Ya' },
      ],
    },
  },
];

/* ---------------------------------------------------------------------------
   Pembacaan aturan
   ------------------------------------------------------------------------- */

function listValue(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function describeRule(rule: Rule, fields: Field[]): string {
  const source = fields.find((field) => field.id === rule.fieldId);
  if (!source) return 'Acuan tidak sah';
  if (NO_VALUE.has(rule.op)) return `${source.label} ${rule.op}`;
  if (rule.op === 'di antara') {
    return `${source.label} ${rule.value}–${rule.value2 ?? ''}`;
  }
  const value =
    rule.op === 'salah satu dari' ? listValue(rule.value).join(', ') : rule.value;
  return `${source.label} ${rule.op} ${value}`;
}

function describeCondition(condition: Condition, fields: Field[]): string {
  return condition.rules
    .map((rule) => describeRule(rule, fields))
    .join(condition.join === 'salah_satu' ? ' atau ' : ' dan ');
}

function ruleShort(rule: Rule, source: Field | undefined): string {
  if (!source) return 'acuan tidak sah';
  if (NO_VALUE.has(rule.op)) return rule.op;
  if (rule.op === 'di antara') return `${rule.value}–${rule.value2 ?? ''}`;
  if (rule.op === 'salah satu dari') {
    return `${rule.op} ${listValue(rule.value).join(', ')}`;
  }
  return `${rule.op} ${rule.value}`;
}

function ruleComplete(rule: Rule, source: Field | undefined): boolean {
  if (!source) return false;
  if (NO_VALUE.has(rule.op)) return true;
  if (rule.op === 'di antara') {
    return rule.value.trim() !== '' && (rule.value2 ?? '').trim() !== '';
  }
  if (rule.op === 'salah satu dari') return listValue(rule.value).length > 0;
  return rule.value.trim() !== '';
}

function matchRule(rule: Rule, source: Field, answer: string | undefined): boolean {
  const raw = (answer ?? '').trim();
  if (source.kind === 'number') {
    const num = raw === '' ? null : Number(raw);
    if (num === null || Number.isNaN(num)) return false;
    const first = Number(rule.value);
    if (Number.isNaN(first)) return false;
    const second = Number(rule.value2 ?? '');
    switch (rule.op) {
      case '=':
        return num === first;
      case '≠':
        return num !== first;
      case '>':
        return num > first;
      case '≥':
        return num >= first;
      case '<':
        return num < first;
      case '≤':
        return num <= first;
      case 'di antara':
        if (Number.isNaN(second)) return false;
        return num >= Math.min(first, second) && num <= Math.max(first, second);
      default:
        return false;
    }
  }
  if (source.kind === 'single_choice') {
    switch (rule.op) {
      case 'adalah':
        return raw === rule.value;
      case 'bukan':
        return raw !== rule.value;
      case 'salah satu dari':
        return listValue(rule.value).includes(raw);
      default:
        return false;
    }
  }
  const needle = rule.value.trim().toLowerCase();
  switch (rule.op) {
    case 'terisi':
      return raw !== '';
    case 'kosong':
      return raw === '';
    case 'mengandung':
      return raw.toLowerCase().includes(needle);
    case 'tidak mengandung':
      return !raw.toLowerCase().includes(needle);
    default:
      return false;
  }
}

/** Aturan yang acuannya sudah tidak di atas target dianggap tidak sah. */
function ruleIsValid(rule: Rule, fields: Field[], targetIndex: number): boolean {
  const at = fields.findIndex((field) => field.id === rule.fieldId);
  return at >= 0 && at < targetIndex;
}

function conditionHolds(
  field: Field,
  fields: Field[],
  index: number,
  answers: Answers,
  visible: Record<string, boolean>,
): boolean {
  const condition = field.condition;
  if (!condition || condition.rules.length === 0) return true;
  const valid = condition.rules.filter((rule) => ruleIsValid(rule, fields, index));
  // Semua acuan tidak sah: kondisi diabaikan, pertanyaan tetap tampil.
  if (valid.length === 0) return true;
  const test = (rule: Rule) => {
    const source = fields.find((item) => item.id === rule.fieldId);
    if (!source) return false;
    const answer = visible[source.id] === true ? answers[source.id] : undefined;
    return matchRule(rule, source, answer);
  };
  return condition.join === 'semua' ? valid.every(test) : valid.some(test);
}

function visibleMap(fields: Field[], answers: Answers): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  fields.forEach((field, index) => {
    map[field.id] = conditionHolds(field, fields, index, answers, map);
  });
  return map;
}

/** `Question` cuma butuh bagian tampilannya. */
function toDemoField(field: Field): DemoField {
  return {
    id: field.id,
    kind: field.kind,
    label: field.label,
    required: field.required,
    options: field.options,
  };
}

export default function FormsKondisiDemo() {
  return (
    <DemoFrame
      title="Pertanyaan bersyarat"
      location="Lembaga › Forms › Open Recruitment Panitia AMI 2027 › tab Konten"
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [fields, setFields] = useState<Field[]>(INITIAL);
  const [answers, setAnswers] = useState<Answers>({});
  const [tab, setTab] = useState<Tab>('konten');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Condition>({ join: 'semua', rules: [] });
  const [selected, setSelected] = useState<string | null>(null);

  const visible = useMemo(() => visibleMap(fields, answers), [fields, answers]);
  const editing = fields.find((field) => field.id === editingId) ?? null;
  const editingIndex = editing
    ? fields.findIndex((field) => field.id === editing.id)
    : -1;
  // Acuan cuma pertanyaan yang letaknya di atas target.
  const sources = editingIndex > 0 ? fields.slice(0, editingIndex) : [];

  const openEditor = (field: Field) => {
    const index = fields.findIndex((item) => item.id === field.id);
    const above = index > 0 ? fields.slice(0, index) : [];
    const first = above[0];
    setDraft(
      field.condition && field.condition.rules.length > 0
        ? {
            join: field.condition.join,
            rules: field.condition.rules.map((rule) => ({ ...rule })),
          }
        : {
            join: 'semua',
            rules: first
              ? [
                  {
                    fieldId: first.id,
                    op: OPERATORS[first.kind][0] ?? '',
                    value: '',
                  },
                ]
              : [],
          },
    );
    setEditingId(field.id);
    if (field.id === 'q-cerita') guide.complete('buka');
  };

  const saveCondition = () => {
    if (!editing) return;
    const id = editing.id;
    const next: Condition | null = draft.rules.length > 0 ? draft : null;
    setFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, condition: next } : field)),
    );
    setEditingId(null);
    if (id !== 'q-cerita' || next?.rules.length !== 1) return;
    const rule = next.rules[0];
    if (
      rule?.fieldId === 'q-panitia' &&
      rule.op === 'adalah' &&
      rule.value.trim() === 'Ya'
    ) {
      guide.complete('aturan');
    }
  };

  const removeCondition = () => {
    if (!editing) return;
    const id = editing.id;
    setFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, condition: null } : field)),
    );
    setEditingId(null);
  };

  const moveField = (from: number, to: number) => {
    if (to < 0 || to >= fields.length) return;
    const next = [...fields];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    setFields(next);
    const angkatan = next.findIndex((field) => field.id === 'q-angkatan');
    const mentor = next.findIndex((field) => field.id === 'q-mentor');
    if (mentor >= 0 && angkatan > mentor) guide.complete('tidaksah');
  };

  const setRequired = (id: string, required: boolean) =>
    setFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, required } : field)),
    );

  const answer = (id: string, value: string) => {
    const next: Answers = { ...answers, [id]: value };
    setAnswers(next);

    if (id === 'q-panitia' && value === 'Ya') {
      const cerita = fields.find((field) => field.id === 'q-cerita');
      if (cerita?.condition && cerita.condition.rules.length > 0) {
        guide.complete('ya');
      }
    }
    if (id === 'q-divisi' && (value === 'Grafis' || value === 'Publikasi')) {
      guide.complete('divisi');
    }
    const angkatan = (next['q-angkatan'] ?? '').trim();
    const angka = Number(angkatan);
    if (
      angkatan !== '' &&
      !Number.isNaN(angka) &&
      angka <= 2024 &&
      next['q-panitia'] === 'Ya' &&
      next['q-mentor'] === 'Ya'
    ) {
      guide.complete('mentor');
    }
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    if (next === 'alur') guide.complete('alur');
  };

  const ending =
    visible['q-mentor'] === true && answers['q-mentor'] === 'Ya'
      ? ENDING_MENTOR
      : ENDING_DEFAULT;

  return (
    <div className="max-h-[560px] overflow-y-auto pr-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-neutral-1000">
          Open Recruitment Panitia AMI 2027
        </p>
        <Pill tone="success">Draf</Pill>
      </div>
      <div className="mt-2">
        <TabBar
          label="Bagian form"
          tabs={
            [
              ['konten', 'Konten'],
              ['alur', 'Alur'],
            ] as const
          }
          value={tab}
          onChange={switchTab}
          spot={(id) => guide.spot(id === 'alur' ? 'alur' : 'tidaksah')}
        />
      </div>

      <div className={cn('mt-3 grid gap-4', tab === 'konten' && 'md:grid-cols-2')}>
        <div className="min-w-0">
          {tab === 'konten' ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary-100 text-secondary-800">
                  <Layers className="size-3.5" aria-hidden />
                </span>
                <p className="text-sm font-semibold text-neutral-1000">
                  Kenalan dulu
                </p>
                <Pill tone="teal">Bagian 1</Pill>
              </div>
              {fields.map((field, index) => (
                <Card
                  key={field.id}
                  field={field}
                  fields={fields}
                  index={index}
                  spotOpen={field.id === 'q-cerita' ? guide.spot('buka') : ''}
                  spotDown={field.id === 'q-angkatan' ? guide.spot('tidaksah') : ''}
                  onOpen={() => openEditor(field)}
                  onMove={(to) => moveField(index, to)}
                  onRequired={(required) => setRequired(field.id, required)}
                />
              ))}
              <EndingCard fields={fields} />
            </div>
          ) : (
            <Flow
              fields={fields}
              selected={selected}
              onSelect={setSelected}
              onOpenCondition={openEditor}
            />
          )}
        </div>

        {tab === 'konten' ? (
          <Preview
            fields={fields}
            visible={visible}
            answers={answers}
            ending={ending}
            guide={guide}
            onAnswer={answer}
          />
        ) : null}
      </div>

      {editing ? (
        <ConditionDialog
          field={editing}
          sources={sources}
          draft={draft}
          onChange={setDraft}
          onCancel={() => setEditingId(null)}
          onSave={saveCondition}
          onRemove={removeCondition}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Kartu pertanyaan, mengikuti `field-card.tsx`.
   ------------------------------------------------------------------------- */

function Card({
  field,
  fields,
  index,
  spotOpen,
  spotDown,
  onOpen,
  onMove,
  onRequired,
}: {
  field: Field;
  fields: Field[];
  index: number;
  spotOpen: string;
  spotDown: string;
  onOpen: () => void;
  onMove: (to: number) => void;
  onRequired: (next: boolean) => void;
}) {
  const condition =
    field.condition && field.condition.rules.length > 0 ? field.condition : null;
  const summary = condition ? describeCondition(condition, fields) : null;
  const invalid = condition
    ? condition.rules.filter((rule) => !ruleIsValid(rule, fields, index)).length
    : 0;

  return (
    <article
      aria-label={`Pertanyaan ${index + 1}`}
      className={cn(
        'rounded-[24px] border bg-neutral-50 p-4 transition-colors duration-150 focus-within:border-primary-400',
        invalid > 0 ? 'border-tomato' : 'border-neutral-400',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-400 text-sm font-semibold text-white"
        >
          {index + 1}
        </span>
        <span className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-neutral-400 bg-neutral-50 px-2 text-sm text-neutral-700">
          <KindIcon kind={field.kind} className="size-4 shrink-0" />
          <span className="truncate">{kindLabel(field.kind)}</span>
        </span>
        {field.required ? <Pill tone="warning">Wajib</Pill> : null}
      </div>

      <p className="mt-3 break-words text-sm font-semibold text-neutral-1000">
        {field.label}
      </p>

      <div className="mt-3">
        <button
          type="button"
          onClick={onOpen}
          title={summary ? `Tampil jika ${summary}` : undefined}
          className={cn(
            'inline-flex max-w-full items-center gap-1.5 rounded-full border border-neutral-400 bg-neutral-50 px-3 py-1 text-sm text-neutral-700 transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
            spotOpen,
          )}
        >
          <GitBranch className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            {summary ? `Tampil jika ${summary}` : 'Tampil jika…'}
          </span>
        </button>
        {invalid > 0 ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-danger-light px-2 py-0.5 text-xs font-semibold text-danger-dark">
            <AlertTriangle className="size-3.5" aria-hidden />
            {invalid} acuan tidak sah, diabaikan
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-neutral-400 pt-3">
        <Toggle checked={field.required} onChange={onRequired} label="Wajib diisi" />
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <IconBtn
            label="Naikkan"
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
          >
            <ArrowUp />
          </IconBtn>
          <IconBtn
            label="Turunkan"
            disabled={index === fields.length - 1}
            onClick={() => onMove(index + 1)}
            className={spotDown}
          >
            <ArrowDown />
          </IconBtn>
        </div>
      </div>
    </article>
  );
}

function EndingCard({ fields }: { fields: Field[] }) {
  return (
    <div className="rounded-[24px] border border-neutral-400 bg-neutral-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary-100 text-secondary-800">
          <Flag className="size-3.5" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-neutral-1000">Ending</p>
        <Pill tone="teal">2 layar</Pill>
      </div>
      <p className="mt-1 text-xs text-neutral-700">
        Layar penutup yang muncul setelah pertanyaan terakhir.
      </p>
      <ul className="mt-3 grid gap-2">
        {ENDINGS.map((ending) => (
          <li
            key={ending.id}
            className="rounded-xl border border-neutral-400 bg-neutral-50 p-3"
          >
            <div className="flex items-start gap-2">
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-secondary-700"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-1000">
                  {ending.title}
                </p>
                <p
                  title={
                    ending.rule
                      ? `Tampil jika ${describeRule(ending.rule, fields)}`
                      : undefined
                  }
                  className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full border border-secondary-300 bg-secondary-50 px-2 py-0.5 text-xs text-secondary-800"
                >
                  <GitBranch className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">
                    {ending.rule
                      ? `Tampil jika ${describeRule(ending.rule, fields)}`
                      : 'Selain itu'}
                  </span>
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Dialog "Tampil jika", mengikuti `condition-editor.tsx`.
   ------------------------------------------------------------------------- */

function ConditionDialog({
  field,
  sources,
  draft,
  onChange,
  onCancel,
  onSave,
  onRemove,
}: {
  field: Field;
  sources: Field[];
  draft: Condition;
  onChange: (next: Condition) => void;
  onCancel: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const valid =
    draft.rules.length > 0 &&
    draft.rules.every((rule) =>
      ruleComplete(
        rule,
        sources.find((source) => source.id === rule.fieldId),
      ),
    );

  const setRule = (index: number, patch: Partial<Rule>) =>
    onChange({
      ...draft,
      rules: draft.rules.map((rule, at) => (at === index ? { ...rule, ...patch } : rule)),
    });

  const pickSource = (index: number, id: string) => {
    const next = sources.find((source) => source.id === id);
    if (!next) return;
    setRule(index, {
      fieldId: next.id,
      op: OPERATORS[next.kind][0] ?? '',
      value: '',
      value2: undefined,
    });
  };

  return (
    <Modal
      wide
      title="Tampil jika"
      description={`${field.label} cuma tampil kalau aturan di bawah terpenuhi. Tanpa aturan, selalu tampil.`}
      onClose={onCancel}
      footer={
        <>
          {field.condition ? (
            <Btn tone="dangerOutline" className="sm:mr-auto" onClick={onRemove}>
              <Trash2 /> Hapus kondisi
            </Btn>
          ) : null}
          <Btn tone="outline" onClick={onCancel}>
            Batal
          </Btn>
          <Btn tone="primary" disabled={sources.length === 0 || !valid} onClick={onSave}>
            Simpan
          </Btn>
        </>
      }
    >
      {sources.length === 0 ? (
        <p className="rounded-xl bg-neutral-100 p-4 text-sm text-neutral-700">
          Belum ada pertanyaan di atasnya yang bisa jadi acuan. Acuan cuma boleh
          pertanyaan yang letaknya lebih atas.
        </p>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-800">Tampil bila</span>
            <select
              aria-label="Cara menggabungkan aturan"
              value={draft.join}
              onChange={(event) =>
                onChange({ ...draft, join: event.target.value as Condition['join'] })
              }
              className={cn(inputClass, 'w-56')}
            >
              <option value="semua">semua aturan cocok</option>
              <option value="salah_satu">salah satu aturan cocok</option>
            </select>
          </div>

          {draft.rules.map((rule, index) => {
            const source = sources.find((item) => item.id === rule.fieldId);
            return (
              <fieldset
                key={index}
                className="grid gap-2 rounded-xl border border-neutral-400 p-3"
              >
                <legend className="px-1 text-sm text-neutral-700">
                  Aturan {index + 1}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    aria-label="Pertanyaan acuan"
                    value={source ? rule.fieldId : ''}
                    onChange={(event) => pickSource(index, event.target.value)}
                    className={inputClass}
                  >
                    {!source ? <option value="">(acuan tidak sah)</option> : null}
                    {sources.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Operator"
                    value={rule.op}
                    onChange={(event) =>
                      setRule(index, {
                        op: event.target.value,
                        value: '',
                        value2: undefined,
                      })
                    }
                    className={inputClass}
                  >
                    {(source ? OPERATORS[source.kind] : []).map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </div>
                <RuleValue
                  rule={rule}
                  source={source}
                  onChange={(patch) => setRule(index, patch)}
                />
                <div>
                  <Btn
                    small
                    tone="ghost"
                    className="text-danger-dark hover:text-danger-dark"
                    onClick={() =>
                      onChange({
                        ...draft,
                        rules: draft.rules.filter((_, at) => at !== index),
                      })
                    }
                  >
                    <Trash2 /> Hapus aturan
                  </Btn>
                </div>
              </fieldset>
            );
          })}

          <div className="flex flex-wrap items-center gap-2">
            <Btn
              small
              tone="outline"
              disabled={draft.rules.length >= MAX_RULES}
              onClick={() => {
                const last = sources[sources.length - 1];
                if (!last) return;
                onChange({
                  ...draft,
                  rules: [
                    ...draft.rules,
                    { fieldId: last.id, op: OPERATORS[last.kind][0] ?? '', value: '' },
                  ],
                });
              }}
            >
              <Plus /> Tambah aturan
            </Btn>
            {draft.rules.length >= MAX_RULES ? (
              <span className="text-sm text-neutral-700">Maksimal {MAX_RULES} aturan.</span>
            ) : null}
          </div>
          {!valid ? (
            <p className="text-xs text-neutral-700">
              Lengkapi nilainya dulu, baru tombol Simpan aktif.
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

function RuleValue({
  rule,
  source,
  onChange,
}: {
  rule: Rule;
  source: Field | undefined;
  onChange: (patch: Partial<Rule>) => void;
}) {
  if (!source || NO_VALUE.has(rule.op)) return null;

  if (source.kind === 'single_choice') {
    if (rule.op === 'salah satu dari') {
      const chosen = listValue(rule.value);
      return (
        <div className="grid gap-1.5" role="group" aria-label="Pilihan">
          {source.options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={chosen.includes(option)}
                onChange={(event) =>
                  onChange({
                    value: (event.target.checked
                      ? [...chosen, option]
                      : chosen.filter((item) => item !== option)
                    ).join(','),
                  })
                }
                className="size-4 accent-[#2B6282]"
              />
              {option}
            </label>
          ))}
        </div>
      );
    }
    return (
      <select
        aria-label="Nilai"
        value={rule.value}
        onChange={(event) => onChange({ value: event.target.value })}
        className={inputClass}
      >
        <option value="">Pilih…</option>
        {source.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (source.kind === 'number') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          aria-label="Nilai"
          value={rule.value}
          onChange={(event) => onChange({ value: event.target.value })}
          className={inputClass}
        />
        {rule.op === 'di antara' ? (
          <>
            <span className="shrink-0 text-sm text-neutral-700">dan</span>
            <input
              type="number"
              aria-label="Nilai kedua"
              value={rule.value2 ?? ''}
              onChange={(event) => onChange({ value2: event.target.value })}
              className={inputClass}
            />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <input
      type="text"
      aria-label="Nilai"
      placeholder="Tulis kata kuncinya…"
      value={rule.value}
      onChange={(event) => onChange({ value: event.target.value })}
      className={inputClass}
    />
  );
}

/* ---------------------------------------------------------------------------
   Pratinjau isian, seperti halaman form yang dibuka pendaftar.
   ------------------------------------------------------------------------- */

function Preview({
  fields,
  visible,
  answers,
  ending,
  guide,
  onAnswer,
}: {
  fields: Field[];
  visible: Record<string, boolean>;
  answers: Answers;
  ending: Ending;
  guide: DemoGuide;
  onAnswer: (id: string, value: string) => void;
}) {
  const hidden = fields.filter((field) => visible[field.id] !== true).length;

  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
        Pratinjau
      </p>
      <div
        className={cn(
          'mt-3 rounded-[24px] border border-neutral-400 bg-neutral-50 p-4',
          guide.spot('ya', 'divisi', 'mentor'),
        )}
      >
        <p className="text-base font-semibold text-neutral-1000">
          Open Recruitment Panitia AMI 2027
        </p>
        <p className="mt-0.5 text-xs text-neutral-700">
          Aku Masuk ITB 2027 · {fields.length} pertanyaan
        </p>

        <div className="mt-4 space-y-4">
          {fields.map((field, index) => {
            if (visible[field.id] !== true) return null;
            const conditional = !!field.condition && field.condition.rules.length > 0;
            return (
              <div key={field.id}>
                {conditional ? (
                  <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] font-semibold text-secondary-800">
                    <GitBranch className="size-3" aria-hidden />
                    Pertanyaan lanjutan dari jawabanmu
                  </p>
                ) : null}
                <Question
                  field={toDemoField(field)}
                  number={index + 1}
                  value={answers[field.id]}
                  onChange={(next) =>
                    onAnswer(field.id, typeof next === 'string' ? next : String(next ?? ''))
                  }
                />
              </div>
            );
          })}
        </div>

        {hidden > 0 ? (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-neutral-700">
            <EyeOff className="size-3.5" aria-hidden />
            {hidden} pertanyaan tersembunyi karena syaratnya belum terpenuhi.
          </p>
        ) : null}

        <div className="mt-4 rounded-xl border border-secondary-300 bg-secondary-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-800">
            Layar penutup yang akan tampil
          </p>
          <p className="mt-1 text-sm font-semibold text-neutral-1000">{ending.title}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Tab Alur, mengikuti `flow-pane.tsx` dalam versi ringkas.
   ------------------------------------------------------------------------- */

const NW = 210;
const NH = 86;
const COLX = 290;
const ROWY = 132;

type FlowNode = {
  id: string;
  kind: 'field' | 'ending';
  title: string;
  typeLabel: string;
  number?: number;
  required: boolean;
  fieldKind?: Kind;
  /** Aturan sah yang menggambar garis kondisi. */
  rules: Rule[];
  /** Semua aturan, termasuk yang acuannya sudah tidak sah. */
  allRules: Rule[];
};

type FlowEdge = {
  id: string;
  from: string;
  to: string;
  kind: 'seq' | 'cond' | 'rejoin' | 'invalid';
  rule?: Rule;
};

function buildNodes(fields: Field[]): FlowNode[] {
  const nodes: FlowNode[] = fields.map((field, index) => {
    const all = field.condition?.rules ?? [];
    return {
      id: field.id,
      kind: 'field',
      title: field.label,
      typeLabel: kindLabel(field.kind),
      number: index + 1,
      required: field.required,
      fieldKind: field.kind,
      rules: all.filter((rule) => ruleIsValid(rule, fields, index)),
      allRules: all,
    };
  });
  for (const ending of ENDINGS) {
    const all = ending.rule ? [ending.rule] : [];
    nodes.push({
      id: ending.id,
      kind: 'ending',
      title: ending.title,
      typeLabel: 'Ending',
      required: false,
      rules: all,
      allRules: all,
    });
  }
  return nodes;
}

/**
 * Tata letak kiri ke kanan: blok tanpa syarat mengisi jalur utama, blok
 * bersyarat digantung satu kolom setelah acuannya. Ending di kolom terakhir.
 */
function layoutFlow(fields: Field[], nodes: FlowNode[]) {
  const pos: Record<string, { x: number; y: number }> = {};
  const edges: FlowEdge[] = [];
  const occupied = new Set<string>();
  let maxCol = -1;

  const questions = nodes.filter((node) => node.kind === 'field');
  const main = questions.filter((node) => node.rules.length === 0);
  const conditional = questions.filter((node) => node.rules.length > 0);
  const orderOf = (id: string) => fields.findIndex((field) => field.id === id);

  let prevMain: string | null = null;
  for (const node of main) {
    maxCol += 1;
    pos[node.id] = { x: maxCol * COLX, y: 0 };
    occupied.add(`${maxCol}:0`);
    if (prevMain) {
      edges.push({ id: `s-${node.id}`, from: prevMain, to: node.id, kind: 'seq' });
    }
    prevMain = node.id;
  }

  for (const node of conditional) {
    let anchor: { x: number; y: number } | null = null;
    for (const rule of node.rules) {
      const point = pos[rule.fieldId];
      if (!point) continue;
      if (!anchor || point.x > anchor.x) anchor = point;
    }
    const col = anchor ? Math.round(anchor.x / COLX) + 1 : maxCol + 1;
    let row = 1;
    for (const candidate of [1, -1, 2, -2, 3, -3]) {
      if (!occupied.has(`${col}:${candidate}`)) {
        row = candidate;
        break;
      }
    }
    occupied.add(`${col}:${row}`);
    pos[node.id] = { x: col * COLX, y: row * ROWY };
    maxCol = Math.max(maxCol, col);
  }

  // Cabang kembali ke jalur utama (garis putus-putus).
  for (const node of conditional) {
    const at = orderOf(node.id);
    const next = main.find((item) => orderOf(item.id) > at);
    edges.push({
      id: `j-${node.id}`,
      from: node.id,
      to: next ? next.id : ENDING_DEFAULT.id,
      kind: 'rejoin',
    });
  }

  const endCol = maxCol + 1;
  const endingOrder = [ENDING_DEFAULT, ENDING_MENTOR];
  endingOrder.forEach((ending, index) => {
    pos[ending.id] = { x: endCol * COLX, y: index * ROWY };
  });
  if (prevMain) {
    edges.push({
      id: 'e-default',
      from: prevMain,
      to: ENDING_DEFAULT.id,
      kind: 'seq',
    });
  }

  for (const node of nodes) {
    const targetAt = orderOf(node.id);
    node.rules.forEach((rule, index) => {
      edges.push({
        id: `c-${node.id}-${index}`,
        from: rule.fieldId,
        to: node.id,
        kind: 'cond',
        rule,
      });
    });
    node.allRules.forEach((rule, index) => {
      const valid =
        node.kind === 'ending' ? true : ruleIsValid(rule, fields, targetAt);
      if (valid) return;
      edges.push({
        id: `x-${node.id}-${index}`,
        from: rule.fieldId,
        to: node.id,
        kind: 'invalid',
        rule,
      });
    });
  }

  return { pos, edges, cols: endCol + 1 };
}

function Flow({
  fields,
  selected,
  onSelect,
  onOpenCondition,
}: {
  fields: Field[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onOpenCondition: (field: Field) => void;
}) {
  const [zoom, setZoom] = useState(0.55);
  const nodes = useMemo(() => buildNodes(fields), [fields]);
  const { pos, edges, cols } = useMemo(() => layoutFlow(fields, nodes), [fields, nodes]);

  const ys = Object.values(pos).map((point) => point.y);
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 0;
  const top = minY - NH / 2 - 60;
  const height = maxY + NH / 2 + 24 - top;
  const width = Math.max(1, cols) * COLX + 40;

  const selectedNode = nodes.find((node) => node.id === selected) ?? null;
  const selectedField =
    selectedNode?.kind === 'field'
      ? fields.find((field) => field.id === selectedNode.id) ?? null
      : null;
  const condCount = nodes.filter(
    (node) => node.kind === 'field' && node.rules.length > 0,
  ).length;
  const invalidCount = nodes.reduce(
    (total, node) => total + (node.allRules.length - node.rules.length),
    0,
  );

  const labelled = edges.filter(
    (edge) => edge.kind === 'cond' || edge.kind === 'invalid',
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
        <Legend className="border-neutral-600">Jalur utama</Legend>
        <Legend className="border-secondary-500">Kondisi tampil</Legend>
        <Legend className="border-dashed border-neutral-600">
          Kembali ke jalur utama
        </Legend>
        <span className="hidden flex-1 sm:block" />
        <span className="text-neutral-700">{condCount} blok bersyarat</span>
        {invalidCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-light px-2 py-0.5 text-xs font-semibold text-danger-dark">
            <AlertTriangle className="size-3.5" aria-hidden />
            {invalidCount} acuan tidak sah
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative min-w-0 flex-1">
          <div
            className="h-[320px] overflow-auto rounded-[24px] border border-neutral-400 bg-neutral-100"
            style={{
              backgroundImage:
                'radial-gradient(rgb(157 164 168 / 0.45) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          >
            <div
              className="relative"
              style={{ width: width * zoom, height: height * zoom }}
            >
              <div
                className="absolute left-0 top-0"
                style={{
                  width,
                  height,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                }}
              >
                <svg
                  aria-hidden
                  className="pointer-events-none absolute left-0 top-0 overflow-visible"
                  width={width}
                  height={height}
                >
                  <defs>
                    <marker
                      id="kondisi-ah"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M0 0 10 5 0 10z" className="fill-neutral-600" />
                    </marker>
                    <marker
                      id="kondisi-ahc"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M0 0 10 5 0 10z" className="fill-secondary-500" />
                    </marker>
                    <marker
                      id="kondisi-ahr"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M0 0 10 5 0 10z" className="fill-tomato" />
                    </marker>
                  </defs>
                  {edges.map((edge) => {
                    const from = pos[edge.from];
                    const to = pos[edge.to];
                    if (!from || !to) return null;
                    const x1 = from.x + NW;
                    const x2 = to.x - 4;
                    const y1 = from.y - top;
                    const y2 = to.y - top;
                    const mx = (x1 + x2) / 2;
                    const active =
                      !!selected && (edge.from === selected || edge.to === selected);
                    const colour =
                      edge.kind === 'cond'
                        ? 'stroke-secondary-500'
                        : edge.kind === 'invalid'
                          ? 'stroke-tomato'
                          : 'stroke-neutral-600';
                    return (
                      <path
                        key={edge.id}
                        d={`M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        markerEnd={
                          edge.kind === 'cond'
                            ? 'url(#kondisi-ahc)'
                            : edge.kind === 'invalid'
                              ? 'url(#kondisi-ahr)'
                              : 'url(#kondisi-ah)'
                        }
                        className={colour}
                        strokeWidth={
                          active ? 3 : edge.kind === 'seq' ? 1.6 : 2
                        }
                        strokeDasharray={
                          edge.kind === 'rejoin' || edge.kind === 'invalid'
                            ? '6 5'
                            : undefined
                        }
                      />
                    );
                  })}
                </svg>

                {labelled.map((edge) => {
                  const point = pos[edge.to];
                  if (!point || !edge.rule) return null;
                  const source = fields.find(
                    (field) => field.id === edge.rule?.fieldId,
                  );
                  const nth = labelled
                    .filter((item) => item.to === edge.to)
                    .indexOf(edge);
                  const invalid = edge.kind === 'invalid';
                  return (
                    <div
                      key={`label-${edge.id}`}
                      title={
                        invalid
                          ? 'Acuan tidak sah: pertanyaannya ada di bawah target'
                          : describeRule(edge.rule, fields)
                      }
                      className={cn(
                        'pointer-events-none absolute max-w-[132px] -translate-x-1/2 -translate-y-1/2 truncate rounded-full border bg-neutral-50 px-2 py-0.5 text-[11.5px] font-semibold',
                        invalid
                          ? 'border-tomato text-danger-dark'
                          : 'border-secondary-500 text-secondary-800',
                      )}
                      style={{
                        left: point.x + NW / 2,
                        top: point.y - top - NH / 2 - 14 - nth * 22,
                      }}
                    >
                      {invalid ? 'acuan tidak sah' : ruleShort(edge.rule, source)}
                    </div>
                  );
                })}

                {nodes.map((node) => {
                  const point = pos[node.id];
                  if (!point) return null;
                  const isEnding = node.kind === 'ending';
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => onSelect(node.id)}
                      aria-pressed={selected === node.id}
                      style={{
                        left: point.x,
                        top: point.y - top - NH / 2,
                        width: NW,
                        height: NH,
                      }}
                      className={cn(
                        'absolute flex flex-col gap-1.5 rounded-2xl border-2 border-transparent p-2 text-left transition-[border-color,box-shadow,background-color] duration-150 hover:border-secondary-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400',
                        isEnding ? 'bg-primary-100' : 'bg-neutral-200',
                        selected === node.id &&
                          'border-secondary-400 bg-neutral-50 shadow-[0_6px_18px_rgba(0,0,0,0.14)] hover:border-secondary-400',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1.5 rounded-lg bg-neutral-50/60 px-2 py-1 text-[11.5px] font-bold text-neutral-800">
                        {isEnding ? (
                          <CheckCircle2 aria-hidden className="size-3.5 shrink-0" />
                        ) : node.rules.length > 0 ? (
                          <GitBranch
                            aria-hidden
                            className="size-3.5 shrink-0 text-secondary-700"
                          />
                        ) : (
                          <KindIcon
                            kind={node.fieldKind ?? 'short_text'}
                            className="size-3.5 shrink-0"
                          />
                        )}
                        <span className="truncate">
                          {node.number ? `${node.number} · ` : ''}
                          {node.typeLabel}
                        </span>
                        {node.required ? (
                          <span
                            className="ml-auto size-1.5 shrink-0 rounded-full bg-tomato"
                            title="Wajib diisi"
                          />
                        ) : null}
                      </span>
                      <span className="line-clamp-2 px-1.5 text-[12.5px] leading-snug text-neutral-1000">
                        {node.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="absolute bottom-3 left-3 flex gap-1 rounded-xl bg-neutral-50 p-1 shadow-[0_1px_2px_rgba(20,40,40,0.06),0_6px_20px_rgba(20,40,40,0.08)]">
            <IconBtn
              label="Perkecil"
              onClick={() => setZoom((value) => Math.max(0.3, value / 1.2))}
            >
              <Minus />
            </IconBtn>
            <IconBtn
              label="Perbesar"
              onClick={() => setZoom((value) => Math.min(1.2, value * 1.2))}
            >
              <Plus />
            </IconBtn>
            <IconBtn label="Paskan ke layar" onClick={() => setZoom(0.55)}>
              <Maximize2 />
            </IconBtn>
          </div>
        </div>

        {selectedNode ? (
          <aside
            aria-label="Panel logika"
            className="flex flex-col gap-3 rounded-[24px] border border-neutral-400 bg-neutral-50 p-4 lg:w-[300px] lg:flex-none"
          >
            <div className="flex items-start gap-2.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-400 text-xs font-bold text-neutral-50">
                {selectedNode.number ?? <Flag className="size-3.5" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-neutral-700">{selectedNode.typeLabel}</p>
                <p className="break-words font-semibold text-neutral-1000">
                  {selectedNode.title}
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup panel"
                onClick={() => onSelect(null)}
                className="rounded-md p-1 text-neutral-700 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <X className="size-4" />
              </button>
            </div>

            <section className="grid gap-2 border-t border-neutral-400 pt-3">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-1000">
                <GitBranch aria-hidden className="size-4 text-secondary-700" />
                {selectedNode.kind === 'ending'
                  ? 'Ending ini dipakai jika'
                  : 'Pertanyaan ini tampil jika'}
              </h3>
              {selectedNode.allRules.length === 0 ? (
                <p className="text-sm text-neutral-700">
                  {selectedNode.kind === 'ending'
                    ? 'Selain itu: dipakai kalau ending lain nggak terpenuhi.'
                    : 'Selalu tampil. Tambah kondisi biar blok ini cuma muncul saat prasyaratnya terpenuhi.'}
                </p>
              ) : (
                <ul className="grid gap-1.5">
                  {selectedNode.allRules.map((rule, index) => {
                    const targetAt = fields.findIndex(
                      (field) => field.id === selectedNode.id,
                    );
                    const invalid =
                      selectedNode.kind === 'ending'
                        ? false
                        : !ruleIsValid(rule, fields, targetAt);
                    return (
                      <li
                        key={index}
                        className={cn(
                          'rounded-xl border px-2.5 py-2 text-sm',
                          invalid
                            ? 'border-tomato bg-danger-light text-danger-dark'
                            : 'border-neutral-400 bg-neutral-50 text-neutral-800',
                        )}
                      >
                        {describeRule(rule, fields)}
                        {invalid ? (
                          <span className="mt-1 block text-xs font-semibold">
                            Acuan tidak sah, diabaikan
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {selectedField ? (
              <Btn small tone="outline" onClick={() => onOpenCondition(selectedField)}>
                <GitBranch /> Atur kondisi
              </Btn>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function Legend({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <i aria-hidden className={cn('h-0 w-7 border-t-2', className)} />
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Bagian kecil yang dipakai berulang.
   ------------------------------------------------------------------------- */

function KindIcon({ kind, className }: { kind: Kind; className?: string }) {
  if (kind === 'long_text') return <AlignLeft className={className} aria-hidden />;
  if (kind === 'single_choice') return <CircleDot className={className} aria-hidden />;
  if (kind === 'number') return <Hash className={className} aria-hidden />;
  return <Type className={className} aria-hidden />;
}

function IconBtn({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid size-8 place-items-center rounded-md text-neutral-800 transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent [&_svg]:size-4',
        className,
      )}
    >
      {children}
    </button>
  );
}
