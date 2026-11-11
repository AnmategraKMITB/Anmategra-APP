'use client';

import { Monitor, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { cn } from '~/lib/utils';

import { useBuilder } from './builder-context';
import { FormRenderer } from './form-renderer';

/** Tab Pratinjau: form seperti yang dilihat pengisi, tanpa mengirim apa pun. */
export function PreviewPane() {
  const { detail } = useBuilder();
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  if (!detail) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-700">
          Pratinjau: kamu bisa mengisi dan berpindah halaman, tetapi jawaban
          tidak dikirim.
        </p>
        <div
          role="radiogroup"
          aria-label="Ukuran layar"
          className="inline-flex overflow-hidden rounded-lg border border-neutral-400"
        >
          {(
            [
              ['desktop', 'Desktop', Monitor],
              ['mobile', 'Ponsel', Smartphone],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={device === value}
              onClick={() => setDevice(value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400',
                device === value
                  ? 'bg-primary-400 text-white'
                  : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-200',
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div
        className={cn(
          'mx-auto w-full transition-[max-width] duration-200',
          device === 'desktop' ? 'max-w-2xl' : 'max-w-[375px]',
        )}
      >
        <FormRenderer key={detail.id} form={detail} mode="preview" />
      </div>
    </div>
  );
}
