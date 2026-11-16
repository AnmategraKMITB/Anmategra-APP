import { TRPCError } from '@trpc/server';
import { and, asc, eq, ne, or, sql } from 'drizzle-orm';
import { env } from '~/env';
import {
  assertConfirmEmail,
  isEmergencySuperadmin,
  normalizeEmail,
  remainingSuperadmins,
} from '~/server/api/superadmin';
import {
  adminPermissionProcedure,
  createTRPCRouter,
  superadminProcedure,
} from '~/server/api/trpc';
import {
  AdminLembagaCreateInputSchema,
  SuperadminAddInputSchema,
  SuperadminRemoveInputSchema,
  VerifiedEmailAddInputSchema,
  VerifiedEmailRemoveInputSchema,
} from '~/server/api/types/admin-ops.type';
import {
  adminAudit,
  lembaga,
  mahasiswa,
  users,
  verifiedUsers,
} from '~/server/db/schema';

export const adminOpsRouter = createTRPCRouter({
  // ---- Superadmin -------------------------------------------------------

  superadminList: superadminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.role, 'admin'))
      .orderBy(asc(users.email));
    const emergency = env.SUPERADMIN_EMAILS.map(normalizeEmail);
    const dbEmails = new Set(rows.map((row) => normalizeEmail(row.email)));
    return {
      /** Akun darurat dari `SUPERADMIN_EMAILS`; tidak dapat diubah dari panel. */
      emergency: emergency.map((address) => ({
        email: address,
        name: rows.find((row) => normalizeEmail(row.email) === address)?.name ?? null,
      })),
      managed: rows
        .filter((row) => !emergency.includes(normalizeEmail(row.email)))
        .map((row) => ({ ...row, self: row.id === ctx.session.user.id })),
      total: new Set([...dbEmails, ...emergency]).size,
    };
  }),

  superadminAdd: superadminProcedure
    .input(SuperadminAddInputSchema)
    .mutation(async ({ ctx, input }) => {
      const value = input.identifier.trim();
      const nim = /^\d{8}$/.test(value) ? Number(value) : null;
      const [target] = await ctx.db
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .leftJoin(mahasiswa, eq(mahasiswa.userId, users.id))
        .where(
          nim
            ? or(eq(users.email, value.toLowerCase()), eq(mahasiswa.nim, nim))
            : or(eq(users.email, value.toLowerCase()), eq(users.id, value)),
        )
        .limit(1);
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Akun tidak ditemukan.' });
      }
      assertConfirmEmail(input.confirmEmail, target.email);
      if (target.role === 'admin') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Akun ini sudah menjadi Superadmin.',
        });
      }
      await ctx.db.transaction(async (tx) => {
        await tx.update(users).set({ role: 'admin' }).where(eq(users.id, target.id));
        await tx.insert(adminAudit).values({
          actorId: ctx.session.user.id,
          action: 'superadmin_add',
          entityType: 'user',
          entityId: target.id,
          summary: `Menjadikan ${target.email} Superadmin`,
          metadata: { previousRole: target.role },
        });
      });
      return { success: true };
    }),

  superadminRemove: superadminProcedure
    .input(SuperadminRemoveInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Anda tidak dapat menurunkan diri sendiri.',
        });
      }
      const [target] = await ctx.db
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Akun tidak ditemukan.' });
      }
      if (isEmergencySuperadmin(target.email, env.SUPERADMIN_EMAILS)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Akun darurat dari SUPERADMIN_EMAILS tidak dapat diubah dari panel.',
        });
      }
      if (target.role !== 'admin') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Akun ini bukan Superadmin.',
        });
      }
      assertConfirmEmail(input.confirmEmail, target.email);

      const admins = await ctx.db
        .select({ email: users.email })
        .from(users)
        .where(and(eq(users.role, 'admin'), ne(users.id, target.id)));
      if (
        remainingSuperadmins(
          admins.map((row) => row.email),
          env.SUPERADMIN_EMAILS,
          target.email,
        ) < 1
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Superadmin terakhir tidak boleh diturunkan.',
        });
      }

      await ctx.db.transaction(async (tx) => {
        const [owned] = await tx
          .select({ id: lembaga.id })
          .from(lembaga)
          .where(eq(lembaga.userId, target.id))
          .limit(1);
        const nextRole = owned ? 'lembaga' : 'mahasiswa';
        await tx.update(users).set({ role: nextRole }).where(eq(users.id, target.id));
        await tx.insert(adminAudit).values({
          actorId: ctx.session.user.id,
          action: 'superadmin_remove',
          entityType: 'user',
          entityId: target.id,
          summary: `Menurunkan ${target.email} dari Superadmin`,
          metadata: { nextRole },
        });
      });
      return { success: true };
    }),

  // ---- Lembaga baru -----------------------------------------------------

  lembagaCreate: adminPermissionProcedure('lembaga.write')
    .input(AdminLembagaCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email sudah dipakai akun lain.',
        });
      }
      if (input.parentId) {
        const [parent] = await ctx.db
          .select({ id: lembaga.id })
          .from(lembaga)
          .where(eq(lembaga.id, input.parentId))
          .limit(1);
        if (!parent) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Lembaga induk tidak ditemukan.' });
        }
      }
      return ctx.db.transaction(async (tx) => {
        const [account] = await tx
          .insert(users)
          .values({ email: input.email, name: input.name, role: 'lembaga' })
          .returning({ id: users.id });
        if (!account) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [created] = await tx
          .insert(lembaga)
          .values({
            userId: account.id,
            name: input.name,
            acronym: input.acronym === '' ? null : input.acronym,
            type: input.type,
            parentId: input.parentId ?? null,
            foundingDate: new Date(),
          })
          .returning({ id: lembaga.id });
        if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const [alreadyVerified] = await tx
          .select({ id: verifiedUsers.id })
          .from(verifiedUsers)
          .where(eq(verifiedUsers.email, input.email))
          .limit(1);
        if (!alreadyVerified) {
          await tx.insert(verifiedUsers).values({ email: input.email });
        }
        await tx.insert(adminAudit).values({
          actorId: ctx.session.user.id,
          action: 'lembaga_create',
          entityType: 'lembaga',
          entityId: created.id,
          summary: `Membuat lembaga ${input.name} (${input.email})`,
          metadata: { type: input.type, parentId: input.parentId ?? null },
        });
        return { id: created.id, userId: account.id };
      });
    }),

  // ---- Email terverifikasi ---------------------------------------------

  verifiedEmailList: adminPermissionProcedure('accounts.write')
    .query(async ({ ctx }) => {
      return ctx.db
        .select({ id: verifiedUsers.id, email: verifiedUsers.email })
        .from(verifiedUsers)
        .orderBy(asc(verifiedUsers.email))
        .limit(1000);
    }),

  verifiedEmailAdd: adminPermissionProcedure('accounts.write')
    .input(VerifiedEmailAddInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [exists] = await ctx.db
        .select({ id: verifiedUsers.id })
        .from(verifiedUsers)
        .where(sql`lower(${verifiedUsers.email}) = ${input.email}`)
        .limit(1);
      if (exists) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Email sudah terdaftar.' });
      }
      await ctx.db.transaction(async (tx) => {
        await tx.insert(verifiedUsers).values({ email: input.email });
        await tx.insert(adminAudit).values({
          actorId: ctx.session.user.id,
          action: 'verified_email_add',
          entityType: 'verified_user',
          entityId: null,
          summary: `Menambah email terverifikasi ${input.email}`,
        });
      });
      return { success: true };
    }),

  verifiedEmailRemove: adminPermissionProcedure('accounts.write')
    .input(VerifiedEmailRemoveInputSchema)
    .mutation(async ({ ctx, input }) => {
      const removed = await ctx.db.transaction(async (tx) => {
        const rows = await tx
          .delete(verifiedUsers)
          .where(sql`lower(${verifiedUsers.email}) = ${input.email}`)
          .returning({ id: verifiedUsers.id });
        if (rows.length > 0) {
          await tx.insert(adminAudit).values({
            actorId: ctx.session.user.id,
            action: 'verified_email_remove',
            entityType: 'verified_user',
            entityId: rows[0]!.id,
            summary: `Menghapus email terverifikasi ${input.email}`,
          });
        }
        return rows.length;
      });
      if (removed === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Email tidak ditemukan.' });
      }
      return { success: true };
    }),
});
