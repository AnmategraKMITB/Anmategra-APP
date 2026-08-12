import { profileRouter } from '~/server/api/routers/profile';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';

import { adminRouter } from './routers/admin';
import { eventRouter } from './routers/event';
import { kegiatanRouter } from './routers/kegiatan';
import { landingRouter } from './routers/landing';
import { lembagaRouter } from './routers/lembaga';
import { organizationRouter } from './routers/organization';
import { profilRouter } from './routers/profil';
import { raporRouter } from './routers/rapor';
import { userRouter } from './routers/user';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  admin: adminRouter,
  landing: landingRouter,
  lembaga: lembagaRouter,
  event: eventRouter,
  kegiatan: kegiatanRouter,
  profile: profileRouter,
  users: userRouter,
  profil: profilRouter,
  rapor: raporRouter,
  organization: organizationRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
