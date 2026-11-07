'use client';

import { Download } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { api } from '~/trpc/react';

import { ResponsesSummary } from './responses-summary';
import { ResponsesTable } from './responses-table';

const PAGE_SIZE = 50;

/** Halaman respons satu form: Ringkasan dan Tabel, plus ekspor CSV. */
export function ResponsesView({
  formId,
  title,
  ownerName,
  backHref,
}: {
  formId: string;
  title: string;
  ownerName: string;
  backHref: string;
}) {
  const [tab, setTab] = useState<'ringkasan' | 'tabel'>('ringkasan');
  const [page, setPage] = useState(1);
  const summary = api.form.responses.summary.useQuery({ formId });
  const list = api.form.responses.list.useQuery(
    { formId, page, pageSize: PAGE_SIZE },
    { placeholderData: (previous) => previous, enabled: tab === 'tabel' },
  );
  const total = summary.data?.total;

  return (
    <div className="py-6 sm:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={backHref}
            className="text-sm text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            ← Kembali ke form
          </Link>
          <h1 className="mt-2 break-words text-2xl font-semibold text-neutral-1000 sm:text-[32px]">
            Respons: {title}
          </h1>
          <p className="mt-1 text-sm text-neutral-700">
            {ownerName}
            {total === undefined ? '' : ` · ${total} respons`}
          </p>
        </div>
        <Button
          asChild
          variant="dark_blue"
          className={cn(total === 0 && 'pointer-events-none opacity-50')}
          aria-disabled={total === 0}
        >
          <a href={`/api/forms/${formId}/respons.csv`} download>
            <Download /> Ekspor CSV
          </a>
        </Button>
      </header>

      <div
        role="tablist"
        aria-label="Tampilan respons"
        className="mt-6 flex gap-1 border-b border-neutral-400"
      >
        {(
          [
            ['ringkasan', 'Ringkasan'],
            ['tabel', 'Tabel'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
              tab === id
                ? 'border-primary-400 text-primary-400'
                : 'border-transparent text-neutral-700 hover:text-neutral-1000',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="mt-6"
      >
        {tab === 'ringkasan' ? (
          summary.isError ? (
            <ErrorNote message={summary.error.message} />
          ) : summary.data ? (
            <ResponsesSummary data={summary.data} />
          ) : (
            <Loading />
          )
        ) : list.isError ? (
          <ErrorNote message={list.error.message} />
        ) : list.data ? (
          <ResponsesTable
            columns={list.data.columns}
            rows={list.data.rows}
            total={list.data.total}
            page={page}
            pageSize={PAGE_SIZE}
            onPage={setPage}
            loading={list.isFetching}
          />
        ) : (
          <Loading />
        )}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <p role="status" className="py-10 text-center text-neutral-700">
      Memuat respons…
    </p>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
    >
      Respons belum bisa dimuat: {message}
    </p>
  );
}
