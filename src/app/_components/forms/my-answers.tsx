'use client';

import { FileText } from 'lucide-react';
import type { GetPublicFormOutput } from '~/server/api/types/form.type';

import { RichText } from './rich-text-view';

type Field = GetPublicFormOutput['fields'][number];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function optionLabel(field: Field, id: unknown) {
  return field.options.find((o) => o.id === id)?.label ?? String(id);
}

function Empty() {
  return <span className="italic text-neutral-700">Tidak dijawab</span>;
}

/** Satu jawaban dalam bentuk yang bisa dibaca, sesuai jenis pertanyaannya. */
function AnswerValue({ field, value }: { field: Field; value: unknown }) {
  if (value === undefined || value === null || value === '') return <Empty />;
  if (Array.isArray(value) && value.length === 0) return <Empty />;

  if (field.type === 'file' && Array.isArray(value)) {
    return (
      <ul className="grid gap-1.5">
        {value.filter(isRecord).map((file) => (
          <li key={String(file.itemId)}>
            <a
              href={String(file.url)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-primary-400 underline-offset-4 hover:underline"
            >
              <FileText aria-hidden className="size-4 shrink-0" />
              <span className="break-all">{String(file.name)}</span>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  if (field.type === 'matrix' && isRecord(value)) {
    const rows = field.config.rows ?? [];
    const columns = field.config.columns ?? [];
    const col = (id: unknown) =>
      columns.find((c) => c.id === id)?.label ?? String(id);
    return (
      <dl className="grid gap-1">
        {rows.map((row) => {
          const picked = value[row.id];
          const text = Array.isArray(picked)
            ? picked.map(col).join(', ')
            : picked
              ? col(picked)
              : '';
          return (
            <div key={row.id} className="flex flex-wrap gap-x-2">
              <dt className="text-neutral-700">{row.label}:</dt>
              <dd className="text-neutral-1000">{text || <Empty />}</dd>
            </div>
          );
        })}
      </dl>
    );
  }

  if (Array.isArray(value)) {
    // Urutan pilihan tujuan oprec bermakna (pilihan ke-1, ke-2, …).
    if (field.type === 'unit_choice') {
      return (
        <ol className="grid list-decimal gap-0.5 pl-5">
          {value.map((id) => (
            <li key={String(id)}>{optionLabel(field, id)}</li>
          ))}
        </ol>
      );
    }
    if (value.length === 1 || field.type === 'single_choice') {
      return (
        <span>{value.map((id) => optionLabel(field, id)).join(', ')}</span>
      );
    }
    return (
      <ul className="grid list-disc gap-0.5 pl-5">
        {value.map((id) => (
          <li key={String(id)}>{optionLabel(field, id)}</li>
        ))}
      </ul>
    );
  }

  if (typeof value === 'boolean') return <span>{value ? 'Ya' : 'Tidak'}</span>;

  if (typeof value === 'string' && field.options.length > 0) {
    return <span>{optionLabel(field, value)}</span>;
  }

  if (field.type === 'link' && typeof value === 'string') {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="break-all text-primary-400 underline-offset-4 hover:underline"
      >
        {value}
      </a>
    );
  }

  return (
    <span className="whitespace-pre-wrap break-words">
      {typeof value === 'string' || typeof value === 'number'
        ? value
        : JSON.stringify(value)}
    </span>
  );
}

/**
 * Jawaban terkirim milik pengisi sendiri, hanya-baca. Pertanyaan yang
 * tersembunyi oleh kondisi dan tidak dijawab tidak ditampilkan.
 */
export function MyAnswers({
  form,
  answers,
}: {
  form: GetPublicFormOutput;
  answers: Record<string, unknown>;
}) {
  const questions = form.fields.filter((f) => f.type !== 'text_block');
  const shown = questions.filter(
    (f) => !f.condition || answers[f.id] !== undefined,
  );
  const sectionOf = new Map(form.sections.map((s) => [s.id, s.title]));

  return (
    <ol className="grid gap-3">
      {shown.map((field, i) => {
        const prev = shown[i - 1];
        const heading =
          field.sectionId && prev?.sectionId !== field.sectionId
            ? sectionOf.get(field.sectionId)
            : undefined;
        return (
          <li key={field.id} className="grid gap-3">
            {heading ? (
              <h2 className="mt-4 text-base font-semibold text-neutral-1000 first:mt-0">
                {heading}
              </h2>
            ) : null}
            <div className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-5">
              <p className="flex gap-2 text-sm font-semibold text-neutral-1000">
                <span className="tabular-nums text-neutral-700">{i + 1}.</span>
                <span className="min-w-0">
                  <RichText value={field.label} />
                </span>
              </p>
              <div className="mt-2 text-neutral-1000">
                <AnswerValue field={field} value={answers[field.id]} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
