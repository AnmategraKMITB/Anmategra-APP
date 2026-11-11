import { recruitmentLog } from '~/server/db/schema';

import { type Tx } from '../form/services';
import { type Database } from './services';

/** Mencatat satu tindakan pada oprec; dipanggil di transaksi yang sama dengan perubahannya. */
export async function logAction(
  db: Tx | Database,
  entry: {
    recruitmentId: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    detail?: Record<string, unknown>;
  },
) {
  await db.insert(recruitmentLog).values({
    recruitmentId: entry.recruitmentId,
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    detail: entry.detail ?? null,
  });
}
