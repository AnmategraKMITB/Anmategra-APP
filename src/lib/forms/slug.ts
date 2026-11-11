/**
 * Stub publik formulir: `/forms/<slug>`. Huruf kecil, angka, dan tanda hubung.
 * Slug tidak boleh bentrok dengan jalur yang sudah dipakai aplikasi.
 */
export const FORM_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
