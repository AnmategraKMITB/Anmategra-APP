/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { TRPCError, initTRPC } from '@trpc/server';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import superjson from 'superjson';
import { type ZodError, type ZodIssue, z } from 'zod';
import { getServerAuthSession } from '~/server/auth';
import {
  type AdminPermission,
  hasAdminPermission,
} from '~/server/api/admin-permissions';
import { resolveAssessAccess } from '~/server/api/routers/oprec/assess-access';
import { db } from '~/server/db';
import { adminPermission, form, recruitment } from '~/server/db/schema';

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await getServerAuthSession();

  return {
    db,
    session,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
/**
 * Per-procedure metadata. `access` is set once on each procedure builder below
 * instead of on every procedure, so routers stay untouched; the OpenAPI
 * generator (`scripts/gen-openapi.cts`) reads it to document who may call what.
 */
export type ApiMeta = {
  access:
    | 'public'
    | 'authenticated'
    | 'admin'
    | 'admin-permission'
    | 'mahasiswa'
    | 'lembaga-scoped'
    | 'lembaga-owner'
    | 'event-scoped'
    | 'form-scoped'
    | 'oprec-scoped'
    | 'oprec-assess';
};

/**
 * Mengambil `issues` validasi dari `cause` sebuah TRPCError.
 *
 * Dicocokkan dari bentuknya, bukan `instanceof`. Error lemparan zod sendiri
 * memang turunan `Error`, jadi tRPC meneruskannya apa adanya. Tapi `ZodError`
 * yang dibangun manual bukan turunan `Error` di Zod 4, sehingga tRPC
 * menyalinnya ke `UnknownCauseError` lewat `Object.assign` dan `issues` — own
 * property yang non-enumerable — ikut hilang. Endpoint yang perlu mengirim
 * issue sendiri karena itu memakai cause turunan `Error` dengan `issues`
 * sebagai properti biasa (lihat `AnswerIssuesError` di router form).
 */
export function zodIssuesFromCause(cause: unknown): ZodIssue[] | null {
  if (typeof cause !== 'object' || cause === null) return null;
  const { issues } = cause as { issues?: unknown };
  return Array.isArray(issues) ? (issues as ZodIssue[]) : null;
}

const t = initTRPC
  .context<typeof createTRPCContext>()
  .meta<ApiMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      // Customize message for Zod validation errors
      const issues = zodIssuesFromCause(error.cause);
      if (issues) {
        const formattedMessage = issues
          .map((e) => {
            return e.message;
          })
          .join('; ');

        return {
          ...shape,
          message: formattedMessage,
          data: {
            ...shape.data,
            zodError: z.flattenError({ issues } as unknown as ZodError),
          },
        };
      }

      return {
        ...shape,
        data: {
          ...shape.data,
          zodError: null,
        },
      };
    },
  });

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Merge multiple routers into one, flattening their procedures onto a
 * single namespace (official replacement for spreading `._def.procedures`).
 *
 * @see https://trpc.io/docs/server/merging-routers
 */
export const mergeTRPCRouters = t.mergeRouters;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  // if (t._config.isDev) {
  //   // artificial delay in dev
  //   const waitMs = Math.floor(Math.random() * 400) + 100;
  //   await new Promise((resolve) => setTimeout(resolve, waitMs));
  // }

  const result = await next();

  const end = Date.now();
  // Hanya log yang lambat; log tiap panggilan membanjiri stdout saat ramai.
  if (end - start > 500) {
    console.warn(`[TRPC] ${path} took ${end - start}ms to execute`);
  }

  // Uncomment this to include the execution time in the response

  // const duration = end - start;
  // if (result.ok) {
  //   result.data = {
  //     data: result.data,
  //     executionTime: `${duration}ms`, // Include execution time in the response
  //   };
  // }

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure
  .meta({ access: 'public' })
  .use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .meta({ access: 'authenticated' })
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

