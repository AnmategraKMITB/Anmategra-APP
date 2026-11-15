'use client';

import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Grid3X3,
  Hash,
  Info,
  Link2,
  ListChecks,
  ListOrdered,
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

import { useBuilder } from './builder-context';
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
  unit_choice: ListOrdered,
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
  size,
  trigger,
  align = 'start',
}: {
  onSelect: (kind: FieldKind) => void;
  label?: string;
  variant?: 'dark_blue_outline' | 'light_blue' | 'ghost';
  size?: 'sm';
  /** Tombol pemicu sendiri, menggantikan tombol bawaan. */
  trigger?: React.ReactElement;
  align?: 'start' | 'center' | 'end';
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant={variant} size={size}>
            <Plus /> {label}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        collisionPadding={12}
        className="max-h-[min(30rem,var(--radix-popover-content-available-height))] w-[min(22rem,90vw)] overflow-y-auto rounded-[20px] p-2"
      >
        <KindList
          onPick={(kind) => {
            setOpen(false);
            onSelect(kind);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function KindList({ onPick }: { onPick: (kind: FieldKind) => void }) {
  const builder = useBuilder();
  // Blok Pilihan tujuan hanya untuk form oprec, dan cukup satu.
  const choiceAllowed =
    !!builder.detail?.oprec &&
    !builder.detail.fields.some((f) => f.type === 'unit_choice');
  const kinds = FIELD_KINDS.filter(
    (k) => k.kind !== 'unit_choice' || choiceAllowed,
  );
  return (
    <ul className="grid gap-0.5">
      {kinds.map((item) => (
        <li key={item.kind}>
          <button
            type="button"
            onClick={() => onPick(item.kind)}
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
  );
}

/** Satu tombol "Tambah pertanyaan..." di kartu: pilih letaknya, lalu jenisnya. */
export function AddAroundMenu({
  onSelect,
}: {
  onSelect: (kind: FieldKind, where: 'before' | 'after') => void;
}) {
  const [open, setOpen] = useState(false);
  const [where, setWhere] = useState<'before' | 'after'>('after');
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus /> Tambah pertanyaan...
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="max-h-[min(30rem,var(--radix-popover-content-available-height))] w-[min(22rem,90vw)] overflow-y-auto rounded-[20px] p-2"
      >
        <div
          role="radiogroup"
          aria-label="Letak pertanyaan baru"
          className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-neutral-200 p-1"
        >
          {(
            [
              ['before', 'Di atasnya', ArrowUp],
              ['after', 'Di bawahnya', ArrowDown],
            ] as const
          ).map(([value, text, Arrow]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={where === value}
              onClick={() => setWhere(value)}
              className={
                where === value
                  ? 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-50 px-3 py-1.5 text-sm font-semibold text-primary-400 shadow-sm'
                  : 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-neutral-700 hover:text-neutral-1000'
              }
            >
              <Arrow aria-hidden className="size-4" />
              {text}
            </button>
          ))}
        </div>
        <KindList
          onPick={(kind) => {
            setOpen(false);
            onSelect(kind, where);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
