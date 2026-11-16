import { z } from 'zod';

/**
 * Input wajib untuk prosedur `lembagaScopedProcedure`: lembaga yang dikelola.
 * Gabungkan dengan skema domain lewat `Skema.and(LembagaScopeInput)`.
 */
export const LembagaScopeInput = z.object({
  lembagaId: z.string().nonempty(),
});

/** Buang `lembagaId` sebelum input disebar ke `insert`/`update` Drizzle. */
export function withoutLembagaId<T extends { lembagaId: string }>(input: T) {
  const { lembagaId, ...rest } = input;
  void lembagaId;
  return rest;
}
