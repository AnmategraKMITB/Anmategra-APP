/**
 * Konstanta Forms yang dipakai server dan browser. Berkas ini tidak boleh
 * mengimpor apa pun dari skema database.
 */

export const SHORT_TEXT_MAX_LENGTH = 500;
export const LONG_TEXT_MAX_LENGTH = 5000;
export const MAX_FIELDS_PER_FORM = 500;
export const MAX_OPTIONS_PER_FIELD = 100;
export const MAX_SECTIONS_PER_FORM = 50;
export const LINK_MAX_LENGTH = 2048;
export const MATRIX_MAX_ROWS = 30;
export const MATRIX_MAX_COLUMNS = 10;

/**
 * Format teks yang bisa dipilih pembuat formulir.
 *
 * Sengaja preset, bukan regex bebas. Pola milik pembuat formulir dieksekusi di
 * server setiap kali orang lain mengisi formulir, dan pola seperti `(a+)+b`
 * membuat satu jawaban pendek memakan CPU secara eksponensial (ReDoS) sampai
 * seluruh proses Node ikut macet; batas panjang teks tidak menolong. Semua
 * pola di bawah linear dan di-compile sekali di modul ini, bukan tiap jawaban.
 */
export const TEXT_PATTERN_PRESETS = ['email', 'nomor_hp', 'nim'] as const;

export type TextPatternPreset = (typeof TEXT_PATTERN_PRESETS)[number];

export const TEXT_PATTERN_RULES: Record<
  TextPatternPreset,
  { regex: RegExp; description: string }
> = {
  email: {
    regex: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u,
    description: 'alamat email yang valid',
  },
  nomor_hp: {
    regex: /^(?:\+62|62|0)8\d{7,11}$/u,
    description: 'nomor HP Indonesia, contoh 081234567890',
  },
  nim: {
    regex: /^\d{8}$/u,
    description: 'NIM 8 digit angka',
  },
};

export const FILE_PRESETS = {
  pdf: { label: 'PDF', mimes: ['application/pdf'] },
  office: {
    label: 'Dokumen Office',
    mimes: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  },
  zip: {
    label: 'ZIP',
    mimes: ['application/zip', 'application/x-zip-compressed'],
  },
  gambar: {
    label: 'Gambar (JPG, PNG, WebP)',
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
  },
} as const;
export type FilePreset = keyof typeof FILE_PRESETS;
export const FILE_PRESET_KEYS = ['pdf', 'office', 'zip', 'gambar'] as const;
export const FILE_MAX_FILES = 5;
export const FILE_MAX_SIZE_MB = 16;

/** Tautan berkas boleh dari OneDrive/SharePoint (data lama) atau UploadThing. */
export function isAllowedFileHost(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return (
      host.endsWith('.sharepoint.com') ||
      host === '1drv.ms' ||
      host === 'onedrive.live.com' ||
      host === 'utfs.io' ||
      host.endsWith('.ufs.sh') ||
      host === 'drive.google.com' ||
      host === 'docs.google.com'
    );
  } catch {
    return false;
  }
}

/** Gambar dekoratif hanya boleh dari penyimpanan UploadThing. */
export function isAllowedImageHost(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return host === 'utfs.io' || host.endsWith('.ufs.sh');
  } catch {
    return false;
  }
}
