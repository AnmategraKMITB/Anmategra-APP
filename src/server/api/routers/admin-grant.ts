import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import {
  listManagedEvents,
  listManagedLembaga,
  hasManagedScope,
} from '~/server/api/managed-scope';
import {
  createTRPCRouter,
  eventScopedProcedure,
  lembagaOwnerProcedure,
  lembagaScopedProcedure,
  protectedProcedure,
} from '~/server/api/trpc';
import {
  accessGrant,
  events,
  lembaga,
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
  HasManagedScopeOutputSchema,
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

      const existing = await ctx.db.query.accessGrant.findFirst({
        where: and(
          eq(accessGrant.lembagaId, input.lembagaId),
          eq(accessGrant.userId, target.id),
        ),
      });

      if (existing) {
        await ctx.db
          .update(accessGrant)
          .set({
            status: 'active',
            features: input.features,
            grantedBy: ctx.session.user.id,
            revokedAt: null,
            revokedBy: null,
          })
          .where(eq(accessGrant.id, existing.id));
      } else {
        await ctx.db.insert(accessGrant).values({
          lembagaId: input.lembagaId,
          userId: target.id,
          features: input.features,
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
        .update(accessGrant)
        .set({
          status: 'revoked',
          revokedAt: new Date(),
          revokedBy: ctx.session.user.id,
        })
        .where(
          and(
            eq(accessGrant.lembagaId, input.lembagaId),
            eq(accessGrant.userId, input.userId),
          ),
        );

      return { success: true };
    }),

  listLembagaAdmins: lembagaScopedProcedure
    .input(ListLembagaAdminsInputSchema)
    .output(ListLembagaAdminsOutputSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.accessGrant.findMany({
        where: and(
          eq(accessGrant.lembagaId, input.lembagaId),
          eq(accessGrant.status, 'active'),
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
          features: row.features,
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

      const existing = await ctx.db.query.accessGrant.findFirst({
        where: and(
          eq(accessGrant.periodId, input.eventId),
          eq(accessGrant.userId, target.id),
        ),
      });

      if (existing) {
        await ctx.db
          .update(accessGrant)
          .set({
            status: 'active',
            features: input.features,
            grantedBy: ctx.session.user.id,
            revokedAt: null,
            revokedBy: null,
          })
          .where(eq(accessGrant.id, existing.id));
      } else {
        await ctx.db.insert(accessGrant).values({
          periodId: input.eventId,
          userId: target.id,
          features: input.features,
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
        .update(accessGrant)
        .set({
          status: 'revoked',
          revokedAt: new Date(),
          revokedBy: ctx.session.user.id,
        })
        .where(
          and(
            eq(accessGrant.periodId, input.eventId),
            eq(accessGrant.userId, input.userId),
          ),
        );

      return { success: true };
    }),

  listEventAdmins: eventScopedProcedure
    .input(ListEventAdminsInputSchema)
    .output(ListEventAdminsOutputSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.accessGrant.findMany({
        where: and(
          eq(accessGrant.periodId, input.eventId),
          eq(accessGrant.status, 'active'),
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
          features: row.features,
        })),
      );

      return withNim;
    }),

  getMyManagedLembaga: protectedProcedure
    .output(GetMyManagedLembagaOutputSchema)
    .query(({ ctx }) => listManagedLembaga(ctx.db, ctx.session.user)),

  getMyManagedEvents: protectedProcedure
    .output(GetMyManagedEventsOutputSchema)
    .query(({ ctx }) => listManagedEvents(ctx.db, ctx.session.user)),

  hasManagedScope: protectedProcedure
    .output(HasManagedScopeOutputSchema)
    .query(({ ctx }) => hasManagedScope(ctx.db, ctx.session.user)),
});
