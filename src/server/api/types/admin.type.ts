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
  // NIM ITB 8 digit; batas jumlah menjaga satu permintaan tetap wajar.
  nims: z.array(z.number().int().min(10_000_000).max(99_999_999)).min(1).max(20_000),
  wisudaBatch: z.string().trim().max(100).optional(),
});

export const UploadAlumniCsvOutputSchema = z.object({
  success: z.boolean(),
  updatedCount: z.number(),
  pendingCount: z.number(),
});
