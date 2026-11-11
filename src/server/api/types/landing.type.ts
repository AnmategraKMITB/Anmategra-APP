import { z } from 'zod';
import type { Kepanitiaan } from '~/types/kepanitiaan';

export const GetRecentEventsOutputSchema = z.array(z.custom<Kepanitiaan>());

export const GetTopEventsOutputSchema = z.array(z.custom<Kepanitiaan>());

export const GetAllEventsInputSchema = z.object({
  limit: z.number().min(1).max(24).default(8),
  cursor: z.string().optional(),
  status: z
    .array(z.enum(['Coming Soon', 'On going', 'Ended', 'Open Recruitment']))
    .optional(),
  sort: z.enum(['newest', 'oldest', 'most_participants']).optional(),
});

export const GetAllEventsOutputSchema = z.object({
  events: z.array(z.custom<Kepanitiaan>()),
  nextCursor: z.string().nullable(),
});

/** Paginasi id-only yang dipakai sitemap. */
const IdCursorPageInputSchema = z.object({
  limit: z.number().min(1).max(100).default(100),
  cursor: z.string().optional(),
});

export const GetAllEventIdsInputSchema = IdCursorPageInputSchema;

export const GetAllEventIdsOutputSchema = z.object({
  items: z.array(z.object({ id: z.string() })),
  nextCursor: z.string().optional(),
});

export const GetAllLembagaIdsInputSchema = IdCursorPageInputSchema;

export const GetAllLembagaIdsOutputSchema = z.object({
  items: z.array(z.object({ id: z.string() })),
  nextCursor: z.string().optional(),
});

export const SearchAllQueryInputSchema = z.object({ query: z.string() });

export const MahasiswaSchema = z.object({
  userId: z.string(),
  nama: z.string(),
  nim: z.string(),
  jurusan: z.string(),
  image: z.string().url().optional(),
});

export const SearchAllOutputSchema = z.object({
  mahasiswa: z.array(MahasiswaSchema),
  lembaga: z.array(z.custom<Kepanitiaan>()),
  kegiatan: z.array(z.custom<Kepanitiaan>()),
});

export const searchPreviewInputSchema = z.object({
  query: z.string(),
});

export const searchPreviewOutputSchema = z.object({
  mahasiswa: z.array(
    z.object({
      userId: z.string(),
      nama: z.string(),
      nim: z.string(),
    }),
  ),
  lembaga: z.array(
    z.object({
      lembagaId: z.string(),
      name: z.string(),
    }),
  ),
  kegiatan: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
});
