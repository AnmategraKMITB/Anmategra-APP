import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(255);

export const SuperadminAddInputSchema = z.object({
  /** Email, NIM, atau id akun yang akan dijadikan Superadmin. */
  identifier: z.string().trim().min(1).max(255),
  /** Email akun sasaran, diketik ulang sebagai konfirmasi. */
  confirmEmail: z.string().trim().min(1).max(255),
});

export const SuperadminRemoveInputSchema = z.object({
  userId: z.string().min(1),
  confirmEmail: z.string().trim().min(1).max(255),
});

export const AdminLembagaCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.enum([
    'Himpunan',
    'UKM',
    'Kepanitiaan',
    'BSO',
    'Badan',
    'Pusat',
    'Organisasi',
  ]),
  acronym: z.string().trim().max(50).optional(),
  parentId: z.string().min(1).nullable().optional(),
  /** Email Google resmi Owner; dipakai untuk masuk dan didaftarkan terverifikasi. */
  email,
});

export const VerifiedEmailAddInputSchema = z.object({ email });
export const VerifiedEmailRemoveInputSchema = z.object({ email });
