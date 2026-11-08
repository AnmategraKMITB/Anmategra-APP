'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '~/trpc/react';

import { BerkasView } from './berkas';
import { SheetView } from './sheet';

type ViewMode = 'berkas' | 'sheet';

export function NilaiView({
  recruitmentId,
  basePath,
}: {
  recruitmentId: string;
  basePath?: string;
}) {
  const scopes = api.oprec.assessScopes.useQuery({ recruitmentId });
  const [scope, setScope] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('berkas');

  const data = scopes.data;
  const active =
    data?.scopes.find((item) => item.scope === scope) ??
    data?.scopes[0] ??
    null;

  return (
    <div className="py-6 sm:py-8">
      <header className="min-w-0">
        {basePath ? (
          <Link
            href={basePath}
            className="text-sm text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            ← Kembali ke oprec
          </Link>
        ) : null}
        <h1 className="mt-2 text-2xl font-semibold text-neutral-1000 sm:text-[32px]">
          Nilai
        </h1>
        <p className="mt-1 break-words text-sm text-neutral-700">
          {data ? data.name : 'Memuat oprec…'}
        </p>
      </header>

      {scopes.isError ? (
        <p
          role="alert"
          className="mt-6 rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
        >
          Lingkup penilaian belum bisa dimuat: {scopes.error.message}
        </p>
      ) : data ? (
        data.scopes.length === 0 ? (
          <p className="mt-6 rounded-[24px] border border-neutral-400 bg-neutral-50 p-8 text-center text-sm text-neutral-700">
            Kamu belum punya akses penilaian pada oprec ini.
          </p>
        ) : (
          <div className="mt-6 grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Lingkup penilaian"
                className="flex flex-wrap gap-1.5"
              >
                {data.scopes.map((item) => {
                  const selected = active?.scope === item.scope;
                  return (
                    <button
                      key={item.scope}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setScope(item.scope)}
                      className={`inline-flex h-9 items-center rounded-full border px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                        selected
                          ? 'border-primary-300 bg-primary-100 text-primary-500'
                          : 'border-neutral-400 bg-neutral-50 text-neutral-700 hover:border-primary-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <div
                role="group"
                aria-label="Tampilan"
                className="inline-flex rounded-full border border-neutral-400 bg-neutral-50 p-1"
              >
                {(['berkas', 'sheet'] as const).map((mode) => {
                  const selected = view === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setView(mode)}
                      className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                        selected
                          ? 'bg-primary-100 text-primary-500'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {mode === 'berkas' ? 'Per berkas' : 'Sheet'}
                    </button>
                  );
                })}
              </div>
            </div>

            {active ? (
              view === 'berkas' ? (
                <BerkasView
                  key={`berkas-${active.scope}`}
                  recruitmentId={recruitmentId}
                  scope={active.scope}
                  canDecide={active.canDecide}
                  ratingMin={data.ratingMin}
                  ratingMax={data.ratingMax}
                />
              ) : (
                <SheetView
                  key={`sheet-${active.scope}`}
                  recruitmentId={recruitmentId}
                  scope={active.scope}
                  ratingMin={data.ratingMin}
                  ratingMax={data.ratingMax}
                />
              )
            ) : null}
          </div>
        )
      ) : (
        <p
          role="status"
          className="mt-6 py-10 text-center text-sm text-neutral-700"
        >
          Memuat lingkup penilaian…
        </p>
      )}
    </div>
  );
}
