import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import {
  createTRPCRouter,
  lembagaProcedure,
  protectedProcedure,
} from '~/server/api/trpc';
import {
  events,
  keanggotaan,
  kehimpunan,
  lembaga,
  mahasiswa,
  nilaiProfilKegiatan,
  nilaiProfilLembaga,
  profilKegiatan,
  profilLembaga,
  users,
} from '~/server/db/schema';

import {
  GetAllNilaiProfilKegiatanInputSchema,
  GetAllNilaiProfilKegiatanOutputSchema,
  GetAllNilaiProfilLembagaInputSchema,
  GetAllNilaiProfilLembagaOutputSchema,
  GetNilaiKegiatanIndividuInputSchema,
  GetNilaiKegiatanIndividuOutputSchema,
  GetNilaiLembagaIndividuInputSchema,
  GetNilaiLembagaIndividuOutputSchema,
  UpsertNilaiMahasiswaKegiatanInputSchema,
  UpsertNilaiMahasiswaKegiatanOutputSchema,
  UpsertNilaiMahasiswaLembagaInputSchema,
  UpsertNilaiMahasiswaLembagaOutputSchema,
} from '../types/rapor.type';

export const raporRouter = createTRPCRouter({
  getAllNilaiProfilKegiatan: lembagaProcedure
    .input(GetAllNilaiProfilKegiatanInputSchema)
    .output(GetAllNilaiProfilKegiatanOutputSchema)
    .query(async ({ ctx, input }) => {
      try {
        const event = await ctx.db.query.events.findFirst({
          where: (event, { eq }) => eq(event.id, input.event_id),
          columns: { org_id: true },
        });

        if (!event || event.org_id !== ctx.session.user.lembagaId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this event.',
          });
        }

        const mahasiswaList = await ctx.db
          .select({
            user_id: keanggotaan.user_id,
            name: users.name,
            nim: mahasiswa.nim,
          })
          .from(keanggotaan)
          .innerJoin(mahasiswa, eq(mahasiswa.userId, keanggotaan.user_id))
          .innerJoin(users, eq(users.id, keanggotaan.user_id))
          .where(eq(keanggotaan.event_id, input.event_id))
          .orderBy(keanggotaan.index, mahasiswa.nim);

        const mahasiswaIds = mahasiswaList.map((m) => m.user_id);

        const nilaiList = await ctx.db
          .select({
            user_id: nilaiProfilKegiatan.mahasiswaId,
            profil_id: nilaiProfilKegiatan.profilId,
            nilai: nilaiProfilKegiatan.nilai,
          })
          .from(nilaiProfilKegiatan)
          .innerJoin(
            profilKegiatan,
            eq(nilaiProfilKegiatan.profilId, profilKegiatan.id),
          )
          .where(
            and(
              eq(profilKegiatan.eventId, input.event_id),
              inArray(nilaiProfilKegiatan.mahasiswaId, mahasiswaIds),
            ),
          );

        const nilaiPerMahasiswa = new Map<
          string,
          { profil_id: string; nilai: number }[]
        >();
        for (const n of nilaiList) {
          if (!nilaiPerMahasiswa.has(n.user_id)) {
            nilaiPerMahasiswa.set(n.user_id, []);
          }
          nilaiPerMahasiswa.get(n.user_id)!.push({
            profil_id: n.profil_id,
            nilai: n.nilai
              ? n.nilai < 0
                ? 0
                : n.nilai > 100
                  ? 100
                  : n.nilai
              : 0,
          });
        }

        const formattedMahasiswaList = mahasiswaList.map((m) => ({
          user_id: m.user_id,
          name: m.name ?? '',
          nim: m.nim.toString() ?? '',
          nilai: nilaiPerMahasiswa.get(m.user_id) ?? [],
        }));

        return { mahasiswa: formattedMahasiswaList };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengambil data nilai profil kegiatan',
        });
      }
    }),

  getNilaiKegiatanIndividu: lembagaProcedure
    .input(GetNilaiKegiatanIndividuInputSchema)
    .output(GetNilaiKegiatanIndividuOutputSchema)
    .query(async ({ ctx, input }) => {
      try {
        const event = await ctx.db.query.events.findFirst({
          where: (event, { eq }) => eq(event.id, input.event_id),
          columns: { org_id: true, rapor_visible: true },
        });

        if (!event) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Event tidak ditemukan.',
          });
        }

        if (
          !event.rapor_visible &&
          event.org_id !== ctx.session.user.lembagaId
        ) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this event.',
          });
        }

        const mhs = await ctx.db
          .select({
            user_id: keanggotaan.user_id,
            name: users.name,
            nim: mahasiswa.nim,
            jurusan: mahasiswa.jurusan,
            lineId: mahasiswa.lineId,
            whatsapp: mahasiswa.whatsapp,
            division: keanggotaan.division,
            position: keanggotaan.position,
          })
          .from(keanggotaan)
          .innerJoin(mahasiswa, eq(mahasiswa.userId, keanggotaan.user_id))
          .innerJoin(users, eq(users.id, keanggotaan.user_id))
          .where(
            and(
              eq(keanggotaan.event_id, input.event_id),
              eq(keanggotaan.user_id, input.mahasiswa_id),
            ),
          )
          .limit(1);

        if (!mhs.length)
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Mahasiswa tidak ditemukan',
          });

        const dataMahasiswa = mhs[0]!;

        const nilaiList = await ctx.db
          .select({
            profil_id: profilKegiatan.id,
            profil_name: profilKegiatan.name,
            nilai: nilaiProfilKegiatan.nilai,
          })
          .from(profilKegiatan)
          .leftJoin(
            nilaiProfilKegiatan,
            and(
              eq(nilaiProfilKegiatan.profilId, profilKegiatan.id),
              eq(nilaiProfilKegiatan.mahasiswaId, input.mahasiswa_id),
            ),
          )
          .where(and(eq(profilKegiatan.eventId, input.event_id)));

        const formattedNilaiList = nilaiList.map(
          ({ profil_id, profil_name, nilai }) => ({
            profil_id,
            profil_name,
            nilai: nilai ?? 0,
          }),
        );

        return {
          user_id: dataMahasiswa.user_id,
          name: dataMahasiswa.name ?? '',
          nim: dataMahasiswa.nim.toString() ?? '',
          jurusan: dataMahasiswa.jurusan ?? '',
          lineId: dataMahasiswa.lineId ?? '',
          whatsapp: dataMahasiswa.whatsapp ?? '',
          division: dataMahasiswa.division ?? '',
          position: dataMahasiswa.position ?? '',
          nilai: formattedNilaiList,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengambil nilai individu',
        });
      }
    }),

  upsertNilaiMahasiswaKegiatan: lembagaProcedure
    .input(UpsertNilaiMahasiswaKegiatanInputSchema)
    .output(UpsertNilaiMahasiswaKegiatanOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          const lembagaId: string = ctx.session.user.lembagaId!;
          const { event_id } = input;

          const eventValid = await tx.query.events.findFirst({
            where: and(eq(events.id, event_id), eq(events.org_id, lembagaId)),
          });

          if (!eventValid) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Event tidak valid atau tidak dimiliki lembaga ini.',
            });
          }

          for (const mahasiswa of input.mahasiswa) {
            for (const n of mahasiswa.nilai) {
              const profilValid = await tx.query.profilKegiatan.findFirst({
                where: and(
                  eq(profilKegiatan.id, n.profil_id),
                  eq(profilKegiatan.eventId, event_id),
                ),
              });

              if (!profilValid) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: `Profil ${n.profil_id} tidak valid untuk event ${event_id}.`,
                });
              }

              const existing = await tx.query.nilaiProfilKegiatan.findFirst({
                where: and(
                  eq(nilaiProfilKegiatan.mahasiswaId, mahasiswa.user_id),
                  eq(nilaiProfilKegiatan.profilId, n.profil_id),
                ),
              });

              if (existing) {
                await tx
                  .update(nilaiProfilKegiatan)
                  .set({ nilai: n.nilai })
                  .where(eq(nilaiProfilKegiatan.id, existing.id));
              } else {
                await tx.insert(nilaiProfilKegiatan).values({
                  mahasiswaId: mahasiswa.user_id,
                  profilId: n.profil_id,
                  nilai: n.nilai,
                });
              }
            }
          }
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengupdate nilai mahasiswa.',
        });
      }
    }),
  getAllNilaiProfilLembaga: lembagaProcedure
    .input(GetAllNilaiProfilLembagaInputSchema)
    .output(GetAllNilaiProfilLembagaOutputSchema)
    .query(async ({ ctx, input }) => {
      try {
        if (ctx.session.user.lembagaId !== input.lembaga_id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this lembaga.',
          });
        }

        const anggotaList = await ctx.db
          .select({
            user_id: users.id,
            name: users.name,
            nim: mahasiswa.nim,
          })
          .from(kehimpunan)
          .innerJoin(users, eq(kehimpunan.userId, users.id))
          .innerJoin(mahasiswa, eq(users.id, mahasiswa.userId))
          .where(eq(kehimpunan.lembagaId, input.lembaga_id))
          .orderBy(kehimpunan.index, mahasiswa.nim);

        const anggotaIds = anggotaList.map((a) => a.user_id);

        const nilaiList = await ctx.db
          .select({
            user_id: nilaiProfilLembaga.mahasiswaId,
            profil_id: nilaiProfilLembaga.profilId,
            nilai: nilaiProfilLembaga.nilai,
          })
          .from(nilaiProfilLembaga)
          .innerJoin(
            profilLembaga,
            eq(nilaiProfilLembaga.profilId, profilLembaga.id),
          )
          .where(
            and(
              eq(profilLembaga.lembagaId, input.lembaga_id),
              inArray(nilaiProfilLembaga.mahasiswaId, anggotaIds),
            ),
          );

        const nilaiPerAnggota = new Map<
          string,
          { profil_id: string; nilai: number }[]
        >();
        for (const n of nilaiList) {
          if (!nilaiPerAnggota.has(n.user_id))
            nilaiPerAnggota.set(n.user_id, []);
          nilaiPerAnggota.get(n.user_id)!.push({
            profil_id: n.profil_id,
            nilai: n.nilai ?? 0,
          });
        }

        const formattedAnggotaList = anggotaList.map((a) => ({
          user_id: a.user_id,
          name: a.name ?? '',
          nim: a.nim.toString() ?? '',
          nilai: nilaiPerAnggota.get(a.user_id) ?? [],
        }));

        return { mahasiswa: formattedAnggotaList };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengambil data anggota lembaga',
        });
      }
    }),

  getNilaiLembagaIndividu: lembagaProcedure
    .input(GetNilaiLembagaIndividuInputSchema)
    .output(GetNilaiLembagaIndividuOutputSchema)
    .query(async ({ ctx, input }) => {
      try {
        const [lembagaUser] = await ctx.db
          .select()
          .from(lembaga)
          .where(eq(lembaga.id, input.lembaga_id))
          .limit(1);

        if (!lembagaUser) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Lembaga tidak ditemukan.',
          });
        }

        if (
          !lembagaUser.raporVisible &&
          ctx.session.user.lembagaId !== input.lembaga_id
        ) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this lembaga.',
          });
        }

        const mhs = await ctx.db
          .select({
            user_id: kehimpunan.userId,
            name: users.name,
            nim: mahasiswa.nim,
            jurusan: mahasiswa.jurusan,
            lineId: mahasiswa.lineId,
            whatsapp: mahasiswa.whatsapp,
            division: kehimpunan.division,
            position: kehimpunan.position,
          })
          .from(kehimpunan)
          .innerJoin(mahasiswa, eq(mahasiswa.userId, kehimpunan.userId))
          .innerJoin(users, eq(users.id, kehimpunan.userId))
          .where(
            and(
              eq(kehimpunan.lembagaId, input.lembaga_id),
              eq(kehimpunan.userId, input.mahasiswa_id),
            ),
          )
          .limit(1);

        if (!mhs.length)
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Mahasiswa tidak ditemukan',
          });

        const dataMahasiswa = mhs[0]!;

        const nilaiList = await ctx.db
          .select({
            profil_id: profilLembaga.id,
            profil_name: profilLembaga.name,
            nilai: nilaiProfilLembaga.nilai,
          })
          .from(profilLembaga)
          .leftJoin(
            nilaiProfilLembaga,
            and(
              eq(nilaiProfilLembaga.profilId, profilLembaga.id),
              eq(nilaiProfilLembaga.mahasiswaId, input.mahasiswa_id),
            ),
          )
          .where(and(eq(profilLembaga.lembagaId, input.lembaga_id)));

        const formattedNilaiList = nilaiList.map(
          ({ profil_id, profil_name, nilai }) => ({
            profil_id,
            profil_name,
            nilai: nilai ?? 0,
          }),
        );

        return {
          user_id: dataMahasiswa.user_id,
          name: dataMahasiswa.name ?? '',
          nim: dataMahasiswa.nim.toString() ?? '',
          jurusan: dataMahasiswa.jurusan ?? '',
          lineId: dataMahasiswa.lineId ?? '',
          whatsapp: dataMahasiswa.whatsapp ?? '',
          division: dataMahasiswa.division ?? '',
          position: dataMahasiswa.position ?? '',
          nilai: formattedNilaiList,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengambil nilai individu lembaga',
        });
      }
    }),

  upsertNilaiMahasiswaLembaga: lembagaProcedure
    .input(UpsertNilaiMahasiswaLembagaInputSchema)
    .output(UpsertNilaiMahasiswaLembagaOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.transaction(async (tx) => {
          const lembagaId: string = ctx.session.user.lembagaId!;

          for (const mahasiswa of input.mahasiswa) {
            for (const n of mahasiswa.nilai) {
              const profilValid = await tx.query.profilLembaga.findFirst({
                where: and(
                  eq(profilLembaga.id, n.profil_id),
                  eq(profilLembaga.lembagaId, lembagaId),
                ),
              });

              if (!profilValid) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: `Profil ${n.profil_id} tidak valid untuk lembaga ini.`,
                });
              }

              const existing = await tx.query.nilaiProfilLembaga.findFirst({
                where: and(
                  eq(nilaiProfilLembaga.mahasiswaId, mahasiswa.user_id),
                  eq(nilaiProfilLembaga.profilId, n.profil_id),
                ),
              });

              if (existing) {
                await tx
                  .update(nilaiProfilLembaga)
                  .set({ nilai: n.nilai })
                  .where(eq(nilaiProfilLembaga.id, existing.id));
              } else {
                await tx.insert(nilaiProfilLembaga).values({
                  mahasiswaId: mahasiswa.user_id,
                  profilId: n.profil_id,
                  nilai: n.nilai,
                });
              }
            }
          }
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengupdate nilai mahasiswa.',
        });
      }
    }),

  // Public procedures for mahasiswa to view rapor if visible
  getNilaiKegiatanIndividuPublic: protectedProcedure
    .input(GetNilaiKegiatanIndividuInputSchema)
    .output(GetNilaiKegiatanIndividuOutputSchema)
    .query(async ({ ctx, input }) => {
      try {
        const event = await ctx.db.query.events.findFirst({
          where: (event, { eq }) => eq(event.id, input.event_id),
          columns: { org_id: true, rapor_visible: true },
          with: {
            lembaga: {
              columns: { id: true },
            },
          },
        });

        if (!event) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Event tidak ditemukan',
          });
        }

        if (!event.rapor_visible) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Rapor tidak dapat diakses',
          });
        }

        const mhs = await ctx.db
          .select({
            user_id: keanggotaan.user_id,
            name: users.name,
            nim: mahasiswa.nim,
            jurusan: mahasiswa.jurusan,
            lineId: mahasiswa.lineId,
            whatsapp: mahasiswa.whatsapp,
            division: keanggotaan.division,
            position: keanggotaan.position,
            raporVisible: mahasiswa.raporVisible,
          })
          .from(keanggotaan)
          .innerJoin(mahasiswa, eq(mahasiswa.userId, keanggotaan.user_id))
          .innerJoin(users, eq(users.id, keanggotaan.user_id))
          .where(
            and(
              eq(keanggotaan.event_id, input.event_id),
              eq(keanggotaan.user_id, input.mahasiswa_id),
            ),
          )
          .limit(1);

        if (!mhs.length)
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Mahasiswa tidak ditemukan',
          });

        const dataMahasiswa = mhs[0]!;

        if (input.mahasiswa_id !== ctx.session.user.id && !dataMahasiswa.raporVisible) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Rapor mahasiswa tidak dapat diakses',
          });
        }

        const nilaiList = await ctx.db
          .select({
            profil_id: profilKegiatan.id,
            profil_name: profilKegiatan.name,
            nilai: nilaiProfilKegiatan.nilai,
          })
          .from(profilKegiatan)
          .leftJoin(
            nilaiProfilKegiatan,
            and(
              eq(nilaiProfilKegiatan.profilId, profilKegiatan.id),
              eq(nilaiProfilKegiatan.mahasiswaId, input.mahasiswa_id),
            ),
          )
          .where(and(eq(profilKegiatan.eventId, input.event_id)));

        const formattedNilaiList = nilaiList.map(
          ({ profil_id, profil_name, nilai }) => ({
            profil_id,
            profil_name,
            nilai: nilai ?? 0,
          }),
        );

        return {
          user_id: dataMahasiswa.user_id,
          name: dataMahasiswa.name ?? '',
          nim: dataMahasiswa.nim.toString() ?? '',
          jurusan: dataMahasiswa.jurusan ?? '',
          lineId: dataMahasiswa.lineId ?? '',
          whatsapp: dataMahasiswa.whatsapp ?? '',
          division: dataMahasiswa.division ?? '',
          position: dataMahasiswa.position ?? '',
          nilai: formattedNilaiList,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengambil nilai individu',
        });
      }
    }),

  getNilaiLembagaIndividuPublic: protectedProcedure
    .input(GetNilaiLembagaIndividuInputSchema)
    .output(GetNilaiLembagaIndividuOutputSchema)
    .query(async ({ ctx, input }) => {
      try {
        const lembagaData = await ctx.db.query.lembaga.findFirst({
          where: (lembaga, { eq }) => eq(lembaga.id, input.lembaga_id),
          columns: { id: true, raporVisible: true },
        });

        if (!lembagaData) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Lembaga tidak ditemukan',
          });
        }

        if (!lembagaData.raporVisible) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Rapor tidak dapat diakses',
          });
        }

        const mhs = await ctx.db
          .select({
            user_id: kehimpunan.userId,
            name: users.name,
            nim: mahasiswa.nim,
            jurusan: mahasiswa.jurusan,
            lineId: mahasiswa.lineId,
            whatsapp: mahasiswa.whatsapp,
            division: kehimpunan.division,
            position: kehimpunan.position,
            raporVisible: mahasiswa.raporVisible,
          })
          .from(kehimpunan)
          .innerJoin(mahasiswa, eq(mahasiswa.userId, kehimpunan.userId))
          .innerJoin(users, eq(users.id, kehimpunan.userId))
          .where(
            and(
              eq(kehimpunan.lembagaId, input.lembaga_id),
              eq(kehimpunan.userId, input.mahasiswa_id),
            ),
          )
          .limit(1);

        if (!mhs.length)
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Mahasiswa tidak ditemukan',
          });

        const dataMahasiswa = mhs[0]!;

        if (input.mahasiswa_id !== ctx.session.user.id && !dataMahasiswa.raporVisible) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Rapor mahasiswa tidak dapat diakses',
          });
        }

        const nilaiList = await ctx.db
          .select({
            profil_id: profilLembaga.id,
            profil_name: profilLembaga.name,
            nilai: nilaiProfilLembaga.nilai,
          })
          .from(profilLembaga)
          .leftJoin(
            nilaiProfilLembaga,
            and(
              eq(nilaiProfilLembaga.profilId, profilLembaga.id),
              eq(nilaiProfilLembaga.mahasiswaId, input.mahasiswa_id),
            ),
          )
          .where(and(eq(profilLembaga.lembagaId, input.lembaga_id)));

        const formattedNilaiList = nilaiList.map(
          ({ profil_id, profil_name, nilai }) => ({
            profil_id,
            profil_name,
            nilai: nilai ?? 0,
          }),
        );

        return {
          user_id: dataMahasiswa.user_id,
          name: dataMahasiswa.name ?? '',
          nim: dataMahasiswa.nim.toString() ?? '',
          jurusan: dataMahasiswa.jurusan ?? '',
          lineId: dataMahasiswa.lineId ?? '',
          whatsapp: dataMahasiswa.whatsapp ?? '',
          division: dataMahasiswa.division ?? '',
          position: dataMahasiswa.position ?? '',
          nilai: formattedNilaiList,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gagal mengambil nilai individu lembaga',
        });
      }
    }),
});
