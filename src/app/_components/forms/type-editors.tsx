'use client';

import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Switch } from '~/components/ui/switch';
import { cn } from '~/lib/utils';
import {
  FILE_MAX_SIZE_MB,
  FILE_PRESETS,
  FILE_PRESET_KEYS,
  MATRIX_MAX_COLUMNS,
  MATRIX_MAX_ROWS,
  MAX_OPTIONS_PER_FIELD,
} from '~/server/api/types/form.constants';
import type { UpdateFieldInput } from '~/server/api/types/form.type';

type Draft = UpdateFieldInput;

/** Config baru dari config lama + perubahan; kunci bernilai `undefined` dibuang. */
function withConfig<D extends Draft>(
  draft: D,
  patch: Record<string, unknown>,
): D {
  const merged = Object.fromEntries(
    Object.entries({ ...draft.config, ...patch }).filter(
      ([, v]) => v !== undefined,
    ),
  );
  return { ...draft, config: merged } as D;
}

function NumberInput({
  id,
  label,
  value,
  onChange,
  min,
  max,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={value ?? ''}
        min={min}
        max={max}
        onChange={(e) => {
          const raw = e.target.value;
          const number = Number(raw);
          onChange(raw === '' || !Number.isFinite(number) ? undefined : number);
        }}
      />
    </div>
  );
}

const PATTERN_LABELS: Record<string, string> = {
  none: 'Tanpa format',
  email: 'Alamat email',
  nomor_hp: 'Nomor HP Indonesia',
  nim: 'NIM (8 digit)',
};

// ---------------------------------------------------------------------------
// Daftar yang bisa diurutkan: pilihan, baris dan kolom matriks
// ---------------------------------------------------------------------------

type Item = { id?: string | undefined; label: string };

