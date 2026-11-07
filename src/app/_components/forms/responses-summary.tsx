'use client';

import type { ResponsesSummaryOutput } from '~/server/api/types/form.type';

import { richTextToPlain } from './rich-text';

type FieldSummary = ResponsesSummaryOutput['fields'][number];

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

function Bar({
  label,
  count,
  percent,
  note,
}: {
  label: string;
  count: number;
  percent: number;
  note?: string;
}) {
  return (
    <li className="grid gap-1">
      <div className="flex justify-between gap-3 text-sm">
        <span className="min-w-0 break-words text-neutral-1000">
          {label}
          {note ? <span className="text-neutral-700"> ({note})</span> : null}
        </span>
        <span className="shrink-0 tabular-nums text-neutral-700">
          {number.format(count)} · {number.format(percent)}%
        </span>
      </div>
      <div
        role="img"
        aria-label={`${label}: ${number.format(percent)} persen`}
        className="h-2 overflow-hidden rounded-full bg-neutral-200"
      >
        <div
          className="h-full rounded-full bg-primary-400"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-100 px-3 py-2">
      <dt className="text-xs text-neutral-700">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-neutral-1000">
        {value}
      </dd>
    </div>
  );
}

function SummaryBody({ item }: { item: FieldSummary }) {
  switch (item.type) {
    case 'choice':
      return (
        <ul className="grid gap-3">
          {item.options.map((o) => (
            <Bar
              key={o.id}
              label={o.label}
              count={o.count}
              percent={o.percent}
              note={o.archived ? 'pilihan sudah dihapus' : undefined}
            />
          ))}
        </ul>
      );
    case 'number':
      return (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Jawaban" value={number.format(item.count)} />
          <Stat
            label="Rata-rata"
            value={item.average === null ? '—' : number.format(item.average)}
          />
          <Stat
            label="Terendah"
            value={item.min === null ? '—' : number.format(item.min)}
          />
          <Stat
            label="Tertinggi"
            value={item.max === null ? '—' : number.format(item.max)}
          />
        </dl>
      );
    case 'scale': {
      return (
        <div className="grid gap-3">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Jawaban" value={number.format(item.count)} />
            <Stat label="Rata-rata" value={number.format(item.average)} />
          </dl>
          <ul className="grid gap-3">
            {item.distribution.map((d) => (
              <Bar
                key={d.value}
                label={String(d.value)}
                count={d.count}
                percent={item.count > 0 ? (d.count / item.count) * 100 : 0}
              />
            ))}
          </ul>
        </div>
      );
    }
    case 'text':
      return item.latest.length === 0 ? (
        <p className="text-sm text-neutral-700">Belum ada jawaban.</p>
      ) : (
        <div>
          <ul className="grid gap-2">
            {item.latest.map((text, i) => (
              <li
                key={i}
                className="whitespace-pre-line break-words rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-1000"
              >
                {text}
              </li>
            ))}
          </ul>
          {item.count > item.latest.length ? (
            <p className="mt-2 text-sm text-neutral-700">
              Menampilkan {item.latest.length} dari {number.format(item.count)}{' '}
              jawaban terbaru. Lihat semuanya di tab Tabel atau ekspor CSV.
            </p>
          ) : null}
        </div>
      );
    case 'checkbox': {
      const total = item.yes + item.no;
      return (
        <ul className="grid gap-3">
          <Bar
            label="Ya"
            count={item.yes}
            percent={total > 0 ? (item.yes / total) * 100 : 0}
          />
          <Bar
            label="Tidak"
            count={item.no}
            percent={total > 0 ? (item.no / total) * 100 : 0}
          />
        </ul>
      );
    }
    case 'matrix':
      return (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left font-medium text-neutral-700" />
                {item.rows[0]?.cells.map((c) => (
                  <th
                    key={c.columnId}
                    scope="col"
                    className="p-2 text-center font-medium text-neutral-700"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {item.rows.map((row) => (
                <tr key={row.rowId} className="border-t border-neutral-300">
                  <th scope="row" className="p-2 text-left font-medium">
                    {row.label}
                  </th>
                  {row.cells.map((c) => (
                    <td
                      key={c.columnId}
                      className="p-2 text-center tabular-nums"
                    >
                      {number.format(c.count)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/** Tab Ringkasan: satu kartu per pertanyaan. */
export function ResponsesSummary({ data }: { data: ResponsesSummaryOutput }) {
  if (data.total === 0) {
    return (
      <p className="rounded-[24px] border border-neutral-400 p-8 text-center text-neutral-700">
        Belum ada yang mengirim jawaban.
      </p>
    );
  }
  return (
    <ol className="grid gap-4">
      {data.fields.map((item) => (
        <li
          key={item.fieldId}
          className="rounded-[24px] border border-neutral-400 bg-neutral-50 p-5"
        >
          <h3 className="font-semibold text-neutral-1000">
            {richTextToPlain(item.label)}
            {item.archived ? (
              <span className="ml-2 text-sm font-normal text-neutral-700">
                (pertanyaan sudah diarsipkan)
              </span>
            ) : null}
          </h3>
          <div className="mt-3">
            <SummaryBody item={item} />
          </div>
        </li>
      ))}
    </ol>
  );
}
