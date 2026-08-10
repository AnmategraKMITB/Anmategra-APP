import { TRPCError } from '@trpc/server';
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
} from 'drizzle-orm';
import { type z } from 'zod';
import { type comboboxDataType } from '~/app/_components/form/tambah-anggota-kegiatan-form';
import {
  createTRPCRouter,
  lembagaProcedure,
  protectedProcedure,
} from '~/server/api/trpc';
import { type Prodi } from '~/server/auth';
import {
  associationRequests,
  associationRequestsLembaga,
  bestStaffKegiatan,
  bestStaffLembaga,
  events,
  keanggotaan,
  kehimpunan,
  lembaga,
  mahasiswa,
  users,
} from '~/server/db/schema';

import daftarProdi from '../../db/kode-program-studi.json';
import {
  AcceptRequestAssociationInputSchema,
  AcceptRequestAssociationLembagaInputSchema,
  AcceptRequestAssociationLembagaOutputSchema,
  AcceptRequestAssociationOutputSchema,
  AddAnggotaLembagaInputSchema,
  AddAnggotaLembagaOutputSchema,
  AddAnggotaManualLembagaInputSchema,
  ChooseBestStaffKegiatanInputSchema,
  ChooseBestStaffKegiatanOutputSchema,
  ChooseBestStaffLembagaInputSchema,
  ChooseBestStaffLembagaOutputSchema,
  DeclineRequestAssociationInputSchema,
  DeclineRequestAssociationLembagaInputSchema,
  DeclineRequestAssociationLembagaOutputSchema,
  DeclineRequestAssociationOutputSchema,
  DeleteBestStaffPeriodeInputSchema,
  DeleteBestStaffPeriodeOutputSchema,
  EditProfilLembagaInputSchema,
  EditProfilLembagaOutputSchema,
  GetAllAnggotaLembagaInputSchema,
  GetAllAnggotaLembagaOutputSchema,
  GetAllDivisionOutputSchema,
  GetAllHistoryBestStaffKegiatanInputSchema,
  GetAllHistoryBestStaffKegiatanOutputSchema,
  GetAllHistoryBestStaffLembagaInputSchema,
  GetAllHistoryBestStaffLembagaOutputSchema,
  GetAllHistoryBestStaffMahasiswaInputSchema,
  GetAllHistoryBestStaffMahasiswaOutputSchema,
  GetAllKegiatanDivisionInputSchema,
  GetAllLembagaDivisionInputSchema,
  GetAllRequestAssociationInputSchema,
  GetAllRequestAssociationKegiatanInputSchema,
  GetAllRequestAssociationLembagaOutputSchema,
  GetAllRequestAssociationOutputSchema,
  GetAllRequestAssociationSummaryInputSchema,
  GetAllRequestedAssociationSummaryOutputSchema,
  GetBestStaffLembagaOptionsInputSchema,
  GetBestStaffLembagaOptionsOutputSchema,
  GetBestStaffOptionsInputSchema,
  GetBestStaffOptionsOutputSchema,
  GetInfoLembagaInputSchema,
  GetInfoLembagaOutputSchema,
  GetLatestBestStaffKegiatanInputSchema,
  GetLatestBestStaffKegiatanOutputSchema,
  GetLatestBestStaffLembagaInputSchema,
  GetLatestBestStaffLembagaOutputSchema,
  GetLembagaEventsInputSchema,
  GetLembagaEventsOutputSchema,
  GetLembagaHighlightedEventInputSchema,
  GetLembagaHighlightedEventOutputSchema,
  GetPosisiBidangOptionsOutputSchema,
  RemoveAnggotaLembagaInputSchema,
  RemoveAnggotaLembagaOutputSchema,
  ReorderAnggotaKegiatanInputSchema,
  ReorderAnggotaKegiatanOutputSchema,
  ReorderAnggotaLembagaInputSchema,
  ReorderAnggotaLembagaOutputSchema,
  ToggleRaporVisibilityLembagaInputSchema,
  ToggleRaporVisibilityLembagaOutputSchema,
  editAnggotaLembagaInputSchema,
  editAnggotaLembagaOutputSchema,
} from '../types/lembaga.type';

