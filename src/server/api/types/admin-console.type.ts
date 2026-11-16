import { z } from 'zod';
import { GRANT_FEATURES } from '~/server/api/access';
import {
  CreateEventInputSchema,
  UpdateEventInputSchema,
} from '~/server/api/types/event.type';

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
const sortDir = z.enum(['asc', 'desc']).default('desc');
const page = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const AdminUsersListInputSchema = page.extend({
  search: z.string().trim().max(100).optional(),
  role: z.enum(['admin', 'lembaga', 'mahasiswa']).optional(),
  status: z.enum(['all', 'demo', 'hidden']).default('all'),
  sort: z.enum(['name', 'email', 'role', 'created_at']).default('created_at'),
  dir: sortDir,
});

export const AdminUserSearchInputSchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.number().int().min(1).max(20).default(8),
});

export const AdminLembagaListInputSchema = page.extend({
  search: z.string().trim().max(100).optional(),
  type: lembagaType.optional(),
  parentId: z.string().min(1).nullable().optional(),
  sort: z.enum(['name', 'acronym', 'type', 'created_at']).default('name'),
  dir: sortDir,
});

export const AdminLembagaSearchInputSchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.number().int().min(1).max(20).default(8),
});

export const AdminPositionSearchInputSchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.number().int().min(1).max(20).default(8),
});

export const AdminEventSearchInputSchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.number().int().min(1).max(20).default(8),
});

export const AdminUserDetailInputSchema = z.object({
  userId: z.string().min(1),
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

export const AdminMahasiswaUpdateSchema = z.object({
  nim: z.string().trim().regex(/^\d{8}$/).optional(),
  nimTpb: z.string().trim().regex(/^\d{8}$/).nullable().optional(),
  nama: name.optional(),
  jurusan: z.string().trim().min(1).max(255).optional(),
  angkatan: z.number().int().min(2000).max(2100).optional(),
  lineId: z.string().trim().max(255).nullable().optional(),
  whatsapp: z.string().trim().max(255).nullable().optional(),
  raporVisible: z.boolean().optional(),
  status: z.enum(['aktif', 'alumni']).optional(),
});

export const AdminUserUpdateInputSchema = z
  .object({
    userId: z.string().min(1),
    email: email.optional(),
    name: name.optional(),
    image: z.string().url().max(255).nullable().optional(),
    emailVerified: z.boolean().optional(),
    role: z.enum(['admin', 'lembaga', 'mahasiswa']).optional(),
    /** Wajib saat `role` berubah: email akun yang diketik ulang. */
    confirmEmail: z.string().trim().max(255).optional(),
    hidden: z.boolean().optional(),
    isDemo: z.boolean().optional(),
    mahasiswa: AdminMahasiswaUpdateSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const { userId: _userId, confirmEmail: _confirm, ...fields } = value;
    const hasField =
      Object.values(fields).some((field) => field !== undefined) ||
      Object.keys(fields.mahasiswa ?? {}).length > 0;
    if (!hasField) {
      ctx.addIssue({ code: 'custom', message: 'Tidak ada perubahan.', path: ['userId'] });
    }
  });

export const AdminLembagaUpdateInputSchema = z.object({
  lembagaId: z.string().min(1),
  name: name.optional(),
  acronym: z.string().trim().max(50).nullable().optional(),
  type: lembagaType.optional(),
  description: z.string().trim().max(20_000).nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  foundingDate: z.coerce.date().nullable().optional(),
  endingDate: z.coerce.date().nullable().optional(),
  major: z.string().trim().max(255).nullable().optional(),
  field: z.string().trim().max(255).nullable().optional(),
  memberCount: z.number().int().min(0).nullable().optional(),
  raporVisible: z.boolean().optional(),
  image: z.string().url().max(255).nullable().optional(),
});

export const AdminLembagaDetailInputSchema = z.object({
  lembagaId: z.string().min(1),
});

export const AdminLembagaProfileListInputSchema = z.object({
  lembagaId: z.string().min(1),
});

export const AdminLembagaProfileUpsertInputSchema = z.object({
  lembagaId: z.string().min(1),
  profilId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(20_000),
});

export const AdminLembagaProfileDeleteInputSchema = z.object({
  profilId: z.string().min(1),
});

export const AdminGrantSetInputSchema = z.object({
  kind: z.enum(['lembaga', 'event']),
  targetId: z.string().min(1),
  identifier: z.string().trim().min(1).max(255),
  features: z.array(z.enum(GRANT_FEATURES)).min(1).default(['admin']),
  propagate: z.boolean().default(false),
  revoke: z.boolean().default(false),
});

export const AdminGrantsListInputSchema = page.extend({
  search: z.string().trim().max(100).optional(),
  scope: z.enum(['all', 'lembaga', 'event']).default('all'),
  feature: z.enum(GRANT_FEATURES).optional(),
  sort: z.enum(['created_at', 'user', 'scope']).default('created_at'),
  dir: sortDir,
});

export const AdminGrantRevokeInputSchema = z.object({
  grantId: z.string().min(1),
});

export const AdminAuditListInputSchema = page.extend({
  search: z.string().trim().max(100).optional(),
  action: z.string().trim().max(64).optional(),
  entityType: z.string().trim().max(64).optional(),
  actorId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['created_at', 'action']).default('created_at'),
  dir: sortDir,
});

export const AdminOperatorPermissionSetInputSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
  permissions: z.array(z.string()).default([]),
  expiresAt: z.coerce.date().nullable().optional(),
});

export const AdminOperatorPermissionRevokeInputSchema = z.object({
  userId: z.string().min(1),
});

export const AdminMembershipUpsertInputSchema = z.object({
  userId: z.string().min(1),
  lembagaId: z.string().min(1),
  cohortYear: z.number().int().min(1900).max(2100).nullable().optional(),
  cohortLabel: z.string().trim().max(255).nullable().optional(),
  status: z.enum(['aktif', 'keluar']).default('aktif'),
  joinedAt: z.coerce.date().nullable().optional(),
  endedAt: z.coerce.date().nullable().optional(),
});

export const AdminMembershipRemoveInputSchema = z.object({
  membershipId: z.string().min(1),
});

export const AdminPlacementAddInputSchema = z.object({
  userId: z.string().min(1),
  positionId: z.string().min(1),
  note: z.string().trim().max(2000).nullable().optional(),
  source: z.enum(['manual', 'import']).default('manual'),
});

export const AdminPlacementRemoveInputSchema = z.object({
  placementId: z.string().min(1),
});

export const AdminEventCreateInputSchema = CreateEventInputSchema.extend({
  lembagaId: z.string().min(1),
  kind: z.enum(['kegiatan', 'kepengurusan']).default('kegiatan'),
  label: z.string().trim().max(255).nullable().optional(),
});

export const AdminEventUpdateInputSchema = UpdateEventInputSchema.extend({
  lembagaId: z.string().min(1),
  kind: z.enum(['kegiatan', 'kepengurusan']).optional(),
  label: z.string().trim().max(255).nullable().optional(),
});

export const AdminEventDeleteInputSchema = z.object({
  id: z.string().min(1),
  lembagaId: z.string().min(1),
});
