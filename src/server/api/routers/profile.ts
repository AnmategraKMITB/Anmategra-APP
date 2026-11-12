import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from '~/server/api/trpc';
import {
  events,
  lembaga,
  mahasiswa,
  users,
} from '~/server/db/schema';
import { type Kepanitiaan } from '~/types/kepanitiaan';
import { byUserId, loadMahasiswaProfile } from '../mahasiswa-profile';

import {
  lembagaMembersSq,
  periodMembersSq,
  userKegiatanMemberships,
  userLembagaMemberships,
} from './organization/membership';

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
      const profile = await loadMahasiswaProfile(
        ctx.db,
        ctx.session.user,
        byUserId(input.mahasiswaId),
      );
      if (!profile) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Mahasiswa tidak ditemukan.',
        });
      }
      const [newestEvent, memberLembagaResult] = await Promise.all([
        userKegiatanMemberships(ctx.db, input.mahasiswaId),
        userLembagaMemberships(ctx.db, input.mahasiswaId),
      ]);

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
        position: item.position,
        division: item.division,
        raporVisible:
          item.event.rapor_visible &&
          (profile.mahasiswa.raporVisible ||
            profile.mahasiswa.userId === ctx.session.user.id),
      }));

      const formattedLembaga = memberLembagaResult.map((item) => ({
        id: item.lembaga.id,
        name: item.lembaga.name,
        description: item.lembaga.description,
        image: item.user.image,
        memberCount: item.lembaga.memberCount,
        type: item.lembaga.type,
        position: item.position,
        division: item.division,
      }));

      return {
        mahasiswaData: profile,
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
          acronym: true,
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
        where: (events, { eq }) =>
          and(eq(events.org_id, input.lembagaId), eq(events.kind, 'kegiatan')),
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

      const members = await lembagaMembersSq(ctx.db, input.lembagaId);
      const anggota = await ctx.db
        .select({
          id: users.id,
          nama: users.name,
          nim: mahasiswa.nim,
          image: users.image,
          jurusan: mahasiswa.jurusan,
          divisi: members.division,
          posisi: members.position,
        })
        .from(members)
        .innerJoin(users, eq(members.userId, users.id))
        .innerJoin(mahasiswa, eq(users.id, mahasiswa.userId))
        .orderBy(
          members.index,
          members.division,
          members.position,
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

      const members = periodMembersSq(ctx.db, input.kegiatanId);
      const participants = await ctx.db
        .select({
          userId: mahasiswa.userId,
          nama: users.name,
          nim: mahasiswa.nim,
          jurusan: mahasiswa.jurusan,
          image: users.image,
          position: members.position,
          divisi: members.division,
        })
        .from(members)
        .innerJoin(mahasiswa, eq(members.userId, mahasiswa.userId))
        .innerJoin(users, eq(mahasiswa.userId, users.id))
        .orderBy(
          members.index,
          members.division,
          members.position,
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
          acronym: true,
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
        where: (events, { eq }) =>
          and(eq(events.org_id, input.lembagaId), eq(events.kind, 'kegiatan')),
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
