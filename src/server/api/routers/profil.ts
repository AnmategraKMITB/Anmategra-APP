import {
  createTRPCRouter,
  mergeTRPCRouters,
  publicProcedure,
} from '~/server/api/trpc';

import { GetAllProfilKMOutputSchema } from '../types/profil.type';
import { profilKegiatanRouter } from './profil/kegiatan';
import { profileLembagaRouter } from './profil/lembaga';

const profilKmRouter = createTRPCRouter({
  getAllProfilKM: publicProcedure
    .output(GetAllProfilKMOutputSchema)
    .query(async ({ ctx }) => {
      const profilKMList = await ctx.db.query.profilKM.findMany({
        columns: {
          id: true,
          description: true,
        },
        orderBy: (profilKM, { asc }) => [asc(profilKM.description)],
      });

      return {
        profil_km: profilKMList,
      };
    }),
});

export const profilRouter = mergeTRPCRouters(
  profilKegiatanRouter,
  profileLembagaRouter,
  profilKmRouter,
);
