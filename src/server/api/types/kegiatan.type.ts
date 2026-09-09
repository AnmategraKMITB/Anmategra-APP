import { z } from 'zod';

import { EventPublicRowSchema } from './event.type';

export const GetAllKegiatanPublicOutputSchema = z.array(EventPublicRowSchema);

export const GetAllKegiatanByLembagaOutputSchema =
  z.array(EventPublicRowSchema);

export const GetKegiatanByIdPublicInputSchema = z.object({
  event_id: z.string(),
});

/**
 * Query-nya hanya mengambil sebagian kolom lembaga, jadi schema-nya sengaja
 * tidak memakai `LembagaRowSchema` yang utuh.
 */
export const GetKegiatanByIdPublicOutputSchema = EventPublicRowSchema.extend({
  lembaga: z
    .object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      users: z.object({
        image: z.string().nullable(),
      }),
    })
    .nullable(),
}).optional();
