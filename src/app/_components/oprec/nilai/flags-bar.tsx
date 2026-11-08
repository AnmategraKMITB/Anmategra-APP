'use client';

import { X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { type RouterOutputs, api } from '~/trpc/react';

import { FLAG_STYLE } from './status';

type FlagLabel = RouterOutputs['oprec']['flagLabels'][number];
type FlagColor = FlagLabel['color'];

const COLORS: { value: FlagColor; label: string }[] = [
  { value: 'teal', label: 'Teal' },
  { value: 'amber', label: 'Kuning' },
  { value: 'blue', label: 'Biru' },
  { value: 'red', label: 'Merah' },
];

export function FlagsBar({
  recruitmentId,
  applicationId,
  canCreateLabels,
}: {
  recruitmentId: string;
  applicationId: string;
  canCreateLabels: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<FlagColor>('teal');
  const [sensitive, setSensitive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const flags = api.oprec.applicationFlags.useQuery({
    recruitmentId,
    applicationId,
  });
  const labels = api.oprec.flagLabels.useQuery({ recruitmentId });

  const utils = api.useUtils();
  const apply = api.oprec.flagApply.useMutation();
  const remove = api.oprec.flagRemove.useMutation();
  const saveLabel = api.oprec.flagLabelSave.useMutation();

  const appliedIds = new Set((flags.data ?? []).map((flag) => flag.labelId));
  const available = (labels.data ?? []).filter(
    (label) => !appliedIds.has(label.id),
  );

  const refresh = () => {
    void utils.oprec.applicationFlags.invalidate();
    void utils.oprec.flagLabels.invalidate();
  };

  const resetForm = () => {
    setName('');
    setColor('teal');
    setSensitive(false);
  };

  const applyLabel = (labelId: string) => {
    setError(null);
    apply.mutate(
      { recruitmentId, applicationId, labelId },
      {
        onSuccess: () => {
          refresh();
          setOpen(false);
        },
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

  const removeLabel = (labelId: string) => {
    remove.mutate(
      { recruitmentId, applicationId, labelId },
      { onSuccess: refresh },
    );
  };

  const createLabel = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '') {
      setFormError('Nama label wajib diisi.');
      return;
    }
    setFormError(null);
    setError(null);
    saveLabel.mutate(
      {
        recruitmentId,
        name: trimmed,
        color,
        isSensitive: sensitive,
      },
      {
        onSuccess: (label) => {
          void utils.oprec.flagLabels.invalidate();
          apply.mutate(
            {
              recruitmentId,
              applicationId,
              labelId: label.id,
            },
            {
              onSuccess: () => {
                refresh();
                setOpen(false);
                resetForm();
              },
              onError: (mutationError) => setError(mutationError.message),
            },
          );
        },
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {flags.data?.map((flag) => (
          <span
            key={flag.labelId}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${FLAG_STYLE[flag.color]}`}
          >
            {flag.name}
            {flag.isSensitive ? ' · sensitif' : ''}
            <button
              type="button"
              aria-label={`Hapus label ${flag.name}`}
              disabled={remove.isPending}
              onClick={() => removeLabel(flag.labelId)}
              className="inline-flex size-4 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}

        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setError(null);
              setFormError(null);
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="dark_blue_outline" size="sm">
              + Label
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <div className="grid gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-1000">Label</p>
                {labels.isError ? (
                  <p role="alert" className="mt-1 text-sm text-danger-dark">
                    Label belum bisa dimuat: {labels.error.message}
                  </p>
                ) : !labels.data ? (
                  <p role="status" className="mt-1 text-sm text-neutral-700">
                    Memuat label…
                  </p>
                ) : available.length === 0 ? (
                  <p className="mt-1 text-sm text-neutral-700">
                    {labels.data.length === 0
                      ? 'Belum ada label.'
                      : 'Semua label sudah dipakai.'}
                  </p>
                ) : (
                  <ul className="mt-2 grid gap-1.5">
                    {available.map((label) => (
                      <li key={label.id}>
                        <button
                          type="button"
                          disabled={apply.isPending}
                          onClick={() => applyLabel(label.id)}
                          className={`inline-flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50 ${FLAG_STYLE[label.color]}`}
                        >
                          <span>
                            {label.name}
                            {label.isSensitive ? ' · sensitif' : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error ? (
                <p role="alert" className="text-sm text-danger-dark">
                  {error}
                </p>
              ) : null}

              {canCreateLabels ? (
                <form
                  onSubmit={createLabel}
                  className="grid gap-2 border-t border-neutral-200 pt-3"
                >
                  <p className="text-sm font-semibold text-neutral-1000">
                    Buat label
                  </p>
                  <input
                    value={name}
                    placeholder="Nama label"
                    aria-label="Nama label"
                    onChange={(event) => setName(event.target.value)}
                    className="h-9 w-full rounded-lg border border-neutral-400 bg-neutral-50 px-3 text-sm text-neutral-1000 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  />
                  <div
                    role="radiogroup"
                    aria-label="Warna label"
                    className="flex flex-wrap gap-1.5"
                  >
                    {COLORS.map((option) => {
                      const selected = color === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setColor(option.value)}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                            FLAG_STYLE[option.value]
                          } ${selected ? 'ring-2 ring-primary-400' : 'ring-1 ring-neutral-400'}`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <label className="flex items-start gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={sensitive}
                      onChange={(event) => setSensitive(event.target.checked)}
                      className="mt-0.5 size-4 rounded border-neutral-400 accent-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    />
                    <span>Sensitif (hanya terlihat pengambil keputusan)</span>
                  </label>
                  {formError ? (
                    <p role="alert" className="text-sm text-danger-dark">
                      {formError}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    variant="light_blue"
                    size="sm"
                    disabled={saveLabel.isPending || apply.isPending}
                  >
                    {saveLabel.isPending || apply.isPending
                      ? 'Menyimpan…'
                      : 'Buat dan pakai'}
                  </Button>
                </form>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {flags.isError ? (
        <p role="alert" className="text-sm text-danger-dark">
          Label pendaftar belum bisa dimuat: {flags.error.message}
        </p>
      ) : null}
      {remove.isError ? (
        <p role="alert" className="text-sm text-danger-dark">
          {remove.error.message}
        </p>
      ) : null}
    </div>
  );
}
