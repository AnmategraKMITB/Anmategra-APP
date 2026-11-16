'use client';

import { Plus } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '~/lib/utils';

import { AddMenu } from './add-menu';
import { useBuilder } from './builder-context';

/**
 * Tombol lebar bergaris putus yang muncul saat kursor berada di celah antara
 * dua blok (atau saat difokus dengan Tab). Di layar sentuh, yang tidak punya
 * hover, tombolnya selalu tampak.
 */
const GapButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    compact?: boolean;
  }
>(function GapButton({ label, compact, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className={cn(
        'flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-primary-400 bg-primary-100/90 font-semibold text-primary-400 opacity-0 shadow-sm backdrop-blur-sm transition-[opacity,transform] duration-150 ease-out hover:bg-primary-200 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 group-hover/gap:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100',
        compact ? 'h-full scale-y-90 text-xs' : 'h-full scale-y-90 text-sm',
        'group-hover/gap:scale-y-100 focus-visible:scale-y-100 data-[state=open]:scale-y-100',
        className,
      )}
    >
      <Plus aria-hidden className={compact ? 'size-3.5' : 'size-4'} />
      {label}
    </button>
  );
});

/**
 * Celah tanpa tinggi di antara dua blok dalam grid: tidak menambah jarak, tetapi
 * punya area sentuh setinggi `zone` yang menumpang di atas jarak antarblok.
 */
function Gap({
  children,
  compact,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('relative h-0', compact ? '-my-1.5' : '-my-2')}>
      <div
        className={cn(
          'group/gap absolute inset-x-0 z-10 flex items-center',
          compact ? '-top-3 h-6' : '-top-4 h-8',
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Garis sisip: membuat bagian baru di urutan `atIndex` di antara bagian lain. */
export function InsertSection({
  atIndex,
  compact,
}: {
  atIndex: number;
  compact?: boolean;
}) {
  const builder = useBuilder();
  return (
    <Gap compact={compact}>
      <GapButton
        compact={compact}
        label="Sisipkan bagian di sini"
        onClick={() => void builder.addSection(atIndex)}
      />
    </Gap>
  );
}

/** Garis sisip pertanyaan: memilih jenis lalu menambahkannya di `atIndex`. */
export function InsertQuestion({
  sectionId,
  atIndex,
}: {
  sectionId: string;
  atIndex: number;
}) {
  const builder = useBuilder();
  return (
    <Gap>
      <AddMenu
        align="center"
        onSelect={(kind) => void builder.addField(kind, sectionId, atIndex)}
        trigger={<GapButton label="Sisipkan pertanyaan di sini" />}
      />
    </Gap>
  );
}
