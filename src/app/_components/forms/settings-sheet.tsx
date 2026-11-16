'use client';

import { DATETIME_MAX, DATETIME_MIN, isValidDateInput } from '~/lib/date-input';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { Switch } from '~/components/ui/switch';
import { Textarea } from '~/components/ui/textarea';
import type { FormSettings } from '~/server/api/types/form.type';

import { useBuilder } from './builder-context';

const TOGGLES: {
  key: keyof Omit<FormSettings, 'closedMessage'>;
  label: string;
  hint: string;
}[] = [
  {
    key: 'showNumbers',
    label: 'Tampilkan nomor pertanyaan',
    hint: 'Nomor 1, 2, 3 di samping tiap pertanyaan.',
  },
  {
    key: 'showProgress',
    label: 'Tampilkan bilah kemajuan',
    hint: 'Menunjukkan sudah sampai bagian ke berapa.',
  },
  {
    key: 'shuffleOptions',
    label: 'Acak urutan pilihan',
    hint: 'Urutan pilihan berbeda untuk tiap pengisi.',
  },
  {
    key: 'reviewBeforeSubmit',
    label: 'Tinjau jawaban sebelum mengirim',
    hint: 'Satu halaman ringkasan sebelum tombol kirim.',
  },
  {
    key: 'confirmOnLeave',
    label: 'Minta konfirmasi saat meninggalkan halaman',
    hint: 'Mencegah jawaban hilang karena tidak sengaja.',
  },
  {
    key: 'autosaveDraft',
    label: 'Simpan draf jawaban di browser pengisi',
    hint: 'Jawaban yang belum dikirim tetap ada saat halaman dibuka lagi.',
  },
  {
    key: 'requiredByDefault',
    label: 'Pertanyaan baru wajib diisi',
    hint: 'Berlaku untuk pertanyaan yang ditambahkan sesudahnya.',
  },
];

/** Waktu lokal untuk <input type="datetime-local">. */
function toLocalInput(date: Date | null): string {
  if (!date) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const builder = useBuilder();
  const { detail } = builder;
  if (!detail) return null;

  const saveSettings = (patch: Partial<FormSettings>) =>
    builder.saveSettings(patch);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Pengaturan form</SheetTitle>
          <SheetDescription>Perubahan tersimpan otomatis.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-6">
          <section className="grid gap-3" aria-labelledby="set-akses">
            <h3
              id="set-akses"
              className="text-sm font-semibold text-neutral-1000"
            >
              Pengisian
            </h3>
            <div className="grid gap-1.5">
              <Label htmlFor="closes-at">Tenggat (opsional)</Label>
              <div className="flex gap-2">
                <Input
                  key={String(detail.closesAt)}
                  id="closes-at"
                  type="datetime-local"
                  min={DATETIME_MIN}
                  max={DATETIME_MAX}
                  defaultValue={toLocalInput(detail.closesAt)}
                  onBlur={(e) => {
                    const value = e.currentTarget.value;
                    if (!isValidDateInput(value)) return;
                    const next = value ? new Date(value) : null;
                    if (
                      (next?.getTime() ?? null) !==
                      (detail.closesAt?.getTime() ?? null)
                    ) {
                      void builder.saveForm({ closesAt: next });
                    }
                  }}
                />
                {detail.closesAt ? (
                  <Button
                    type="button"
                    variant="dark_blue_outline"
                    onClick={() => void builder.saveForm({ closesAt: null })}
                  >
                    Hapus
                  </Button>
                ) : null}
              </div>
              <p className="text-sm text-neutral-700">
                Setelah tenggat, form tidak menerima jawaban lagi.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Switch
                id="one-per-account"
                checked={!detail.allowMultipleSubmissions}
                onCheckedChange={(one) =>
                  void builder.saveForm({
                    allowMultipleSubmissions: !one,
                    // Form banyak-respons tidak mendukung pengubahan jawaban.
                    ...(one ? {} : { allowEditAfterSubmit: false }),
                  })
                }
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="one-per-account">Satu respons per akun</Label>
                <p className="text-sm text-neutral-700">
                  Bila dimatikan, satu akun boleh mengirim lebih dari satu kali.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Switch
                id="edit-after-submit"
                checked={detail.allowEditAfterSubmit}
                disabled={detail.allowMultipleSubmissions}
                onCheckedChange={(value) =>
                  void builder.saveForm({ allowEditAfterSubmit: value })
                }
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="edit-after-submit">
                  Izinkan pengisi mengubah jawaban
                </Label>
                <p className="text-sm text-neutral-700">
                  Hanya untuk form satu respons dan selama form masih menerima
                  jawaban.
                </p>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="max-responses">
                Batas jumlah respons (opsional)
              </Label>
              <div className="flex gap-2">
                <Input
                  key={String(detail.maxResponses)}
                  id="max-responses"
                  type="number"
                  min={1}
                  defaultValue={detail.maxResponses ?? ''}
                  placeholder="Tanpa batas"
                  onBlur={(e) => {
                    const raw = e.currentTarget.value.trim();
                    const next = raw === '' ? null : Number(raw);
                    if (
                      next !== null &&
                      (!Number.isInteger(next) || next < 1)
                    ) {
                      return;
                    }
                    if (next !== detail.maxResponses) {
                      void builder.saveForm({ maxResponses: next });
                    }
                  }}
                />
                {detail.maxResponses !== null ? (
                  <Button
                    type="button"
                    variant="dark_blue_outline"
                    onClick={() =>
                      void builder.saveForm({ maxResponses: null })
                    }
                  >
                    Hapus
                  </Button>
                ) : null}
              </div>
              <p className="text-sm text-neutral-700">
                Setelah batas tercapai, form berhenti menerima jawaban baru.
                Saat ini {detail.submissionCount} respons.
              </p>
            </div>
          </section>

          <section className="grid gap-3" aria-labelledby="set-tampilan">
            <h3
              id="set-tampilan"
              className="text-sm font-semibold text-neutral-1000"
            >
              Tampilan untuk pengisi
            </h3>
            {TOGGLES.map(({ key, label, hint }) => (
              <div key={key} className="flex items-start gap-3">
                <Switch
                  id={`set-${key}`}
                  checked={detail.settings[key]}
                  onCheckedChange={(value) =>
                    void saveSettings({ [key]: value })
                  }
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor={`set-${key}`}>{label}</Label>
                  <p className="text-sm text-neutral-700">{hint}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="grid gap-1.5" aria-labelledby="set-tutup">
            <h3
              id="set-tutup"
              className="text-sm font-semibold text-neutral-1000"
            >
              Pesan saat form tidak menerima jawaban
            </h3>
            <Textarea
              key={detail.settings.closedMessage}
              defaultValue={detail.settings.closedMessage}
              rows={3}
              maxLength={500}
              aria-labelledby="set-tutup"
              placeholder="Misalnya: Pendaftaran sudah ditutup. Terima kasih."
              onBlur={(e) => {
                if (e.currentTarget.value !== detail.settings.closedMessage) {
                  void saveSettings({ closedMessage: e.currentTarget.value });
                }
              }}
            />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
