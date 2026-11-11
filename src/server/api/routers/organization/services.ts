/**
 * Kode SQLSTATE dari galat basis data. Drizzle (>= 0.44) membungkus galat Postgres
 * dalam `DrizzleQueryError` dan menaruh aslinya di `cause`, jadi `error.code` di
 * puncak kosong; telusuri rantai `cause` (dibatasi, aman dari siklus).
 */
function pgErrorCode(error: unknown): string | undefined {
  let cursor: unknown = error;
  for (let depth = 0; depth < 5 && cursor && typeof cursor === 'object'; depth++) {
    const code = (cursor as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    cursor = (cursor as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Postgres unique_violation: duplikat yang harus tampil ke pemanggil sebagai CONFLICT. */
export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === '23505';
}

/** Postgres foreign_key_violation, mis. menghapus posisi yang masih berpenghuni. */
export function isForeignKeyViolation(error: unknown): boolean {
  return pgErrorCode(error) === '23503';
}
