import { TRPCError } from '@trpc/server';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { env } from '~/env';
import { ADMIN_PERMISSIONS, type AdminPermission } from '~/server/api/admin-permissions';
import {
  adminPermissionProcedure,
  createTRPCRouter,
  protectedProcedure,
} from '~/server/api/trpc';
import type { db as database } from '~/server/db';
import { periodHasMembers } from '~/server/api/routers/organization/membership';
import {
  AdminAuditListInputSchema,
  AdminEventCreateInputSchema,
  AdminEventDeleteInputSchema,
  AdminEventUpdateInputSchema,
  AdminGrantRevokeInputSchema,
  AdminGrantSetInputSchema,
  AdminGrantsListInputSchema,
  AdminLembagaDetailInputSchema,
  AdminLembagaListInputSchema,
  AdminLembagaSearchInputSchema,
  AdminLembagaUpdateInputSchema,
  AdminPositionSearchInputSchema,
  AdminEventSearchInputSchema,
  AdminMembershipRemoveInputSchema,
  AdminMembershipUpsertInputSchema,
  AdminOperatorPermissionRevokeInputSchema,
  AdminOperatorPermissionSetInputSchema,
  AdminPlacementAddInputSchema,
  AdminPlacementRemoveInputSchema,
  AdminUserCreateInputSchema,
  AdminUserDetailInputSchema,
  AdminUserSearchInputSchema,
  AdminUserUpdateInputSchema,
  AdminUsersListInputSchema,
} from '~/server/api/types/admin-console.type';
import {
  accessGrant,
  adminAudit,
  adminPermission,
  bestStaffKegiatan,
  bestStaffLembaga,
  events,
  lembaga,
  lembagaMembership,
  mahasiswa,
  organizationPosition,
  organizationStructure,
  organizationUnit,
  placement,
  riwayatKepanitiaan,
  riwayatOrganisasi,
  users,
} from '~/server/db/schema';

type Db = typeof database;

const likeOf = (value: string) => `%${value.replace(/[\\%_]/g, '\\$&')}%`;

const activeAdminPermission = and(
  isNull(adminPermission.revokedAt),
  or(isNull(adminPermission.expiresAt), sql`${adminPermission.expiresAt} > now()`),
);

