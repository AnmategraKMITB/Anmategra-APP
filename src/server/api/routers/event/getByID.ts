import { TRPCError } from '@trpc/server';
import { type SQL, and, eq, ilike } from 'drizzle-orm';
import { type z } from 'zod';
import { periodMembersSq } from '~/server/api/routers/organization/membership';
import { mahasiswa, users } from '~/server/db/schema';

import { protectedProcedure } from '../../trpc';
import {
  GetAllAnggotaKegiatanInputSchema,
  GetAllAnggotaKegiatanOutputSchema,
  GetEventByIdInputSchema,
  GetEventByIdOutputSchema,
} from '../../types/event.type';

export const getEvent = protectedProcedure
  .input(GetEventByIdInputSchema)
  .output(GetEventByIdOutputSchema)
  .query(async ({ ctx, input }) => {
    const event = await ctx.db.query.events.findFirst({
      where: (event, { eq }) => eq(event.id, input.id),
      with: {
        lembaga: true,
      },
    });
    // Drizzle melebarkan tipe relasi `with` jadi `Record<string, any>`, jadi tipenya
    // tidak bisa dibuktikan tsc. Bentuk aslinya tetap dijaga `.output()` saat runtime.
    return event as z.infer<typeof GetEventByIdOutputSchema>;
  });

export const getAllAnggota = protectedProcedure
  .input(GetAllAnggotaKegiatanInputSchema)
  .output(GetAllAnggotaKegiatanOutputSchema)
  .query(async ({ ctx, input }) => {
    try {
      const members = periodMembersSq(ctx.db, input.event_id);
      const conditions: SQL[] = [];

      if (input.namaOrNim) {
        if (isNaN(Number(input.namaOrNim))) {
          conditions.push(ilike(users.name, `%${input.namaOrNim}%`));
        } else {
          conditions.push(eq(mahasiswa.nim, Number(input.namaOrNim)));
        }
      }

      if (input.divisi) {
        conditions.push(eq(members.division, input.divisi));
      }
      const anggota = await ctx.db
        .select({
          id: users.id,
          nama: users.name,
          nim: mahasiswa.nim,
          division: members.division,
          position: members.position,
        })
        .from(members)
        .innerJoin(users, eq(members.userId, users.id))
        .innerJoin(mahasiswa, eq(users.id, mahasiswa.userId))
        .where(and(...conditions))
        .orderBy(
          members.index,
          members.division,
          members.position,
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
