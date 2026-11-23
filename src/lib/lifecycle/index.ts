import { type LifecycleDescription, describeLifecycle } from './describe';
import { formLifecycle } from './form';
import { oprecLifecycle } from './oprec';
import { placementLifecycle } from './placement';
import { resultsReleaseLifecycle } from './results-release';
import { supportLifecycle } from './support';
import { transferLifecycle } from './transfer';

/**
 * Semua siklus hidup yang dideklarasikan. `bun run docs` menulis
 * `docs/api/lifecycles.{json,md}` dari daftar ini; siklus baru wajib didaftarkan.
 */
export const LIFECYCLES: LifecycleDescription[] = [
  describeLifecycle(formLifecycle),
  describeLifecycle(oprecLifecycle),
  describeLifecycle(placementLifecycle),
  describeLifecycle(resultsReleaseLifecycle),
  describeLifecycle(transferLifecycle),
  describeLifecycle(supportLifecycle),
];
