import { z } from 'zod';
import { ORGANIZATION_UNIT_KINDS } from '~/server/db/schema';

const OrganizationUnitKindSchema = z.enum(ORGANIZATION_UNIT_KINDS, {
  errorMap: () => ({ message: 'Jenis unit tidak valid' }),
});

const OrganizationStructureSchema = z.object({
  id: z.string(),
  lembaga_id: z.string().nullable(),
  event_id: z.string().nullable(),
  name: z.string(),
  is_active: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
});

const OrganizationUnitBaseSchema = z.object({
  id: z.string(),
  structure_id: z.string(),
  parent_id: z.string().nullable(),
  name: z.string(),
  kind: OrganizationUnitKindSchema,
  level: z.number().int(),
  sort_order: z.number().int(),
});

/**
 * Tree depth is capped at 3 by `organization_unit_level_range_check`, so the
 * nesting is spelled out level by level instead of using `z.lazy`. A recursive
 * zod type needs an explicit `z.ZodType<T>` annotation that kills inference,
 * and it would happily validate a 4-level tree. These three encode the
 * max-depth invariant in the contract itself.
 */
const OrganizationUnitLevel3Schema = OrganizationUnitBaseSchema.extend({
  member_count: z.number().int(),
  // buildUnitTree always emits `children`, so the key must be allowed — but a
  // non-empty one at depth 3 means the tree builder produced a 4th level.
  // Rejecting is deliberate: zod would otherwise strip it and lose rows
  // silently, hiding the bug instead of surfacing it.
  children: z
    .array(z.unknown())
    .max(0, 'Struktur organisasi maksimal 3 tingkat')
    .optional(),
});

const OrganizationUnitLevel2Schema = OrganizationUnitBaseSchema.extend({
  member_count: z.number().int(),
  children: z.array(OrganizationUnitLevel3Schema),
});

const OrganizationUnitLevel1Schema = OrganizationUnitBaseSchema.extend({
  member_count: z.number().int(),
  children: z.array(OrganizationUnitLevel2Schema),
});

/** Flat shape for dropdowns; `path_label` reads like "Bidang A / Divisi B". */
const OrganizationUnitFlatSchema = OrganizationUnitBaseSchema.extend({
  path_label: z.string(),
});

const OrganizationRoleSchema = z.object({
  id: z.string(),
  structure_id: z.string(),
  name: z.string(),
  ring_level: z.number().int(),
  sort_order: z.number().int(),
});

const MutationSuccessSchema = z.object({ success: z.boolean() });

const structureId = z.string().nonempty('Struktur organisasi wajib dipilih');
const unitId = z.string().nonempty('Unit wajib dipilih');
const roleId = z.string().nonempty('Posisi wajib dipilih');
const namaUnit = z
  .string()
  .min(1, 'Nama wajib diisi')
  .max(255, 'Nama maksimal 255 karakter');

// --- structure ---------------------------------------------------------------

export const CreateOrganizationStructureInputSchema = z.object({
  name: namaUnit,
  // Absent means the structure belongs to the caller's own lembaga. The owner
  // is never taken from input beyond this.
  event_id: z.string().nonempty().optional(),
});

export const CreateOrganizationStructureOutputSchema = z.object({
  success: z.boolean(),
  structure_id: z.string(),
});

export const GetAllOrganizationStructureInputSchema = z.object({
  event_id: z.string().nonempty().optional(),
});

export const GetAllOrganizationStructureOutputSchema = z.object({
  structures: z.array(OrganizationStructureSchema),
});

export const GetOrganizationStructureTreeInputSchema = z.object({
  structure_id: structureId,
});

export const GetOrganizationStructureTreeOutputSchema = z.object({
  structure: OrganizationStructureSchema,
  units: z.array(OrganizationUnitLevel1Schema),
  roles: z.array(OrganizationRoleSchema),
});

export const UpdateOrganizationStructureInputSchema = z.object({
  structure_id: structureId,
  name: namaUnit.optional(),
  is_active: z.boolean().optional(),
});

export const UpdateOrganizationStructureOutputSchema = MutationSuccessSchema;

export const DeleteOrganizationStructureInputSchema = z.object({
  structure_id: structureId,
});

export const DeleteOrganizationStructureOutputSchema = MutationSuccessSchema;

// --- unit --------------------------------------------------------------------

export const CreateOrganizationUnitInputSchema = z.object({
  structure_id: structureId,
  name: namaUnit,
  kind: OrganizationUnitKindSchema,
  // `level` is intentionally absent: it is derived from the parent's depth.
  parent_id: z.string().nonempty().optional(),
});

