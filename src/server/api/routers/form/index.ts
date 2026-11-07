import { createTRPCRouter, mergeTRPCRouters } from '~/server/api/trpc';

import { formEndingRouter } from './ending';
import { formFieldRouter } from './field';
import { formFormRouter } from './form';
import { formResponsesRouter } from './responses';
import { formSectionRouter } from './section';
import { formSubmissionRouter } from './submission';

/**
 * `form.*` holds the form-level procedures and the filling ones side by side
 * (no name collisions), while fields and sections get their own
 * `form.field.*` and `form.section.*` namespaces because `create`/`update`/
 * `delete` exist on all three.
 */
export const formRouter = mergeTRPCRouters(
  formFormRouter,
  formSubmissionRouter,
  createTRPCRouter({
    field: formFieldRouter,
    section: formSectionRouter,
    ending: formEndingRouter,
    responses: formResponsesRouter,
  }),
);