function ListEditor({
  idPrefix,
  title,
  noun,
  items,
  onChange,
  min,
  max,
  marker,
}: {
  idPrefix: string;
  title: string;
  /** Kata benda tunggal untuk nama bawaan dan label tombol: "Pilihan", "Baris", "Kolom". */
  noun: string;
  items: Item[];
  onChange: (next: Item[]) => void;
  min: number;
  max: number;
  marker?: 'radio' | 'checkbox';
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const focusIndex = useRef<{ index: number; select: boolean } | null>(null);

  // Memindahkan fokus ke baris yang baru dibuat setelah React menggambarnya.
  useEffect(() => {
    const target = focusIndex.current;
    if (target === null) return;
    const el = inputs.current[target.index];
    el?.focus();
    // Baris baru: teks bawaannya terpilih, jadi langsung bisa diganti dengan mengetik.
    if (target.select) el?.select();
    focusIndex.current = null;
  });

  const seen = new Map<string, number>();
  const duplicate = items.map((item) => {
    const key = item.label.trim().toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
    return key;
  });

  const update = (index: number, label: string) =>
    onChange(items.map((item, i) => (i === index ? { ...item, label } : item)));

  const insertAfter = (index: number, labels: string[]) => {
    const room = max - items.length;
    const added = labels.slice(0, room).map((label) => ({ label }));
    if (added.length === 0) return;
    const next = [
      ...items.slice(0, index + 1),
      ...added,
      ...items.slice(index + 1),
    ];
    focusIndex.current = { index: index + added.length, select: true };
    onChange(next);
  };

  const remove = (index: number) => {
    if (items.length <= min) return;
    focusIndex.current = { index: Math.max(0, index - 1), select: false };
    onChange(items.filter((_, i) => i !== index));
  };

  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to]!, next[index]!];
    focusIndex.current = { index: to, select: false };
    onChange(next);
  };

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold text-neutral-1000">
        {title}
      </legend>
      <ul className="grid gap-1.5">
        {items.map((item, index) => {
          const repeated = (seen.get(duplicate[index]!) ?? 0) > 1;
          return (
            <li
              key={`${item.id ?? 'baru'}:${index}`}
              className="flex items-center gap-1.5"
            >
              {marker ? (
                <span
                  aria-hidden
                  className={cn(
                    'size-4 shrink-0 border border-neutral-500',
                    marker === 'radio' ? 'rounded-full' : 'rounded',
                  )}
                />
              ) : (
                <span
                  aria-hidden
                  className="w-5 shrink-0 text-right text-sm text-neutral-500"
                >
                  {index + 1}
                </span>
              )}
              <Input
                ref={(el) => {
                  inputs.current[index] = el;
                }}
                id={`${idPrefix}-${index}`}
                aria-label={`${noun} ${index + 1}`}
                value={item.label}
                maxLength={255}
                aria-invalid={repeated}
                onChange={(e) => update(index, e.target.value)}
                onKeyDown={(e) => {
                  if (e.altKey && e.key === 'ArrowUp') {
                    e.preventDefault();
                    e.stopPropagation();
                    move(index, -1);
                  } else if (e.altKey && e.key === 'ArrowDown') {
                    e.preventDefault();
                    e.stopPropagation();
                    move(index, 1);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    insertAfter(index, [`${noun} ${items.length + 1}`]);
                  } else if (
                    e.key === 'Backspace' &&
                    item.label === '' &&
                    items.length > min
                  ) {
                    e.preventDefault();
                    remove(index);
                  }
                }}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text');
                  if (!text.includes('\n')) return;
                  e.preventDefault();
                  const lines = text
                    .split(/\r?\n/)
                    .map((l) => l.trim())
                    .filter(Boolean);
                  if (lines.length === 0) return;
                  if (item.label === '') {
                    const [first, ...rest] = lines;
                    onChange(
                      items.map((it, i) =>
                        i === index ? { ...it, label: first! } : it,
                      ),
                    );
                    if (rest.length > 0) {
                      // Baris sisanya disisipkan sesudah baris ini.
                      const room = max - items.length;
                      const added = rest
                        .slice(0, room)
                        .map((label) => ({ label }));
                      onChange([
                        ...items.slice(0, index),
                        { ...item, label: first! },
                        ...added,
                        ...items.slice(index + 1),
                      ]);
                    }
                  } else {
                    insertAfter(index, lines);
                  }
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Naikkan ${noun.toLowerCase()} ${index + 1}`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Turunkan ${noun.toLowerCase()} ${index + 1}`}
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Hapus ${noun.toLowerCase()} ${index + 1}`}
                disabled={items.length <= min}
                onClick={() => remove(index)}
              >
                <X />
              </Button>
              {repeated ? (
                <span role="status" className="sr-only">
                  {noun} ini sama dengan yang lain.
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {duplicate.some((key) => (seen.get(key) ?? 0) > 1) ? (
        <p role="alert" className="text-sm text-danger-dark">
          Ada {noun.toLowerCase()} yang sama. Setiap {noun.toLowerCase()} harus
          berbeda.
        </p>
      ) : null}
      <div>
        <Button
          type="button"
          variant="dark_blue_outline"
          size="sm"
          disabled={items.length >= max}
          onClick={() =>
            insertAfter(items.length - 1, [`${noun} ${items.length + 1}`])
          }
        >
          <Plus /> Tambah {noun.toLowerCase()}
        </Button>
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Editor per jenis
// ---------------------------------------------------------------------------

export function TypeEditor({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (next: Draft) => void;
}) {
  const key = draft.fieldId;
  switch (draft.type) {
    case 'short_text':
    case 'long_text': {
      const c = draft.config;
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberInput
            id={`minlen-${key}`}
            label="Panjang minimal"
            min={0}
            value={c.minLength}
            onChange={(v) => onChange(withConfig(draft, { minLength: v }))}
          />
          <NumberInput
            id={`maxlen-${key}`}
            label="Panjang maksimal"
            min={1}
            value={c.maxLength}
            onChange={(v) => onChange(withConfig(draft, { maxLength: v }))}
          />
          <div className="grid gap-1.5">
            <Label htmlFor={`pattern-${key}`}>Format</Label>
            <Select
              value={c.pattern ?? 'none'}
              onValueChange={(v) =>
                onChange(
                  withConfig(draft, { pattern: v === 'none' ? undefined : v }),
                )
              }
            >
              <SelectTrigger id={`pattern-${key}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PATTERN_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    case 'number':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberInput
            id={`min-${key}`}
            label="Nilai minimal"
            value={draft.config.min}
            onChange={(v) => onChange(withConfig(draft, { min: v }))}
          />
          <NumberInput
            id={`max-${key}`}
            label="Nilai maksimal"
            value={draft.config.max}
            onChange={(v) => onChange(withConfig(draft, { max: v }))}
          />
        </div>
      );

    case 'single_choice':
      return (
        <div className="grid gap-4">
          <div
            role="radiogroup"
            aria-label="Tampilan pilihan"
            className="inline-flex w-fit overflow-hidden rounded-lg border border-neutral-400"
          >
            {(['daftar', 'dropdown'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={draft.config.tampilan === mode}
                onClick={() => onChange(withConfig(draft, { tampilan: mode }))}
                className={cn(
                  'px-4 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400',
                  draft.config.tampilan === mode
                    ? 'bg-primary-400 text-white'
                    : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-200',
                )}
              >
                {mode === 'daftar' ? 'Daftar' : 'Dropdown'}
              </button>
            ))}
          </div>
          <ListEditor
            idPrefix={`opt-${key}`}
            title="Pilihan"
            noun="Pilihan"
            marker="radio"
            min={1}
            max={MAX_OPTIONS_PER_FIELD}
            items={draft.options}
            onChange={(options) => onChange({ ...draft, options })}
          />
        </div>
      );

    case 'multiple_choice':
      return (
        <div className="grid gap-4">
          <ListEditor
            idPrefix={`opt-${key}`}
            title="Pilihan"
            noun="Pilihan"
            marker="checkbox"
            min={1}
            max={MAX_OPTIONS_PER_FIELD}
            items={draft.options}
            onChange={(options) => onChange({ ...draft, options })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput
              id={`minsel-${key}`}
              label="Pilih minimal"
              min={0}
              value={draft.config.minSelections}
              onChange={(v) =>
                onChange(withConfig(draft, { minSelections: v }))
              }
            />
            <NumberInput
              id={`maxsel-${key}`}
              label="Pilih maksimal"
              min={1}
              value={draft.config.maxSelections}
              onChange={(v) =>
                onChange(withConfig(draft, { maxSelections: v }))
              }
            />
          </div>
        </div>
      );

    case 'file': {
      const c = draft.config;
      const set = (patch: Partial<typeof c>) =>
        onChange({ ...draft, config: { ...c, ...patch } });
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`fpre-${key}`}>Jenis berkas</Label>
            <Select
              value={c.preset}
              onValueChange={(v) => set({ preset: v as typeof c.preset })}
            >
              <SelectTrigger id={`fpre-${key}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILE_PRESET_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {FILE_PRESETS[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`fcnt-${key}`}>Jumlah berkas maksimal</Label>
            <Select
              value={String(c.maxFiles)}
              onValueChange={(v) => set({ maxFiles: Number(v) })}
            >
              <SelectTrigger id={`fcnt-${key}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`fsz-${key}`}>
              Ukuran maksimal per berkas (MB)
            </Label>
            <Input
              id={`fsz-${key}`}
              type="number"
              min={1}
              max={FILE_MAX_SIZE_MB}
              value={c.maxSizeMb}
              onChange={(e) =>
                set({
                  maxSizeMb: Math.min(
                    FILE_MAX_SIZE_MB,
                    Math.max(1, Math.floor(Number(e.target.value) || 1)),
                  ),
                })
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`facc-${key}`}>
              Siapa yang bisa membuka tautan
            </Label>
            <Select
              value={c.linkAccess}
              onValueChange={(v) =>
                set({ linkAccess: v as typeof c.linkAccess })
              }
            >
              <SelectTrigger id={`facc-${key}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anyone">
                  Siapa saja yang punya tautan
                </SelectItem>
                <SelectItem value="organization">
                  Hanya akun Institut Teknologi Bandung
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-neutral-700 sm:col-span-2">
            Berkas disimpan di OneDrive pengisi, bukan di Anmategra. Pilih
            &ldquo;Hanya akun Institut Teknologi Bandung&rdquo; untuk berkas
            berisi data pribadi seperti KTM.
          </p>
        </div>
      );
    }

    case 'link':
      return (
        <div className="grid gap-1.5 sm:max-w-sm">
          <Label htmlFor={`btn-${key}`}>Teks tombol (opsional)</Label>
          <Input
            id={`btn-${key}`}
            value={draft.config.buttonLabel ?? ''}
            maxLength={50}
            onChange={(e) =>
              onChange(
                withConfig(draft, { buttonLabel: e.target.value || undefined }),
              )
            }
          />
        </div>
      );

    case 'matrix':
      return (
        <div className="grid gap-4">
          <ListEditor
            idPrefix={`row-${key}`}
            title="Baris"
            noun="Baris"
            min={1}
            max={MATRIX_MAX_ROWS}
            items={draft.config.rows}
            onChange={(rows) =>
              onChange({ ...draft, config: { ...draft.config, rows } })
            }
          />
          <ListEditor
            idPrefix={`col-${key}`}
            title="Kolom"
            noun="Kolom"
            min={2}
            max={MATRIX_MAX_COLUMNS}
            items={draft.config.columns}
            onChange={(columns) =>
              onChange({ ...draft, config: { ...draft.config, columns } })
            }
          />
          <div className="flex items-center gap-2">
            <Switch
              id={`multi-${key}`}
              checked={draft.config.multiple}
              onCheckedChange={(multiple) =>
                onChange({ ...draft, config: { ...draft.config, multiple } })
              }
            />
            <Label htmlFor={`multi-${key}`}>
              Boleh memilih lebih dari satu kolom per baris
            </Label>
          </div>
        </div>
      );

    case 'scale': {
      const c = draft.config;
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`smin-${key}`}>Mulai dari</Label>
            <Select
              value={String(c.min)}
              onValueChange={(v) =>
                onChange({ ...draft, config: { ...c, min: Number(v) } })
              }
            >
              <SelectTrigger id={`smin-${key}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`smax-${key}`}>Sampai</Label>
            <Select
              value={String(c.max)}
              onValueChange={(v) =>
                onChange({ ...draft, config: { ...c, max: Number(v) } })
              }
            >
              <SelectTrigger id={`smax-${key}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`sminl-${key}`}>Label ujung bawah (opsional)</Label>
            <Input
              id={`sminl-${key}`}
              value={c.minLabel ?? ''}
              maxLength={50}
              onChange={(e) =>
                onChange(
                  withConfig(draft, { minLabel: e.target.value || undefined }),
                )
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`smaxl-${key}`}>Label ujung atas (opsional)</Label>
            <Input
              id={`smaxl-${key}`}
              value={c.maxLabel ?? ''}
              maxLength={50}
              onChange={(e) =>
                onChange(
                  withConfig(draft, { maxLabel: e.target.value || undefined }),
                )
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`sdisp-${key}`}>Tampilan</Label>
            <Select
              value={c.tampilan}
              onValueChange={(v) =>
                onChange({
                  ...draft,
                  config: { ...c, tampilan: v as 'angka' | 'bintang' },
                })
              }
            >
              <SelectTrigger id={`sdisp-${key}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="angka">Angka</SelectItem>
                <SelectItem value="bintang">Bintang</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
