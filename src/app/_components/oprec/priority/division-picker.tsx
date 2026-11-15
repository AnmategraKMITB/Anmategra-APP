'use client';

import { Check, ChevronDown, Lock } from 'lucide-react';
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

type PickerDivision = {
  id: string;
  label: string;
  groupLabel: string | null;
  ranked: number;
  rankable: number;
  lockedAt: Date | null;
};

const NO_GROUP = 'Tanpa bidang';

/**
 * Pemilih divisi untuk papan prioritas: dropdown yang dikelompokkan per bidang,
 * bisa dicari, dengan centang pada divisi yang sedang dibuka. Pengganti deretan
 * chip yang makan tempat saat divisinya banyak.
 */
export function DivisionPicker({
  divisions,
  activeId,
  onPick,
}: {
  divisions: PickerDivision[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = divisions.find((d) => d.id === activeId);
  const groups = new Map<string, PickerDivision[]>();
  for (const d of divisions) {
    const key = d.groupLabel ?? NO_GROUP;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const done = divisions.filter((d) => d.lockedAt).length;

  return (
    <div className="mt-6 grid gap-1">
      <h2 id="pilih-divisi" className="text-sm font-semibold text-neutral-1000">
        Bidang dan divisi yang disusun
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-labelledby="pilih-divisi"
              className="inline-flex min-w-64 items-center justify-between gap-3 rounded-lg border border-neutral-400 bg-neutral-50 px-3 py-2 text-left text-sm transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <span className="min-w-0">
                {active?.groupLabel ? (
                  <span className="block text-xs text-neutral-700">
                    {active.groupLabel}
                  </span>
                ) : null}
                <span className="font-semibold text-neutral-1000">
                  {active?.label ?? 'Pilih divisi'}
                </span>
              </span>
              <ChevronDown aria-hidden className="size-4 text-neutral-700" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command>
              <CommandInput placeholder="Cari bidang atau divisi" />
              <CommandList className="max-h-80">
                <CommandEmpty>Divisi tidak ditemukan.</CommandEmpty>
                {[...groups.entries()].map(([group, items]) => (
                  <CommandGroup key={group} heading={group}>
                    {items.map((d) => (
                      <CommandItem
                        key={d.id}
                        value={`${group} ${d.label} ${d.id}`}
                        onSelect={() => {
                          onPick(d.id);
                          setOpen(false);
                        }}
                        className="gap-2 pl-4"
                      >
                        <Check
                          aria-hidden
                          className={cn(
                            'size-4 shrink-0',
                            d.id === activeId ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {d.label}
                        </span>
                        {d.lockedAt ? (
                          <Lock aria-label="terkunci" className="size-3.5" />
                        ) : null}
                        <span className="text-xs text-neutral-700">
                          {d.ranked}/{d.rankable}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <span className="text-sm text-neutral-700">
          {done} dari {divisions.length} daftar terkunci
        </span>
      </div>
    </div>
  );
}
