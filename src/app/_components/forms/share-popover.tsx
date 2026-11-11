'use client';

import { Copy, Share2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { Switch } from '~/components/ui/switch';

import { useBuilder } from './builder-context';
import { previewUrl } from './model';

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error('Tidak bisa menyalin otomatis. Salin tautannya secara manual.');
  }
}

/** Tautan pratinjau publik (bisa dimatikan dan dibuat ulang) dan tautan untuk mengisi. */
export function SharePopover() {
  const builder = useBuilder();
  const { detail } = builder;
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [slug, setSlug] = useState(detail?.slug ?? '');
  const [savingSlug, setSavingSlug] = useState(false);
  if (!detail) return null;

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const fillUrl = `${origin}/forms/${detail.slug ?? detail.id}`;
  const preview = detail.previewToken
    ? previewUrl(origin, detail.previewToken)
    : null;

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="dark_blue_outline" aria-label="Share">
            <Share2 /> <span className="hidden sm:inline">Share</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[min(26rem,92vw)] rounded-[20px] p-4"
        >
          <div className="grid gap-4">
            <section className="grid gap-2" aria-labelledby="share-preview">
              <div className="flex items-start gap-3">
                <Switch
                  id="preview-enabled"
                  checked={detail.previewEnabled}
                  onCheckedChange={(enabled) =>
                    void builder.setPreview(enabled)
                  }
                  className="mt-0.5"
                />
                <div>
                  <Label id="share-preview" htmlFor="preview-enabled">
                    Tautan pratinjau publik
                  </Label>
                  <p className="text-sm text-neutral-700">
                    Siapa pun yang punya tautan bisa melihat form ini tanpa
                    login, tetapi tidak bisa mengirim jawaban.
                  </p>
                </div>
              </div>
              {detail.previewEnabled && preview ? (
                <div className="grid gap-2">
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={preview}
                      aria-label="Tautan pratinjau"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button
                      type="button"
                      variant="dark_blue"
                      size="icon"
                      aria-label="Salin tautan pratinjau"
                      onClick={() =>
                        void copy(preview, 'Tautan pratinjau disalin.')
                      }
                    >
                      <Copy />
                    </Button>
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="warning_outline"
                      size="sm"
                      onClick={() => setConfirmRotate(true)}
                    >
                      Buat ulang tautan
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>

            <section
              className="grid gap-2 border-t border-neutral-400 pt-4"
              aria-labelledby="share-fill"
            >
              <h3
                id="share-fill"
                className="text-sm font-semibold text-neutral-1000"
              >
                Tautan untuk mengisi
              </h3>
              <div className="grid gap-2 rounded-xl border border-neutral-400 p-3">
                <Label htmlFor="share-slug">Slug kustom (opsional)</Label>
                <div className="flex items-center gap-1">
                  <span className="shrink-0 text-sm text-neutral-700">/forms/</span>
                  <Input
                    id="share-slug"
                    value={slug}
                    placeholder={detail.id.slice(0, 8)}
                    maxLength={80}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                  />
                  <Button
                    type="button"
                    variant="dark_blue"
                    size="sm"
                    disabled={savingSlug || slug === (detail.slug ?? '')}
                    onClick={async () => {
                      setSavingSlug(true);
                      const done = await builder.saveForm({
                        slug: slug.trim() || null,
                      });
                      setSavingSlug(false);
                      if (done) toast.success('Slug disimpan.');
                    }}
                  >
                    Simpan
                  </Button>
                </div>
                <p className="text-sm text-neutral-700">
                  Huruf kecil, angka, dan tanda hubung. Kosongkan untuk memakai
                  id formulir.
                </p>
              </div>
              {detail.status === 'Published' ? (
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={fillUrl}
                    aria-label="Tautan untuk mengisi"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    type="button"
                    variant="dark_blue"
                    size="icon"
                    aria-label="Salin tautan untuk mengisi"
                    onClick={() => void copy(fillUrl, 'Tautan disalin.')}
                  >
                    <Copy />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-neutral-700">
                  Tautan ini baru bisa dipakai setelah form diterbitkan.
                </p>
              )}
              <p className="text-sm text-neutral-700">
                Pengisi harus login dan berstatus mahasiswa aktif.
              </p>
            </section>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <DialogContent className="rounded-[20px]">
          <DialogHeader>
            <DialogTitle>Buat ulang tautan pratinjau?</DialogTitle>
            <DialogDescription>
              Tautan yang lama langsung berhenti berlaku. Orang yang
              menyimpannya tidak bisa membuka form lagi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="dark_blue_outline"
              onClick={() => setConfirmRotate(false)}
            >
              Batal
            </Button>
            <Button
              variant="warning"
              onClick={async () => {
                setConfirmRotate(false);
                const done = await builder.rotatePreviewToken();
                if (done) toast.success('Tautan pratinjau diganti.');
              }}
            >
              Buat ulang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
