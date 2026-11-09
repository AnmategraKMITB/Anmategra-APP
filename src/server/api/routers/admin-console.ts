import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { env } from '~/env';
import { adminProcedure, createTRPCRouter } from '~/server/api/trpc';
import type { db as database } from '~/server/db';
import {
  AdminAuditListInputSchema,
  AdminGrantSetInputSchema,
  AdminLembagaUpdateInputSchema,
  AdminUserCreateInputSchema,
  AdminUserUpdateInputSchema,
  AdminUsersListInputSchema,
} from '~/server/api/types/admin-console.type';
import {
  accessGrant,
  adminAudit,
  events,
  lembaga,
  mahasiswa,
  users,
} from '~/server/db/schema';

type Db = typeof database;

const likeOf = (value: string) => `%${value.replace(/[\\%_]/g, '\\$&')}%`;

async function findUserByIdentifier(db: Db, identifier: string) {
  const value = identifier.trim();
  const lower = value.toLowerCase();
  const nim = /^\d{8}$/.test(value) ? Number(value) : null;
  const where = nim
    ? or(eq(users.email, lower), eq(mahasiswa.nim, nim))
    : eq(users.email, lower);
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .leftJoin(mahasiswa, eq(mahasiswa.userId, users.id))
    .where(where)
    .limit(1);
  return row ?? null;
}

async function audit(
  db: Db,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  summary: string,
  metadata?: Record<string, unknown>,
) {
  await db.insert(adminAudit).values({
    actorId,
    action,
    entityType,
    entityId,
    summary,
    metadata,
  });
}

