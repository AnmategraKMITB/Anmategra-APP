'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { useDebounce } from '~/components/debounceHook';
import { Button } from '~/components/ui/button';
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
import { api } from '~/trpc/react';

type Props = {
  kind: 'user' | 'lembaga' | 'event' | 'position';
  value: string;
  onSelect: (value: string, label: string) => void;
  placeholder: string;
  disabled?: boolean;
};

export function AdminEntitySearch({
  kind,
  value,
  onSelect,
  placeholder,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [label, setLabel] = useState('');
  const debounced = useDebounce(query, 250);
  const enabled = debounced.trim().length >= 2;

  const users = api.adminConsole.usersSearch.useQuery(
    { q: debounced.trim(), limit: 8 },
    { enabled: kind === 'user' && enabled },
  );
  const lembaga = api.adminConsole.lembagaSearch.useQuery(
    { q: debounced.trim(), limit: 8 },
    { enabled: kind === 'lembaga' && enabled },
  );
  const events = api.adminConsole.eventsSearch.useQuery(
    { q: debounced.trim(), limit: 8 },
    { enabled: kind === 'event' && enabled },
  );
  const positions = api.adminConsole.positionsSearch.useQuery(
    { q: debounced.trim(), limit: 8 },
    { enabled: kind === 'position' && enabled },
  );


  const loading =
    kind === 'user'
      ? users.isLoading
      : kind === 'lembaga'
        ? lembaga.isLoading
        : kind === 'event'
          ? events.isLoading
          : positions.isLoading;
  const options =
    kind === 'user'
      ? (users.data ?? []).map((row) => ({
          id: row.id,
          title: row.name ?? row.email,
          meta: [row.email, row.nim, row.lembagaName].filter(Boolean).join(' · '),
        }))
      : kind === 'lembaga'
        ? (lembaga.data ?? []).map((row) => ({
            id: row.id,
            title: row.name,
            meta: [row.acronym, row.type].filter(Boolean).join(' · '),
          }))
        : kind === 'event'
          ? (events.data ?? []).map((row) => ({
              id: row.id,
              title: row.name,
              meta: row.orgName ?? '',
            }))
          : (positions.data ?? []).map((row) => ({
              id: row.id,
              title: row.title,
              meta: [row.unitName, row.structureName, row.lembagaName, row.periodName]
                .filter(Boolean)
                .join(' · '),
            }));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !label && 'text-neutral-500')}>
            {label || placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={
              kind === 'user'
                ? 'Cari nama, email, atau NIM…'
                : kind === 'lembaga'
                  ? 'Cari nama, singkatan, atau jenis…'
                  : kind === 'event'
                    ? 'Cari nama kegiatan…'
                    : 'Cari jabatan, unit, atau lembaga…'
            }
          />
          <CommandList>
            <CommandEmpty>
              {!enabled
                ? 'Ketik minimal 2 karakter.'
                : loading
                  ? 'Mencari…'
                  : 'Tidak ditemukan.'}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => {
                    onSelect(option.id, option.title);
                    setLabel(option.title);
                    setOpen(false);
                  }}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{option.title}</span>
                    {option.meta ? (
                      <span className="truncate text-xs text-neutral-700">
                        {option.meta}
                      </span>
                    ) : null}
                  </div>
                  <Check
                    className={cn(
                      'ml-auto size-4 shrink-0',
                      value === option.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