export const adminProcedure = t.procedure
  .meta({ access: 'admin' })
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    // 401 = belum login; 403 = sudah login tetapi bukan admin.
    if (!ctx.session?.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    if (ctx.session.user.role !== 'admin') {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

/**
 * Izin operator admin console. Superadmin (`role === 'admin'`) melewati semua
 * pemeriksaan; operator biasa harus punya baris `admin_permission` aktif yang
 * memuat izin yang diminta.
 */
export const adminPermissionProcedure = (required: AdminPermission) =>
  t.procedure
    .meta({ access: 'admin-permission' })
    .use(timingMiddleware)
    .use(async ({ ctx, next }) => {
      if (!ctx.session?.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }
      if (ctx.session.user.role === 'admin') {
        return next({
          ctx: {
            session: { ...ctx.session, user: ctx.session.user },
            adminPermissions: ['*'] as const,
          },
        });
      }

      const row = await ctx.db.query.adminPermission.findFirst({
        where: and(
          eq(adminPermission.userId, ctx.session.user.id),
          isNull(adminPermission.revokedAt),
          or(
            isNull(adminPermission.expiresAt),
            gt(adminPermission.expiresAt, new Date()),
          ),
        ),
        columns: { permissions: true },
      });
      if (!row || !hasAdminPermission(row.permissions, required)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return next({
        ctx: {
          session: { ...ctx.session, user: ctx.session.user },
          adminPermissions: row.permissions,
        },
      });
    });

/**
 * Hanya Account Role `mahasiswa`. Untuk tindakan yang mengubah data milik
 * mahasiswa sendiri; role lain ditolak (403) alih-alih berhasil tanpa efek.
 */
export const mahasiswaProcedure = protectedProcedure
  .meta({ access: 'mahasiswa' })
  .use(({ ctx, next }) => {
    if (ctx.session.user.role !== 'mahasiswa') {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next();
  });

// Logika "siapa boleh mengelola lembaga/periode" ada di access.ts supaya bisa diuji
// tanpa memuat NextAuth; diekspor ulang di sini agar impor lama tetap berlaku.
import {
  canManageEvent,
  canManageLembaga,
  type LembagaAccess,
} from './access';
export { canManageEvent, canManageLembaga, type LembagaAccess };

/**
 * Id dari input mentah sebuah scoped procedure.
 *
 * Middleware tRPC berjalan **sebelum** schema `.input()` diparse, jadi nilai di
 * sini belum tersentuh Zod padahal langsung dipakai menanyai database. Tanpa
 * penjagaan bentuk, id yang memuat byte NUL membuat driver Postgres gagal dan
 * muncul sebagai 500, bukan BAD_REQUEST. Panjangnya dibatasi selebar kolom id.
 */
function rawId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (value.length === 0 || value.length > 255) return undefined;
  if (value.includes('\u0000')) return undefined;
  return value;
}

/**
 * Prosedur untuk mutation/query yang menerima `lembagaId` di input dan boleh
 * diakses Owner ATAU Admin Lembaga (`canManageLembaga`). Semua endpoint
 * pengelolaan lembaga memakai prosedur ini; `ctx.lembagaId` adalah Scope.
 */
export const lembagaScopedProcedure = protectedProcedure
  .meta({ access: 'lembaga-scoped' })
  .use(timingMiddleware)
  .use(async ({ ctx, next, getRawInput }) => {
    const raw = (await getRawInput()) as { lembagaId?: unknown };
    const lembagaId = rawId(raw?.lembagaId);
    if (!lembagaId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'lembagaId is required',
      });
    }
    const access = await canManageLembaga(
      ctx.db,
      ctx.session.user.id,
      ctx.session.user.role,
      ctx.session.user.lembagaId,
      lembagaId,
    );
    if (!access) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({ ctx: { ...ctx, lembagaAccess: access, lembagaId } });
  });

/** Owner-only: kelola/grant/revoke admin lain — bukan operasional biasa. */
export const lembagaOwnerProcedure = lembagaScopedProcedure
  .meta({ access: 'lembaga-owner' })
  .use(({ ctx, next }) => {
    if (ctx.lembagaAccess !== 'owner') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Hanya Owner Lembaga yang dapat melakukan aksi ini.',
      });
    }
    return next();
  });

/**
 * Analog `lembagaScopedProcedure` tapi di-scope oleh `eventId`. Owner/Admin
 * Lembaga otomatis boleh kelola event di bawah lembaganya; Admin Kepanitiaan
 * cuma boleh kelola event yang di-grant ke dia secara spesifik.
 */
export const eventScopedProcedure = protectedProcedure
  .meta({ access: 'event-scoped' })
  .use(timingMiddleware)
  .use(async ({ ctx, next, getRawInput }) => {
    const raw = (await getRawInput()) as { eventId?: unknown };
    const eventId = rawId(raw?.eventId);
    if (!eventId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'eventId is required',
      });
    }
    const access = await canManageEvent(
      ctx.db,
      ctx.session.user.id,
      ctx.session.user.role,
      ctx.session.user.lembagaId,
      eventId,
      'events',
    );
    if (!access) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({ ctx: { ...ctx, eventAccess: access, eventId } });
  });

/**
 * Di-scope oleh `formId` (#210). Form dimiliki tepat satu lembaga ATAU satu
 * event, jadi aksesnya diturunkan dari pemiliknya: Owner/Admin Lembaga untuk
 * form lembaga, dan aturan `canManageEvent` untuk form kepanitiaan.
 *
 * Form yang tidak ada → NOT_FOUND, bukan milik → FORBIDDEN. Membedakan
 * keduanya aman karena `formId` adalah UUID yang tidak bisa ditebak.
 *
 * Endpoint yang juga menerima `fieldId` WAJIB memastikan field itu milik
 * `ctx.form.id` — builder ini hanya membuktikan akses ke form-nya.
 */
