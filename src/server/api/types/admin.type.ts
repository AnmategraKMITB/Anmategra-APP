import { type InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import {
  roleEnum,
  supportStatusEnum,
  supportUrgentEnum,
  type users,
} from '~/server/db/schema';

export type Admin = InferSelectModel<typeof users>;

/** Bentuk satu baris tabel `user` apa adanya. */
export const UserRowSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  emailVerified: z.date().nullable(),
  image: z.string().nullable(),
  role: z.enum(roleEnum.enumValues),
  created_at: z.date(),
  updated_at: z.date(),
});

/** Bentuk satu baris tabel `verified_user` apa adanya. */
export const VerifiedUserRowSchema = z.object({
  id: z.string(),
  email: z.string(),
});

export const AddVerifiedEmailInputSchema = z.object({ email: z.string() });

/** `.returning()` selalu mengembalikan array, walau hanya satu row yang di-insert. */
export const AddVerifiedEmailOutputSchema = z.array(VerifiedUserRowSchema);

export const DeleteVerifiedEmailInputSchema = z.object({ email: z.string() });

/**
 * Bentuk responsnya memang tidak seragam: kalau email-nya sudah punya akun,
 * yang dikembalikan adalah row `user` yang dihapus; kalau belum, array row
 * `verified_user`; kalau tidak ada dua-duanya, `undefined`.
 */
export const DeleteVerifiedEmailOutputSchema = z
  .union([UserRowSchema, z.array(VerifiedUserRowSchema)])
  .optional();

export const adminSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  // tambahkan field lain sesuai schema admin di database
});

export const GetAllReportsAdminInputSchema = z.object({
  search: z.string().optional(),
  status: z.enum(supportStatusEnum.enumValues).optional(),
});

export const GetAllReportsAdminOutputSchema = z.object({
  reports: z.array(
    z.object({
      id: z.string(),
      subject: z.string(),
      urgent: z.enum(supportUrgentEnum.enumValues),
      description: z.string(),
      status: z.enum(supportStatusEnum.enumValues),
      attachment: z.string().optional(),
      created_at: z.string(),
      updated_at: z.string(),
    }),
  ),
});

export const SetReportStatusInputSchema = z.object({
  id: z.string(),
  status: z.enum(supportStatusEnum.enumValues),
});

export const SetReportStatusOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Alumni CSV upload (H-03): NIM lulusan per batch wisuda. Yang belum
// terdaftar disimpan sebagai pending, otomatis di-apply saat sign-in pertama.
export const UploadAlumniCsvInputSchema = z.object({
  nims: z.array(z.number().int().positive()).min(1),
  wisudaBatch: z.string().optional(),
});

export const UploadAlumniCsvOutputSchema = z.object({
  success: z.boolean(),
  updatedCount: z.number(),
  pendingCount: z.number(),
});
