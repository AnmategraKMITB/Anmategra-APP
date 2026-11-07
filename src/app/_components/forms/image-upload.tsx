'use client';

import { ImagePlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { useUploadThing } from '~/utils/uploadthing';

export type UploadedImage = { url: string; key: string; alt?: string | null };

/**
 * Unggah satu gambar dekoratif (PNG, JPEG, atau WEBP, maks. 4 MB). `value`
 * kosong = belum ada gambar. Teks alternatif hanya ditampilkan bila
 * `onAlt` diberikan.
 */
export function ImageUpload({
  formId,
  label,
  url,
  alt,
  onUploaded,
  onRemove,
  onAlt,
}: {
  formId: string;
  label: string;
  url: string | null | undefined;
  alt?: string | null;
  onUploaded: (image: { url: string; key: string }) => void;
  onRemove: () => void;
  onAlt?: (alt: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const { startUpload } = useUploadThing('formImage', {
    onClientUploadComplete: (res) => {
      const first = res[0]?.serverData;
      if (first) onUploaded({ url: first.url, key: first.key });
      setBusy(false);
    },
    onUploadError: (error) => {
      toast.error(error.message || 'Gambar belum bisa diunggah.');
      setBusy(false);
    },
  });

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt ?? ''}
          className="max-h-40 w-full rounded-xl border border-neutral-400 object-cover"
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="dark_blue_outline"
          size="sm"
          disabled={busy}
          asChild
        >
          <label className="cursor-pointer">
            <ImagePlus />{' '}
            {busy ? 'Mengunggah…' : url ? 'Ganti gambar' : 'Pilih gambar'}
            <input
              type="file"
              className="sr-only"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setBusy(true);
                void startUpload([file], { formId });
              }}
            />
          </label>
        </Button>
        {url ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-danger-dark hover:text-danger-dark"
            onClick={onRemove}
          >
            <Trash2 /> Hapus
          </Button>
        ) : null}
      </div>
      {url && onAlt ? (
        <Input
          key={alt ?? ''}
          aria-label={`Teks alternatif ${label}`}
          placeholder="Teks alternatif (jelaskan gambar untuk pembaca layar)"
          defaultValue={alt ?? ''}
          maxLength={255}
          onBlur={(e) =>
            e.currentTarget.value !== (alt ?? '') &&
            onAlt(e.currentTarget.value)
          }
        />
      ) : null}
      <p className="text-sm text-neutral-700">
        Hanya hiasan: PNG, JPEG, atau WEBP, maksimal 4 MB.
      </p>
    </div>
  );
}
