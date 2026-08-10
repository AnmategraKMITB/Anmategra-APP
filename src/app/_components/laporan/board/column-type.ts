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
