'use client';

import { type ReactNode, useState } from 'react';
import { formatCsvAnswer } from '~/server/api/routers/form/csv';
import { type RouterOutputs } from '~/trpc/react';

import { FileAnswer } from '../../forms/responses-table';
import { richTextToPlain } from '../../forms/rich-text';

type AssessGet = RouterOutputs['oprec']['assessGet'];
type Column = Pick<AssessGet['columns'][number], 'fieldId' | 'type' | 'label'>;

const LONG_TEXT = 240;
const isLong = (text: string) =>
  text.length > LONG_TEXT || text.split('\n').length > 4;
const isHttpUrl = (text: string) => /^https?:\/\/\S+$/i.test(text);

function ClampedText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = isLong(text);

  return (
    <div>
      <p
        className={`whitespace-pre-line break-words text-neutral-1000 ${long && !open ? 'line-clamp-4' : ''}`}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="mt-1 text-sm font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          {open ? 'Tutup' : 'Baca selengkapnya'}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Jawaban pendaftar. Pertanyaan di `linkedFieldIds` (mis. yang tertaut ke
 * kriteria aktif, atau bagian divisi di papan prioritas) tampil dulu dan
 * disorot; sisanya dilipat di "Jawaban lainnya".
 */
export function AnswerList({
  columns,
  answers,
  linkedLabel,
  linkedFieldIds = [],
}: {
  columns: Column[];
  answers: AssessGet['answers'];
  /** Judul kelompok jawaban yang disorot, mis. "Untuk kriteria X". */
  linkedLabel?: ReactNode;
  linkedFieldIds?: string[];
}) {
  if (columns.length === 0) {
    return (
      <p className="text-sm text-neutral-700">
        Pendaftar ini tidak mengisi formulir.
      </p>
    );
  }

  const linked = new Set(linkedFieldIds);
  const related = columns.filter((c) => linked.has(c.fieldId));
  if (related.length === 0) {
    return <AnswerItems columns={columns} answers={answers} />;
  }
  const others = columns.filter((c) => !linked.has(c.fieldId));

  return (
    <div className="grid gap-3">
      <p className="text-sm text-neutral-700">{linkedLabel}</p>
      <AnswerItems columns={related} answers={answers} highlight />
      {others.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
            Jawaban lainnya ({others.length})
          </summary>
          <div className="mt-3">
            <AnswerItems columns={others} answers={answers} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function AnswerItems({
  columns,
  answers,
  highlight = false,
}: {
  columns: Column[];
  answers: AssessGet['answers'];
  highlight?: boolean;
}) {
  return (
    <dl className="grid gap-3">
      {columns.map((column) => {
        const value = answers[column.fieldId];
        const text = formatCsvAnswer(column.type, value);

        return (
          <div
            key={column.fieldId}
            className={
              highlight
                ? 'rounded-xl border-l-4 border-primary-400 bg-primary-100 px-3 py-2'
                : 'rounded-xl bg-neutral-100 px-3 py-2'
            }
          >
            <dt className="text-sm text-neutral-700">
              {richTextToPlain(column.label)}
            </dt>
            <dd className="mt-0.5 text-sm text-neutral-1000">
              {column.type === 'file' ? (
                <FileAnswer value={value} />
              ) : text === '' ? (
                <span className="text-neutral-500">—</span>
              ) : isHttpUrl(text) ? (
                <a
                  href={text}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="break-all font-medium text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  {text}
                </a>
              ) : (
                <ClampedText text={text} />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
