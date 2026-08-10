import {
  and,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { z } from 'zod';
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from '~/server/api/trpc';
import { events, lembaga, mahasiswa, users } from '~/server/db/schema';
import { type Kepanitiaan } from '~/types/kepanitiaan';

import {
  GetAllEventsInputSchema,
  GetAllEventsOutputSchema,
  GetRecentEventsOutputSchema,
  GetTopEventsOutputSchema,
  SearchAllOutputSchema,
  SearchAllQueryInputSchema,
  searchPreviewInputSchema,
  searchPreviewOutputSchema,
} from '../types/landing.type';

export const landingRouter = createTRPCRouter({
  getRecentEvents: publicProcedure
    .input(z.void())
    .output(GetRecentEventsOutputSchema)
    .query(async ({ ctx }) => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const events = await ctx.db.query.events.findMany({
        orderBy: (events, { desc }) => desc(events.start_date),
        where: (events, { gte }) => gte(events.start_date, sixMonthsAgo),
        with: {
          lembaga: {
            with: {
              users: {},
            },
          },
        },
        limit: 8,
        columns: {
          id: true,
          name: true,
          description: true,
          image: true,
          start_date: true,
          end_date: true,
          participant_count: true,
          background_image: true,
        },
      });

      const formattedEvents: Kepanitiaan[] = events.map((item) => {
        const lembaga = item.lembaga as
          | { name: string | null; users: { image: string | null } }
          | null;
        return {
          lembaga: {
            name: lembaga?.name ?? '',
            profilePicture: lembaga?.users.image ?? '',
          },
          id: item.id,
          name: item.name,
          description: item.description,
          image: item.background_image,
          anggotaCount: item.participant_count ?? 0,
          startDate: new Date(item.start_date),
          endDate: item.end_date ? new Date(item.end_date) : null,
        };
      });

      return formattedEvents;
    }),

  getAllEvents: publicProcedure
    .input(GetAllEventsInputSchema)
    .output(GetAllEventsOutputSchema)
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 8;
      const sort = input.sort ?? 'newest';
      let cursorDate: Date | undefined;
      let cursorId: string | undefined;
      let cursorCount: number | undefined;

      if (input.cursor) {
        const [datePart, idPart] = input.cursor.split('|');
        if (datePart && idPart) {
          if (sort === 'most_participants') {
            cursorCount = Number(datePart);
          } else {
            cursorDate = new Date(datePart);
          }
          cursorId = idPart;
        }
      }

      const conditions: SQL<unknown>[] = [];
      if (sort === 'newest' && cursorDate && cursorId) {
        const date = cursorDate;
        const id = cursorId;
        conditions.push(
          or(
            lt(events.start_date, date),
            and(eq(events.start_date, date), lt(events.id, id)),
          ) as SQL,
        );
      }
      if (sort === 'oldest' && cursorDate && cursorId) {
        const date = cursorDate;
        const id = cursorId;
        conditions.push(
          or(
            gt(events.start_date, date),
            and(eq(events.start_date, date), gt(events.id, id)),
          ) as SQL,
        );
      }
      if (
        sort === 'most_participants' &&
        cursorCount !== undefined &&
        cursorId
      ) {
        const count = cursorCount;
        const id = cursorId;
        conditions.push(
          or(
            lt(events.participant_count, count),
            and(eq(events.participant_count, count), lt(events.id, id)),
          ) as SQL,
        );
      }

      if (input.status && input.status.length > 0) {
        const filterConditions: SQL<unknown>[] = [];
        const statusFilters = input.status.filter(
          (s) => s !== 'Open Recruitment',
        );
        if (statusFilters.length > 0) {
          filterConditions.push(inArray(events.status, statusFilters));
        }
        if (input.status.includes('Open Recruitment')) {
          const oprecConditions: SQL<unknown>[] = [];
          oprecConditions.push(isNotNull(events.oprec_link));
          oprecConditions.push(isNotNull(events.end_date));
          oprecConditions.push(gt(events.end_date, new Date()));
          oprecConditions.push(ne(events.status, 'Ended'));
          filterConditions.push(and(...oprecConditions) as SQL);
        }
        conditions.push(or(...filterConditions) as SQL);
      }

      const orderBy =
        sort === 'oldest'
          ? (events, { asc }) => [asc(events.start_date), asc(events.id)]
          : sort === 'most_participants'
            ? (events, { desc }) => [
                desc(events.participant_count),
                desc(events.id),
              ]
            : (events, { desc }) => [desc(events.start_date), desc(events.id)];

      const list = await ctx.db.query.events.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy,
        with: {
          lembaga: {
            with: {
              users: {},
            },
          },
        },
        limit: limit + 1,
        columns: {
          id: true,
          name: true,
          description: true,
          image: true,
          start_date: true,
          end_date: true,
          participant_count: true,
          background_image: true,
        },
      });

      const hasMore = list.length > limit;
      const sliced = hasMore ? list.slice(0, limit) : list;

      const formattedEvents: Kepanitiaan[] = sliced.map((item) => {
        const lembaga = item.lembaga as
          | { name: string | null; users: { image: string | null } }
          | null;
        return {
          lembaga: {
            name: lembaga?.name ?? '',
            profilePicture: lembaga?.users.image ?? '',
          },
          id: item.id,
          name: item.name,
          description: item.description,
          image: item.background_image,
          anggotaCount: item.participant_count ?? 0,
          startDate: new Date(item.start_date),
          endDate: item.end_date ? new Date(item.end_date) : null,
        };
      });

      const lastItem = sliced[sliced.length - 1];
      const nextCursor =
        hasMore && lastItem
          ? sort === 'most_participants'
            ? `${lastItem.participant_count ?? 0}|${lastItem.id}`
            : `${new Date(lastItem.start_date).toISOString()}|${lastItem.id}`
          : null;
      return {
        events: formattedEvents,
        nextCursor,
      };
    }),

  getTopEvents: publicProcedure
    .input(z.void())
    .output(GetTopEventsOutputSchema)
    .query(async ({ ctx }) => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const events = await ctx.db.query.events.findMany({
        where: (events, { gte }) => gte(events.start_date, sixMonthsAgo),
        orderBy: (events, { desc }) => desc(events.participant_count),
        with: {
          lembaga: {
            columns: {
              name: true,
            },
            with: {
              users: {},
            },
          },
        },
        limit: 8,
        columns: {
          id: true,
          name: true,
          description: true,
          image: true,
          start_date: true,
          end_date: true,
          participant_count: true,
          background_image: true,
        },
      });

      const formattedEvents: Kepanitiaan[] = events.map((item) => {
        const lembaga = item.lembaga as
          | { name: string | null; users: { image: string | null } }
          | null;
        return {
          lembaga: {
            name: lembaga?.name ?? '',
            profilePicture: lembaga?.users.image ?? '',
          },
          id: item.id,
          name: item.name,
          description: item.description,
          anggotaCount: item.participant_count ?? 0,
          image: item.background_image,
          startDate: new Date(item.start_date),
          endDate: item.end_date ? new Date(item.end_date) : null,
        };
      });

      return formattedEvents;
    }),

  searchAll: protectedProcedure
    .input(SearchAllQueryInputSchema)
    .output(SearchAllOutputSchema)
    .query(async ({ ctx, input }) => {
      const { query } = input;
      const limit = 10;

      // Cek apakah query adalah angka (hanya digit 0-9)
      const isNumeric = /^\d+$/.test(query);

      const [mahasiswaResults, lembaga, event] = await Promise.all([
        // Mahasiswa query
        // Inner join User dan Mahasiswa dengan kondisi pencarian
        ctx.db
          .select({
            userId: users.id,
            nama: users.name,
            nim: mahasiswa.nim,
            jurusan: mahasiswa.jurusan,
            image: users.image,
          })
          .from(users)
          .innerJoin(mahasiswa, eq(users.id, mahasiswa.userId))
          .where(
            isNumeric
              ? or(
                  // Jika query numerik: cari di kolom nim (integer) dan name (string)
                  // @ts-expect-error Mahasiswa.nim adalah integer
                  ilike(sql`${mahasiswa.nim}::text`, `%${query}%`), // Cast integer ke text untuk ilike
                  ilike(users.name, `%${query}%`),
                )
              : // Jika bukan numerik: cari hanya di kolom name
                ilike(users.name, `%${query}%`),
          )
          .limit(limit),

        // Lembaga query
        ctx.db.query.lembaga.findMany({
          where: (lembaga, { ilike }) => ilike(lembaga.name, `%${query}%`),
          with: {
            users: {},
          },
          limit,
        }),

        // Events query
        ctx.db.query.events.findMany({
          where: (event, { ilike }) => ilike(event.name, `%${query}%`),
          with: {
            lembaga: {
              with: {
                users: {},
              },
            },
          },
          limit,
        }),
      ]);

      const formattedMahasiswa = mahasiswaResults.map((mahasiswa) => ({
        userId: mahasiswa.userId,
        nama: mahasiswa.nama ?? '',
        nim: mahasiswa.nim.toString(),
        jurusan: mahasiswa.jurusan,
        image: mahasiswa.image ?? undefined,
      }));

      const formattedLembaga: Kepanitiaan[] = lembaga.map((item) => {
        const itemUsers = item.users as { image: string | null } | null;
        return {
          lembaga: {
            id: item.id,
            name: item.name,
            profilePicture: itemUsers?.image ?? '',
          },
          name: item.name,
          description: item.description,
          anggotaCount: item.memberCount ?? 0,
          startDate: item.foundingDate ? new Date(item.foundingDate) : null,
          image: itemUsers?.image ?? null,
          endDate: item.endingDate ? new Date(item.endingDate) : null,
        };
      });

      const formattedKepanitiaan: Kepanitiaan[] = event.map((item) => {
        const lembagaItem = item.lembaga as
          | { name: string | null; users: { image: string | null } }
          | null;
        return {
          lembaga: {
            name: lembagaItem?.name ?? '',
            profilePicture: lembagaItem?.users.image ?? '',
          },
          id: item.id,
          name: item.name,
          description: item.description,
          image: item.background_image,
          anggotaCount: item.participant_count ?? 0,
          startDate: new Date(item.start_date),
          endDate: item.end_date ? new Date(item.end_date) : null,
        };
      });

      return {
        mahasiswa: formattedMahasiswa,
        lembaga: formattedLembaga,
        kegiatan: formattedKepanitiaan,
      };
    }),

  searchPreview: protectedProcedure
    .input(searchPreviewInputSchema)
    .output(searchPreviewOutputSchema)
    .query(async ({ ctx, input }) => {
      const { query } = input;
      const q = query.trim();

      if (q.length < 2) {
        return {
          mahasiswa: [],
          lembaga: [],
          kegiatan: [],
        };
      }
      const isNumeric = /^[0-9]+$/.test(q);

      // nim search
      if (isNumeric) {
        let mahasiswaRes = await ctx.db
          .select({
            userId: mahasiswa.userId,
            nama: mahasiswa.nama,
            nim: sql<string>`${mahasiswa.nim}::text`,
          })
          .from(mahasiswa)
          .where(sql`${mahasiswa.nim}::text LIKE ${q + '%'}`)
          .limit(2);

        if (mahasiswaRes.length === 0) {
          mahasiswaRes = await ctx.db
            .select({
              userId: mahasiswa.userId,
              nama: mahasiswa.nama,
              nim: sql<string>`${mahasiswa.nimTpb}::text`,
            })
            .from(mahasiswa)
            .where(
              and(
                sql`${mahasiswa.nimTpb} IS NOT NULL`,
                sql`${mahasiswa.nimTpb}::text LIKE ${q + '%'}`,
              ),
            )
            .limit(2);
        }

        return {
          mahasiswa: mahasiswaRes.map((m) => ({
            userId: m.userId,
            nama: m.nama ?? '',
            nim: m.nim,
          })),
          lembaga: [],
          kegiatan: [],
        };
      }

      // name search
      const [mahasiswaRes, lembagaRes, kegiatanRes] = await Promise.all([
        // Mahasiswa
        ctx.db
          .select({
            userId: mahasiswa.userId,
            nama: mahasiswa.nama,
            nim: sql<string>`${mahasiswa.nim}::text`,
          })
          .from(mahasiswa)
          .where(sql`${mahasiswa.nama} ILIKE ${'%' + q + '%'}`)
          .limit(2),

        // Lembaga
        ctx.db
          .select({
            lembagaId: lembaga.id,
            name: lembaga.name,
          })
          .from(lembaga)
          .where(sql`${lembaga.name} ILIKE ${'%' + q + '%'}`)
          .limit(2),

        // Events / Kegiatan
        ctx.db
          .select({
            id: events.id,
            name: events.name,
          })
          .from(events)
          .where(sql`${events.name} ILIKE ${'%' + q + '%'}`)
          .limit(2),
      ]);

      return {
        mahasiswa: mahasiswaRes.map((m) => ({
          userId: m.userId,
          nama: m.nama ?? '',
          nim: m.nim,
        })),
        lembaga: lembagaRes,
        kegiatan: kegiatanRes,
      };
    }),

  getAllEventIds: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(100),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.query.events.findMany({
        columns: {
          id: true,
        },
        where: input.cursor ? (e, { gt }) => gt(e.id, input.cursor!) : undefined,
        orderBy: (e, { asc }) => [asc(e.id)],
        limit: input.limit,
      });

      const nextCursor =
        items.length === input.limit ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor };
    }),

  getAllLembagaIds: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(100),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.query.lembaga.findMany({
        columns: {
          id: true,
        },
        where: input.cursor ? (l, { gt }) => gt(l.id, input.cursor!) : undefined,
        orderBy: (l, { asc }) => [asc(l.id)],
        limit: input.limit,
      });

      const nextCursor =
        items.length === input.limit ? items[items.length - 1]?.id : undefined;

      return { items, nextCursor };
    }),
});
