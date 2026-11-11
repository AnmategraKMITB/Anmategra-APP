'use client';

import { ExternalLink, FileText } from 'lucide-react';

import type { FileAnswerItem } from '~/lib/forms/file-answer';

/**
 * Pratinjau berkas jawaban. Drive punya endpoint `/preview` yang bisa
 * di-embed; berkas dari provider lain hanya bisa ditampilkan bila berupa
 * gambar, sisanya diarahkan ke tab baru.
 */
export function FilePreview({ item }: { item: FileAnswerItem }) {
  const driveId =
    item.provider === 'google-drive' && item.driveId === 'google-drive'
      ? item.itemId
      : null;

  if (driveId) {
    return (
      <iframe
        src={`https://drive.google.com/file/d/${encodeURIComponent(driveId)}/preview`}
        title={`Pratinjau ${item.name}`}
        className="h-[65vh] w-full max-w-full rounded-xl border border-neutral-300"
        allow="autoplay"
      />
    );
  }

  if (item.mime.startsWith('image/')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL dinamis dari penyimpanan berkas.
      <img
        src={item.url}
        alt={item.name}
        className="max-h-[65vh] w-full max-w-full rounded-xl object-contain"
      />
    );
  }

  return (
    <div className="grid place-items-center gap-3 rounded-xl bg-neutral-100 px-6 py-12 text-center">
      <FileText className="size-10 text-neutral-500" aria-hidden />
      <p className="text-sm text-neutral-700">
        Pratinjau tidak tersedia untuk jenis berkas ini.
      </p>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 underline underline-offset-4"
      >
        Buka berkas di tab baru <ExternalLink className="size-4" aria-hidden />
      </a>
    </div>
  );
}
