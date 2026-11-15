'use client';

import { Check, ChevronDown, Minus } from 'lucide-react';
import { useState } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { cn } from '~/lib/utils';

export type FilterOption = { value: string; label: string };
export type FilterGroup = { label: string | null; options: FilterOption[] };

function Box({ state }: { state: 'on' | 'off' | 'some' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded border',
        state === 'off'
          ? 'border-neutral-500'
          : 'border-primary-400 bg-primary-400 text-neutral-50',
      )}
    >
      {state === 'on' ? <Check className="size-3" strokeWidth={3} /> : null}
      {state === 'some' ? <Minus className="size-3" strokeWidth={3} /> : null}
    </span>
  );
}

/**
 * Dropdown multi-centang dengan pencarian. Opsi bisa dikelompokkan (mis.
 * bidang → divisi); mencentang judul kelompok mencentang semua isinya.
 * `selected` kosong berarti tidak menyaring.
 */
export function MultiFilter({
  label,
  allLabel,
  groups,
  selected,
  onChange,
}: {
  label: string;
  allLabel: string;
  groups: FilterGroup[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = new Set(selected);
  const toggle = (values: string[], on: boolean) => {
    const next = new Set(chosen);
    for (const v of values) {
      if (on) next.add(v);
      else next.delete(v);
    }
    onChange([...next]);
  };
  const all = groups.flatMap((g) => g.options);
  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? (all.find((o) => o.value === selected[0])?.label ?? '1 dipilih')
        : `${selected.length} dipilih`;

  return (
    <div className="grid gap-1">
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`${label}: ${summary}`}
            className="inline-flex h-9 min-w-44 items-center justify-between gap-2 rounded-lg border border-neutral-400 bg-neutral-50 px-3 text-left text-sm text-neutral-1000 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <span className="truncate">{summary}</span>
            <ChevronDown aria-hidden className="size-4 text-neutral-700" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder={`Cari ${label.toLowerCase()}`} />
            <CommandList className="max-h-80">
              <CommandEmpty>Tidak ditemukan.</CommandEmpty>
              {groups.map((group, gi) => {
                const values = group.options.map((o) => o.value);
                const count = values.filter((v) => chosen.has(v)).length;
                const groupState =
                  count === 0 ? 'off' : count === values.length ? 'on' : 'some';
                return (
                  <CommandGroup key={group.label ?? `g${gi}`}>
                    {group.label && values.length > 1 ? (
                      <CommandItem
                        value={`kelompok ${group.label}`}
                        onSelect={() => toggle(values, groupState !== 'on')}
                        className="gap-2 font-semibold"
                      >
                        <Box state={groupState} />
                        {group.label}
                      </CommandItem>
                    ) : null}
                    {group.options.map((o) => (
                      <CommandItem
                        key={o.value}
                        value={`${group.label ?? ''} ${o.label} ${o.value}`}
                        onSelect={() => toggle([o.value], !chosen.has(o.value))}
                        className={cn(
                          'gap-2',
                          group.label && values.length > 1 && 'pl-7',
                        )}
                      >
                        <Box state={chosen.has(o.value) ? 'on' : 'off'} />
                        {o.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>
          {selected.length > 0 ? (
            <div className="border-t border-neutral-400 p-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-sm font-semibold text-primary-400 underline-offset-2 hover:underline"
              >
                Hapus saringan
              </button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
