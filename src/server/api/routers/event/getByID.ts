import { TRPCError } from '@trpc/server';
import { and, eq, ilike } from 'drizzle-orm';
import { z } from 'zod';
import { keanggotaan, mahasiswa, users } from '~/server/db/schema';

import { protectedProcedure } from '../../trpc';
import {
  GetAllAnggotaKegiatanInputSchema,
  GetAllAnggotaKegiatanOutputSchema,
} from '../../types/event.type';

export const getEvent = protectedProcedure
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const event = await ctx.db.query.events.findFirst({
      where: (event, { eq }) => eq(event.id, input.id),
      with: {
        lembaga: true,
      },
    });
    return event;
  });

export const getAllAnggota = protectedProcedure
  .input(GetAllAnggotaKegiatanInputSchema)
  .output(GetAllAnggotaKegiatanOutputSchema)
  .query(async ({ ctx, input }) => {
    try {
      const conditions = [eq(keanggotaan.event_id, input.event_id)];

      if (input.namaOrNim) {
        if (isNaN(Number(input.namaOrNim))) {
          conditions.push(ilike(users.name, `%${input.namaOrNim}%`));
        } else {
          conditions.push(eq(mahasiswa.nim, Number(input.namaOrNim)));
        }
      }

      if (input.divisi) {
        conditions.push(eq(keanggotaan.division, input.divisi));
      }
      const anggota = await ctx.db
        .select({
          id: users.id,
          nama: users.name,
          nim: mahasiswa.nim,
          division: keanggotaan.division,
          position: keanggotaan.position,
        })
        .from(keanggotaan)
        .innerJoin(users, eq(keanggotaan.user_id, users.id))
        .innerJoin(mahasiswa, eq(users.id, mahasiswa.userId))
        .where(and(...conditions))
        .orderBy(
          keanggotaan.index,
          keanggotaan.division,
          keanggotaan.position,
          mahasiswa.nim,
          users.name,
        );

      const formatted_anggota = anggota.map((anggota) => {
        return {
          id: anggota.id,
          nama: anggota.nama ?? '',
          nim: anggota.nim.toString() ?? '',
          divisi: anggota.division ?? '',
          posisi: anggota.position ?? '',
        };
      });

      return formatted_anggota;
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      });
    }
  });