export const lembagaRouter = createTRPCRouter({
  // Fetch lembaga general information
  getInfo: protectedProcedure
    .input(GetInfoLembagaInputSchema)
    .output(GetInfoLembagaOutputSchema)
    .query(async ({ ctx, input }) => {
      const lembaga = await ctx.db.query.lembaga.findFirst({
        where: (lembaga, { eq }) => eq(lembaga.id, input.lembagaId),
        with: {
          users: {
            columns: {
              image: true,
            },
          },
        },
      });

      if (!lembaga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Lembaga tidak ditemukan',
        });
      }

      const lembagaUsers = lembaga.users as { image: string | null };
      return {
        id: lembaga.id,
        nama: lembaga.name,
        foto: lembagaUsers.image,
        deskripsi: lembaga.description,
        tanggal_berdiri: lembaga.foundingDate,
        tipe_lembaga: lembaga.type,
        raporVisible: lembaga.raporVisible,
        detail_tambahan: {
          jurusan: lembaga.type === 'Himpunan' ? lembaga.major : null,
          bidang: lembaga.type === 'UKM' ? lembaga.field : null,
          jumlah_anggota: lembaga.memberCount,
        },
      };
    }),

  getAllAnggota: protectedProcedure
    .input(GetAllAnggotaLembagaInputSchema)
    .output(GetAllAnggotaLembagaOutputSchema)
    .query(async ({ ctx, input }) => {
      try {
        const conditions = [eq(kehimpunan.lembagaId, input.lembagaId)];

        if (input.namaOrNim) {
          if (isNaN(Number(input.namaOrNim))) {
            conditions.push(ilike(users.name, `%${input.namaOrNim}%`));
          } else {
            conditions.push(eq(mahasiswa.nim, Number(input.namaOrNim)));
          }
        }

        if (input.divisi) {
          conditions.push(eq(kehimpunan.division, input.divisi));
        }
        const anggota = await ctx.db
          .select({
            id: users.id,
            nama: users.name,
            nim: mahasiswa.nim,
            divisi: kehimpunan.division,
            posisi: kehimpunan.position,
          })
          .from(kehimpunan)
          .innerJoin(users, eq(kehimpunan.userId, users.id))
          .innerJoin(mahasiswa, eq(users.id, mahasiswa.userId))
          .where(and(...conditions))
          .orderBy(
            kehimpunan.index,
            kehimpunan.division,
            kehimpunan.position,
            mahasiswa.nim,
            users.name,
          );

        return anggota.map((anggota) => ({
          id: anggota.id,
          nama: anggota.nama ?? 'Tidak Diketahui',
          nim: anggota.nim.toString(),
          divisi: anggota.divisi,
          posisi: anggota.posisi,
          posisiColor: 'blue',
        }));
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengambil data anggota lembaga.',
        });
      }
    }),

  getAllRequestAssociationSummary: lembagaProcedure
    .input(GetAllRequestAssociationSummaryInputSchema)
    .output(GetAllRequestedAssociationSummaryOutputSchema)
    .query(async ({ ctx, input }) => {
      const conditions1 = [eq(lembaga.id, ctx.session.user.lembagaId!)];
      const conditions2 = [eq(events.org_id, ctx.session.user.lembagaId!)];

      if (input.name) {
        conditions1.push(ilike(lembaga.name, `%${input.name}%`));
        conditions2.push(ilike(events.name, `%${input.name}%`));
      }

      const res = [] as z.infer<
        typeof GetAllRequestedAssociationSummaryOutputSchema
      >;

      const lembaga1 = await ctx.db
        .select({
          name: lembaga.name,
          image: users.image,
        })
        .from(lembaga)
        .innerJoin(users, eq(lembaga.userId, users.id))
        .where(and(...conditions1));

      if (lembaga1) {
        const countLembagaRequests = await ctx.db
          .select({
            count: count(),
          })
          .from(associationRequestsLembaga)
          .where(
            and(
              eq(
                associationRequestsLembaga.lembagaId,
                ctx.session.user.lembagaId!,
              ),
              eq(associationRequestsLembaga.status, 'Pending'),
            ),
          );

        if (Number(countLembagaRequests[0]?.count ?? 0) > 0) {
          res.push({
            id: ctx.session.user.lembagaId!,
            name: lembaga1[0]?.name ?? '',
            total_requests: Number(countLembagaRequests[0]?.count ?? 0),
            type: 'Lembaga',
            image: lembaga1[0]?.image ?? null,
          });
        }
      }

      const eventslist = await ctx.db
        .select({
          id: events.id,
          name: events.name,
          image: events.image,
        })
        .from(events)
        .where(and(...conditions2));

      // Get all pending requests for these events in a single grouped query
      const eventIds = eventslist.map((e) => e.id);
      let eventRequestCounts: { event_id: string; count: number }[] = [];
      if (eventIds.length > 0) {
        eventRequestCounts = (await ctx.db
          .select({
            event_id: associationRequests.event_id,
            count: count(),
          })
          .from(associationRequests)
          .where(
            and(
              eq(associationRequests.status, 'Pending'),
              // Only for events in our list
              eventIds.length === 1
                ? eq(associationRequests.event_id, eventIds[0]!)
                : inArray(associationRequests.event_id, eventIds),
            ),
          )
          .groupBy(associationRequests.event_id)) as {
          event_id: string;
          count: number;
        }[];
      }
      // Map event_id to count
      const eventCountMap = new Map<string, number>();
      for (const row of eventRequestCounts) {
        eventCountMap.set(row.event_id, Number(row.count));
      }
      for (const event of eventslist) {
        const count = eventCountMap.get(event.id) ?? 0;
        if (count === 0) continue;
        res.push({
          id: event.id,
          name: event.name ?? '',
          total_requests: count,
          type: 'Kegiatan',
          image: event.image ?? null,
        });
      }
      return res;
    }),

  // Fetch all associated events with lembaga
  getAllRequestAssociation: lembagaProcedure
    .input(GetAllRequestAssociationKegiatanInputSchema)
    .output(GetAllRequestAssociationOutputSchema)
    .query(async ({ ctx, input }) => {
      const eventOrg = await ctx.db.query.events.findFirst({
        where: eq(events.id, input.event_id),
        columns: { org_id: true },
      });

      if (!eventOrg) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Kegiatan tidak ditemukan',
        });
      }

      if (eventOrg.org_id !== ctx.session.user.lembagaId!) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Anda tidak memiliki izin untuk mengakses data ini.',
        });
      }

      const conditions = [
        eq(associationRequests.event_id, input.event_id),
        eq(associationRequests.status, 'Pending'),
      ];

      if (input.division && input.division.length > 0) {
        conditions.push(inArray(associationRequests.division, input.division));
      }

      const requests = await ctx.db
        .select({
          event_id: associationRequests.event_id,
          event_name: events.name,
          user_id: associationRequests.user_id,
          image: users.image,
          mahasiswa_name: users.name,
          division: associationRequests.division,
          position: associationRequests.position,
        })
        .from(associationRequests)
        .innerJoin(users, eq(associationRequests.user_id, users.id))
        .innerJoin(events, eq(associationRequests.event_id, events.id))
        .where(and(...conditions))
        .orderBy(desc(associationRequests.created_at));

      return requests.map((req) => ({
        event_id: req.event_id ?? '',
        event_name: req.event_name ?? '',
        user_id: req.user_id ?? '',
        image: req.image ?? null,
        mahasiswa_name: req.mahasiswa_name ?? '',
        division: req.division ?? '',
        position: req.position ?? '',
      }));
    }),

  // Fetch highlighted/pinned event
  getHighlightedEvent: protectedProcedure
    .input(GetLembagaHighlightedEventInputSchema)
    .output(GetLembagaHighlightedEventOutputSchema)
    .query(async ({ ctx, input }) => {
      const highlightedEvent = await ctx.db.query.events.findFirst({
        where: (event, { eq, and }) =>
          and(
            eq(event.org_id, input.lembagaId),
            eq(event.is_highlighted, true),
          ),
      });

      if (!highlightedEvent) return null;

      return {
        id: highlightedEvent.id,
        nama: highlightedEvent.name,
        deskripsi: highlightedEvent.description,
        poster: highlightedEvent.image,
      };
    }),

  // Fetch paginated list of events
  getEvents: protectedProcedure
    .input(GetLembagaEventsInputSchema)
    .output(GetLembagaEventsOutputSchema)
    .query(async ({ ctx, input }) => {
      const limit = 10;
      const offset = (input.page - 1) * limit;

      const [events, totalEvents] = await Promise.all([
        ctx.db.query.events.findMany({
          where: (event, { eq }) => eq(event.org_id, input.lembagaId),
          orderBy: (event, { desc }) => [desc(event.start_date)],
          limit,
          offset,
        }),
        ctx.db.query.events
          .findMany({
            where: (event, { eq }) => eq(event.org_id, input.lembagaId),
            columns: { id: true },
          })
          .then((events) => events.length),
      ]);

      return {
        events: events.map((event) => ({
          id: event.id,
          nama: event.name,
          deskripsi: event.description,
          poster: event.image,
          start_date: event.start_date,
        })),
        totalPages: Math.ceil(totalEvents / limit),
      };
    }),

  // Add new anggota to lembaga
  addAnggota: lembagaProcedure
    .input(AddAnggotaLembagaInputSchema)
    .output(AddAnggotaLembagaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.insert(kehimpunan).values({
          id: input.user_id + '_' + ctx.session.user.id,
          lembagaId: ctx.session.user.lembagaId!,
          userId: input.user_id,
          division: input.division,
          position: input.position,
        });

        return {
          success: true,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal menambahkan anggota',
        });
      }
    }),

  addAnggotaManual: lembagaProcedure
    .input(AddAnggotaManualLembagaInputSchema)
    .output(AddAnggotaLembagaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if user already exists by email (primary identifier)
        const email = `${input.nim}@mahasiswa.itb.ac.id`;
        const existingUser = await ctx.db.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (existingUser) {
          // Name doesn't match
          if (existingUser.name !== input.name) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Sudah ada mahasiswa dengan NIM ${input.nim} bernama ${existingUser.name}`,
            });
          }

          // User exists, just add them to kehimpunan
          await ctx.db.insert(kehimpunan).values({
            id: existingUser.id + '_' + ctx.session.user.lembagaId!,
            lembagaId: ctx.session.user.lembagaId!,
            userId: existingUser.id,
            division: input.division,
            position: input.position,
          });

          return { success: true };
        }

        const kodeProdi = parseInt(input.nim.substring(0, 3));
        const jurusan =
          daftarProdi.find((item: Prodi) => item.kode === kodeProdi)?.jurusan ??
          'TPB';

        // asumsi cuma ada angkatan 2000-an
        const angkatan = parseInt(input.nim.substring(3, 5)) + 2000;

        await ctx.db.transaction(async (tx) => {
          const user = await tx
            .insert(users)
            .values({
              name: input.name,
              email: email,
              role: 'mahasiswa',
              emailVerified: null, // Not verified yet
            })
            .returning({ id: users.id });

          await tx.insert(mahasiswa).values({
            userId: user[0]!.id,
            nim: Number(input.nim),
            jurusan: jurusan,
            angkatan: angkatan,
          });

          await tx.insert(kehimpunan).values({
            id: user[0]!.id + '_' + ctx.session.user.id,
            lembagaId: ctx.session.user.lembagaId!,
            userId: user[0]!.id,
            division: input.division,
            position: input.position,
          });
        });

        return {
          success: true,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message ?? 'Gagal menambahkan anggota secara manual',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal menambahkan anggota secara manual',
        });
      }
    }),

  removeAnggota: lembagaProcedure
    .input(RemoveAnggotaLembagaInputSchema)
    .output(RemoveAnggotaLembagaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const existingKehimpunan = await ctx.db.query.kehimpunan.findFirst({
        where: and(
          eq(kehimpunan.userId, input.user_id),
          eq(kehimpunan.lembagaId, ctx.session.user.lembagaId!),
        ),
      });

      if (!existingKehimpunan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Anggota tidak ditemukan',
        });
      }

      await ctx.db
        .delete(kehimpunan)
        .where(
          and(
            eq(kehimpunan.userId, input.user_id),
            eq(kehimpunan.lembagaId, ctx.session.user.lembagaId!),
          ),
        );

      return {
        success: true,
      };
    }),

  editAnggota: lembagaProcedure
    .input(editAnggotaLembagaInputSchema)
    .output(editAnggotaLembagaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await ctx.db
          .update(kehimpunan)
          .set({
            position: input.position,
            division: input.division,
          })
          .where(
            and(
              eq(kehimpunan.userId, input.user_id),
              eq(kehimpunan.lembagaId, ctx.session.user.lembagaId!),
            ),
          )
          .returning({ id: kehimpunan.id });

        if (updated.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Anggota tidak ditemukan',
          });
        }

        return {
          success: true,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengedit anggota',
        });
      }
    }),

  editProfil: lembagaProcedure
    .input(EditProfilLembagaInputSchema)
    .output(EditProfilLembagaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.gambar) {
        await ctx.db
          .update(users)
          .set({
            image: input.gambar,
          })
          .where(eq(users.id, ctx.session.user.id));
      }

      await ctx.db
        .update(lembaga)
        .set({
          name: input.nama,
          description: input.deskripsi,
          ...(input.tipe ? { type: input.tipe } : {}),
        })
        .where(eq(lembaga.id, ctx.session.user.lembagaId!));

      return {
        success: true,
      };
    }),

  acceptRequestAssociation: lembagaProcedure
    .input(AcceptRequestAssociationInputSchema)
    .output(AcceptRequestAssociationOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const isExistAndAuthorized = await ctx.db
          .select({ id: associationRequests.id })
          .from(associationRequests)
          .innerJoin(
            events,
            and(
              eq(associationRequests.event_id, events.id),
              eq(events.org_id, ctx.session.user.lembagaId!),
            ),
          )
          .where(
            and(
              eq(associationRequests.event_id, input.event_id),
              eq(associationRequests.user_id, input.user_id),
              eq(associationRequests.status, 'Pending'),
            ),
          )
          .limit(1);

        if (isExistAndAuthorized.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Permintaan asosiasi tidak ditemukan.',
          });
        }

        const isUserAlreadyParticipant = await ctx.db
          .select({ id: keanggotaan.id })
          .from(keanggotaan)
          .where(
            and(
              eq(keanggotaan.event_id, input.event_id),
              eq(keanggotaan.user_id, input.user_id),
            ),
          )
          .limit(1);
        if (isUserAlreadyParticipant.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'User sudah terdaftar di dalam kegiatan, silahkan edit posisi dan divisi di halaman kegiatan tersebut.',
          });
        }

        const eventToUpdate = await ctx.db.query.events.findFirst({
          where: and(
            eq(events.id, input.event_id),
            eq(events.org_id, ctx.session.user.lembagaId!),
          ),
          columns: {
            id: true,
            participant_count: true,
          },
        });

        if (!eventToUpdate) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
          });
        }

        await ctx.db.transaction(async (tx) => {
          await tx.insert(keanggotaan).values({
            id: input.event_id + '_' + input.user_id,
            event_id: input.event_id,
            user_id: input.user_id,
            position: input.position,
            division: input.division,
          });

          await tx
            .update(associationRequests)
            .set({
              status: 'Accepted',
            })
            .where(
              and(
                eq(associationRequests.event_id, input.event_id),
                eq(associationRequests.user_id, input.user_id),
              ),
            );
        });

        return {
          success: true,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'Terjadi kesalahan tak terduga saat menerima permintaan asosiasi.',
        });
      }
    }),

  declineRequestAssociation: lembagaProcedure
    .input(DeclineRequestAssociationInputSchema)
    .output(DeclineRequestAssociationOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const isExistAndAuthorized = await ctx.db
          .select({ id: associationRequests.id })
          .from(associationRequests)
          .innerJoin(
            events,
            and(
              eq(associationRequests.event_id, events.id),
              eq(events.org_id, ctx.session.user.lembagaId!),
            ),
          )
          .where(
            and(
              eq(associationRequests.event_id, input.event_id),
              eq(associationRequests.user_id, input.user_id),
              eq(associationRequests.status, 'Pending'),
            ),
          )
          .limit(1);

        if (isExistAndAuthorized.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Permintaan asosiasi tidak ditemukan.',
          });
        }

        await ctx.db
          .update(associationRequests)
          .set({
            status: 'Declined',
          })
          .where(
            and(
              eq(associationRequests.event_id, input.event_id),
              eq(associationRequests.user_id, input.user_id),
            ),
          );

        return {
          success: true,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'Terjadi kesalahan tak terduga saat menolak permintaan asosiasi.',
        });
      }
    }),

  getAllLembagaDivision: lembagaProcedure
    .input(GetAllLembagaDivisionInputSchema)
    .output(GetAllDivisionOutputSchema)
    .query(async ({ ctx, input }) => {
      if (ctx.session.user.lembagaId !== input.lembaga_id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const divisionsRaw = await ctx.db
        .select({ division: kehimpunan.division })
        .from(kehimpunan)
        .where(eq(kehimpunan.lembagaId, input.lembaga_id));

      const uniqueDivisions = Array.from(
        new Set(divisionsRaw.map((row) => row.division)),
      );

      return { divisions: uniqueDivisions };
    }),

  getAllKegiatanDivision: lembagaProcedure
    .input(GetAllKegiatanDivisionInputSchema)
    .output(GetAllDivisionOutputSchema)
    .query(async ({ ctx, input }) => {
      const orgId = await ctx.db.query.events.findFirst({
        where: eq(events.id, input.event_id),
        columns: { org_id: true },
      });

      if (!orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      if (orgId.org_id !== ctx.session.user.lembagaId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const divisionsRaw = await ctx.db
        .select({ division: keanggotaan.division })
        .from(keanggotaan)
        .where(eq(keanggotaan.event_id, input.event_id));

      const uniqueDivisions = Array.from(
        new Set(divisionsRaw.map((row) => row.division)),
      );

      return { divisions: uniqueDivisions };
    }),

  getBestStaffOptions: lembagaProcedure
    .input(GetBestStaffOptionsInputSchema)
    .output(GetBestStaffOptionsOutputSchema)
    .query(async ({ ctx, input }) => {
      const orgId = await ctx.db.query.events.findFirst({
        where: eq(events.id, input.event_id),
        columns: { org_id: true },
      });

      if (!orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      if (orgId.org_id !== ctx.session.user.lembagaId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const staffOptions = await ctx.db
        .select({
          user_id: users.id,
          name: users.name,
        })
        .from(keanggotaan)
        .innerJoin(users, eq(keanggotaan.user_id, users.id))
        .where(
          and(
            eq(keanggotaan.event_id, input.event_id),
            eq(keanggotaan.division, input.division),
          ),
        );

      return {
        staff_options: staffOptions.map((staff) => ({
          user_id: staff.user_id,
          name: staff.name ?? 'Tidak Diketahui',
        })),
      };
    }),

  getAllRequestAssociationLembaga: lembagaProcedure
    .input(GetAllRequestAssociationInputSchema)
    .output(GetAllRequestAssociationLembagaOutputSchema)
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(
          associationRequestsLembaga.lembagaId,
          ctx.session?.user?.lembagaId ?? '',
        ),
      ];

      conditions.push(eq(associationRequestsLembaga.status, 'Pending'));

      if (input.division && input.division.length > 0) {
        conditions.push(
          inArray(associationRequestsLembaga.division, input.division),
        );
      }

      const requests = await ctx.db
        .select({
          user_id: associationRequestsLembaga.user_id,
          image: users.image,
          mahasiswa_name: users.name,
          division: associationRequestsLembaga.division,
          position: associationRequestsLembaga.position,
        })
        .from(associationRequestsLembaga)
        .where(and(...conditions))
        .innerJoin(users, eq(associationRequestsLembaga.user_id, users.id))
        .orderBy(desc(associationRequestsLembaga.created_at));
      return {
        requests: requests.map((req) => ({
          user_id: req.user_id ?? '',
          image: req.image ?? null,
          mahasiswa_name: req.mahasiswa_name ?? '',
          division: req.division ?? '',
          position: req.position ?? '',
        })),
      };
    }),

  acceptRequestAssociationLembaga: lembagaProcedure
    .input(AcceptRequestAssociationLembagaInputSchema)
    .output(AcceptRequestAssociationLembagaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const isExistAndAuthorized = await ctx.db
          .select({ id: associationRequestsLembaga.id })
          .from(associationRequestsLembaga)
          .where(
            and(
              eq(
                associationRequestsLembaga.lembagaId,
                ctx.session.user.lembagaId!,
              ),
              eq(associationRequestsLembaga.user_id, input.user_id),
              eq(associationRequestsLembaga.status, 'Pending'),
            ),
          )
          .limit(1);

        if (isExistAndAuthorized.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Permintaan asosiasi tidak ditemukan atau sudah diproses.',
          });
        }

        // Check if user is already a member of the lembaga
        const isUserAlreadyMember = await ctx.db
          .select({ id: kehimpunan.id })
          .from(kehimpunan)
          .where(
            and(
              eq(kehimpunan.lembagaId, ctx.session.user.lembagaId!),
              eq(kehimpunan.userId, input.user_id),
            ),
          )
          .limit(1);

        if (isUserAlreadyMember.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'User sudah terdaftar di dalam lembaga, silahkan edit posisi dan divisi di halaman anggota.',
          });
        }

        await ctx.db.transaction(async (tx) => {
          // Add user to kehimpunan
          await tx.insert(kehimpunan).values({
            lembagaId: ctx.session.user.lembagaId!,
            userId: input.user_id,
            position: input.position,
            division: input.division,
          });

          // Update the association request status to 'Accepted'
          await tx
            .update(associationRequestsLembaga)
            .set({
              status: 'Accepted',
            })
            .where(
              and(
                eq(
                  associationRequestsLembaga.lembagaId,
                  ctx.session.user.lembagaId!,
                ),
                eq(associationRequestsLembaga.user_id, input.user_id),
              ),
            );
        });

        return {
          success: true,
          message: 'Permintaan asosiasi berhasil diterima.',
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'Terjadi kesalahan tak terduga saat menerima permintaan asosiasi.',
        });
      }
    }),

  declineRequestAssociationLembaga: lembagaProcedure
    .input(DeclineRequestAssociationLembagaInputSchema)
    .output(DeclineRequestAssociationLembagaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if the request exists and is pending
        const isExistAndAuthorized = await ctx.db
          .select({ id: associationRequestsLembaga.id })
          .from(associationRequestsLembaga)
          .where(
            and(
              eq(
                associationRequestsLembaga.lembagaId,
                ctx.session.user.lembagaId!,
              ),
              eq(associationRequestsLembaga.user_id, input.user_id),
              eq(associationRequestsLembaga.status, 'Pending'),
            ),
          )
          .limit(1);

        if (isExistAndAuthorized.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Permintaan asosiasi tidak ditemukan atau sudah diproses.',
          });
        }

        // Update the association request status to 'Declined'
        await ctx.db
          .update(associationRequestsLembaga)
          .set({
            status: 'Declined',
          })
          .where(
            and(
              eq(
                associationRequestsLembaga.lembagaId,
                ctx.session.user.lembagaId!,
              ),
              eq(associationRequestsLembaga.user_id, input.user_id),
            ),
          );

        return {
          success: true,
          message: 'Permintaan asosiasi berhasil ditolak.',
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'Terjadi kesalahan tak terduga saat menolak permintaan asosiasi.',
        });
      }
    }),

  chooseBestStaffKegiatan: lembagaProcedure
    .input(ChooseBestStaffKegiatanInputSchema)
    .output(ChooseBestStaffKegiatanOutputSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify that the event belongs to the lembaga
      const eventOrg = await ctx.db.query.events.findFirst({
        where: eq(events.id, input.event_id),
        columns: { org_id: true },
      });

      if (ctx.session.user.lembagaId! !== eventOrg?.org_id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Verify the start date and end date is valid
      if (new Date(input.start_date) > new Date(input.end_date)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Start date tidak boleh lebih besar dari end date',
        });
      }

      await ctx.db
        .delete(bestStaffKegiatan)
        .where(
          and(
            eq(bestStaffKegiatan.eventId, input.event_id),
            lte(bestStaffKegiatan.startDate, new Date(input.end_date)),
            gte(bestStaffKegiatan.endDate, new Date(input.start_date)),
          ),
        );

      // insert to tabel bestStaffKegiatan
      await ctx.db.insert(bestStaffKegiatan).values(
        input.best_staff_list.map((staff) => ({
          id: crypto.randomUUID(),
          eventId: input.event_id,
          mahasiswaId: staff.user_id,
          division: staff.division,
          startDate: new Date(input.start_date),
          endDate: new Date(input.end_date),
        })),
      );

      return {
        success: true,
      };
    }),

  getBestStaffLembagaOptions: lembagaProcedure
    .input(GetBestStaffLembagaOptionsInputSchema)
    .output(GetBestStaffLembagaOptionsOutputSchema)
    .query(async ({ ctx, input }) => {
      const staffOptions = await ctx.db
        .select({
          user_id: users.id,
          name: users.name,
        })
        .from(kehimpunan)
        .innerJoin(users, eq(kehimpunan.userId, users.id))
        .where(
          and(
            eq(kehimpunan.lembagaId, input.lembaga_id),
            eq(kehimpunan.division, input.division),
          ),
        );

      return {
        staff_options: staffOptions.map((staff) => ({
          user_id: staff.user_id,
          name: staff.name ?? 'Tidak Diketahui',
        })),
      };
    }),

  chooseBestStaffLembaga: lembagaProcedure
    .input(ChooseBestStaffLembagaInputSchema)
    .output(ChooseBestStaffLembagaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify that lembaga id matches
      if (ctx.session.user.lembagaId! !== input.lembaga_id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Verify the start date and end date is valid
      if (new Date(input.start_date) > new Date(input.end_date)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Start date tidak boleh lebih besar dari end date',
        });
      }

      await ctx.db
        .delete(bestStaffLembaga)
        .where(
          and(
            eq(bestStaffLembaga.lembagaId, input.lembaga_id),
            lte(bestStaffLembaga.startDate, new Date(input.end_date)),
            gte(bestStaffLembaga.endDate, new Date(input.start_date)),
          ),
        );

      // insert to tabel bestStaffKegiatan
      await ctx.db.insert(bestStaffLembaga).values(
        input.best_staff_list.map((staff) => ({
          id: crypto.randomUUID(),
          lembagaId: input.lembaga_id,
          mahasiswaId: staff.user_id,
          division: staff.division,
          startDate: new Date(input.start_date),
          endDate: new Date(input.end_date),
        })),
      );

      return {
        success: true,
      };
    }),

  getLatestBestStaffKegiatan: protectedProcedure
    .input(GetLatestBestStaffKegiatanInputSchema)
    .output(GetLatestBestStaffKegiatanOutputSchema)
    .query(async ({ ctx, input }) => {
      const latestRecord = await ctx.db.query.bestStaffKegiatan.findFirst({
        where: eq(bestStaffKegiatan.eventId, input.event_id),
        orderBy: (bs, { desc }) => [desc(bs.startDate)],
      });

      if (!latestRecord) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const staffList = await ctx.db
        .select({
          user_id: users.id,
          name: users.name,
          image: users.image,
          nim: mahasiswa.nim,
          jurusan: mahasiswa.jurusan,
          division: bestStaffKegiatan.division,
        })
        .from(bestStaffKegiatan)
        .innerJoin(
          mahasiswa,
          eq(bestStaffKegiatan.mahasiswaId, mahasiswa.userId),
        )
        .innerJoin(users, eq(mahasiswa.userId, users.id))
        .where(
          and(
            eq(bestStaffKegiatan.eventId, input.event_id),
            eq(bestStaffKegiatan.startDate, latestRecord.startDate),
            eq(bestStaffKegiatan.endDate, latestRecord.endDate),
          ),
        );

      return {
        start_date: latestRecord.startDate.toISOString(),
        end_date: latestRecord.endDate.toISOString(),
        best_staff_list: staffList.map((staff) => ({
          user_id: staff.user_id,
          name: staff.name ?? 'Tidak Diketahui',
          image: staff.image,
          nim: staff.nim ? staff.nim.toString() : '-',
          jurusan: staff.jurusan ?? 'Tidak Diketahui',
          division: staff.division ?? '',
        })),
      };
    }),

  getLatestBestStaffLembaga: protectedProcedure
    .input(GetLatestBestStaffLembagaInputSchema)
    .output(GetLatestBestStaffLembagaOutputSchema)
    .query(async ({ ctx, input }) => {
      const latestRecord = await ctx.db.query.bestStaffLembaga.findFirst({
        where: eq(bestStaffLembaga.lembagaId, input.lembaga_id),
        orderBy: (bs, { desc }) => [desc(bs.startDate)],
      });

      if (!latestRecord) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const staffList = await ctx.db
        .select({
          user_id: users.id,
          name: users.name,
          image: users.image,
          nim: mahasiswa.nim,
          jurusan: mahasiswa.jurusan,
          division: bestStaffLembaga.division,
        })
        .from(bestStaffLembaga)
        .innerJoin(
          mahasiswa,
          eq(bestStaffLembaga.mahasiswaId, mahasiswa.userId),
        )
        .innerJoin(users, eq(mahasiswa.userId, users.id))
        .where(
          and(
            eq(bestStaffLembaga.lembagaId, input.lembaga_id),
            eq(bestStaffLembaga.startDate, latestRecord.startDate),
            eq(bestStaffLembaga.endDate, latestRecord.endDate),
          ),
        );

      return {
        start_date: latestRecord.startDate.toISOString(),
        end_date: latestRecord.endDate.toISOString(),
        best_staff_list: staffList.map((staff) => ({
          user_id: staff.user_id,
          name: staff.name ?? 'Tidak Diketahui',
          image: staff.image,
          nim: staff.nim ? staff.nim.toString() : '-',
          jurusan: staff.jurusan ?? 'Tidak Diketahui',
          division: staff.division ?? '',
        })),
      };
    }),

  getAllHistoryBestStaffKegiatan: protectedProcedure
    .input(GetAllHistoryBestStaffKegiatanInputSchema)
    .output(GetAllHistoryBestStaffKegiatanOutputSchema)
    .query(async ({ ctx, input }) => {
      const records = await ctx.db
        .select({
          id: bestStaffKegiatan.id,
          startDate: bestStaffKegiatan.startDate,
          endDate: bestStaffKegiatan.endDate,
          user_id: users.id,
          name: users.name,
          image: users.image,
          nim: mahasiswa.nim,
          jurusan: mahasiswa.jurusan,
          division: bestStaffKegiatan.division,
        })
        .from(bestStaffKegiatan)
        .innerJoin(
          mahasiswa,
          eq(bestStaffKegiatan.mahasiswaId, mahasiswa.userId),
        )
        .innerJoin(users, eq(mahasiswa.userId, users.id))
        .where(eq(bestStaffKegiatan.eventId, input.event_id))
        .orderBy(desc(bestStaffKegiatan.startDate));

      const grouped = new Map<
        string,
        {
          startDate: Date;
          endDate: Date;
          staffList: {
            user_id: string;
            name: string;
            image: string | null;
            nim: string;
            jurusan: string;
            division: string;
          }[];
        }
      >();

      for (const record of records) {
        const key =
          record.startDate.toISOString() + '_' + record.endDate.toISOString();

        if (!grouped.has(key)) {
          grouped.set(key, {
            startDate: record.startDate,
            endDate: record.endDate,
            staffList: [],
          });
        }

        grouped.get(key)!.staffList.push({
          user_id: record.user_id,
          name: record.name ?? 'Tidak Diketahui',
          image: record.image,
          nim: record.nim ? record.nim.toString() : '-',
          jurusan: record.jurusan ?? 'Tidak Diketahui',
          division: record.division ?? '',
        });
      }

      return {
        periode: Array.from(grouped.values()).map((group) => ({
          start_date: group.startDate.toISOString(),
          end_date: group.endDate.toISOString(),
          best_staff_list: group.staffList,
        })),
      };
    }),

  getAllHistoryBestStaffLembaga: protectedProcedure
    .input(GetAllHistoryBestStaffLembagaInputSchema)
    .output(GetAllHistoryBestStaffLembagaOutputSchema)
    .query(async ({ ctx, input }) => {
      const records = await ctx.db
        .select({
          id: bestStaffLembaga.id,
          startDate: bestStaffLembaga.startDate,
          endDate: bestStaffLembaga.endDate,
          user_id: users.id,
          name: users.name,
          image: users.image,
          nim: mahasiswa.nim,
          jurusan: mahasiswa.jurusan,
          division: bestStaffLembaga.division,
        })
        .from(bestStaffLembaga)
        .innerJoin(
          mahasiswa,
          eq(bestStaffLembaga.mahasiswaId, mahasiswa.userId),
        )
        .innerJoin(users, eq(mahasiswa.userId, users.id))
        .where(eq(bestStaffLembaga.lembagaId, input.lembaga_id))
        .orderBy(desc(bestStaffLembaga.startDate));

      const grouped = new Map<
        string,
        {
          startDate: Date;
          endDate: Date;
          staffList: {
            user_id: string;
            name: string;
            image: string | null;
            nim: string;
            jurusan: string;
            division: string;
          }[];
        }
      >();

      for (const record of records) {
        const key =
          record.startDate.toISOString() + '_' + record.endDate.toISOString();

        if (!grouped.has(key)) {
          grouped.set(key, {
            startDate: record.startDate,
            endDate: record.endDate,
            staffList: [],
          });
        }

        grouped.get(key)!.staffList.push({
          user_id: record.user_id,
          name: record.name ?? 'Tidak Diketahui',
          image: record.image,
          nim: record.nim ? record.nim.toString() : '-',
          jurusan: record.jurusan ?? 'Tidak Diketahui',
          division: record.division ?? '',
        });
      }

      return {
        periode: Array.from(grouped.values()).map((group) => ({
          start_date: group.startDate.toISOString(),
          end_date: group.endDate.toISOString(),
          best_staff_list: group.staffList,
        })),
      };
    }),

  getAllHistoryBestStaffMahasiswa: protectedProcedure
    .input(GetAllHistoryBestStaffMahasiswaInputSchema)
    .output(GetAllHistoryBestStaffMahasiswaOutputSchema)
    .query(async ({ ctx, input }) => {
      const kegiatanRecords = await ctx.db
        .select({
          event_id: events.id,
          name: events.name,
          start_date: bestStaffKegiatan.startDate,
          end_date: bestStaffKegiatan.endDate,
          division: bestStaffKegiatan.division,
        })
        .from(bestStaffKegiatan)
        .innerJoin(events, eq(bestStaffKegiatan.eventId, events.id))
        .where(eq(bestStaffKegiatan.mahasiswaId, input.mahasiswa_id))
        .orderBy(desc(bestStaffKegiatan.startDate));

      const lembagaRecords = await ctx.db
        .select({
          lembaga_id: lembaga.id,
          event_name: lembaga.name,
          start_date: bestStaffLembaga.startDate,
          end_date: bestStaffLembaga.endDate,
          division: bestStaffLembaga.division,
        })
        .from(bestStaffLembaga)
        .innerJoin(lembaga, eq(bestStaffLembaga.lembagaId, lembaga.id))
        .where(eq(bestStaffLembaga.mahasiswaId, input.mahasiswa_id))
        .orderBy(desc(bestStaffLembaga.startDate));

      return {
        best_staff_kegiatan: kegiatanRecords.map((record) => ({
          event_id: record.event_id ?? '',
          name: record.name ?? '',
          start_date: record.start_date.toISOString(),
          end_date: record.end_date.toISOString(),
          division: record.division ?? '',
        })),
        best_staff_lembaga: lembagaRecords.map((record) => ({
          lembaga_id: record.lembaga_id ?? '',
          event_name: record.event_name ?? '',
          start_date: record.start_date.toISOString(),
          end_date: record.end_date.toISOString(),
          division: record.division ?? '',
        })),
      };
    }),

  deleteBestStaffPeriode: lembagaProcedure
    .input(DeleteBestStaffPeriodeInputSchema)
    .output(DeleteBestStaffPeriodeOutputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.lembaga_id) {
        if (ctx.session.user.lembagaId! !== input.lembaga_id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        await ctx.db
          .delete(bestStaffLembaga)
          .where(
            and(
              eq(bestStaffLembaga.lembagaId, input.lembaga_id),
              eq(bestStaffLembaga.startDate, new Date(input.start_date)),
              eq(bestStaffLembaga.endDate, new Date(input.end_date)),
            ),
          );
      } else if (input.event_id) {
        const event = await ctx.db.query.events.findFirst({
          where: eq(events.id, input.event_id),
        });

        if (!event || event.org_id !== ctx.session.user.lembagaId) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        await ctx.db
          .delete(bestStaffKegiatan)
          .where(
            and(
              eq(bestStaffKegiatan.eventId, input.event_id),
              eq(bestStaffKegiatan.startDate, new Date(input.start_date)),
              eq(bestStaffKegiatan.endDate, new Date(input.end_date)),
            ),
          );
      } else {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Either lembaga_id or event_id must be provided',
        });
      }

      return {
        success: true,
      };
    }),

  getPosisiBidangOptions: lembagaProcedure
    .output(GetPosisiBidangOptionsOutputSchema)
    .query(async ({ ctx }) => {
      const list_posisi_bidang = await ctx.db.query.kehimpunan.findMany({
        where: (kehimpunan, { eq }) =>
          eq(kehimpunan.lembagaId, ctx.session.user.lembagaId!),
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

  toggleRaporVisibility: lembagaProcedure
    .input(ToggleRaporVisibilityLembagaInputSchema)
    .output(ToggleRaporVisibilityLembagaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db
          .update(lembaga)
          .set({
            raporVisible: input.rapor_visible,
          })
          .where(eq(lembaga.id, ctx.session.user.lembagaId!));

        return {
          success: true,
          rapor_visible: input.rapor_visible,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Terjadi kesalahan saat mengubah visibilitas rapor.',
        });
      }
    }),

  reorderAnggotaLembaga: lembagaProcedure
    .input(ReorderAnggotaLembagaInputSchema)
    .output(ReorderAnggotaLembagaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        if (ctx.session.user.lembagaId !== input.lembaga_id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message:
              'Anda tidak memiliki izin untuk mengubah urutan anggota lembaga ini',
          });
        }

        await ctx.db.transaction(async (tx) => {
          for (let i = 0; i < input.user_ids.length; i++) {
            await tx
              .update(kehimpunan)
              .set({ index: i })
              .where(
                and(
                  eq(kehimpunan.userId, input.user_ids[i]!),
                  eq(kehimpunan.lembagaId, input.lembaga_id),
                ),
              );
          }
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengubah urutan anggota',
        });
      }
    }),

  reorderAnggotaKegiatan: lembagaProcedure
    .input(ReorderAnggotaKegiatanInputSchema)
    .output(ReorderAnggotaKegiatanOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.query.events.findFirst({
        where: eq(events.id, input.event_id),
        columns: { org_id: true },
      });

      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Kegiatan tidak ditemukan',
        });
      }
      if (event.org_id !== ctx.session.user.lembagaId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message:
            'Anda tidak memiliki izin untuk mengubah urutan anggota kegiatan ini',
        });
      }

      try {
        await ctx.db.transaction(async (tx) => {
          for (let i = 0; i < input.user_ids.length; i++) {
            await tx
              .update(keanggotaan)
              .set({ index: i })
              .where(
                and(
                  eq(keanggotaan.user_id, input.user_ids[i]!),
                  eq(keanggotaan.event_id, input.event_id),
                ),
              );
          }
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengubah urutan anggota kegiatan',
        });
      }
    }),
});
