import { TRPCError } from '@trpc/server';
import { LembagaScopeInput } from '~/server/api/types/scope';
import { z } from 'zod';
import { type comboboxDataType } from '~/app/_components/form/tambah-anggota-kegiatan-form';
import {
  createTRPCRouter,
  lembagaScopedProcedure,
  publicProcedure,
} from '~/server/api/trpc';

import { EventIdSchema } from '../types/event.type';
import { periodTextOptions } from './organization/membership';
import {
  GetAllKegiatanByLembagaOutputSchema,
  GetAllKegiatanPublicOutputSchema,
  GetKegiatanByIdPublicInputSchema,
  GetKegiatanByIdPublicOutputSchema,
} from '../types/kegiatan.type';
import { GetPosisiBidangOptionsOutputSchema } from '../types/lembaga.type';

export const kegiatanRouter = createTRPCRouter({
  // Public Procedures
  getAllPublic: publicProcedure
    .output(GetAllKegiatanPublicOutputSchema)
    .query(async ({ ctx }) => {
      const kegiatan = await ctx.db.query.events.findMany({
        where: (events, { eq }) => eq(events.kind, 'kegiatan'),
        orderBy: (events, { desc }) => desc(events.start_date),
        columns: {
          org_id: false,
        },
      });
      return kegiatan;
    }),

  getByIdPublic: publicProcedure
    .input(GetKegiatanByIdPublicInputSchema)
    .output(GetKegiatanByIdPublicOutputSchema)
    .query(async ({ ctx, input }) => {
      const kegiatan = await ctx.db.query.events.findFirst({
        where: (events, { eq }) => eq(events.id, input.event_id),
        with: {
          lembaga: {
            columns: {
              id: true,
              name: true,
              description: true,
            },
            with: {
              users: {
                columns: {
                  image: true,
                },
              },
            },
          },
        },
        columns: { org_id: false },
      });
      // Sama seperti event.getByID: tipe relasi `with` dari Drizzle terlalu lebar,
      // bentuk aslinya dijaga `.output()` saat runtime.
      return kegiatan as z.infer<typeof GetKegiatanByIdPublicOutputSchema>;
    }),

  // lembaga procedure
  // Tanpa `kind`: semua periode lembaga (dipakai pemilih periode organogram).
  getAllByLembaga: lembagaScopedProcedure
    .input(
      LembagaScopeInput.extend({
        kind: z.enum(['kegiatan', 'kepengurusan']).optional(),
      }),
    )
    .output(GetAllKegiatanByLembagaOutputSchema)
    .query(async ({ ctx, input }) => {
      const kegiatan = await ctx.db.query.events.findMany({
        where: (events, { and, eq }) =>
          and(
            eq(events.org_id, ctx.lembagaId),
            input.kind ? eq(events.kind, input.kind) : undefined,
          ),
        orderBy: (events, { desc }) => [
          desc(events.is_highlighted),
          desc(events.start_date),
        ],
        columns: {
          org_id: false,
        },
      });
      return kegiatan;
    }),

  getPosisiBidangOptions: lembagaScopedProcedure
    .input(EventIdSchema.and(LembagaScopeInput))
    .output(GetPosisiBidangOptionsOutputSchema)
    .query(async ({ ctx, input }) => {
      const kegiatan = await ctx.db.query.events.findFirst({
        where: (events, { eq }) => eq(events.id, input.event_id),
        columns: { org_id: true },
      });

      if (!kegiatan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Kegiatan tidak ditemukan',
        });
      }

      if (kegiatan.org_id !== ctx.lembagaId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const options = await periodTextOptions(ctx.db, input.event_id);
      const posisi_list = options.positions.map((position) => ({
        value: position,
        label: position,
      }));
      const bidang_list = options.divisions.map((division) => ({
        value: division,
        label: division,
      }));

      return {
        posisi: posisi_list ?? ([] as comboboxDataType[]),
        bidang: bidang_list ?? ([] as comboboxDataType[]),
      };
    }),
});
