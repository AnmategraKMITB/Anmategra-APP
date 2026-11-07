'use client';

import { Check } from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { Textarea } from '~/components/ui/textarea';
import { cn } from '~/lib/utils';
import type { FormTheme, FormWelcome } from '~/server/api/types/form.type';

import { useBuilder } from './builder-context';
import { ImageUpload } from './image-upload';
import { HEX_COLOR, contrastWithWhite } from './model';

const ACCENTS = [
  { name: 'Lapis lazuli', hex: '#2B6282' },
  { name: 'Verdigris', hex: '#00B7B7' },
  { name: 'Hijau', hex: '#29BC5B' },
  { name: 'Tomat', hex: '#F16350' },
  { name: 'Gunmetal', hex: '#0F222D' },
];
const BACKGROUNDS = [
  { name: 'Putih', hex: '#FFFFFF' },
  { name: 'Abu terang', hex: '#FAFAFA' },
  { name: 'Biru muda', hex: '#EAEFF2' },
  { name: 'Toska muda', hex: '#E6F8F8' },
  { name: 'Krem', hex: '#FEFAF0' },
];
const FONTS: { value: NonNullable<FormTheme['font']>; label: string }[] = [
  { value: 'sans', label: 'Sans (bawaan)' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
];

function ColorPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: { name: string; hex: string }[];
  onChange: (hex: string | undefined) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold text-neutral-1000">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = value?.toLowerCase() === o.hex.toLowerCase();
          return (
            <button
              key={o.hex}
              type="button"
              aria-label={`${label}: ${o.name}`}
              aria-pressed={selected}
              onClick={() => onChange(o.hex)}
              style={{ backgroundColor: o.hex }}
              className={cn(
                'flex size-9 items-center justify-center rounded-full border border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
                selected && 'ring-2 ring-primary-400 ring-offset-2',
              )}
            >
              {selected ? (
                <Check
                  className={cn(
                    'size-4',
                    contrastWithWhite(o.hex) >= 3
                      ? 'text-white'
                      : 'text-neutral-1000',
                  )}
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input
          key={value ?? 'kosong'}
          defaultValue={value ?? ''}
          placeholder="#RRGGBB"
          aria-label={`${label}, kode warna`}
          maxLength={7}
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            if (v === '') return onChange(undefined);
            if (HEX_COLOR.test(v)) return onChange(v.toUpperCase());
            e.currentTarget.value = value ?? '';
          }}
        />
        {value ? (
          <Button
            type="button"
            variant="dark_blue_outline"
            onClick={() => onChange(undefined)}
          >
            Setel ulang
          </Button>
        ) : null}
      </div>
    </fieldset>
  );
}

export function DesignSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const builder = useBuilder();
  const { detail } = builder;
  if (!detail) return null;

  const saveTheme = (patch: Partial<FormTheme>) =>
    void builder.saveTheme(patch);
  // Kolom yang dikosongkan dibuang dari blok sambutan.
  const saveWelcome = (patch: Partial<FormWelcome>) =>
    void builder.saveWelcome(
      Object.fromEntries(
        Object.entries(patch).map(([k, v]) => [k, v === '' ? undefined : v]),
      ) as Partial<FormWelcome>,
    );

  const accent = detail.theme.accent;
  const ratio = accent ? contrastWithWhite(accent) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Desain form</SheetTitle>
          <SheetDescription>
            Warna, huruf, dan layar sambutan. Lihat hasilnya di tab Pratinjau.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-6">
          <ColorPicker
            label="Warna utama"
            value={accent}
            options={ACCENTS}
            onChange={(accentValue) => saveTheme({ accent: accentValue })}
          />
          {ratio !== null && ratio < 4.5 ? (
            <p
              role="alert"
              className="rounded-xl border border-saffron bg-warning-light px-3 py-2 text-sm text-neutral-1000"
            >
              Teks putih di atas warna ini kurang terbaca (rasio{' '}
              {ratio.toFixed(1)}:1, minimal 4,5:1). Pilih warna yang lebih
              gelap.
            </p>
          ) : null}
          <ColorPicker
            label="Warna latar"
            value={detail.theme.bg}
            options={BACKGROUNDS}
            onChange={(bg) => saveTheme({ bg })}
          />

          <div className="grid gap-1.5">
            <Label htmlFor="theme-font">Huruf</Label>
            <Select
              value={detail.theme.font ?? 'sans'}
              onValueChange={(v) =>
                saveTheme({ font: v as NonNullable<FormTheme['font']> })
              }
            >
              <SelectTrigger id="theme-font">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONTS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ImageUpload
            formId={detail.id}
            label="Banner"
            url={detail.theme.banner}
            onUploaded={({ url }) => saveTheme({ banner: url })}
            onRemove={() => saveTheme({ banner: null })}
          />
          <ImageUpload
            formId={detail.id}
            label="Logo"
            url={detail.theme.logo}
            onUploaded={({ url }) => saveTheme({ logo: url })}
            onRemove={() => saveTheme({ logo: null })}
          />

          <section className="grid gap-3" aria-labelledby="welcome-title">
            <h3
              id="welcome-title"
              className="text-sm font-semibold text-neutral-1000"
            >
              Layar sambutan
            </h3>
            <p className="-mt-2 text-sm text-neutral-700">
              Tampil sebelum pertanyaan pertama. Kosongkan untuk melewatinya.
            </p>
            <div className="grid gap-1.5">
              <Label htmlFor="welcome-judul">Judul</Label>
              <Input
                key={detail.welcome.title ?? ''}
                id="welcome-judul"
                defaultValue={detail.welcome.title ?? ''}
                maxLength={200}
                onBlur={(e) =>
                  e.currentTarget.value !== (detail.welcome.title ?? '') &&
                  saveWelcome({ title: e.currentTarget.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="welcome-isi">Isi</Label>
              <Textarea
                key={detail.welcome.description ?? ''}
                id="welcome-isi"
                rows={3}
                defaultValue={detail.welcome.description ?? ''}
                maxLength={2000}
                onBlur={(e) =>
                  e.currentTarget.value !==
                    (detail.welcome.description ?? '') &&
                  saveWelcome({ description: e.currentTarget.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="welcome-tombol">Teks tombol mulai</Label>
              <Input
                key={detail.welcome.buttonLabel ?? ''}
                id="welcome-tombol"
                defaultValue={detail.welcome.buttonLabel ?? ''}
                maxLength={50}
                placeholder="Mulai"
                onBlur={(e) =>
                  e.currentTarget.value !==
                    (detail.welcome.buttonLabel ?? '') &&
                  saveWelcome({ buttonLabel: e.currentTarget.value })
                }
              />
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
