'use client';

import { Eye, Paperclip, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  type FileAnswerItem,
  fileRuleProblem,
  isFileAnswerList,
  mimeFromName,
} from '~/lib/forms/file-answer';
import { FILE_PRESETS } from '~/server/api/types/form.constants';

import { FilePreview } from './file-preview';
import type { RendererField } from './form-validate';
import { useFormFileUpload } from './use-file-upload';

export type UploadContext = {
  /** Pratinjau: tombol unggah dinonaktifkan. */
  enabled: boolean;
  /** Form yang sedang diisi; dipakai route UploadThing untuk otorisasi. */
  formId?: string;
  /** Nama folder lama; tidak dipakai oleh UploadThing. */
  folder?: string;
  closesAt?: Date | null;
};

const fmt = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Jawaban berkas via UploadThing (public-read) atau Google Drive pengisi
 * (aplikasi hanya menyimpan tautan; akses dibuka otomatis).
 */
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
  const [problem, setProblem] = useState<string | null>(null);
  const [preview, setPreview] = useState<FileAnswerItem | null>(null);
  /**
   * Berkas yang diunggah pada sesi ini dan belum pernah tersimpan. Hanya
   * berkas ini yang aman dihapus dari Drive saat tombol hapus ditekan; berkas
   * dari jawaban lama tidak boleh dihapus karena pengisi bisa membatalkan
   * perubahan.
   */
  const fresh = useRef<Set<string>>(new Set());
  const files: FileAnswerItem[] = isFileAnswerList(value) ? value : [];
  const c = field.config;
  const preset = FILE_PRESETS[c.preset ?? 'pdf'];
  const max = c.maxFiles ?? 1;
  const formId = upload?.formId;
  const {
    upload: uploadFile,
    providerId,
    providerLabel,
    remove,
    needsConnect,
    isConnected,
    prepare,
    connect,
  } = useFormFileUpload();
  const configured = Boolean(formId);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(isConnected);

  // Muat skrip Google sedini mungkin supaya popup izin bisa dibuka langsung
  // dari klik tanpa menunggu unduhan skrip.
  useEffect(() => {
    prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Dipanggil langsung dari klik: popup izin Google hanya lolos dari sini. */
  const connectNow = () => {
    setProblem(null);
    setConnecting(true);
    connect()
      .then(() => setConnected(true))
      .catch((error: unknown) =>
        setProblem(
          error instanceof Error
            ? error.message
            : 'Belum bisa terhubung ke Google Drive. Coba lagi.',
        ),
      )
      .finally(() => setConnecting(false));
  };

  const pick = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file || !upload?.enabled || !formId) return;
    setProblem(null);
    const mime = file.type || mimeFromName(file.name);

    // Periksa aturan yang sama di klien sebelum memakai kuota UploadThing.
    const early = fileRuleProblem(
      [
        {
          itemId: '-',
          driveId: 'uploadthing',
          name: file.name,
          size: file.size,
          mime,
          url: 'https://x.ufs.sh/',
          scope: 'anyone',
        },
      ],
      { ...c, maxFiles: 1 },
    );
    if (early) return setProblem(early);

    setBusy(true);
    try {
      const saved = await uploadFile(file, {
        formId,
        fieldId: field.id,
        folder: upload.folder,
      });
      const late = fileRuleProblem([saved], { ...c, maxFiles: 1 });
      if (late) {
        setProblem(late);
        return;
      }
      onChange([...files, saved]);
      fresh.current.add(saved.itemId);
    } catch (error) {
      setProblem(
        error instanceof Error
          ? error.message
          : 'Berkas belum bisa diunggah. Coba lagi.',
      );
    } finally {
      setBusy(false);
      setConnected(isConnected());
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="grid min-w-0 gap-2">
      <ul className="grid min-w-0 gap-1.5">
        {files.map((f) => (
          <li
            key={f.itemId}
            className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-neutral-100 px-3 py-2 text-sm"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              aria-label={`Pratinjau ${f.name}`}
              onClick={() => setPreview(f)}
            >
              <Paperclip className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{f.name}</span>
              <span className="shrink-0 text-neutral-700">({fmt(f.size)})</span>
            </button>
            <span className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label={`Pratinjau ${f.name}`}
                className="text-neutral-700 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                onClick={() => setPreview(f)}
              >
                <Eye className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Hapus ${f.name}`}
                className="text-neutral-700 hover:text-danger-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                onClick={() => {
                  // Referensi dilepas segera agar UI responsif; objek di
                  // penyimpanan hanya dihapus untuk berkas sesi ini.
                  onChange(files.filter((x) => x.itemId !== f.itemId));
                  if (fresh.current.delete(f.itemId)) void remove(f);
                }}
              >
                <X className="size-4" />
              </button>
            </span>
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
            disabled={!upload?.enabled || !configured || busy || connecting}
            onChange={(e) => void pick(e.target.files)}
          />
          <Button
            type="button"
            variant="dark_blue_outline"
            disabled={!upload?.enabled || !configured || busy || connecting}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            onClick={() => {
              // Google Drive: izin diminta di klik ini, bukan setelah berkas
              // dipilih, karena browser HP memblokir popup dari `onChange`.
              if (needsConnect && !isConnected()) return connectNow();
              input.current?.click();
            }}
          >
            <Paperclip />{' '}
            {connecting
              ? 'Menghubungkan…'
              : busy
                ? 'Mengunggah…'
                : needsConnect && !connected
                  ? 'Hubungkan Google Drive'
                  : 'Pilih berkas'}
          </Button>
        </div>
      ) : null}
      <p className="text-sm text-neutral-700">
        {preset.label}, maksimal {max} berkas, {c.maxSizeMb ?? 10} MB per
        berkas.{' '}
        {providerId === 'google-drive'
          ? 'Berkas yang kamu unggah di sini akan otomatis tersimpan di Google Drive dari akun yang kamu pilih, dengan akses “Siapa saja yang memiliki link” (Viewer).'
          : `Berkas diunggah ke ${providerLabel}.`}
      </p>
      {!upload?.enabled ? (
        <p className="text-sm text-neutral-700">
          Pratinjau: unggah tidak aktif.
        </p>
      ) : !configured ? (
        <p role="alert" className="text-sm text-danger-dark">
          Form belum siap untuk unggah berkas.
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-sm text-danger-dark">
          {problem}
        </p>
      ) : null}

      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-3xl min-w-0 rounded-[20px] [grid-template-columns:minmax(0,1fr)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{preview?.name}</DialogTitle>
            <DialogDescription>
              Pratinjau berkas yang kamu unggah.
            </DialogDescription>
          </DialogHeader>
          {preview ? <FilePreview item={preview} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
