import { profileRouter } from '~/server/api/routers/profile';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';

import { adminConsoleRouter } from './routers/admin-console';
import { adminGrantRouter } from './routers/admin-grant';
import { adminRouter } from './routers/admin';
import { adminOpsRouter } from './routers/admin-ops';
import { eventRouter } from './routers/event';
import { formRouter } from './routers/form';
import { kegiatanRouter } from './routers/kegiatan';
import { landingRouter } from './routers/landing';
import { lembagaRouter } from './routers/lembaga';
import { oprecRouter } from './routers/oprec';
import { organizationRouter } from './routers/organization';
import { profilRouter } from './routers/profil';
import { raporRouter } from './routers/rapor';
import { riwayatRouter } from './routers/riwayat';
import { userRouter } from './routers/user';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  admin: adminRouter,
  adminConsole: adminConsoleRouter,
  adminOps: adminOpsRouter,
  adminGrant: adminGrantRouter,
  landing: landingRouter,
  lembaga: lembagaRouter,
  event: eventRouter,
  kegiatan: kegiatanRouter,
  profile: profileRouter,
  users: userRouter,
  profil: profilRouter,
  rapor: raporRouter,
  riwayat: riwayatRouter,
  organization: organizationRouter,
  oprec: oprecRouter,
  form: formRouter,
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
