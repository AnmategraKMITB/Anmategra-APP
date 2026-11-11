import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { canManageLembaga } from '~/server/api/access';
import {
  createTRPCRouter,
  eventScopedProcedure,
  lembagaOwnerProcedure,
  lembagaScopedProcedure,
  protectedProcedure,
} from '~/server/api/trpc';
import {
  accessGrant,
  adminAudit,
  events,
  lembaga,
  mahasiswa,
  users,
} from '~/server/db/schema';

import {
  GetMyManagedEventsOutputSchema,
  KelolaAdminAccessInputSchema,
  KelolaAdminAccessOutputSchema,
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

type Db = typeof import('~/server/db').db;
const MAX_TREE_DEPTH = 16;
const NOT_REGISTERED_MESSAGE =
  'Akun dengan email/NIM tersebut belum terdaftar di sistem.';
const FORBIDDEN_FEATURE_MESSAGE =
  'Anda tidak dapat memberi akses yang tidak Anda miliki.';

async function writeAudit(
  db: Db,
  actorId: string,
  action: 'grant_set' | 'grant_revoke',
  entityType: 'lembaga' | 'event',
  entityId: string,
  summary: string,
  metadata: Record<string, unknown>,
) {
  await db
    .insert(adminAudit)
    .values({ actorId, action, entityType, entityId, summary, metadata });
}

/**
 * Admin Lembaga hanya boleh memberi fitur yang ia miliki. Owner dan akun
 * `admin` sistem tanpa batas; fitur `admin` berarti semua fitur.
 */
async function assertGrantableFeatures(
  db: Db,
  user: { id: string; role: string },
  access: 'owner' | 'admin',
  lembagaId: string,
  features: readonly string[],
) {
  if (access === 'owner' || user.role === 'admin') return;
  const grants = await db.query.accessGrant.findMany({
    where: and(
      eq(accessGrant.userId, user.id),
      eq(accessGrant.lembagaId, lembagaId),
      eq(accessGrant.status, 'active'),
    ),
    columns: { features: true },
  });
  // Tanpa hibah langsung, akses datang dari propagasi/operator (penuh).
  if (grants.length === 0) return;
  const owned = new Set(grants.flatMap((g) => g.features));
  if (owned.has('admin')) return;
  if (features.some((f) => !owned.has(f))) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: FORBIDDEN_FEATURE_MESSAGE,
    });
  }
}

