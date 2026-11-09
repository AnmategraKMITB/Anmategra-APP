'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

import { type PresetId } from './model';
import { PRESETS, presetHighlights } from './presets';

/** Layar pertama: pilih preset yang paling dekat, atau atur sendiri. */
export function PresetScreen({
  current,
  onPick,
  cancelHref,
}: {
  current: PresetId | null;
  onPick: (id: PresetId) => void;
  cancelHref: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-primary-400">Setup oprec</p>
      <h1 className="mt-1 text-2xl font-semibold text-neutral-1000 sm:text-[32px]">
        Mulai dari mana?
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-700">
        Pilih preset yang paling dekat dengan oprec ini. Preset hanya mengisi
        pengaturan; daftar divisi, tanggal gelombang, dan bagian penilai tetap
        kamu pilih di langkah berikutnya.
      </p>
      {current !== null && current !== 'custom' ? (
        <p className="mt-3 rounded-xl bg-warning-light px-3 py-2 text-sm text-warning-dark">
          Memilih preset lagi akan menimpa pengaturan yang sudah diisi.
        </p>
      ) : null}

      <div
        role="group"
        aria-label="Pilihan preset"
        className="mt-6 grid gap-3 sm:grid-cols-2"
      >
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onPick(preset.id)}
            className={cn(
              'grid content-start gap-2 rounded-[20px] border bg-neutral-50 p-4 text-left transition-colors duration-150 hover:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
              current === preset.id
                ? 'border-primary-400 bg-primary-100'
                : 'border-neutral-400',
            )}
          >
            <span className="flex flex-wrap items-baseline gap-2">
              <span className="text-base font-semibold text-neutral-1000">
                {preset.title}
              </span>
              <span className="text-xs text-neutral-700">{preset.example}</span>
            </span>
            <span className="text-sm text-neutral-700">{preset.blurb}</span>
            <span className="mt-1 flex flex-wrap gap-1">
              {presetHighlights(preset).map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] text-neutral-700"
                >
                  {item}
                </span>
              ))}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary-400">
              Pakai preset <ArrowRight className="size-4" />
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPick('custom')}
          className={cn(
            'grid content-start gap-2 rounded-[20px] border border-dashed bg-neutral-50 p-4 text-left transition-colors duration-150 hover:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
            current === 'custom'
              ? 'border-primary-400 bg-primary-100'
              : 'border-neutral-400',
          )}
        >
          <span className="text-base font-semibold text-neutral-1000">
            Atur sendiri
          </span>
          <span className="text-sm text-neutral-700">
            Mulai dari bawaan dan jawab semua pertanyaan satu per satu.
          </span>
          <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary-400">
            Atur sendiri <ArrowRight className="size-4" />
          </span>
        </button>
      </div>

      <div className="mt-6">
        <Button asChild variant="ghost">
          <Link href={cancelHref}>Batal</Link>
        </Button>
      </div>
    </div>
  );
}
