import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(255);
const name = z.string().trim().min(1).max(255);
const lembagaType = z.enum([
  'Himpunan',
  'UKM',
  'Kepanitiaan',
  'BSO',
  'Badan',
  'Pusat',
  'Organisasi',
]);

export const AdminUsersListInputSchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const AdminUserCreateInputSchema = z
  .object({
    kind: z.enum(['mahasiswa', 'lembaga']),
    email,
    name,
    nim: z.string().trim().regex(/^\d{8}$/).optional(),
    jurusan: z.string().trim().min(1).max(255).optional(),
    angkatan: z.number().int().min(2000).max(2100).optional(),
    lembagaName: z.string().trim().min(1).max(255).optional(),
    lembagaType: lembagaType.optional(),
    acronym: z.string().trim().max(50).optional(),
    isDemo: z.boolean().default(false),
    hidden: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'mahasiswa') {
      if (!value.nim) ctx.addIssue({ code: 'custom', message: 'NIM wajib 8 digit.', path: ['nim'] });
      if (!value.jurusan) ctx.addIssue({ code: 'custom', message: 'Program studi wajib.', path: ['jurusan'] });
      if (!value.angkatan) ctx.addIssue({ code: 'custom', message: 'Angkatan wajib.', path: ['angkatan'] });
    } else {
      if (!value.lembagaName) ctx.addIssue({ code: 'custom', message: 'Nama lembaga wajib.', path: ['lembagaName'] });
      if (!value.lembagaType) ctx.addIssue({ code: 'custom', message: 'Jenis lembaga wajib.', path: ['lembagaType'] });
    }
  });

export const AdminUserUpdateInputSchema = z.object({
  userId: z.string().min(1),
  name: name.optional(),
  hidden: z.boolean().optional(),
  isDemo: z.boolean().optional(),
});

export const AdminLembagaUpdateInputSchema = z.object({
  lembagaId: z.string().min(1),
  name: name.optional(),
  acronym: z.string().trim().max(50).nullable().optional(),
  type: lembagaType.optional(),
});

export const AdminGrantSetInputSchema = z.object({
  kind: z.enum(['lembaga', 'event']),
  targetId: z.string().min(1),
  identifier: z.string().trim().min(1).max(255),
  revoke: z.boolean().default(false),
});

export const AdminAuditListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});
