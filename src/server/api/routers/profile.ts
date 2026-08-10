import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from '~/server/api/trpc';
import {
  events,
  keanggotaan,
  kehimpunan,
  lembaga,
  mahasiswa,
  users,
} from '~/server/db/schema';
import { type Kepanitiaan } from '~/types/kepanitiaan';

import {
  GetKegiatanInputSchema,
  GetKegiatanOutputSchema,
  GetKegiatanPublicOutputSchema,
  GetLembagaInputSchema,
  GetLembagaOutputSchema,
  GetLembagaPublicOutputSchema,
  GetMahasiswaInputSchema,
  GetMahasiswaOutputSchema,
} from '../types/profile.type';

export const profileRouter = createTRPCRouter({
  getMahasiswa: protectedProcedure
    .input(GetMahasiswaInputSchema)
    .output(GetMahasiswaOutputSchema)
    .query(async ({ ctx, input }) => {
      const [mahasiswaResult, newestEvent, memberLembagaResult] =
        await Promise.all([
          ctx.db
            .select()
            .from(mahasiswa)
            .innerJoin(users, eq(mahasiswa.userId, users.id))
            .where(eq(users.id, input.mahasiswaId))
            .limit(1),
          ctx.db
            .select()
            .from(events)
            .innerJoin(keanggotaan, eq(events.id, keanggotaan.event_id))
            .innerJoin(lembaga, eq(events.org_id, lembaga.id))
            .innerJoin(users, eq(lembaga.userId, users.id))
            .where(eq(keanggotaan.user_id, input.mahasiswaId))
            .orderBy(desc(events.start_date)),
          ctx.db
            .select()
            .from(kehimpunan)
            .innerJoin(lembaga, eq(kehimpunan.lembagaId, lembaga.id))
            .innerJoin(users, eq(lembaga.userId, users.id))
            .where(eq(kehimpunan.userId, input.mahasiswaId))
            .orderBy(lembaga.name),
        ]);

      if (mahasiswaResult.length === 0 || !mahasiswaResult[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Mahasiswa tidak ditemukan.',
        });
      }

      const formattedKepanitiaan: Kepanitiaan[] = newestEvent.map((item) => ({
        lembaga: {
          id: item.lembaga.id,
          name: item.lembaga.name,
          profilePicture: item.user.image,
        },
        id: item.event.id,
        name: item.event.name,
        description: item.event.description,
        anggotaCount: item.event.participant_count ?? 0,
        image: item.event.background_image,
        startDate: new Date(item.event.start_date),
        endDate: item.event.end_date ? new Date(item.event.end_date) : null,
        position: item.keanggotaan.position,
        division: item.keanggotaan.division,
        raporVisible:
          item.event.rapor_visible &&
          (mahasiswaResult[0]?.mahasiswa.raporVisible ||
            mahasiswaResult[0]?.mahasiswa.userId === ctx.session.user.id),
      }));

      const formattedLembaga = memberLembagaResult.map((item) => ({
        id: item.lembaga.id,
        name: item.lembaga.name,
        description: item.lembaga.description,
        image: item.user.image,
        memberCount: item.lembaga.memberCount,
        type: item.lembaga.type,
        position: item.kehimpunan.position,
        division: item.kehimpunan.division,
      }));

      return {
        mahasiswaData: mahasiswaResult[0],
        newestEvent: formattedKepanitiaan,
        memberLembaga: formattedLembaga,
      };
    }),

  getLembaga: protectedProcedure
    .input(GetLembagaInputSchema)
    .output(GetLembagaOutputSchema)
    .query(async ({ ctx, input }) => {
      const lembaga = await ctx.db.query.lembaga.findFirst({
        where: (lembaga, { eq }) => eq(lembaga.id, input.lembagaId),
        with: {
          users: {
            columns: {
              id: true,
              image: true,
            },
          },
        },
        columns: {
          id: true,
          name: true,
          description: true,
          memberCount: true,
          foundingDate: true,
          endingDate: true,
          type: true,
          raporVisible: true,
        },
      });

      if (!lembaga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Lembaga tidak ditemukan.',
        });
      }

      const newestEvent = await ctx.db.query.events.findMany({
        where: (events, { eq }) => and(eq(events.org_id, input.lembagaId)),
        orderBy: desc(events.start_date),
      });

      const lembagaUsers = lembaga.users as { id: string; image: string | null };
      const formattedEvents: Kepanitiaan[] = newestEvent.map((item) => ({
        lembaga: {
          id: lembaga.id,
          name: lembaga.name,
          profilePicture: lembagaUsers.image,
        },
        id: item.id,
        name: item.name,
        description: item.description,
        anggotaCount: item.participant_count ?? 0,
        image: item.background_image,
        startDate: new Date(item.start_date),
        endDate: item.end_date ? new Date(item.end_date) : null,
      }));

      const highlightedEvent = await ctx.db.query.events.findFirst({
        where: (events, { eq }) =>
          and(
            eq(events.org_id, input.lembagaId),
            eq(events.is_highlighted, true),
          ),
        orderBy: desc(events.start_date),
      });

      const anggota = await ctx.db
        .select({
          id: users.id,
          nama: users.name,
          nim: mahasiswa.nim,
          image: users.image,
          jurusan: mahasiswa.jurusan,
          divisi: kehimpunan.division,
          posisi: kehimpunan.position,
        })
        .from(kehimpunan)
        .innerJoin(users, eq(kehimpunan.userId, users.id))
        .innerJoin(mahasiswa, eq(users.id, mahasiswa.userId))
        .where(eq(kehimpunan.lembagaId, input.lembagaId))
        .orderBy(
          kehimpunan.index,
          kehimpunan.division,
          kehimpunan.position,
          mahasiswa.nim,
          users.name,
        );

      const formattedAnggota = anggota.map((anggota) => ({
        id: anggota.id,
        nama: anggota.nama ?? 'john doe',
        nim: anggota.nim.toString(),
        jurusan: anggota.jurusan,
        image: anggota.image,
        divisi: anggota.divisi,
        posisi: anggota.posisi,
        posisiColor: 'blue',
      }));

      return {
        lembagaData: { ...lembaga, users: lembagaUsers },
        newestEvent: formattedEvents,
        highlightedEvent: highlightedEvent ? highlightedEvent : null,
        anggota: formattedAnggota,
      };
    }),

  getKegiatan: protectedProcedure
    .input(GetKegiatanInputSchema)
    .output(GetKegiatanOutputSchema)
    .query(async ({ ctx, input }) => {
      const kegiatan = await ctx.db.query.events.findFirst({
        where: (events, { eq }) => eq(events.id, input.kegiatanId),
      });

      if (!kegiatan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Kegiatan tidak ditemukan.',
        });
      }

      if (kegiatan.org_id === null) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Kegiatan tidak ditemukan.',
        });
      }

      const lembagaRes = await ctx.db
        .select({
          id: lembaga.id,
          name: lembaga.name,
          description: lembaga.description,
          image: users.image,
          memberCount: lembaga.memberCount,
          foundingDate: lembaga.foundingDate,
          endingDate: lembaga.endingDate,
          type: lembaga.type,
        })
        .from(lembaga)
        .innerJoin(users, eq(lembaga.userId, users.id))
        .where(eq(lembaga.id, kegiatan.org_id))
        .limit(1);

      if (lembagaRes.length === 0 || !lembagaRes[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Lembaga tidak ditemukan.',
        });
      }

      const participants = await ctx.db
        .select({
          userId: mahasiswa.userId,
          nama: users.name,
          nim: mahasiswa.nim,
          jurusan: mahasiswa.jurusan,
          image: users.image,
          position: keanggotaan.position,
          divisi: keanggotaan.division,
        })
        .from(keanggotaan)
        .innerJoin(mahasiswa, eq(keanggotaan.user_id, mahasiswa.userId))
        .innerJoin(users, eq(mahasiswa.userId, users.id))
        .where(eq(keanggotaan.event_id, input.kegiatanId))
        .orderBy(
          keanggotaan.index,
          keanggotaan.division,
          keanggotaan.position,
          mahasiswa.nim,
          users.name,
        );

      const formattedParticipants = participants.map((participant) => ({
        id: participant.userId,
        nama: participant.nama ?? 'john doe',
        nim: participant.nim.toString(),
        jurusan: participant.jurusan,
        image: participant.image,
        posisi: participant.position,
        divisi: participant.divisi,
        posisiColor: 'blue',
      }));

      return {
        kegiatan: kegiatan,
        lembaga: lembagaRes[0],
        participant: formattedParticipants,
      };
    }),

  getLembagaPublic: publicProcedure
    .input(GetLembagaInputSchema)
    .output(GetLembagaPublicOutputSchema)
    .query(async ({ ctx, input }) => {
      const lembaga = await ctx.db.query.lembaga.findFirst({
        where: (lembaga, { eq }) => eq(lembaga.id, input.lembagaId),
        with: {
          users: {
            columns: {
              id: true,
              image: true,
            },
          },
        },
        columns: {
          id: true,
          name: true,
          description: true,
          memberCount: true,
          foundingDate: true,
          endingDate: true,
          type: true,
          raporVisible: true,
        },
      });

      if (!lembaga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Lembaga tidak ditemukan.',
        });
      }

      const newestEvent = await ctx.db.query.events.findMany({
        where: (events, { eq }) => and(eq(events.org_id, input.lembagaId)),
        orderBy: desc(events.start_date),
      });

      const lembagaUsers = lembaga.users as { id: string; image: string | null };
      const formattedEvents: Kepanitiaan[] = newestEvent.map((item) => ({
        lembaga: {
          id: lembaga.id,
          name: lembaga.name,
          profilePicture: lembagaUsers.image,
        },
        id: item.id,
        name: item.name,
        description: item.description,
        anggotaCount: item.participant_count ?? 0,
        image: item.background_image,
        startDate: new Date(item.start_date),
        endDate: item.end_date ? new Date(item.end_date) : null,
      }));

      const highlightedEvent = await ctx.db.query.events.findFirst({
        where: (events, { eq }) =>
          and(
            eq(events.org_id, input.lembagaId),
            eq(events.is_highlighted, true),
          ),
        orderBy: desc(events.start_date),
      });

      return {
        lembagaData: { ...lembaga, users: lembagaUsers },
        newestEvent: formattedEvents,
        highlightedEvent: highlightedEvent ? highlightedEvent : null,
      };
    }),

  getKegiatanPublic: publicProcedure
    .input(GetKegiatanInputSchema)
    .output(GetKegiatanPublicOutputSchema)
    .query(async ({ ctx, input }) => {
      const kegiatan = await ctx.db.query.events.findFirst({
        where: (events, { eq }) => eq(events.id, input.kegiatanId),
      });

      if (!kegiatan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Kegiatan tidak ditemukan.',
        });
      }

      if (kegiatan.org_id === null) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Kegiatan tidak ditemukan.',
        });
      }

      const lembagaRes = await ctx.db
        .select({
          id: lembaga.id,
          name: lembaga.name,
          description: lembaga.description,
          image: users.image,
          memberCount: lembaga.memberCount,
          foundingDate: lembaga.foundingDate,
          endingDate: lembaga.endingDate,
          type: lembaga.type,
        })
        .from(lembaga)
        .innerJoin(users, eq(lembaga.userId, users.id))
        .where(eq(lembaga.id, kegiatan.org_id))
        .limit(1);

      if (lembagaRes.length === 0 || !lembagaRes[0]) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Lembaga tidak ditemukan.',
        });
      }

      return {
        kegiatan: kegiatan,
        lembaga: lembagaRes[0],
      };
    }),
});
