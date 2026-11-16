'use client';

// Library Import
import { Check, Compass, ListChecks, RotateCcw } from 'lucide-react';
import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { cn } from '~/lib/utils';

/** Satu langkah panduan. `title` dan `hint` boleh memakai **tebal**. */
export type DemoStep = { id: string; title: string; hint?: string };

export type DemoMode = 'guided' | 'free';

export type DemoGuide = {
  mode: DemoMode;
  /** Tandai satu langkah selesai. Aman dipanggil berulang. */
  complete: (id: string) => void;
  /** Kelas sorotan bila salah satu `ids` adalah langkah yang sedang dituju. */
  spot: (...ids: string[]) => string;
  isDone: (id: string) => boolean;
};

/** Mengubah `**teks**` menjadi <strong>; cukup untuk judul langkah. */
export function rich(text: string): ReactNode {
  return text
    .split('**')
    .map((part, index) =>
      index % 2 === 1 ? <strong key={index}>{part}</strong> : part,
    );
}

/**
 * Jendela simulasi di dalam manual. Membungkus satu demo dengan dua mode:
 * "Ikuti langkah" (menyorot aksi berikutnya) dan "Jelajah bebas". Tombol ulang
 * memasang ulang isi demo sehingga semua state kembali ke awal.
 */
export function DemoFrame({
  title,
  location,
  steps,
  children,
}: {
  title: string;
  /** Letak layar ini di aplikasi, mis. "Lembaga › Kegiatan › Oprec". */
  location: string;
  steps: DemoStep[];
  children: (guide: DemoGuide) => ReactNode;
}) {
  const [mode, setMode] = useState<DemoMode>('guided');
  const [done, setDone] = useState<string[]>([]);
  const [run, setRun] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const current = steps.find((step) => !done.includes(step.id)) ?? null;
  const currentIndex = current ? steps.indexOf(current) : steps.length;
  const finished = current === null;

  const complete = useCallback((id: string) => {
    setDone((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const guide = useMemo<DemoGuide>(
    () => ({
      mode,
      complete,
      spot: (...ids) =>
        mode === 'guided' && current !== null && ids.includes(current.id)
          ? 'demo-spot'
          : '',
      isDone: (id) => done.includes(id),
    }),
    [mode, complete, current, done],
  );

  const reset = () => {
    setDone([]);
    setRun((value) => value + 1);
  };

  return (
    <section
      aria-label={`Simulasi: ${title}`}
      className="my-8 overflow-hidden rounded-xl border border-neutral-400 bg-white text-neutral-1000 shadow-sm"
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-400 bg-primary-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-800">
            Coba sendiri
          </p>
          <p className="truncate text-sm font-semibold text-primary-1000">
            {title}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Mode simulasi"
            className="flex rounded-lg border border-primary-300 bg-white p-0.5"
          >
            {(
              [
                ['guided', 'Ikuti langkah', ListChecks],
                ['free', 'Jelajah bebas', Compass],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                aria-pressed={mode === id}
                onClick={() => setMode(id)}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  mode === id
                    ? 'bg-primary-400 text-white'
                    : 'text-primary-600 hover:bg-primary-100',
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 rounded-md border border-primary-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-primary-600 transition-colors hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Ulangi
          </button>
        </div>
      </header>

      <div
        aria-live="polite"
        className="border-b border-neutral-400 bg-secondary-50 px-4 py-3"
      >
        {mode === 'guided' ? (
          finished ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-success-dark">
              <Check className="size-4" aria-hidden />
              Semua langkah selesai. Klik Ulangi untuk mencoba lagi, atau
              lanjutkan dengan Jelajah bebas.
            </p>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 rounded-full bg-secondary-400 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {currentIndex + 1}/{steps.length}
                </span>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-neutral-1000">
                    {rich(current.title)}
                  </p>
                  {current.hint ? (
                    <p className="mt-0.5 text-neutral-700">
                      {rich(current.hint)}
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                aria-expanded={showAll}
                onClick={() => setShowAll((value) => !value)}
                className="mt-2 text-xs font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                {showAll ? 'Sembunyikan daftar langkah' : 'Lihat semua langkah'}
              </button>
              {showAll ? <StepList steps={steps} done={done} ordered /> : null}
            </>
          )
        ) : (
          <>
            <p className="text-sm text-neutral-800">
              Coba apa saja di jendela ini. Beberapa hal yang bisa dilakukan:
            </p>
            <StepList steps={steps} done={done} />
          </>
        )}
      </div>

      <div className="border-b border-neutral-300 bg-neutral-100 px-4 py-1.5 text-xs text-neutral-700">
        {location}
      </div>

      <div
        key={run}
        className="relative min-h-[320px] overflow-x-auto bg-white p-4 text-sm"
      >
        {children(guide)}
      </div>

      <footer className="border-t border-neutral-300 bg-neutral-100 px-4 py-2 text-xs text-neutral-700">
        Simulasi dengan data contoh. Tidak ada yang tersimpan ke Anmategra.
      </footer>
    </section>
  );
}

function StepList({
  steps,
  done,
  ordered = false,
}: {
  steps: DemoStep[];
  done: string[];
  ordered?: boolean;
}) {
  return (
    <ol className="mt-2 space-y-1">
      {steps.map((step, index) => {
        const isDone = done.includes(step.id);
        return (
          <li key={step.id} className="flex items-start gap-2 text-xs">
            <span
              className={cn(
                'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                isDone
                  ? 'border-success-dark bg-success-dark text-white'
                  : 'border-neutral-500 text-neutral-700',
              )}
            >
              {isDone ? (
                <Check className="size-3" aria-label="Selesai" />
              ) : ordered ? (
                index + 1
              ) : null}
            </span>
            <span className={isDone ? 'text-neutral-700' : 'text-neutral-1000'}>
              {rich(step.title)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
