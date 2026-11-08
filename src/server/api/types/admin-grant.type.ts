import { z } from 'zod';
import { GRANT_FEATURES } from '~/server/api/access';

/** Kosong tidak sah; bawaan 'admin' (semua kemampuan). */
export const GrantFeaturesSchema = z
  .array(z.enum(GRANT_FEATURES))
  .min(1)
  .max(GRANT_FEATURES.length)
  .default(['admin']);

export const GrantLembagaAdminInputSchema = z.object({
  lembagaId: z.string().nonempty(),
  identifier: z.string().nonempty(), // email atau NIM
  features: GrantFeaturesSchema,
});

export const GrantLembagaAdminOutputSchema = z.object({
  success: z.boolean(),
});

export const RevokeLembagaAdminInputSchema = z.object({
  lembagaId: z.string().nonempty(),
  userId: z.string().nonempty(),
});

export const RevokeLembagaAdminOutputSchema = z.object({
  success: z.boolean(),
});

export const ListLembagaAdminsInputSchema = z.object({
  lembagaId: z.string().nonempty(),
});

export const AdminGrantEntrySchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  nim: z.number().nullable(),
  grantedAt: z.date(),
  features: z.array(z.string()),
});

export const ListLembagaAdminsOutputSchema = z.array(AdminGrantEntrySchema);

export const GrantEventAdminInputSchema = z.object({
  lembagaId: z.string().nonempty(),
  eventId: z.string().nonempty(),
  identifier: z.string().nonempty(),
  features: GrantFeaturesSchema,
});

export const GrantEventAdminOutputSchema = z.object({
  success: z.boolean(),
});

export const RevokeEventAdminInputSchema = z.object({
  lembagaId: z.string().nonempty(),
  eventId: z.string().nonempty(),
  userId: z.string().nonempty(),
});

export const RevokeEventAdminOutputSchema = z.object({
  success: z.boolean(),
});

export const ListEventAdminsInputSchema = z.object({
  eventId: z.string().nonempty(),
});

export const ListEventAdminsOutputSchema = z.array(AdminGrantEntrySchema);

export const ManagedLembagaEntrySchema = z.object({
  lembagaId: z.string(),
  lembagaNama: z.string(),
  access: z.enum(['owner', 'admin']),
});

export const GetMyManagedLembagaOutputSchema = z.array(
  ManagedLembagaEntrySchema,
);

export const ManagedEventEntrySchema = z.object({
  eventId: z.string(),
  eventNama: z.string(),
  lembagaId: z.string().nullable(),
  access: z.enum(['owner', 'admin']),
});

export const GetMyManagedEventsOutputSchema = z.array(ManagedEventEntrySchema);
