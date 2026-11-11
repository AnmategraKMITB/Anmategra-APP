'use client';

import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { api } from '~/trpc/react';

export type PersonPickerProps = {
  disabled?: boolean;
  disabledReason?: string;
  excludeUserIds: ReadonlySet<string>;
  onPick: (user: { userId: string; name: string }) => void | Promise<void>;
  busy?: boolean;
};

function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part !== '');
  const first = parts[0]?.charAt(0) ?? '';
  const last =
    parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  const initials = `${first}${last}`.toUpperCase();
  return initials === '' ? '?' : initials;
}

export function PersonPicker(props: PersonPickerProps): JSX.Element {
  const { disabled, disabledReason, excludeUserIds, onPick, busy } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const isDisabled = disabled === true || busy === true;
  const trimmedQuery = query.trim();
  const enoughInput = trimmedQuery.length >= 2;
  const enoughDebounced = debounced.trim().length >= 2;
  const waitingForDebounce = enoughInput && !enoughDebounced;

  const search = api.users.searchMahasiswa.useQuery(
    { query: debounced, isKegiatan: false, limit: 8 },
    { enabled: debounced.trim().length >= 2 },
  );

  const results = search.data?.results ?? [];
  const loading = waitingForDebounce || search.isFetching;

  const handleOpenChange = (next: boolean) => {
    if (isDisabled) return;
    setOpen(next);
  };

  const handleValueChange = (value: string) => {
    setQuery(value);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setDebounced(value);
      timerRef.current = null;
    }, 250);
  };

  const handlePick = (user: { userId: string; name: string }) => {
    if (isDisabled) return;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setQuery('');
    setDebounced('');
    setOpen(false);
    void Promise.resolve(
      onPick({ userId: user.userId, name: user.name }),
    ).catch(() => undefined);
  };

  let content: JSX.Element;
  if (trimmedQuery.length < 2) {
    content = (
      <div className="px-3 py-4 text-xs text-neutral-700">
        Ketik minimal 2 huruf
      </div>
    );
  } else if (loading) {
    content = (
      <div className="space-y-2 p-2">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-9 animate-pulse rounded-[8px] bg-neutral-200"
          />
        ))}
      </div>
    );
  } else if (search.error) {
    content = (
      <div className="px-3 py-4 text-xs text-danger-dark">
        Gagal mencari. Coba lagi.
      </div>
    );
  } else if (results.length === 0) {
    content = (
      <div className="px-3 py-4 text-xs text-neutral-700">Tidak ditemukan</div>
    );
  } else {
    content = (
      <div className="p-1">
        {results.map((user) => {
          const excluded = excludeUserIds.has(user.userId);
          return (
            <CommandItem
              key={user.userId}
              value={user.userId}
              disabled={excluded || busy === true}
              onSelect={() => handlePick(user)}
              className="items-start gap-2 rounded-[8px] px-2 py-2"
            >
              <Avatar className="size-8 border-neutral-400">
                <AvatarFallback className="bg-primary-200 text-xs font-semibold text-primary-400">
                  {initialsOf(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-1000">
                  {user.name}
                </p>
                <p className="text-xs tabular-nums text-neutral-700">
                  {user.nim}
                </p>
                {excluded ? (
                  <p className="text-xs text-neutral-700">
                    Sudah di posisi ini
                  </p>
                ) : null}
              </div>
            </CommandItem>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <Popover open={isDisabled ? false : open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="dark_blue_outline"
            size="sm"
            disabled={isDisabled}
            title={disabled === true ? disabledReason : undefined}
          >
            <Plus className="size-4" />
            nama orang
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-80 rounded-[8px] border-neutral-400 p-0 shadow-lg"
        >
          <Command shouldFilter={false} className="rounded-[8px]">
            <CommandInput
              value={query}
              onValueChange={handleValueChange}
              placeholder="Cari nama atau NIM"
              autoFocus
            />
            <CommandList>{content}</CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {disabled === true && disabledReason !== undefined ? (
        <p className="mt-1 text-xs text-neutral-700">{disabledReason}</p>
      ) : null}
    </div>
  );
}