export const formScopedProcedure = protectedProcedure
  .meta({ access: 'form-scoped' })
  .use(timingMiddleware)
  .use(async ({ ctx, next, getRawInput }) => {
    const raw = (await getRawInput()) as { formId?: unknown };
    const formId = rawId(raw?.formId);
    if (!formId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'formId is required',
      });
    }
    const found = await ctx.db.query.form.findFirst({
      where: eq(form.id, formId),
    });
    if (!found) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Formulir tidak ditemukan.',
      });
    }
    const { id: userId, role, lembagaId: sessionLembagaId } = ctx.session.user;
    const access = found.lembagaId
      ? await canManageLembaga(
          ctx.db,
          userId,
          role,
          sessionLembagaId,
          found.lembagaId,
          'forms',
        )
      : found.eventId
        ? await canManageEvent(
            ctx.db,
            userId,
            role,
            sessionLembagaId,
            found.eventId,
            'forms',
          )
        : null;
    if (!access) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({ ctx: { ...ctx, form: found, formAccess: access } });
  });

/**
 * Di-scope oleh `recruitmentId`. Oprec milik satu periode, jadi aksesnya
 * diturunkan dari `canManageEvent` dengan fitur 'oprec' (atau 'admin'), sehingga
 * admin lembaga bisa menunjuk orang lain yang hanya boleh mengurus oprec.
 *
 * Oprec yang tidak ada → NOT_FOUND, bukan milik → FORBIDDEN.
 */
export const oprecScopedProcedure = protectedProcedure
  .meta({ access: 'oprec-scoped' })
  .use(timingMiddleware)
  .use(async ({ ctx, next, getRawInput }) => {
    const raw = (await getRawInput()) as { recruitmentId?: unknown };
    const recruitmentId = rawId(raw?.recruitmentId);
    if (!recruitmentId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'recruitmentId is required',
      });
    }
    const found = await ctx.db.query.recruitment.findFirst({
      where: eq(recruitment.id, recruitmentId),
    });
    if (!found) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Oprec tidak ditemukan.',
      });
    }
    const access = await canManageEvent(
      ctx.db,
      ctx.session.user.id,
      ctx.session.user.role,
      ctx.session.user.lembagaId,
      found.periodId,
      'oprec',
    );
    if (!access) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({ ctx: { ...ctx, recruitment: found, oprecAccess: access } });
  });

/**
 * Analog `oprecScopedProcedure` tetapi di-scope oleh `eventId` (periode), untuk
 * daftar dan pembuatan oprec yang belum punya `recruitmentId`.
 */
export const oprecPeriodProcedure = protectedProcedure
  .meta({ access: 'oprec-scoped' })
  .use(timingMiddleware)
  .use(async ({ ctx, next, getRawInput }) => {
    const raw = (await getRawInput()) as { eventId?: unknown };
    const eventId = rawId(raw?.eventId);
    if (!eventId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'eventId is required',
      });
    }
    const access = await canManageEvent(
      ctx.db,
      ctx.session.user.id,
      ctx.session.user.role,
      ctx.session.user.lembagaId,
      eventId,
      'oprec',
    );
    if (!access) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({ ctx: { ...ctx, oprecAccess: access, eventId } });
  });

/**
 * Di-scope oleh `recruitmentId` untuk peran penilaian: admin oprec, Kadiv,
 * penilai umum, atau penilai tambahan. Peran dibawa di `ctx.assess`; tiap
 * prosedur menegakkan batas lingkupnya sendiri (umum atau divisi tertentu).
 */
export const oprecAssessProcedure = protectedProcedure
  .meta({ access: 'oprec-assess' })
  .use(timingMiddleware)
  .use(async ({ ctx, next, getRawInput }) => {
    const raw = (await getRawInput()) as { recruitmentId?: unknown };
    const recruitmentId = rawId(raw?.recruitmentId);
    if (!recruitmentId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'recruitmentId is required',
      });
    }
    const found = await ctx.db.query.recruitment.findFirst({
      where: eq(recruitment.id, recruitmentId),
    });
    if (!found) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Oprec tidak ditemukan.',
      });
    }
    const assess = await resolveAssessAccess(
      ctx.db,
      {
        id: ctx.session.user.id,
        role: ctx.session.user.role,
        lembagaId: ctx.session.user.lembagaId,
      },
      found,
    );
    if (!assess) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({ ctx: { ...ctx, recruitment: found, assess } });
  });
