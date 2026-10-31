import { z } from 'zod';

export const GetRiwayatOrganisasiInputSchema = z.object({
  userId: z.string().optional(),
});

export const RiwayatOrganisasiEntrySchema = z.object({
  id: z.string(),
  lembagaId: z.string().nullable(),
  lembagaNama: z.string(),
  lembagaTipe: z.string().nullable(),
  division: z.string(),
  position: z.string(),
  startedAt: z.date(),
  endedAt: z.date(),
  endReason: z.string(),
});

export const GetRiwayatOrganisasiOutputSchema = z.array(
  RiwayatOrganisasiEntrySchema,
);

export const GetRiwayatKepanitiaanInputSchema = z.object({
  userId: z.string().optional(),
});

export const RiwayatKepanitiaanEntrySchema = z.object({
  id: z.string(),
  eventId: z.string().nullable(),
  eventNama: z.string(),
  lembagaId: z.string().nullable(),
  lembagaNama: z.string().nullable(),
  division: z.string(),
  position: z.string(),
  startedAt: z.date(),
  endedAt: z.date(),
  endReason: z.string(),
});

export const GetRiwayatKepanitiaanOutputSchema = z.array(
  RiwayatKepanitiaanEntrySchema,
);
