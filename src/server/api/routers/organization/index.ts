import { createTRPCRouter } from '~/server/api/trpc';

import { organizationImportRouter } from './import';
import { organizationPlacementRouter } from './placement';
import { organizationStructureRouter } from './structure';

/**
 * Organogram per periode (Fase 2B). Menggantikan router lama structure/unit/role/
 * assignment, yang bermodel tiga tingkat dan tidak dipakai FE mana pun.
 */
export const organizationRouter = createTRPCRouter({
  structure: organizationStructureRouter,
  placement: organizationPlacementRouter,
  import: organizationImportRouter,
});
