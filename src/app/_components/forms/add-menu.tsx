'use client';

import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Grid3X3,
  Hash,
  Info,
  Link2,
  ListChecks,
  Paperclip,
  Plus,
  SlidersHorizontal,
  Type,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';

import { FIELD_KINDS, type FieldKind } from './model';

const ICONS: Record<FieldKind, React.ComponentType<{ className?: string }>> = {
  short_text: Type,
  long_text: AlignLeft,
  number: Hash,
  date: Calendar,
  single_choice: CircleDot,
  dropdown: ChevronDown,
  multiple_choice: ListChecks,
  checkbox: CheckSquare,
  matrix: Grid3X3,
  scale: SlidersHorizontal,
  link: Link2,
  file: Paperclip,
  text_block: Info,
};

export function KindIcon({
  kind,
  className,
}: {
  kind: FieldKind;
  className?: string;
}) {
  const Icon = ICONS[kind];
  return <Icon aria-hidden className={className} />;
}

/** Menu jenis pertanyaan; `onSelect` menambahkan ke bagian yang sedang dituju. */
export function AddMenu({
  onSelect,
  label = 'Tambah konten',
  variant = 'dark_blue_outline',
}: {
  onSelect: (kind: FieldKind) => void;
  label?: string;
  variant?: 'dark_blue_outline' | 'light_blue';
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant}>
          <Plus /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="max-h-[min(30rem,var(--radix-popover-content-available-height))] w-[min(22rem,90vw)] overflow-y-auto rounded-[20px] p-2"
      >
        <ul className="grid gap-0.5">
          {FIELD_KINDS.map((item) => (
            <li key={item.kind}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelect(item.kind);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-400">
                  <KindIcon kind={item.kind} className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-neutral-1000">
                    {item.label}
                  </span>
                  <span className="block text-sm text-neutral-700">
                    {item.hint}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
