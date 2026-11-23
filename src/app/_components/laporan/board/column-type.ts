import { check } from '~/lib/lifecycle/define';
import { supportLifecycle } from '~/lib/lifecycle/support';

export type ColumnType = 'Draft' | 'Reported' | 'In Progress' | 'Resolved';

const ACTIVE_COLUMN_TYPES: readonly ColumnType[] = [
  'Draft',
  'Reported',
  'In Progress',
  'Resolved',
];

/**
 * Legacy report statuses ('Open', 'Closed', 'Backlog') exist in the DB enum
 * but predate the current 4-stage kanban lifecycle. Fall back to 'Draft' so
 * display code never silently drops an unhandled status.
 */
export function toColumnType(status: string): ColumnType {
  return ACTIVE_COLUMN_TYPES.includes(status as ColumnType)
    ? (status as ColumnType)
    : 'Draft';
}

/**
 * Whether a card may be dropped from `source` into `dest`. Reporters can only
 * reorder their Draft/Reported cards and submit a draft; admins follow
 * `supportLifecycle` (forward only), the same rule `setReportStatus` enforces.
 */
export function canDropReport(
  isAdminView: boolean,
  source?: ColumnType,
  dest?: ColumnType,
): boolean {
  if (!source || !dest) return false;
  if (source === dest) {
    return isAdminView || source === 'Draft' || source === 'Reported';
  }
  if (isAdminView) return check(supportLifecycle, source, dest, undefined).ok;
  return source === 'Draft' && dest === 'Reported';
}
