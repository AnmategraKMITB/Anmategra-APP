import { TRPCError } from '@trpc/server';

/**
 * Aturan Superadmin yang murni (tanpa basis data) agar mudah diuji.
 *
 * Sumber Superadmin ada dua: `SUPERADMIN_EMAILS` (akun darurat, tidak dapat
 * diubah dari panel) dan `users.role = 'admin'` (dikelola lewat panel).
 */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isEmergencySuperadmin(
  email: string | null | undefined,
  emergencyEmails: readonly string[],
): boolean {
  return !!email && emergencyEmails.includes(normalizeEmail(email));
}

/**
 * Jumlah Superadmin yang tersisa bila `excludeEmail` diturunkan. Akun darurat
 * dihitung, dan satu email tidak dihitung ganda.
 */
export function remainingSuperadmins(
  dbAdminEmails: readonly string[],
  emergencyEmails: readonly string[],
  excludeEmail: string,
): number {
  const excluded = normalizeEmail(excludeEmail);
  const all = new Set(
    [...dbAdminEmails, ...emergencyEmails].map(normalizeEmail),
  );
  all.delete(excluded);
  // Akun darurat tetap Superadmin walau namanya yang dikecualikan.
  for (const email of emergencyEmails) all.add(normalizeEmail(email));
  return all.size;
}

/** Konfirmasi tambahan: pengguna harus mengetik ulang email akun sasaran. */
export function assertConfirmEmail(
  typed: string | undefined,
  actual: string,
): void {
  if (!typed || normalizeEmail(typed) !== normalizeEmail(actual)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Ketik ulang email akun dengan benar untuk mengonfirmasi.',
    });
  }
}
