/**
 * Stub publik formulir: `/forms/<slug>` (alias singkat `/f/<slug>`). Huruf,
 * angka, dan tanda hubung. Huruf besar dan kecil dibedakan, jadi `Form` dan
 * `form` adalah dua slug yang berbeda.
 * Slug tidak boleh bentrok dengan jalur yang sudah dipakai aplikasi.
 */
export const FORM_SLUG_RE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;

export const RESERVED_FORM_SLUGS = new Set([
  'admin',
  'api',
  'authentication',
  'auth',
  'forms',
  'lembaga',
  'login',
  'mahasiswa',
  'manual',
  'preview',
]);

export function isReservedFormSlug(value: string): boolean {
  return RESERVED_FORM_SLUGS.has(value);
}
