import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { type comboboxDataType } from '~/app/_components/form/tambah-anggota-kegiatan-form';
import {
  createTRPCRouter,
  lembagaProcedure,
  publicProcedure,
} from '~/server/api/trpc';

import { EventIdSchema } from '../types/event.type';
import { GetPosisiBidangOptionsOutputSchema } from '../types/lembaga.type';

export const kegiatanRouter = createTRPCRouter({
  // Public Procedures
  getAllPublic: publicProcedure.query(async ({ ctx }) => {
    const kegiatan = await ctx.db.query.events.findMany({
      orderBy: (events, { desc }) => desc(events.start_date),
      columns: {
        org_id: false,
      },
    });
    return kegiatan;
  }),

  getByIdPublic: publicProcedure
    .input(z.object({ event_id: z.string() }))
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
      return kegiatan;
    }),

  // lembaga procedure
  getAllByLembaga: lembagaProcedure.query(async ({ ctx }) => {
    const kegiatan = await ctx.db.query.events.findMany({
      where: (events, { eq }) => eq(events.org_id, ctx.session.user.lembagaId!),
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

  getPosisiBidangOptions: lembagaProcedure
    .input(EventIdSchema)
    .output(GetPosisiBidangOptionsOutputSchema)
    .query(async ({ ctx, input }) => {
      const kegiatan = await ctx.db.query.events.findFirst({
        where: (events, { eq }) => eq(events.id, input.event_id),
        columns: { org_id: true },
      });

      if (!kegiatan) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Kegiatan tidak ditemukan' });
      }

      if (kegiatan.org_id !== ctx.session.user.lembagaId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const list_posisi_bidang = await ctx.db.query.keanggotaan.findMany({
        where: (keanggotaan, { eq }) =>
          eq(keanggotaan.event_id, input.event_id),
        columns: {
          position: true,
          division: true,
        },
      });
      const uniquePosisi = Array.from(
        new Set(list_posisi_bidang.map((item) => item.position)),
      );
      const posisi_list = uniquePosisi.map((position) => ({
        value: position,
        label: position ?? '',
      }));

      const uniqueBidang = Array.from(
        new Set(list_posisi_bidang.map((item) => item.division)),
      );
      const bidang_list = uniqueBidang.map((division) => ({
        value: division,
        label: division ?? '',
      }));

      return {
        posisi: posisi_list ?? ([] as comboboxDataType[]),
        bidang: bidang_list ?? ([] as comboboxDataType[]),
      };
    }),
});
