import { createTRPCRouter } from '~/server/api/trpc';

import { organizationAssignmentRouter } from './assignment';
import { organizationRoleRouter } from './role';
import { organizationStructureRouter } from './structure';
import { organizationUnitRouter } from './unit';

/**
 * Nested rather than flattened: `create` exists on three of these, so merging
 * them into one namespace would collide. Plain `createTRPCRouter` composition —
 * `mergeTRPCRouters` is for flattening whole routers onto one namespace, which
 * is not what we want here.
 */
export const organizationRouter = createTRPCRouter({
  structure: organizationStructureRouter,
  unit: organizationUnitRouter,
  role: organizationRoleRouter,
  assignment: organizationAssignmentRouter,
});
