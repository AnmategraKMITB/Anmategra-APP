import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import {
  createTRPCRouter,
  eventScopedProcedure,
  lembagaOwnerProcedure,
  lembagaScopedProcedure,
  protectedProcedure,
} from '~/server/api/trpc';
import {
  eventAdmin,
  events,
  lembaga,
  lembagaAdmin,
  mahasiswa,
  users,
} from '~/server/db/schema';

import {
  GetMyManagedEventsOutputSchema,
  GetMyManagedLembagaOutputSchema,
  GrantEventAdminInputSchema,
  GrantEventAdminOutputSchema,
  GrantLembagaAdminInputSchema,
  GrantLembagaAdminOutputSchema,
  ListEventAdminsInputSchema,
  ListEventAdminsOutputSchema,
  ListLembagaAdminsInputSchema,
  ListLembagaAdminsOutputSchema,
  RevokeEventAdminInputSchema,
  RevokeEventAdminOutputSchema,
  RevokeLembagaAdminInputSchema,
  RevokeLembagaAdminOutputSchema,
} from '../types/admin-grant.type';

// Cari akun existing berdasarkan email atau NIM. Tidak pernah bikin akun baru
// (RO-03: Admin harus akun yang sudah terdaftar).
async function findUserByIdentifier(
  db: typeof import('~/server/db').db,
  identifier: string,
): Promise<{ id: string; name: string | null; email: string } | null> {
  const trimmed = identifier.trim();
  if (/^\d+$/.test(trimmed)) {
    const mahasiswaRecord = await db.query.mahasiswa.findFirst({
      where: eq(mahasiswa.nim, parseInt(trimmed)),
      columns: { userId: true },
    });
    if (!mahasiswaRecord) return null;
    const user = await db.query.users.findFirst({
      where: eq(users.id, mahasiswaRecord.userId),
      columns: { id: true, name: true, email: true },
    });
    return user ?? null;
  }
  const user = await db.query.users.findFirst({
    where: eq(users.email, trimmed),
    columns: { id: true, name: true, email: true },
  });
  return user ?? null;
}

async function attachNim<T extends { userId: string }>(
  db: typeof import('~/server/db').db,
  rows: T[],
): Promise<(T & { nim: number | null })[]> {
  if (rows.length === 0) return [];
  const mahasiswaRows = await db.query.mahasiswa.findMany({
    where: inArray(
      mahasiswa.userId,
      rows.map((r) => r.userId),
    ),
    columns: { userId: true, nim: true },
  });
  const nimByUserId = new Map(mahasiswaRows.map((m) => [m.userId, m.nim]));
  return rows.map((row) => ({ ...row, nim: nimByUserId.get(row.userId) ?? null }));
}

// NOTE: sengaja tidak pakai relational query builder `with` di sini —
// dikombinasikan dengan besarnya jumlah tabel/relasi di schema.ts, TS
// infer beberapa relasi jadi union `T | T[]` yang salah. Fetch manual
// (batch by id) di bawah ini menghindari masalah itu.
async function fetchUsersById(
  db: typeof import('~/server/db').db,
  userIds: string[],
) {
  if (userIds.length === 0) return new Map<string, { name: string | null; email: string }>();
  const rows = await db.query.users.findMany({
    where: inArray(users.id, userIds),
    columns: { id: true, name: true, email: true },
  });
  return new Map(rows.map((row) => [row.id, { name: row.name, email: row.email }]));
}

