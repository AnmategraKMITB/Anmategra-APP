import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { eventStatusEnum, type events } from '~/server/db/schema';

import { LembagaRowSchema } from './lembaga.type';

type Event = InferSelectModel<typeof events>;

/** Bentuk satu baris tabel `event` apa adanya. */
export const EventRowSchema = z.object({
  id: z.string(),
  org_id: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  image: z.string().nullable(),
  background_image: z.string().nullable(),
  start_date: z.date(),
  end_date: z.date().nullable(),
  status: z.enum(eventStatusEnum.enumValues),
  oprec_link: z.string().nullable(),
  location: z.string().nullable(),
  participant_limit: z.number(),
  participant_count: z.number(),
  is_highlighted: z.boolean(),
  is_organogram: z.boolean(),
  organogram_image: z.string().nullable(),
  rapor_visible: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
});

/** Varian publik: `org_id` sengaja tidak diambil oleh query-nya. */
export const EventPublicRowSchema = EventRowSchema.omit({ org_id: true });

export const GetEventByIdInputSchema = z.object({ id: z.string() });

export const GetEventByIdOutputSchema = EventRowSchema.extend({
  lembaga: LembagaRowSchema.nullable(),
}).optional();

export const CreateEventInputSchema = z.object({
  name: z.string().min(1, 'Nama kegiatan wajib diisi'),
  description: z
    .string()
    .min(10, 'Deskripsi minimal 10 karakter')
    .max(100, 'Deskripsi maksimal 100 karakter'),
  image: z.string().url(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime().nullable().optional(),
  status: z.enum(['Coming Soon', 'On going', 'Ended']),
  oprec_link: z
    .string()
    .url('Harus berupa URL yang valid')
    .or(z.literal(''))
    .optional(),
  location: z.string().optional(),
  is_highlighted: z.boolean().optional(),
  is_organogram: z.boolean().optional(),
  background_image: z.string().url().optional(),
  organogram_image: z.string().url().or(z.literal('')).optional(),
  rapor_visible: z.boolean().optional(),
});

export const CreateEventOutputSchema = z.custom<Event>();

export const UpdateEventInputSchema = CreateEventInputSchema.partial().extend({
  id: z.string(),
});

export const UpdateEventOutputSchema = z.custom<Event>();

export const DeleteEventInputSchema = z.object({
  id: z.string(),
});

export const DeleteEventOutputSchema = z.object({
  success: z.boolean(),
  id: z.string(),
});

export const AddNewPanitiaKegiatanInputSchema = z.object({
  event_id: z.string(),
  user_id: z.string(),
  position: z.string(),
  division: z.string(),
});

export const AddNewPanitiaKegiatanOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const RemovePanitiaKegiatanInputSchema = z.object({
  event_id: z.string(),
  id: z.string(),
});

export const RemovePanitiaKegiatanOutputSchema =
  AddNewPanitiaKegiatanOutputSchema;

export const EditPanitiaKegiatanInputSchema = AddNewPanitiaKegiatanInputSchema;

export const EditPanitiaKegiatanOutputSchema = z.object({
  success: z.boolean(),
});

const PanitiaKegiatanSchema = z.object({
  id: z.string(),
  nama: z.string(),
  nim: z.string(),
  divisi: z.string(),
  posisi: z.string(),
});

export const GetAllAnggotaKegiatanInputSchema = z.object({
  event_id: z.string(),
  namaOrNim: z.string().optional(),
  divisi: z.string().optional(),
});

export const GetAllAnggotaKegiatanOutputSchema = z.array(PanitiaKegiatanSchema);

export const AddNewPanitiaKegiatanManualInputSchema = z.object({
  event_id: z.string(),
  name: z.string().nonempty(),
  nim: z.string().regex(/^\d{8}$/, 'NIM harus 8 digit angka'),
  position: z.string().nonempty(),
  division: z.string().nonempty(),
});

export const EventIdSchema = z.object({
  event_id: z.string(),
});

export const ToggleHighlightInputSchema = z.object({
  id: z.string(),
  is_highlighted: z.boolean(),
});

export const ToggleHighlightOutputSchema = z.object({
  success: z.boolean(),
  is_highlighted: z.boolean(),
});

export const ToggleRaporVisibilityInputSchema = z.object({
  id: z.string(),
  rapor_visible: z.boolean(),
});

export const ToggleRaporVisibilityMahasiswaInputSchema = z.object({
  rapor_visible: z.boolean(),
});

export const ToggleRaporVisibilityOutputSchema = z.object({
  success: z.boolean(),
  rapor_visible: z.boolean(),
});
