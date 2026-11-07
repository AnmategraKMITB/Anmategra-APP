'use client';

import { Paperclip, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { env } from '~/env';
import {
  type FileAnswerItem,
  fileRuleProblem,
  isFileAnswerList,
  mimeFromName,
} from '~/lib/forms/file-answer';
import {
  connectOneDrive,
  hasOneDriveAccount,
  prepareOneDrive,
  uploadToOneDrive,
} from '~/lib/forms/onedrive';
import { FILE_PRESETS } from '~/server/api/types/form.constants';

import type { RendererField } from './form-validate';

export type UploadContext = {
  /** Pratinjau: tombol unggah dinonaktifkan. */
  enabled: boolean;
  /** Nama folder di OneDrive pengisi. */
  folder: string;
  closesAt: Date | null;
};

const fmt = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Jawaban berkas: unggah ke OneDrive pengisi, lalu simpan tautannya. */
export function FileInput({
  field,
  value,
  onChange,
  upload,
  invalid,
  describedBy,
}: {
  field: RendererField;
  value: unknown;
  onChange: (value: unknown) => void;
  upload?: UploadContext;
  invalid?: boolean;
  describedBy?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(hasOneDriveAccount);
  const [problem, setProblem] = useState<string | null>(null);
  const files: FileAnswerItem[] = isFileAnswerList(value) ? value : [];
  const c = field.config;
  const preset = FILE_PRESETS[c.preset ?? 'pdf'];
  const max = c.maxFiles ?? 1;
  const clientId = env.NEXT_PUBLIC_AZURE_CLIENT_ID;
  const tenantId = env.NEXT_PUBLIC_AZURE_TENANT_ID;
  const configured = !!clientId && !!tenantId;

  // Siapkan MSAL saat komponen dipasang, supaya popup bisa dibuka langsung dari
  // klik tanpa menunggu inisialisasi (kalau tidak, browser memblokirnya).
  useEffect(() => {
    if (!clientId || !tenantId) return;
    void prepareOneDrive({ clientId, tenantId }).catch(() => undefined);
  }, [clientId, tenantId]);

  const connect = async () => {
    if (!clientId || !tenantId) return;
    setProblem(null);
    setBusy(true);
    try {
      await connectOneDrive({ clientId, tenantId });
      setConnected(hasOneDriveAccount());
    } catch (error) {
      setProblem(
        error instanceof Error
          ? error.message
          : 'Belum bisa masuk ke OneDrive. Coba lagi.',
      );
    } finally {
      // Dialog berkas sengaja dibuka oleh klik berikutnya: membukanya lewat
      // timer setelah popup ditutup berada di luar aktivasi pengguna dan
      // diblokir Firefox/Safari.
      setBusy(false);
    }
  };

  const pick = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file || !upload?.enabled || !clientId || !tenantId) return;
    setProblem(null);
    const access = c.linkAccess ?? 'anyone';
    // Periksa dulu di klien dengan aturan yang sama dengan server. `file.type`
    // bisa kosong untuk .docx/.zip, jadi pakai ekstensi sebagai cadangan.
    const mime = file.type || mimeFromName(file.name);
    const early = fileRuleProblem(
      [
        {
          itemId: '-',
          driveId: '-',
          name: file.name,
          size: file.size,
          mime,
          url: 'https://x.sharepoint.com/',
          scope: access,
        },
      ],
      { ...c, maxFiles: 1 },
    );
    if (early) return setProblem(early);
    setBusy(true);
    try {
      const saved = await uploadToOneDrive({
        config: { clientId, tenantId },
        file,
        folder: upload.folder,
        access,
        closesAt: upload.closesAt,
      });
      // MIME dari Graph bisa berbeda dari tebakan klien; periksa lagi sebelum
      // jawaban disimpan supaya tidak baru gagal saat form dikirim.
      const late = fileRuleProblem(
        [
          {
            ...saved,
            mime: saved.mime || mimeFromName(saved.name),
          },
        ],
        { ...c, maxFiles: 1 },
      );
      if (late) {
        setProblem(late);
        return;
      }
      onChange([...files, saved]);
    } catch (error) {
      setConnected(hasOneDriveAccount());
      setProblem(
        error instanceof Error
          ? error.message
          : 'Berkas belum bisa diunggah. Coba lagi.',
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="grid gap-2">
      <ul className="grid gap-1.5">
        {files.map((f) => (
          <li
            key={f.itemId}
            className="flex items-center justify-between gap-2 rounded-xl bg-neutral-100 px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate">
              <Paperclip className="mr-1.5 inline size-4" aria-hidden />
              {f.name} <span className="text-neutral-700">({fmt(f.size)})</span>
            </span>
            <button
              type="button"
              aria-label={`Hapus ${f.name}`}
              className="shrink-0 text-neutral-700 hover:text-danger-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              onClick={() =>
                onChange(files.filter((x) => x.itemId !== f.itemId))
              }
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {files.length < max ? (
        <div>
          <input
            ref={input}
            id={`fill-${field.id}`}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            accept={preset.mimes.join(',')}
            disabled={!upload?.enabled || !configured || busy}
            onChange={(e) => void pick(e.target.files)}
          />
          <Button
            type="button"
            variant="dark_blue_outline"
            disabled={!upload?.enabled || !configured || busy}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            onClick={() =>
              hasOneDriveAccount() ? input.current?.click() : void connect()
            }
          >
            <Paperclip />{' '}
            {busy
              ? connected
                ? 'Mengunggah…'
                : 'Menghubungkan…'
              : connected || hasOneDriveAccount()
                ? 'Pilih berkas'
                : 'Hubungkan OneDrive'}
          </Button>
        </div>
      ) : null}
      <p className="text-sm text-neutral-700">
        {preset.label}, maksimal {max} berkas, {c.maxSizeMb ?? 10} MB per
        berkas. Berkas diunggah ke OneDrive-mu dan hanya tautannya yang dikirim;
        hubungkan OneDrive sekali di awal.
        {connected ? ' OneDrive sudah terhubung, klik Pilih berkas.' : ''}
      </p>
      {!upload?.enabled ? (
        <p className="text-sm text-neutral-700">
          Pratinjau: unggah tidak aktif.
        </p>
      ) : !configured ? (
        <p role="alert" className="text-sm text-danger-dark">
          Unggah berkas belum dikonfigurasi di server ini.
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-sm text-danger-dark">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