export const adminGrantRouter = createTRPCRouter({
  grantLembagaAdmin: lembagaOwnerProcedure
    .input(GrantLembagaAdminInputSchema)
    .output(GrantLembagaAdminOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const target = await findUserByIdentifier(ctx.db, input.identifier);
      if (!target) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'Akun dengan email/NIM tersebut belum terdaftar di sistem.',
        });
      }

      const lembagaRow = await ctx.db.query.lembaga.findFirst({
        where: eq(lembaga.id, input.lembagaId),
        columns: { userId: true },
      });
      if (target.id === lembagaRow?.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Akun tersebut sudah menjadi Owner lembaga ini.',
        });
      }

      const existing = await ctx.db.query.lembagaAdmin.findFirst({
        where: and(
          eq(lembagaAdmin.lembagaId, input.lembagaId),
          eq(lembagaAdmin.userId, target.id),
        ),
      });

      if (existing) {
        await ctx.db
          .update(lembagaAdmin)
          .set({
            status: 'active',
            grantedBy: ctx.session.user.id,
            revokedAt: null,
            revokedBy: null,
          })
          .where(eq(lembagaAdmin.id, existing.id));
      } else {
        await ctx.db.insert(lembagaAdmin).values({
          lembagaId: input.lembagaId,
          userId: target.id,
          grantedBy: ctx.session.user.id,
        });
      }

      return { success: true };
    }),

  revokeLembagaAdmin: lembagaOwnerProcedure
    .input(RevokeLembagaAdminInputSchema)
    .output(RevokeLembagaAdminOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(lembagaAdmin)
        .set({
          status: 'revoked',
          revokedAt: new Date(),
          revokedBy: ctx.session.user.id,
        })
        .where(
          and(
            eq(lembagaAdmin.lembagaId, input.lembagaId),
            eq(lembagaAdmin.userId, input.userId),
          ),
        );

      return { success: true };
    }),

  listLembagaAdmins: lembagaScopedProcedure
    .input(ListLembagaAdminsInputSchema)
    .output(ListLembagaAdminsOutputSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.lembagaAdmin.findMany({
        where: and(
          eq(lembagaAdmin.lembagaId, input.lembagaId),
          eq(lembagaAdmin.status, 'active'),
        ),
      });

      const userById = await fetchUsersById(
        ctx.db,
        rows.map((row) => row.userId),
      );

      const withNim = await attachNim(
        ctx.db,
        rows.map((row) => ({
          userId: row.userId,
          name: userById.get(row.userId)?.name ?? null,
          email: userById.get(row.userId)?.email ?? '',
          grantedAt: row.created_at,
        })),
      );

      return withNim;
    }),

  grantEventAdmin: lembagaScopedProcedure
    .input(GrantEventAdminInputSchema)
    .output(GrantEventAdminOutputSchema)
    .mutation(async ({ ctx, input }) => {
      // event harus di bawah lembaga yang di-scope oleh lembagaScopedProcedure
      const eventRow = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.eventId),
          eq(events.org_id, ctx.lembagaId),
        ),
        columns: { id: true },
      });
      if (!eventRow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Kegiatan tidak ditemukan di lembaga ini.',
        });
      }

      const target = await findUserByIdentifier(ctx.db, input.identifier);
      if (!target) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'Akun dengan email/NIM tersebut belum terdaftar di sistem.',
        });
      }

      const existing = await ctx.db.query.eventAdmin.findFirst({
        where: and(
          eq(eventAdmin.eventId, input.eventId),
          eq(eventAdmin.userId, target.id),
        ),
      });

      if (existing) {
        await ctx.db
          .update(eventAdmin)
          .set({
            status: 'active',
            grantedBy: ctx.session.user.id,
            revokedAt: null,
            revokedBy: null,
          })
          .where(eq(eventAdmin.id, existing.id));
      } else {
        await ctx.db.insert(eventAdmin).values({
          eventId: input.eventId,
          userId: target.id,
          grantedBy: ctx.session.user.id,
        });
      }

      return { success: true };
    }),

  // Revoke event admin sengaja di-scope lewat lembagaId (Owner/Admin Lembaga),
  // bukan eventScopedProcedure, supaya Admin Kepanitiaan (event-only grant)
  // tidak bisa mencabut akses admin kepanitiaan lain.
  revokeEventAdmin: lembagaScopedProcedure
    .input(RevokeEventAdminInputSchema)
    .output(RevokeEventAdminOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const eventRow = await ctx.db.query.events.findFirst({
        where: and(
          eq(events.id, input.eventId),
          eq(events.org_id, ctx.lembagaId),
        ),
        columns: { id: true },
      });
      if (!eventRow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Kegiatan tidak ditemukan di lembaga ini.',
        });
      }

      await ctx.db
        .update(eventAdmin)
        .set({
          status: 'revoked',
          revokedAt: new Date(),
          revokedBy: ctx.session.user.id,
        })
        .where(
          and(
            eq(eventAdmin.eventId, input.eventId),
            eq(eventAdmin.userId, input.userId),
          ),
        );

      return { success: true };
    }),

  listEventAdmins: eventScopedProcedure
    .input(ListEventAdminsInputSchema)
    .output(ListEventAdminsOutputSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.eventAdmin.findMany({
        where: and(
          eq(eventAdmin.eventId, input.eventId),
          eq(eventAdmin.status, 'active'),
        ),
      });

      const userById = await fetchUsersById(
        ctx.db,
        rows.map((row) => row.userId),
      );

      const withNim = await attachNim(
        ctx.db,
        rows.map((row) => ({
          userId: row.userId,
          name: userById.get(row.userId)?.name ?? null,
          email: userById.get(row.userId)?.email ?? '',
          grantedAt: row.created_at,
        })),
      );

      return withNim;
    }),

  getMyManagedLembaga: protectedProcedure
    .output(GetMyManagedLembagaOutputSchema)
    .query(async ({ ctx }) => {
      const result: {
        lembagaId: string;
        lembagaNama: string;
        access: 'owner' | 'admin';
      }[] = [];

      if (ctx.session.user.role === 'lembaga' && ctx.session.user.lembagaId) {
        const ownedLembaga = await ctx.db.query.lembaga.findFirst({
          where: eq(lembaga.id, ctx.session.user.lembagaId),
          columns: { id: true, name: true },
        });
        if (ownedLembaga) {
          result.push({
            lembagaId: ownedLembaga.id,
            lembagaNama: ownedLembaga.name,
            access: 'owner',
          });
        }
      }

      const grants = await ctx.db.query.lembagaAdmin.findMany({
        where: and(
          eq(lembagaAdmin.userId, ctx.session.user.id),
          eq(lembagaAdmin.status, 'active'),
        ),
      });

      if (grants.length > 0) {
        const lembagaRows = await ctx.db.query.lembaga.findMany({
          where: inArray(
            lembaga.id,
            grants.map((g) => g.lembagaId),
          ),
          columns: { id: true, name: true },
        });
        const lembagaById = new Map(lembagaRows.map((l) => [l.id, l]));

        for (const grant of grants) {
          const lembagaRow = lembagaById.get(grant.lembagaId);
          if (!lembagaRow) continue;
          result.push({
            lembagaId: lembagaRow.id,
            lembagaNama: lembagaRow.name,
            access: 'admin',
          });
        }
      }

      return result;
    }),

  getMyManagedEvents: protectedProcedure
    .output(GetMyManagedEventsOutputSchema)
    .query(async ({ ctx }) => {
      const grants = await ctx.db.query.eventAdmin.findMany({
        where: and(
          eq(eventAdmin.userId, ctx.session.user.id),
          eq(eventAdmin.status, 'active'),
        ),
      });

      if (grants.length === 0) return [];

      const eventRows = await ctx.db.query.events.findMany({
        where: inArray(
          events.id,
          grants.map((g) => g.eventId),
        ),
        columns: { id: true, name: true, org_id: true },
      });
      const eventById = new Map(eventRows.map((e) => [e.id, e]));

      return grants
        .map((grant) => eventById.get(grant.eventId))
        .filter((event): event is NonNullable<typeof event> => Boolean(event))
        .map((event) => ({
          eventId: event.id,
          eventNama: event.name,
          lembagaId: event.org_id,
          access: 'admin' as const,
        }));
    }),
});