/** Hibah `propagate` dari induk lembaga ini, naik sampai akar. */
async function listInheritedGrants(db: Db, lembagaId: string) {
  const ancestors: { id: string; name: string }[] = [];
  const visited = new Set<string>([lembagaId]);
  let current = lembagaId;
  for (let depth = 0; depth < MAX_TREE_DEPTH; depth++) {
    const row = await db.query.lembaga.findFirst({
      where: eq(lembaga.id, current),
      columns: { parentId: true },
    });
    const parentId = row?.parentId;
    if (!parentId || visited.has(parentId)) break;
    const parent = await db.query.lembaga.findFirst({
      where: eq(lembaga.id, parentId),
      columns: { id: true, name: true },
    });
    if (!parent) break;
    ancestors.push({ id: parent.id, name: parent.name });
    visited.add(parentId);
    current = parentId;
  }
  if (ancestors.length === 0) return [];
  const rows = await db.query.accessGrant.findMany({
    where: and(
      inArray(accessGrant.lembagaId, ancestors.map((a) => a.id)),
      eq(accessGrant.status, 'active'),
      eq(accessGrant.propagate, true),
    ),
  });
  const nameById = new Map(ancestors.map((a) => [a.id, a.name]));
  return rows.map((row) => ({
    ...row,
    sourceName: nameById.get(row.lembagaId ?? '') ?? null,
  }));
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
          message: NOT_REGISTERED_MESSAGE,
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

      // `lembagaOwnerProcedure` menjamin pemberi adalah Owner lembaga ini,
      // jadi hanya dia yang dapat menyetel propagasi.
      const values = {
        status: 'active' as const,
        features: input.features,
        propagate: input.propagate,
        grantedBy: ctx.session.user.id,
        revokedAt: null,
        revokedBy: null,
      };
      let grantId: string;
      if (existing) {
        await ctx.db
          .update(accessGrant)
          .set(values)
          .where(eq(accessGrant.id, existing.id));
        grantId = existing.id;
      } else {
        const [created] = await ctx.db
          .insert(accessGrant)
          .values({
            lembagaId: input.lembagaId,
            userId: target.id,
            ...values,
          })
          .returning({ id: accessGrant.id });
        grantId = created!.id;
      }

      await writeAudit(
        ctx.db,
        ctx.session.user.id,
        'grant_set',
        'lembaga',
        input.lembagaId,
        `Beri akses Admin Lembaga ke ${target.email}`,
        {
          grantId,
          targetUserId: target.id,
          lembagaId: input.lembagaId,
          features: input.features,
          previousFeatures:
            existing?.status === 'active' ? existing.features : null,
          propagate: input.propagate,
          via: 'owner-ui',
        },
      );

      return { success: true };
    }),

  revokeLembagaAdmin: lembagaOwnerProcedure
    .input(RevokeLembagaAdminInputSchema)
    .output(RevokeLembagaAdminOutputSchema)
    .mutation(async ({ ctx, input }) => {
      // Idempotent: hanya baris aktif yang disentuh, sehingga `revoked_*`
      // dari pencabutan sebelumnya tidak tertimpa.
      const revoked = await ctx.db
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
            eq(accessGrant.status, 'active'),
          ),
        )
        .returning({
          id: accessGrant.id,
          features: accessGrant.features,
          propagate: accessGrant.propagate,
        });

      for (const row of revoked) {
        await writeAudit(
          ctx.db,
          ctx.session.user.id,
          'grant_revoke',
          'lembaga',
          input.lembagaId,
          'Cabut akses Admin Lembaga',
          {
            grantId: row.id,
            targetUserId: input.userId,
            lembagaId: input.lembagaId,
            features: row.features,
            propagate: row.propagate,
            via: 'owner-ui',
          },
        );
      }

      return { success: true };
    }),

  listLembagaAdmins: lembagaScopedProcedure
    .input(ListLembagaAdminsInputSchema)
    .output(ListLembagaAdminsOutputSchema)
    .query(async ({ ctx, input }) => {
      const [own, inherited] = await Promise.all([
        ctx.db.query.accessGrant.findMany({
          where: and(
            eq(accessGrant.lembagaId, input.lembagaId),
            eq(accessGrant.status, 'active'),
          ),
        }),
        listInheritedGrants(ctx.db, input.lembagaId),
      ]);

      const userById = await fetchUsersById(
        ctx.db,
        [...own, ...inherited].map((row) => row.userId),
      );

      const withNim = await attachNim(
        ctx.db,
        [
          ...own.map((row) => ({
            userId: row.userId,
            name: userById.get(row.userId)?.name ?? null,
            email: userById.get(row.userId)?.email ?? '',
            grantedAt: row.created_at,
            features: row.features,
            origin: 'lembaga' as const,
            sourceLembagaId: null,
            sourceLembagaName: null,
            propagate: row.propagate,
          })),
          ...inherited.map((row) => ({
            userId: row.userId,
            name: userById.get(row.userId)?.name ?? null,
            email: userById.get(row.userId)?.email ?? '',
            grantedAt: row.created_at,
            features: row.features,
            origin: 'diwarisi' as const,
            sourceLembagaId: row.lembagaId,
            sourceLembagaName: row.sourceName,
            propagate: true,
          })),
        ],
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

      await assertGrantableFeatures(
        ctx.db,
        ctx.session.user,
        ctx.lembagaAccess,
        ctx.lembagaId,
        input.features,
      );

      const target = await findUserByIdentifier(ctx.db, input.identifier);
      if (!target) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: NOT_REGISTERED_MESSAGE,
        });
      }

      const owner = await ctx.db.query.lembaga.findFirst({
        where: eq(lembaga.id, ctx.lembagaId),
        columns: { userId: true },
      });
      if (target.id === owner?.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Akun tersebut sudah menjadi Owner lembaga ini.',
        });
      }

      const existing = await ctx.db.query.accessGrant.findFirst({
        where: and(
          eq(accessGrant.periodId, input.eventId),
          eq(accessGrant.userId, target.id),
        ),
      });

      const values = {
        status: 'active' as const,
        features: input.features,
        grantedBy: ctx.session.user.id,
        revokedAt: null,
        revokedBy: null,
      };
      let grantId: string;
      if (existing) {
        await ctx.db
          .update(accessGrant)
          .set(values)
          .where(eq(accessGrant.id, existing.id));
        grantId = existing.id;
      } else {
        const [created] = await ctx.db
          .insert(accessGrant)
          .values({ periodId: input.eventId, userId: target.id, ...values })
          .returning({ id: accessGrant.id });
        grantId = created!.id;
      }

      await writeAudit(
        ctx.db,
        ctx.session.user.id,
        'grant_set',
        'event',
        input.eventId,
        `Beri akses Admin Kepanitiaan ke ${target.email}`,
        {
          grantId,
          targetUserId: target.id,
          lembagaId: ctx.lembagaId,
          periodId: input.eventId,
          features: input.features,
          previousFeatures:
            existing?.status === 'active' ? existing.features : null,
          via: 'owner-ui',
        },
      );

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

      const revoked = await ctx.db
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
            eq(accessGrant.status, 'active'),
          ),
        )
        .returning({ id: accessGrant.id, features: accessGrant.features });

      for (const row of revoked) {
        await writeAudit(
          ctx.db,
          ctx.session.user.id,
          'grant_revoke',
          'event',
          input.eventId,
          'Cabut akses Admin Kepanitiaan',
          {
            grantId: row.id,
            targetUserId: input.userId,
            lembagaId: ctx.lembagaId,
            periodId: input.eventId,
            features: row.features,
            via: 'owner-ui',
          },
        );
      }

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
          origin: 'lembaga' as const,
          sourceLembagaId: null,
          sourceLembagaName: null,
          propagate: false,
        })),
      );

      return withNim;
    }),

  /**
   * Menentukan apakah tombol Kelola Admin tampil: Owner dan Admin Lembaga
   * (pemilik kegiatan untuk `eventId`). Admin Kepanitiaan dan anggota biasa
   * selalu null.
   */
  getKelolaAdminAccess: protectedProcedure
    .input(KelolaAdminAccessInputSchema)
    .output(KelolaAdminAccessOutputSchema)
    .query(async ({ ctx, input }) => {
      let lembagaId = input.lembagaId ?? null;
      if (!lembagaId && input.eventId) {
        const ev = await ctx.db.query.events.findFirst({
          where: eq(events.id, input.eventId),
          columns: { org_id: true },
        });
        lembagaId = ev?.org_id ?? null;
      }
      if (!lembagaId) return null;
      const access = await canManageLembaga(
        ctx.db,
        ctx.session.user.id,
        ctx.session.user.role,
        ctx.session.user.lembagaId,
        lembagaId,
      );
      return access;
    }),

  /** Daftar kegiatan lembaga untuk pemilih di tab Admin Kepanitiaan. */
  listLembagaEvents: lembagaScopedProcedure
    .input(ListLembagaAdminsInputSchema)
    .query(async ({ ctx }) => {
      const rows = await ctx.db.query.events.findMany({
        where: eq(events.org_id, ctx.lembagaId),
        columns: { id: true, name: true },
        orderBy: (e, { desc }) => desc(e.start_date),
      });
      return rows.map((r) => ({ id: r.id, name: r.name ?? '(tanpa nama)' }));
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

      const grants = await ctx.db.query.accessGrant.findMany({
        where: and(
          eq(accessGrant.userId, ctx.session.user.id),
          eq(accessGrant.status, 'active'),
          isNotNull(accessGrant.lembagaId),
        ),
      });
      const grantedLembagaIds = grants.flatMap((g) =>
        g.lembagaId ? [g.lembagaId] : [],
      );

      if (grantedLembagaIds.length > 0) {
        const lembagaRows = await ctx.db.query.lembaga.findMany({
          where: inArray(lembaga.id, grantedLembagaIds),
          columns: { id: true, name: true },
        });
        const lembagaById = new Map(lembagaRows.map((l) => [l.id, l]));

        for (const grant of grants) {
          const lembagaRow = grant.lembagaId
            ? lembagaById.get(grant.lembagaId)
            : undefined;
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
      const grants = await ctx.db.query.accessGrant.findMany({
        where: and(
          eq(accessGrant.userId, ctx.session.user.id),
          eq(accessGrant.status, 'active'),
          isNotNull(accessGrant.periodId),
        ),
      });
      const grantedPeriodIds = grants.flatMap((g) =>
        g.periodId ? [g.periodId] : [],
      );

      if (grantedPeriodIds.length === 0) return [];

      const eventRows = await ctx.db.query.events.findMany({
        where: inArray(events.id, grantedPeriodIds),
        columns: { id: true, name: true, org_id: true },
      });
      const eventById = new Map(eventRows.map((e) => [e.id, e]));

      return grants
        .map((grant) => (grant.periodId ? eventById.get(grant.periodId) : undefined))
        .filter((event): event is NonNullable<typeof event> => Boolean(event))
        .map((event) => ({
          eventId: event.id,
          eventNama: event.name,
          lembagaId: event.org_id,
          access: 'admin' as const,
        }));
    }),
});