export const adminConsoleRouter = createTRPCRouter({
  stats: adminProcedure.query(async ({ ctx }) => {
    const [[userCount], [demoCount], [hiddenCount], [lembagaCount], [eventCount]] =
      await Promise.all([
        ctx.db.select({ n: count() }).from(users),
        ctx.db.select({ n: count() }).from(users).where(eq(users.isDemo, true)),
        ctx.db.select({ n: count() }).from(users).where(sql`${users.hiddenAt} is not null`),
        ctx.db.select({ n: count() }).from(lembaga),
        ctx.db.select({ n: count() }).from(events),
      ]);
    return {
      users: userCount?.n ?? 0,
      demoUsers: demoCount?.n ?? 0,
      hiddenUsers: hiddenCount?.n ?? 0,
      lembaga: lembagaCount?.n ?? 0,
      events: eventCount?.n ?? 0,
      appEnv: env.APP_ENV,
      superadmins: env.SUPERADMIN_EMAILS,
    };
  }),

  usersList: adminProcedure
    .input(AdminUsersListInputSchema)
    .query(async ({ ctx, input }) => {
      const search = input.search?.trim();
      const where = search
        ? or(
            ilike(users.name, likeOf(search)),
            ilike(users.email, likeOf(search)),
            sql`${mahasiswa.nim}::text ilike ${likeOf(search)}`,
          )
        : undefined;
      const [rows, [total]] = await Promise.all([
        ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            isDemo: users.isDemo,
            hiddenAt: users.hiddenAt,
            createdAt: users.created_at,
            nim: mahasiswa.nim,
            jurusan: mahasiswa.jurusan,
            angkatan: mahasiswa.angkatan,
            lembagaId: lembaga.id,
            lembagaName: lembaga.name,
            lembagaType: lembaga.type,
          })
          .from(users)
          .leftJoin(mahasiswa, eq(mahasiswa.userId, users.id))
          .leftJoin(lembaga, eq(lembaga.userId, users.id))
          .where(where)
          .orderBy(desc(users.created_at))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db
          .select({ n: count() })
          .from(users)
          .leftJoin(mahasiswa, eq(mahasiswa.userId, users.id))
          .where(where),
      ]);
      return {
        rows,
        total: total?.n ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  userCreate: adminProcedure
    .input(AdminUserCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.isDemo && env.APP_ENV !== 'demo') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Akun demo hanya boleh dibuat di deployment demo.',
        });
      }
      try {
        return await ctx.db.transaction(async (tx) => {
          const [created] = await tx
            .insert(users)
            .values({
              email: input.email,
              name: input.name,
              role: input.kind,
              isDemo: input.isDemo,
              hiddenAt: input.hidden ? new Date() : null,
              emailVerified: input.isDemo ? new Date() : null,
            })
            .returning({ id: users.id });
          if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

          if (input.kind === 'mahasiswa') {
            await tx.insert(mahasiswa).values({
              userId: created.id,
              nim: Number(input.nim),
              nama: input.name,
              jurusan: input.jurusan!,
              angkatan: input.angkatan!,
              status: 'aktif',
            });
          } else {
            await tx.insert(lembaga).values({
              userId: created.id,
              name: input.lembagaName!,
              acronym: input.acronym ?? null,
              type: input.lembagaType!,
              foundingDate: new Date(),
            });
          }

          await audit(
            tx as unknown as Db,
            ctx.session.user.id,
            'user_create',
            'user',
            created.id,
            `Membuat akun ${input.kind} ${input.email}`,
            {
              kind: input.kind,
              isDemo: input.isDemo,
              hidden: input.hidden,
            },
          );
          return { id: created.id };
        });
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Email atau NIM sudah dipakai.',
          });
        }
        throw error;
      }
    }),

  userUpdate: adminProcedure
    .input(AdminUserUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.isDemo === true && env.APP_ENV !== 'demo') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Akun demo hanya boleh dibuat di deployment demo.',
        });
      }
      const [before] = await ctx.db
        .select({
          id: users.id,
          name: users.name,
          isDemo: users.isDemo,
          hiddenAt: users.hiddenAt,
        })
        .from(users)
        .where(eq(users.id, input.userId));
      if (!before) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.db
        .update(users)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.isDemo !== undefined ? { isDemo: input.isDemo } : {}),
          ...(input.hidden !== undefined
            ? { hiddenAt: input.hidden ? new Date() : null }
            : {}),
        })
        .where(eq(users.id, input.userId));

      await audit(
        ctx.db as unknown as Db,
        ctx.session.user.id,
        'user_update',
        'user',
        input.userId,
        `Memperbarui akun ${before.name ?? input.userId}`,
        { before, after: input },
      );
      return { success: true };
    }),

  lembagaUpdate: adminProcedure
    .input(AdminLembagaUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ id: lembaga.id, name: lembaga.name })
        .from(lembaga)
        .where(eq(lembaga.id, input.lembagaId));
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      await ctx.db
        .update(lembaga)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.acronym !== undefined ? { acronym: input.acronym } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
        })
        .where(eq(lembaga.id, input.lembagaId));
      await audit(
        ctx.db as unknown as Db,
        ctx.session.user.id,
        'lembaga_update',
        'lembaga',
        input.lembagaId,
        `Memperbarui lembaga ${row.name}`,
        { before: row, after: input },
      );
      return { success: true };
    }),

  accessOptions: adminProcedure.query(async ({ ctx }) => {
    const [lembagaRows, eventRows] = await Promise.all([
      ctx.db
        .select({
          id: lembaga.id,
          name: lembaga.name,
          type: lembaga.type,
          acronym: lembaga.acronym,
        })
        .from(lembaga)
        .orderBy(lembaga.name)
        .limit(500),
      ctx.db
        .select({
          id: events.id,
          name: events.name,
          orgId: events.org_id,
          orgName: lembaga.name,
        })
        .from(events)
        .leftJoin(lembaga, eq(lembaga.id, events.org_id))
        .orderBy(desc(events.start_date))
        .limit(500),
    ]);
    return { lembaga: lembagaRows, events: eventRows };
  }),

  grantsList: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: accessGrant.id,
        userId: accessGrant.userId,
        userName: users.name,
        userEmail: users.email,
        lembagaId: accessGrant.lembagaId,
        lembagaName: lembaga.name,
        periodId: accessGrant.periodId,
        periodName: events.name,
        features: accessGrant.features,
        createdAt: accessGrant.created_at,
      })
      .from(accessGrant)
      .innerJoin(users, eq(users.id, accessGrant.userId))
      .leftJoin(lembaga, eq(lembaga.id, accessGrant.lembagaId))
      .leftJoin(events, eq(events.id, accessGrant.periodId))
      .where(eq(accessGrant.status, 'active'))
      .orderBy(desc(accessGrant.created_at))
      .limit(100);
    return rows;
  }),

  grantSet: adminProcedure
    .input(AdminGrantSetInputSchema)
    .mutation(async ({ ctx, input }) => {
      const target = await findUserByIdentifier(ctx.db as unknown as Db, input.identifier);
      if (!target) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Akun dengan email/NIM tersebut belum terdaftar.',
        });
      }

      if (input.kind === 'lembaga') {
        const [row] = await ctx.db
          .select({ id: lembaga.id, name: lembaga.name })
          .from(lembaga)
          .where(eq(lembaga.id, input.targetId));
        if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      } else {
        const [row] = await ctx.db
          .select({ id: events.id, name: events.name })
          .from(events)
          .where(eq(events.id, input.targetId));
        if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const scope =
        input.kind === 'lembaga'
          ? { lembagaId: input.targetId, periodId: null }
          : { lembagaId: null, periodId: input.targetId };
      const [existing] = await ctx.db
        .select({ id: accessGrant.id })
        .from(accessGrant)
        .where(
          and(
            eq(accessGrant.userId, target.id),
            input.kind === 'lembaga'
              ? eq(accessGrant.lembagaId, input.targetId)
              : eq(accessGrant.periodId, input.targetId),
          ),
        );

      if (existing) {
        await ctx.db
          .update(accessGrant)
          .set(
            input.revoke
              ? {
                  status: 'revoked',
                  revokedAt: new Date(),
                  revokedBy: ctx.session.user.id,
                }
              : {
                  status: 'active',
                  features: ['admin'],
                  revokedAt: null,
                  revokedBy: null,
                  grantedBy: ctx.session.user.id,
                },
          )
          .where(eq(accessGrant.id, existing.id));
      } else if (!input.revoke) {
        await ctx.db.insert(accessGrant).values({
          userId: target.id,
          ...scope,
          features: ['admin'],
          grantedBy: ctx.session.user.id,
        });
      }

      await audit(
        ctx.db as unknown as Db,
        ctx.session.user.id,
        input.revoke ? 'grant_revoke' : 'grant_set',
        input.kind,
        input.targetId,
        `${input.revoke ? 'Mencabut' : 'Memberi'} akses admin ${input.kind} untuk ${target.email}`,
        { identifier: input.identifier, targetId: input.targetId },
      );
      return { success: true };
    }),

  auditList: adminProcedure
    .input(AdminAuditListInputSchema)
    .query(async ({ ctx, input }) => {
      const [rows, [total]] = await Promise.all([
        ctx.db
          .select({
            id: adminAudit.id,
            action: adminAudit.action,
            entityType: adminAudit.entityType,
            entityId: adminAudit.entityId,
            summary: adminAudit.summary,
            metadata: adminAudit.metadata,
            createdAt: adminAudit.created_at,
            actorName: users.name,
            actorEmail: users.email,
          })
          .from(adminAudit)
          .innerJoin(users, eq(users.id, adminAudit.actorId))
          .orderBy(desc(adminAudit.created_at))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db.select({ n: count() }).from(adminAudit),
      ]);
      return {
        rows,
        total: total?.n ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),
});
