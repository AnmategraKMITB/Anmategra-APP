/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { TRPCError, initTRPC } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { eventAdmin, events, lembagaAdmin } from '~/server/db/schema';

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
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Customize message for Zod validation errors
    if (error.cause instanceof ZodError) {
      const zodError = error.cause;
      const formattedMessage = zodError.errors
        .map((e) => {
          return e.message;
        })
        .join('; ');

      return {
        ...shape,
        message: formattedMessage,
        data: {
          ...shape.data,
          zodError: zodError.flatten(),
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
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

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
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
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
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (
      !ctx.session ||
      !ctx.session.user ||
      ctx.session.user.role !== 'admin'
    ) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

export const isLembaga = t.middleware(async ({ ctx, next }) => {
  if (ctx.session?.user.role !== 'lembaga') {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next();
});

export const lembagaProcedure = protectedProcedure
  .use(timingMiddleware)
  .use(isLembaga);

/**
 * RO-03: Owner/Admin Lembaga & Kepanitiaan.
 *
 * Owner Lembaga tetap akun `role==='lembaga'` yang memiliki lembaga tsb
 * (dicek via `session.user.lembagaId`). Admin Lembaga adalah akun lain
 * (biasanya `role==='mahasiswa'`) yang di-grant akses lewat tabel
 * `lembagaAdmin` tanpa mengubah role top-level mereka — makanya
 * permission check ini di-scope oleh `lembagaId` yang ada di *input*
 * procedure, bukan cuma dari JWT.
 */
type LembagaAccess = 'owner' | 'admin';

export async function canManageLembaga(
  database: typeof db,
  userId: string,
  role: string,
  sessionLembagaId: string | null | undefined,
  lembagaId: string,
): Promise<LembagaAccess | null> {
  if (role === 'lembaga' && sessionLembagaId === lembagaId) {
    return 'owner';
  }
  const grant = await database.query.lembagaAdmin.findFirst({
    where: and(
      eq(lembagaAdmin.lembagaId, lembagaId),
      eq(lembagaAdmin.userId, userId),
      eq(lembagaAdmin.status, 'active'),
    ),
  });
  return grant ? 'admin' : null;
}

/**
 * Kepanitiaan (event) tidak punya Owner sendiri — Owner Lembaga induknya
 * otomatis jadi Owner Kepanitiaan. Admin Kepanitiaan bisa di-grant scoped
 * ke 1 event lewat tabel `eventAdmin`, terpisah dari Admin Lembaga.
 */
export async function canManageEvent(
  database: typeof db,
  userId: string,
  role: string,
  sessionLembagaId: string | null | undefined,
  eventId: string,
): Promise<LembagaAccess | null> {
  const event = await database.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { id: true, org_id: true },
  });
  if (!event) return null;

  if (event.org_id) {
    const lembagaAccess = await canManageLembaga(
      database,
      userId,
      role,
      sessionLembagaId,
      event.org_id,
    );
    if (lembagaAccess) return lembagaAccess;
  }

  const grant = await database.query.eventAdmin.findFirst({
    where: and(
      eq(eventAdmin.eventId, eventId),
      eq(eventAdmin.userId, userId),
      eq(eventAdmin.status, 'active'),
    ),
  });
  return grant ? 'admin' : null;
}

/**
 * Procedure baru untuk mutation/query yang menerima `lembagaId` di input
 * dan boleh diakses Owner ATAU Admin Lembaga. Endpoint lama yang masih
 * pakai `lembagaProcedure` (Owner-only via role, tanpa cek input) TIDAK
 * perlu dimigrasi sekaligus — migrasi dilakukan bertahap per-endpoint.
 */
export const lembagaScopedProcedure = protectedProcedure
  .use(timingMiddleware)
  .use(async ({ ctx, next, getRawInput }) => {
    const raw = (await getRawInput()) as { lembagaId?: unknown };
    const lembagaId =
      typeof raw?.lembagaId === 'string' ? raw.lembagaId : undefined;
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
export const lembagaOwnerProcedure = lembagaScopedProcedure.use(
  ({ ctx, next }) => {
    if (ctx.lembagaAccess !== 'owner') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Hanya Owner Lembaga yang dapat melakukan aksi ini.',
      });
    }
    return next();
  },
);

/**
 * Analog `lembagaScopedProcedure` tapi di-scope oleh `eventId`. Owner/Admin
 * Lembaga otomatis boleh kelola event di bawah lembaganya; Admin Kepanitiaan
 * cuma boleh kelola event yang di-grant ke dia secara spesifik.
 */
export const eventScopedProcedure = protectedProcedure
  .use(timingMiddleware)
  .use(async ({ ctx, next, getRawInput }) => {
    const raw = (await getRawInput()) as { eventId?: unknown };
    const eventId =
      typeof raw?.eventId === 'string' ? raw.eventId : undefined;
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
    );
    if (!access) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({ ctx: { ...ctx, eventAccess: access, eventId } });
  });
