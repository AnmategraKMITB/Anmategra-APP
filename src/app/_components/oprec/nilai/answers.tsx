'use client';

import { useState } from 'react';
import { formatCsvAnswer } from '~/server/api/routers/form/csv';
import { type RouterOutputs } from '~/trpc/react';

import { FileAnswer } from '../../forms/responses-table';
import { richTextToPlain } from '../../forms/rich-text';

type AssessGet = RouterOutputs['oprec']['assessGet'];
type Column = AssessGet['columns'][number];

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

export function AnswerList({
  columns,
  answers,
}: {
  columns: Column[];
  answers: AssessGet['answers'];
}) {
  if (columns.length === 0) {
    return (
      <p className="text-sm text-neutral-700">
        Pendaftar ini tidak mengisi formulir.
      </p>
    );
  }

  return (
    <dl className="grid gap-3">
      {columns.map((column) => {
        const value = answers[column.fieldId];
        const text = formatCsvAnswer(column.type, value);

        return (
          <div
            key={column.fieldId}
            className="rounded-xl bg-neutral-100 px-3 py-2"
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