async function findUserByIdentifier(db: Db, identifier: string) {
  const value = identifier.trim();
  const lower = value.toLowerCase();
  const nim = /^\d{8}$/.test(value) ? Number(value) : null;
  const where = nim
    ? or(eq(users.email, lower), eq(mahasiswa.nim, nim), eq(users.id, value))
    : or(eq(users.email, lower), eq(users.id, value));
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

function canUseRoles(permissions: readonly string[]): boolean {
  return permissions.includes('*') || permissions.includes('accounts.roles');
}

function generateShortId(byteLength = 8) {
  const array = new Uint8Array(byteLength);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const adminConsoleRouter = createTRPCRouter({
  stats: adminPermissionProcedure('accounts.read').query(async ({ ctx }) => {
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

  myAdminPermissions: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.role === 'admin') {
      return { permissions: ['*'], expiresAt: null };
    }
    const row = await ctx.db.query.adminPermission.findFirst({
      where: and(eq(adminPermission.userId, ctx.session.user.id), activeAdminPermission),
      columns: { permissions: true, expiresAt: true },
    });
    return { permissions: row?.permissions ?? [], expiresAt: row?.expiresAt ?? null };
  }),

  usersList: adminPermissionProcedure('accounts.read')
    .input(AdminUsersListInputSchema)
    .query(async ({ ctx, input }) => {
      const search = input.search?.trim();
      const statusWhere =
        input.status === 'demo'
          ? eq(users.isDemo, true)
          : input.status === 'hidden'
            ? isNotNull(users.hiddenAt)
            : undefined;
      const where = and(
        search
          ? or(
              ilike(users.name, likeOf(search)),
              ilike(users.email, likeOf(search)),
              sql`${mahasiswa.nim}::text ilike ${likeOf(search)}`,
            )
          : undefined,
        input.role ? eq(users.role, input.role) : undefined,
        statusWhere,
      );
      const order =
        input.sort === 'name'
          ? users.name
          : input.sort === 'email'
            ? users.email
            : input.sort === 'role'
              ? users.role
              : users.created_at;
      const [rows, [total]] = await Promise.all([
        ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
            role: users.role,
            isDemo: users.isDemo,
            hiddenAt: users.hiddenAt,
            createdAt: users.created_at,
            nim: mahasiswa.nim,
            nimTpb: mahasiswa.nimTpb,
            jurusan: mahasiswa.jurusan,
            angkatan: mahasiswa.angkatan,
            status: mahasiswa.status,
            lembagaId: lembaga.id,
            lembagaName: lembaga.name,
            lembagaType: lembaga.type,
          })
          .from(users)
          .leftJoin(mahasiswa, eq(mahasiswa.userId, users.id))
          .leftJoin(lembaga, eq(lembaga.userId, users.id))
          .where(where)
          .orderBy(input.dir === 'asc' ? asc(order) : desc(order))
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

  usersSearch: adminPermissionProcedure('accounts.read')
    .input(AdminUserSearchInputSchema)
    .query(async ({ ctx, input }) => {
      const q = input.q.trim();
      return ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          nim: mahasiswa.nim,
          lembagaName: lembaga.name,
        })
        .from(users)
        .leftJoin(mahasiswa, eq(mahasiswa.userId, users.id))
        .leftJoin(lembaga, eq(lembaga.userId, users.id))
        .where(
          or(
            ilike(users.name, likeOf(q)),
            ilike(users.email, likeOf(q)),
            sql`${mahasiswa.nim}::text ilike ${likeOf(q)}`,
          ),
        )
        .orderBy(
          sql`case
            when lower(${users.email}) = lower(${q}) then 0
            when ${users.email} ilike ${`${q}%`} then 1
            when ${users.name} ilike ${`${q}%`} then 2
            else 3 end`,
          asc(users.name),
        )
        .limit(input.limit);
    }),

  userDetail: adminPermissionProcedure('accounts.read')
    .input(AdminUserDetailInputSchema)
    .query(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          emailVerified: users.emailVerified,
          image: users.image,
          role: users.role,
          isDemo: users.isDemo,
          hiddenAt: users.hiddenAt,
          createdAt: users.created_at,
          nim: mahasiswa.nim,
          nimTpb: mahasiswa.nimTpb,
          namaMahasiswa: mahasiswa.nama,
          jurusan: mahasiswa.jurusan,
          angkatan: mahasiswa.angkatan,
          lineId: mahasiswa.lineId,
          whatsapp: mahasiswa.whatsapp,
          raporVisible: mahasiswa.raporVisible,
          status: mahasiswa.status,
        })
        .from(users)
        .leftJoin(mahasiswa, eq(mahasiswa.userId, users.id))
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });

      const [memberships, placements, grants, bestKegiatan, bestLembaga, riwayatOrg, riwayatPanitia] =
        await Promise.all([
          ctx.db
            .select({
              id: lembagaMembership.id,
              lembagaId: lembagaMembership.lembagaId,
              lembagaName: lembaga.name,
              cohortYear: lembagaMembership.cohortYear,
              cohortLabel: lembagaMembership.cohortLabel,
              status: lembagaMembership.status,
              source: lembagaMembership.source,
              joinedAt: lembagaMembership.joinedAt,
              endedAt: lembagaMembership.endedAt,
            })
            .from(lembagaMembership)
            .leftJoin(lembaga, eq(lembaga.id, lembagaMembership.lembagaId))
            .where(eq(lembagaMembership.userId, input.userId))
            .orderBy(desc(lembagaMembership.joinedAt)),
          ctx.db
            .select({
              id: placement.id,
              positionId: placement.positionId,
              positionTitle: organizationPosition.title,
              unitId: organizationUnit.id,
              unitName: organizationUnit.name,
              structureId: organizationStructure.id,
              structureName: organizationStructure.name,
              lembagaId: organizationStructure.lembagaId,
              eventId: organizationStructure.eventId,
              periodName: events.name,
              lembagaName: lembaga.name,
              source: placement.source,
              note: placement.note,
            })
            .from(placement)
            .innerJoin(organizationPosition, eq(organizationPosition.id, placement.positionId))
            .innerJoin(organizationUnit, eq(organizationUnit.id, organizationPosition.unitId))
            .innerJoin(
              organizationStructure,
              eq(organizationStructure.id, organizationUnit.structure_id),
            )
            .leftJoin(events, eq(events.id, organizationStructure.eventId))
            .leftJoin(lembaga, eq(lembaga.id, organizationStructure.lembagaId))
            .where(eq(placement.userId, input.userId)),
          ctx.db
            .select({
              id: accessGrant.id,
              lembagaId: accessGrant.lembagaId,
              lembagaName: lembaga.name,
              periodId: accessGrant.periodId,
              periodName: events.name,
              features: accessGrant.features,
              propagate: accessGrant.propagate,
              createdAt: accessGrant.created_at,
            })
            .from(accessGrant)
            .leftJoin(lembaga, eq(lembaga.id, accessGrant.lembagaId))
            .leftJoin(events, eq(events.id, accessGrant.periodId))
            .where(and(eq(accessGrant.userId, input.userId), eq(accessGrant.status, 'active')))
            .orderBy(desc(accessGrant.created_at)),
          ctx.db
            .select({
              id: bestStaffKegiatan.id,
              eventId: bestStaffKegiatan.eventId,
              eventName: events.name,
              division: bestStaffKegiatan.division,
              startDate: bestStaffKegiatan.startDate,
              endDate: bestStaffKegiatan.endDate,
            })
            .from(bestStaffKegiatan)
            .leftJoin(events, eq(events.id, bestStaffKegiatan.eventId))
            .where(eq(bestStaffKegiatan.mahasiswaId, input.userId)),
          ctx.db
            .select({
              id: bestStaffLembaga.id,
              lembagaId: bestStaffLembaga.lembagaId,
              lembagaName: lembaga.name,
              division: bestStaffLembaga.division,
              startDate: bestStaffLembaga.startDate,
              endDate: bestStaffLembaga.endDate,
            })
            .from(bestStaffLembaga)
            .leftJoin(lembaga, eq(lembaga.id, bestStaffLembaga.lembagaId))
            .where(eq(bestStaffLembaga.mahasiswaId, input.userId)),
          ctx.db
            .select()
            .from(riwayatOrganisasi)
            .where(eq(riwayatOrganisasi.userId, input.userId))
            .orderBy(desc(riwayatOrganisasi.startedAt)),
          ctx.db
            .select()
            .from(riwayatKepanitiaan)
            .where(eq(riwayatKepanitiaan.userId, input.userId))
            .orderBy(desc(riwayatKepanitiaan.startedAt)),
        ]);

      return {
        user,
        memberships,
        placements,
        grants,
        bestStaff: { kegiatan: bestKegiatan, lembaga: bestLembaga },
        riwayat: { organisasi: riwayatOrg, kepanitiaan: riwayatPanitia },
      };
    }),

  userCreate: adminPermissionProcedure('accounts.write')
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
            { kind: input.kind, isDemo: input.isDemo, hidden: input.hidden },
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

  userUpdate: adminPermissionProcedure('accounts.write')
    .input(AdminUserUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.isDemo === true && env.APP_ENV !== 'demo') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Akun demo hanya boleh dibuat di deployment demo.',
        });
      }
      const permissions = ctx.adminPermissions as readonly string[];
      if (
        !canUseRoles(permissions) &&
        (input.email !== undefined ||
          input.role !== undefined ||
          input.emailVerified !== undefined)
      ) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Butuh izin accounts.roles untuk mengubah email/role/verifikasi.',
        });
      }

      const [before] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!before) throw new TRPCError({ code: 'NOT_FOUND' });
      const [beforeMahasiswa] = await ctx.db
        .select()
        .from(mahasiswa)
        .where(eq(mahasiswa.userId, input.userId))
        .limit(1);

      try {
        await ctx.db.transaction(async (tx) => {
          const userPatch: Record<string, unknown> = {};
          if (input.email !== undefined) userPatch.email = input.email;
          if (input.name !== undefined) userPatch.name = input.name;
          if (input.image !== undefined) userPatch.image = input.image;
          if (input.role !== undefined) userPatch.role = input.role;
          if (input.isDemo !== undefined) userPatch.isDemo = input.isDemo;
          if (input.hidden !== undefined) userPatch.hiddenAt = input.hidden ? new Date() : null;
          if (input.emailVerified !== undefined) {
            userPatch.emailVerified = input.emailVerified ? new Date() : null;
          }
          if (Object.keys(userPatch).length > 0) {
            await tx.update(users).set(userPatch).where(eq(users.id, input.userId));
          }

          const m = input.mahasiswa;
          if (m && beforeMahasiswa) {
            const mahasiswaPatch: Record<string, unknown> = {};
            if (m.nim !== undefined) mahasiswaPatch.nim = Number(m.nim);
            if (m.nimTpb !== undefined) mahasiswaPatch.nimTpb = m.nimTpb ? Number(m.nimTpb) : null;
            if (m.nama !== undefined) mahasiswaPatch.nama = m.nama;
            if (m.jurusan !== undefined) mahasiswaPatch.jurusan = m.jurusan;
            if (m.angkatan !== undefined) mahasiswaPatch.angkatan = m.angkatan;
            if (m.lineId !== undefined) mahasiswaPatch.lineId = m.lineId;
            if (m.whatsapp !== undefined) mahasiswaPatch.whatsapp = m.whatsapp;
            if (m.raporVisible !== undefined) mahasiswaPatch.raporVisible = m.raporVisible;
            if (m.status !== undefined) mahasiswaPatch.status = m.status;
            if (input.name !== undefined && m.nama === undefined) mahasiswaPatch.nama = input.name;
            if (Object.keys(mahasiswaPatch).length > 0) {
              await tx
                .update(mahasiswa)
                .set(mahasiswaPatch)
                .where(eq(mahasiswa.userId, input.userId));
            }
          }

          await audit(
            tx as unknown as Db,
            ctx.session.user.id,
            'user_update',
            'user',
            input.userId,
            `Memperbarui akun ${before.name ?? input.userId}`,
            { before, mahasiswaBefore: beforeMahasiswa, after: input },
          );
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
      return { success: true };
    }),

  lembagaList: adminPermissionProcedure('lembaga.read')
    .input(AdminLembagaListInputSchema)
    .query(async ({ ctx, input }) => {
      const search = input.search?.trim();
      const where = and(
        search
          ? or(
              ilike(lembaga.name, likeOf(search)),
              ilike(lembaga.acronym, likeOf(search)),
              sql`${lembaga.type}::text ilike ${likeOf(search)}`,
            )
          : undefined,
        input.type ? eq(lembaga.type, input.type) : undefined,
        input.parentId === null
          ? isNull(lembaga.parentId)
          : input.parentId
            ? eq(lembaga.parentId, input.parentId)
            : undefined,
      );
      const order =
        input.sort === 'name'
          ? lembaga.name
          : input.sort === 'acronym'
            ? lembaga.acronym
            : input.sort === 'type'
              ? lembaga.type
              : lembaga.created_at;
      const [rows, [total]] = await Promise.all([
        ctx.db
          .select({
            id: lembaga.id,
            name: lembaga.name,
            acronym: lembaga.acronym,
            type: lembaga.type,
            parentId: lembaga.parentId,
            description: lembaga.description,
            image: users.image,
            ownerName: users.name,
            ownerEmail: users.email,
            memberCount: lembaga.memberCount,
            createdAt: lembaga.created_at,
          })
          .from(lembaga)
          .leftJoin(users, eq(users.id, lembaga.userId))
          .where(where)
          .orderBy(input.dir === 'asc' ? asc(order) : desc(order))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db.select({ n: count() }).from(lembaga).where(where),
      ]);
      return {
        rows,
        total: total?.n ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  lembagaGroups: adminPermissionProcedure('lembaga.read').query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ type: lembaga.type, n: count() })
      .from(lembaga)
      .groupBy(lembaga.type)
      .orderBy(asc(lembaga.type));
    return rows;
  }),

  lembagaSearch: adminPermissionProcedure('lembaga.read')
    .input(AdminLembagaSearchInputSchema)
    .query(async ({ ctx, input }) => {
      const q = input.q.trim();
      return ctx.db
        .select({
          id: lembaga.id,
          name: lembaga.name,
          acronym: lembaga.acronym,
          type: lembaga.type,
        })
        .from(lembaga)
        .where(
          or(
            ilike(lembaga.name, likeOf(q)),
            ilike(lembaga.acronym, likeOf(q)),
            sql`${lembaga.type}::text ilike ${likeOf(q)}`,
          ),
        )
        .orderBy(
          sql`case
            when lower(${lembaga.name}) = lower(${q}) then 0
            when ${lembaga.name} ilike ${`${q}%`} then 1
            when ${lembaga.acronym} ilike ${`${q}%`} then 2
            else 3 end`,
          asc(lembaga.name),
        )
        .limit(input.limit);
    }),

  eventsSearch: adminPermissionProcedure('access.read')
    .input(AdminEventSearchInputSchema)
    .query(async ({ ctx, input }) => {
      const q = input.q.trim();
      return ctx.db
        .select({
          id: events.id,
          name: events.name,
          orgId: events.org_id,
          orgName: lembaga.name,
        })
        .from(events)
        .leftJoin(lembaga, eq(lembaga.id, events.org_id))
        .where(or(ilike(events.name, likeOf(q)), ilike(lembaga.name, likeOf(q))))
        .orderBy(
          sql`case when ${events.name} ilike ${`${q}%`} then 0 else 1 end`,
          asc(events.name),
        )
        .limit(input.limit);
    }),

  positionsSearch: adminPermissionProcedure('accounts.write')
    .input(AdminPositionSearchInputSchema)
    .query(async ({ ctx, input }) => {
      const q = input.q.trim();
      return ctx.db
        .select({
          id: organizationPosition.id,
          title: organizationPosition.title,
          unitName: organizationUnit.name,
          structureName: organizationStructure.name,
          lembagaName: lembaga.name,
          periodName: events.name,
        })
        .from(organizationPosition)
        .innerJoin(organizationUnit, eq(organizationUnit.id, organizationPosition.unitId))
        .innerJoin(organizationStructure, eq(organizationStructure.id, organizationUnit.structure_id))
        .leftJoin(lembaga, eq(lembaga.id, organizationStructure.lembagaId))
        .leftJoin(events, eq(events.id, organizationStructure.eventId))
        .where(
          or(
            ilike(organizationPosition.title, likeOf(q)),
            ilike(organizationUnit.name, likeOf(q)),
            ilike(lembaga.name, likeOf(q)),
            ilike(events.name, likeOf(q)),
          ),
        )
        .orderBy(asc(organizationPosition.title))
        .limit(input.limit);
    }),

  lembagaDetail: adminPermissionProcedure('lembaga.read')
    .input(AdminLembagaDetailInputSchema)
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          id: lembaga.id,
          name: lembaga.name,
          acronym: lembaga.acronym,
          type: lembaga.type,
          description: lembaga.description,
          parentId: lembaga.parentId,
          foundingDate: lembaga.foundingDate,
          endingDate: lembaga.endingDate,
          major: lembaga.major,
          field: lembaga.field,
          memberCount: lembaga.memberCount,
          raporVisible: lembaga.raporVisible,
          createdAt: lembaga.created_at,
          ownerId: users.id,
          ownerName: users.name,
          ownerEmail: users.email,
          image: users.image,
        })
        .from(lembaga)
        .leftJoin(users, eq(users.id, lembaga.userId))
        .where(eq(lembaga.id, input.lembagaId))
        .limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });

      const [periods, structures, memberCount] = await Promise.all([
        ctx.db
          .select({
            id: events.id,
            name: events.name,
            label: events.label,
            kind: events.kind,
            status: events.status,
            startDate: events.start_date,
            endDate: events.end_date,
            description: events.description,
            image: events.image,
            backgroundImage: events.background_image,
            location: events.location,
            oprecLink: events.oprec_link,
            isHighlighted: events.is_highlighted,
            isOrganogram: events.is_organogram,
            organogramImage: events.organogram_image,
            raporVisible: events.rapor_visible,
            participantLimit: events.participant_limit,
            participantCount: events.participant_count,
          })
          .from(events)
          .where(eq(events.org_id, input.lembagaId))
          .orderBy(desc(events.start_date)),
        ctx.db
          .select({
            id: organizationStructure.id,
            name: organizationStructure.name,
            eventId: organizationStructure.eventId,
            isActive: organizationStructure.is_active,
            editLocked: organizationStructure.editLocked,
            version: organizationStructure.version,
          })
          .from(organizationStructure)
          .where(eq(organizationStructure.lembagaId, input.lembagaId)),
        ctx.db
          .select({ n: count() })
          .from(lembagaMembership)
          .where(and(eq(lembagaMembership.lembagaId, input.lembagaId), eq(lembagaMembership.status, 'aktif'))),
      ]);

      return {
        lembaga: row,
        periods,
        structures,
        memberCount: memberCount[0]?.n ?? 0,
      };
    }),

  lembagaUpdate: adminPermissionProcedure('lembaga.write')
    .input(AdminLembagaUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ id: lembaga.id, name: lembaga.name, userId: lembaga.userId })
        .from(lembaga)
        .where(eq(lembaga.id, input.lembagaId));
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      if (input.parentId === input.lembagaId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Lembaga tidak bisa menjadi induk dirinya sendiri.' });
      }

      try {
        await ctx.db.transaction(async (tx) => {
          await tx
            .update(lembaga)
            .set({
              ...(input.name !== undefined ? { name: input.name } : {}),
              ...(input.acronym !== undefined ? { acronym: input.acronym } : {}),
              ...(input.type !== undefined ? { type: input.type } : {}),
              ...(input.description !== undefined ? { description: input.description } : {}),
              ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
              ...(input.foundingDate !== undefined ? { foundingDate: input.foundingDate } : {}),
              ...(input.endingDate !== undefined ? { endingDate: input.endingDate } : {}),
              ...(input.major !== undefined ? { major: input.major } : {}),
              ...(input.field !== undefined ? { field: input.field } : {}),
              ...(input.memberCount !== undefined ? { memberCount: input.memberCount } : {}),
              ...(input.raporVisible !== undefined ? { raporVisible: input.raporVisible } : {}),
            })
            .where(eq(lembaga.id, input.lembagaId));

          if (input.image !== undefined) {
            await tx.update(users).set({ image: input.image }).where(eq(users.id, row.userId));
          }

          await audit(
            tx as unknown as Db,
            ctx.session.user.id,
            'lembaga_update',
            'lembaga',
            input.lembagaId,
            `Memperbarui lembaga ${row.name}`,
            { before: row, after: input },
          );
        });
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nama lembaga sudah dipakai.' });
        }
        throw error;
      }
      return { success: true };
    }),

  eventCreate: adminPermissionProcedure('lembaga.events')
    .input(AdminEventCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [lembagaRow] = await ctx.db
        .select({ id: lembaga.id, name: lembaga.name })
        .from(lembaga)
        .where(eq(lembaga.id, input.lembagaId));
      if (!lembagaRow) throw new TRPCError({ code: 'NOT_FOUND' });

      const { lembagaId, kind, label, ...fields } = input;
      const [created] = await ctx.db
        .insert(events)
        .values({
          id: generateShortId(),
          org_id: lembagaId,
          kind,
          label: label ?? null,
          ...fields,
          start_date: new Date(fields.start_date),
          end_date: fields.end_date ? new Date(fields.end_date) : null,
        })
        .returning({ id: events.id });

      await audit(
        ctx.db as unknown as Db,
        ctx.session.user.id,
        'event_create',
        'event',
        created?.id ?? null,
        `Membuat ${kind} ${fields.name} di ${lembagaRow.name}`,
      );
      return created ?? null;
    }),

  eventUpdate: adminPermissionProcedure('lembaga.events')
    .input(AdminEventUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, lembagaId, kind, label, start_date, end_date, ...rest } = input;
      const [existing] = await ctx.db
        .select({ id: events.id, name: events.name, org_id: events.org_id })
        .from(events)
        .where(and(eq(events.id, id), eq(events.org_id, lembagaId)));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.db
        .update(events)
        .set({
          ...rest,
          ...(kind !== undefined ? { kind } : {}),
          ...(label !== undefined ? { label } : {}),
          ...(start_date ? { start_date: new Date(start_date) } : {}),
          ...(end_date !== undefined
            ? { end_date: end_date ? new Date(end_date) : null }
            : {}),
        })
        .where(eq(events.id, id));

      await audit(
        ctx.db as unknown as Db,
        ctx.session.user.id,
        'event_update',
        'event',
        id,
        `Memperbarui ${existing.name}`,
      );
      return { success: true };
    }),

  eventDelete: adminPermissionProcedure('lembaga.events')
    .input(AdminEventDeleteInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: events.id, name: events.name })
        .from(events)
        .where(and(eq(events.id, input.id), eq(events.org_id, input.lembagaId)));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });
      if (await periodHasMembers(ctx.db, input.id)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Tidak dapat menghapus periode yang memiliki anggota.',
        });
      }
      await ctx.db.delete(events).where(eq(events.id, input.id));
      await audit(
        ctx.db as unknown as Db,
        ctx.session.user.id,
        'event_delete',
        'event',
        input.id,
        `Menghapus ${existing.name}`,
      );
      return { success: true };
    }),

  accessOptions: adminPermissionProcedure('access.read').query(async ({ ctx }) => {
    const [lembagaRows, eventRows] = await Promise.all([
      ctx.db
        .select({ id: lembaga.id, name: lembaga.name, type: lembaga.type, acronym: lembaga.acronym })
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

  grantsList: adminPermissionProcedure('access.read')
    .input(AdminGrantsListInputSchema)
    .query(async ({ ctx, input }) => {
      const search = input.search?.trim();
      const where = and(
        eq(accessGrant.status, 'active'),
        search
          ? or(
              ilike(users.name, likeOf(search)),
              ilike(users.email, likeOf(search)),
              ilike(lembaga.name, likeOf(search)),
              ilike(events.name, likeOf(search)),
            )
          : undefined,
        input.scope === 'lembaga'
          ? isNotNull(accessGrant.lembagaId)
          : input.scope === 'event'
            ? isNotNull(accessGrant.periodId)
            : undefined,
        input.feature
          ? sql`${accessGrant.features} @> ARRAY[${input.feature}]::text[]`
          : undefined,
      );
      const order =
        input.sort === 'user'
          ? users.name
          : input.sort === 'scope'
            ? sql`coalesce(${lembaga.name}, ${events.name})`
            : accessGrant.created_at;
      const [rows, [total]] = await Promise.all([
        ctx.db
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
            propagate: accessGrant.propagate,
            createdAt: accessGrant.created_at,
            grantedBy: accessGrant.grantedBy,
          })
          .from(accessGrant)
          .innerJoin(users, eq(users.id, accessGrant.userId))
          .leftJoin(lembaga, eq(lembaga.id, accessGrant.lembagaId))
          .leftJoin(events, eq(events.id, accessGrant.periodId))
          .where(where)
          .orderBy(input.dir === 'asc' ? asc(order) : desc(order))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db
          .select({ n: count() })
          .from(accessGrant)
          .innerJoin(users, eq(users.id, accessGrant.userId))
          .leftJoin(lembaga, eq(lembaga.id, accessGrant.lembagaId))
          .leftJoin(events, eq(events.id, accessGrant.periodId))
          .where(where),
      ]);
      return { rows, total: total?.n ?? 0, page: input.page, pageSize: input.pageSize };
    }),

  grantSet: adminPermissionProcedure('access.write')
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
                  features: input.features,
                  propagate: input.propagate,
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
          features: input.features,
          propagate: input.propagate,
          grantedBy: ctx.session.user.id,
        });
      }

      await audit(
        ctx.db as unknown as Db,
        ctx.session.user.id,
        input.revoke ? 'grant_revoke' : 'grant_set',
        input.kind,
        input.targetId,
        `${input.revoke ? 'Mencabut' : 'Memberi'} akses ${input.features.join(', ')} ${input.kind} untuk ${target.email}`,
        { identifier: input.identifier, targetId: input.targetId, features: input.features },
      );
      return { success: true };
    }),

  grantRevokeById: adminPermissionProcedure('access.write')
    .input(AdminGrantRevokeInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(accessGrant)
        .set({ status: 'revoked', revokedAt: new Date(), revokedBy: ctx.session.user.id })
        .where(eq(accessGrant.id, input.grantId));
      await audit(
        ctx.db as unknown as Db,
        ctx.session.user.id,
        'grant_revoke',
        'grant',
        input.grantId,
        'Mencabut akses',
      );
      return { success: true };
    }),

  operatorPermissionsList: adminPermissionProcedure('access.read').query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: adminPermission.id,
        userId: adminPermission.userId,
        userName: users.name,
        userEmail: users.email,
        permissions: adminPermission.permissions,
        expiresAt: adminPermission.expiresAt,
        revokedAt: adminPermission.revokedAt,
        createdAt: adminPermission.created_at,
      })
      .from(adminPermission)
      .innerJoin(users, eq(users.id, adminPermission.userId))
      .orderBy(desc(adminPermission.created_at));
  }),

  operatorPermissionSet: adminPermissionProcedure('access.write')
    .input(AdminOperatorPermissionSetInputSchema)
    .mutation(async ({ ctx, input }) => {
      const target = await findUserByIdentifier(ctx.db as unknown as Db, input.identifier);
      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Akun tidak ditemukan.' });
      const invalid = input.permissions.filter(
        (permission) => !ADMIN_PERMISSIONS.includes(permission as AdminPermission),
      );
      if (invalid.length > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Izin tidak dikenal.' });
      }
      if (ctx.session.user.role !== 'admin') {
        const own = ctx.adminPermissions as readonly string[];
        if (
          input.permissions.includes('*') ||
          !input.permissions.every((permission) => own.includes(permission))
        ) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Operator tidak boleh memberi izin melebihi izinnya sendiri.',
          });
        }
      }
      const [existing] = await ctx.db
        .select({ id: adminPermission.id })
        .from(adminPermission)
        .where(eq(adminPermission.userId, target.id));

      if (existing) {
        await ctx.db
          .update(adminPermission)
          .set({
            permissions: input.permissions,
            expiresAt: input.expiresAt ?? null,
            grantedBy: ctx.session.user.id,
            revokedAt: null,
            revokedBy: null,
          })
          .where(eq(adminPermission.id, existing.id));
      } else {
        await ctx.db.insert(adminPermission).values({
          userId: target.id,
          permissions: input.permissions,
          expiresAt: input.expiresAt ?? null,
          grantedBy: ctx.session.user.id,
        });
      }
      await audit(
        ctx.db as unknown as Db,
        ctx.session.user.id,
        'admin_permission_set',
        'user',
        target.id,
        `Mengatur izin operator untuk ${target.email}`,
        { permissions: input.permissions },
      );
      return { success: true };
    }),

  operatorPermissionRevoke: adminPermissionProcedure('access.write')
    .input(AdminOperatorPermissionRevokeInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(adminPermission)
        .set({ revokedAt: new Date(), revokedBy: ctx.session.user.id })
        .where(eq(adminPermission.userId, input.userId));
      await audit(
        ctx.db as unknown as Db,
        ctx.session.user.id,
        'admin_permission_revoke',
        'user',
        input.userId,
        'Mencabut izin operator',
      );
      return { success: true };
    }),

  membershipUpsert: adminPermissionProcedure('accounts.write')
    .input(AdminMembershipUpsertInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [lembagaRow] = await ctx.db
        .select({ id: lembaga.id })
        .from(lembaga)
        .where(eq(lembaga.id, input.lembagaId));
      if (!lembagaRow) throw new TRPCError({ code: 'NOT_FOUND' });
      const [existing] = await ctx.db
        .select({ id: lembagaMembership.id })
        .from(lembagaMembership)
        .where(
          and(
            eq(lembagaMembership.userId, input.userId),
            eq(lembagaMembership.lembagaId, input.lembagaId),
            eq(lembagaMembership.status, 'aktif'),
          ),
        );
      if (existing) {
        await ctx.db
          .update(lembagaMembership)
          .set({
            cohortYear: input.cohortYear ?? null,
            cohortLabel: input.cohortLabel ?? null,
            status: input.status,
            joinedAt: input.joinedAt ?? undefined,
            endedAt: input.endedAt ?? undefined,
          })
          .where(eq(lembagaMembership.id, existing.id));
      } else {
        await ctx.db.insert(lembagaMembership).values({
          userId: input.userId,
          lembagaId: input.lembagaId,
          cohortYear: input.cohortYear ?? null,
          cohortLabel: input.cohortLabel ?? null,
          status: input.status,
          source: 'manual',
          joinedAt: input.joinedAt ?? undefined,
          endedAt: input.endedAt ?? undefined,
        });
      }
      await audit(
        ctx.db as unknown as Db,
        ctx.session.user.id,
        'membership_upsert',
        'lembaga',
        input.lembagaId,
        `Memperbarui keanggotaan ${input.userId}`,
      );
      return { success: true };
    }),

  membershipRemove: adminPermissionProcedure('accounts.write')
    .input(AdminMembershipRemoveInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(lembagaMembership).where(eq(lembagaMembership.id, input.membershipId));
      await audit(
        ctx.db as unknown as Db,
        ctx.session.user.id,
        'membership_remove',
        'membership',
        input.membershipId,
        'Menghapus keanggotaan',
      );
      return { success: true };
    }),

  placementAdd: adminPermissionProcedure('accounts.write')
    .input(AdminPlacementAddInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [position] = await ctx.db
        .select({ id: organizationPosition.id })
        .from(organizationPosition)
        .where(eq(organizationPosition.id, input.positionId));
      if (!position) throw new TRPCError({ code: 'NOT_FOUND', message: 'Jabatan tidak ditemukan.' });
      try {
        await ctx.db.insert(placement).values({
          userId: input.userId,
          positionId: input.positionId,
          source: input.source,
          note: input.note ?? null,
          createdBy: ctx.session.user.id,
        });
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Sudah ditempatkan di jabatan ini.' });
        }
        throw error;
      }
      await audit(
        ctx.db as unknown as Db,
        ctx.session.user.id,
        'placement_add',
        'placement',
        input.positionId,
        `Menempatkan ${input.userId}`,
      );
      return { success: true };
    }),

  placementRemove: adminPermissionProcedure('accounts.write')
    .input(AdminPlacementRemoveInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(placement).where(eq(placement.id, input.placementId));
      await audit(
        ctx.db as unknown as Db,
        ctx.session.user.id,
        'placement_remove',
        'placement',
        input.placementId,
        'Menghapus penempatan',
      );
      return { success: true };
    }),

  auditList: adminPermissionProcedure('audit.read')
    .input(AdminAuditListInputSchema)
    .query(async ({ ctx, input }) => {
      const where = and(
        input.search
          ? or(
              ilike(adminAudit.summary, likeOf(input.search)),
              ilike(adminAudit.action, likeOf(input.search)),
            )
          : undefined,
        input.action ? eq(adminAudit.action, input.action) : undefined,
        input.entityType ? eq(adminAudit.entityType, input.entityType) : undefined,
        input.actorId ? eq(adminAudit.actorId, input.actorId) : undefined,
        input.from ? sql`${adminAudit.created_at} >= ${input.from}` : undefined,
        input.to ? sql`${adminAudit.created_at} <= ${input.to}` : undefined,
      );
      const order = input.sort === 'action' ? adminAudit.action : adminAudit.created_at;
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
          .where(where)
          .orderBy(input.dir === 'asc' ? asc(order) : desc(order))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db.select({ n: count() }).from(adminAudit).where(where),
      ]);
      return { rows, total: total?.n ?? 0, page: input.page, pageSize: input.pageSize };
    }),
});
