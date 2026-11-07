import {
  FILE_PRESETS,
  type FilePreset,
  isAllowedFileHost,
} from '~/server/api/types/form.constants';

export type FileAnswerItem = {
  itemId: string;
  driveId: string;
  name: string;
  size: number;
  mime: string;
  url: string;
  eTag?: string;
  scope: 'anyone' | 'organization';
};

/**
 * Browser sering melaporkan `file.type` kosong untuk `.docx` atau `.zip`
 * (terutama di Linux dan Windows), padahal berkasnya sah. Tentukan MIME dari
 * ekstensi sebagai cadangan supaya pemeriksaan awal tidak menolak berkas baik.
 */
const EXTENSION_MIMES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
};

export function mimeFromName(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MIMES[extension] ?? '';
}

export type FileRuleConfig = {
  preset?: FilePreset;
  maxFiles?: number;
  maxSizeMb?: number;
  linkAccess?: 'anyone' | 'organization';
};

/**
 * Aturan jawaban berkas terhadap config pertanyaan; dipakai server dan klien
 * supaya keduanya sepakat. Mengembalikan pesan masalah pertama, atau `null`.
 * Isi berkas tidak bisa diperiksa di sini (hanya metadata dari klien).
 */
export function fileRuleProblem(
  files: FileAnswerItem[],
  config: FileRuleConfig,
): string | null {
  const preset = FILE_PRESETS[config.preset ?? 'pdf'];
  const maxFiles = config.maxFiles ?? 1;
  const maxSizeMb = config.maxSizeMb ?? 10;
  if (files.length > maxFiles) return `Maksimal ${maxFiles} berkas.`;
  if (files.some((f) => !isAllowedFileHost(f.url))) {
    return 'Tautan berkas harus berasal dari OneDrive atau SharePoint.';
  }
  if (files.some((f) => f.size > maxSizeMb * 1024 * 1024)) {
    return `Ukuran berkas maksimal ${maxSizeMb} MB.`;
  }
  if (
    files.some((f) => !(preset.mimes as readonly string[]).includes(f.mime))
  ) {
    return `Jenis berkas harus ${preset.label}.`;
  }
  if (
    (config.linkAccess ?? 'anyone') === 'organization' &&
    files.some((f) => f.scope === 'anyone')
  ) {
    return 'Tautan berkas harus dibatasi untuk organisasi.';
  }
  return null;
}

/** Pemeriksaan bentuk longgar di klien; server memakai zod yang ketat. */
export function isFileAnswerList(value: unknown): value is FileAnswerItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (f) =>
        typeof f === 'object' &&
        f !== null &&
        typeof (f as FileAnswerItem).itemId === 'string' &&
        typeof (f as FileAnswerItem).url === 'string' &&
        typeof (f as FileAnswerItem).name === 'string' &&
        typeof (f as FileAnswerItem).size === 'number' &&
        typeof (f as FileAnswerItem).mime === 'string',
    )
  );
}