export const CreateOrganizationUnitOutputSchema = z.object({
  success: z.boolean(),
  unit_id: z.string(),
});

export const UpdateOrganizationUnitInputSchema = z.object({
  unit_id: unitId,
  name: namaUnit,
});

export const UpdateOrganizationUnitOutputSchema = MutationSuccessSchema;

export const MoveOrganizationUnitInputSchema = z.object({
  unit_id: unitId,
  // null promotes the unit to a root.
  parent_id: z.string().nonempty().nullable(),
});

export const MoveOrganizationUnitOutputSchema = MutationSuccessSchema;

export const ReorderOrganizationUnitInputSchema = z.object({
  structure_id: structureId,
  parent_id: z.string().nonempty().nullable(),
  unit_ids: z
    .array(z.string().nonempty())
    .min(1, 'Daftar unit tidak boleh kosong'),
});

export const ReorderOrganizationUnitOutputSchema = MutationSuccessSchema;

export const DeleteOrganizationUnitInputSchema = z.object({ unit_id: unitId });

export const DeleteOrganizationUnitOutputSchema = MutationSuccessSchema;

export const GetAllOrganizationUnitInputSchema = z.object({
  structure_id: structureId,
});

export const GetAllOrganizationUnitOutputSchema = z.object({
  units: z.array(OrganizationUnitFlatSchema),
});

// --- role --------------------------------------------------------------------

export const CreateOrganizationRoleInputSchema = z.object({
  structure_id: structureId,
  name: namaUnit,
  ring_level: z
    .number()
    .int('Ring level harus bilangan bulat')
    .min(1, 'Ring level minimal 1'),
});

export const CreateOrganizationRoleOutputSchema = z.object({
  success: z.boolean(),
  role_id: z.string(),
});

export const UpdateOrganizationRoleInputSchema = z.object({
  role_id: roleId,
  name: namaUnit.optional(),
  ring_level: z
    .number()
    .int('Ring level harus bilangan bulat')
    .min(1, 'Ring level minimal 1')
    .optional(),
});

export const UpdateOrganizationRoleOutputSchema = MutationSuccessSchema;

export const ReorderOrganizationRoleInputSchema = z.object({
  structure_id: structureId,
  role_ids: z
    .array(z.string().nonempty())
    .min(1, 'Daftar posisi tidak boleh kosong'),
});

export const ReorderOrganizationRoleOutputSchema = MutationSuccessSchema;

export const DeleteOrganizationRoleInputSchema = z.object({ role_id: roleId });

export const DeleteOrganizationRoleOutputSchema = MutationSuccessSchema;

export const GetAllOrganizationRoleInputSchema = z.object({
  structure_id: structureId,
});

export const GetAllOrganizationRoleOutputSchema = z.object({
  roles: z.array(OrganizationRoleSchema),
});

// --- assignment --------------------------------------------------------------

const minimalSatuTarget = {
  message: 'Pilih minimal unit atau posisi',
  path: ['org_unit_id'] as const,
};

export const AssignAnggotaLembagaOrganizationInputSchema = z
  .object({
    user_id: z.string().nonempty(),
    org_unit_id: z.string().nonempty().optional(),
    org_role_id: z.string().nonempty().optional(),
  })
  .refine((v) => v.org_unit_id != null || v.org_role_id != null, {
    message: minimalSatuTarget.message,
    path: [...minimalSatuTarget.path],
  });

export const AssignAnggotaLembagaOrganizationOutputSchema =
  MutationSuccessSchema;

export const UnassignAnggotaLembagaOrganizationInputSchema = z.object({
  user_id: z.string().nonempty(),
});

export const UnassignAnggotaLembagaOrganizationOutputSchema =
  MutationSuccessSchema;

export const AssignPanitiaKegiatanOrganizationInputSchema = z
  .object({
    event_id: z.string().nonempty(),
    user_id: z.string().nonempty(),
    org_unit_id: z.string().nonempty().optional(),
    org_role_id: z.string().nonempty().optional(),
  })
  .refine((v) => v.org_unit_id != null || v.org_role_id != null, {
    message: minimalSatuTarget.message,
    path: [...minimalSatuTarget.path],
  });

export const AssignPanitiaKegiatanOrganizationOutputSchema =
  MutationSuccessSchema;

export const UnassignPanitiaKegiatanOrganizationInputSchema = z.object({
  event_id: z.string().nonempty(),
  user_id: z.string().nonempty(),
});

export const UnassignPanitiaKegiatanOrganizationOutputSchema =
  MutationSuccessSchema;
