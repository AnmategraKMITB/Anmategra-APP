import { createTRPCRouter, mergeTRPCRouters } from '~/server/api/trpc';

import { formFieldRouter } from './field';
import { formFormRouter } from './form';
import { formSubmissionRouter } from './submission';

/**
 * `form.*` holds the form-level procedures and the filling ones side by side
 * (no name collisions), while fields get their own `form.field.*` namespace
 * because `create`/`update`/`delete` exist on both.
 */
export const formRouter = mergeTRPCRouters(
  formFormRouter,
  formSubmissionRouter,
  createTRPCRouter({ field: formFieldRouter }),
);
