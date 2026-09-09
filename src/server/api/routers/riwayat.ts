import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { mahasiswa, riwayatKepanitiaan, riwayatOrganisasi } from '~/server/db/schema';

import {
  GetRiwayatKepanitiaanInputSchema,
  GetRiwayatKepanitiaanOutputSchema,
  GetRiwayatOrganisasiInputSchema,
  GetRiwayatOrganisasiOutputSchema,
} from '../types/riwayat.type';

// Kalau lihat riwayat orang lain, hormati toggle rapor_visible yang sama
// dipakai untuk nilai profil/best-staff di tempat lain.
async function assertCanViewRiwayat(
  db: typeof import('~/server/db').db,
  viewerId: string,
  targetUserId: string,
) {
  if (viewerId === targetUserId) return;

  const target = await db.query.mahasiswa.findFirst({
    where: eq(mahasiswa.userId, targetUserId),
    columns: { raporVisible: true },
  });

  if (target && !target.raporVisible) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Riwayat mahasiswa ini tidak ditampilkan secara publik.',
    });
  }
}

export const riwayatRouter = createTRPCRouter({
  getRiwayatOrganisasi: protectedProcedure
    .input(GetRiwayatOrganisasiInputSchema)
    .output(GetRiwayatOrganisasiOutputSchema)
    .query(async ({ ctx, input }) => {
      const targetUserId = input.userId ?? ctx.session.user.id;
      await assertCanViewRiwayat(ctx.db, ctx.session.user.id, targetUserId);

      const rows = await ctx.db.query.riwayatOrganisasi.findMany({
        where: eq(riwayatOrganisasi.userId, targetUserId),
        orderBy: desc(riwayatOrganisasi.endedAt),
      });

      return rows.map((row) => ({
        id: row.id,
        lembagaId: row.lembagaId,
        lembagaNama: row.lembagaNama,
        lembagaTipe: row.lembagaTipe,
        division: row.division,
        position: row.position,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        endReason: row.endReason,
      }));
    }),

  getRiwayatKepanitiaan: protectedProcedure
    .input(GetRiwayatKepanitiaanInputSchema)
    .output(GetRiwayatKepanitiaanOutputSchema)
    .query(async ({ ctx, input }) => {
      const targetUserId = input.userId ?? ctx.session.user.id;
      await assertCanViewRiwayat(ctx.db, ctx.session.user.id, targetUserId);

      const rows = await ctx.db.query.riwayatKepanitiaan.findMany({
        where: eq(riwayatKepanitiaan.userId, targetUserId),
        orderBy: desc(riwayatKepanitiaan.endedAt),
      });

      return rows.map((row) => ({
        id: row.id,
        eventId: row.eventId,
        eventNama: row.eventNama,
        lembagaId: row.lembagaId,
        lembagaNama: row.lembagaNama,
        division: row.division,
        position: row.position,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        endReason: row.endReason,
      }));
    }),
});
