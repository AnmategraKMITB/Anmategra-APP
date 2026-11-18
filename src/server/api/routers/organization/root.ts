import { and, asc, eq, isNull } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type * as schema from '~/server/db/schema';
import { events, lembaga, organizationUnit } from '~/server/db/schema';

import { ROOT_DEPTH } from './tree';

type Db = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

/**
 * Sebutan bawaan akar organogram. Akar adalah lembaga atau kepanitiaan itu
 * sendiri (tempat Ketua): kegiatan menjadi "Kepanitiaan", kepengurusan memakai
 * jenis lembaganya (Himpunan, UKM, Kepanitiaan, ...).
 */
export function rootTypeLabel(
  periodKind: string,
  lembagaType: string | null | undefined,
): string | null {
  if (periodKind === 'kegiatan') return 'Kepanitiaan';
  return lembagaType ?? null;
}

/**
 * Akar sebuah struktur; dibuat bila belum ada, dinamai seperti periodenya.
 * Bagian lain (Bidang, Divisi, ...) berada di bawahnya pada kedalaman 1 dan
 * seterusnya, jadi impor dan penambahan dari data lama tidak membuat banyak akar.
 */
export async function ensureRootUnit(
  db: Db,
  structureId: string,
  periodId: string,
): Promise<string> {
  const [existing] = await db
    .select({ id: organizationUnit.id })
    .from(organizationUnit)
    .where(
      and(
        eq(organizationUnit.structure_id, structureId),
        isNull(organizationUnit.parent_id),
      ),
    )
    .orderBy(asc(organizationUnit.sort_order), asc(organizationUnit.name))
    .limit(1);
  if (existing) return existing.id;

  const [period] = await db
    .select({ name: events.name, kind: events.kind, type: lembaga.type })
    .from(events)
    .leftJoin(lembaga, eq(lembaga.id, events.org_id))
    .where(eq(events.id, periodId))
    .limit(1);
  const [created] = await db
    .insert(organizationUnit)
    .values({
      structure_id: structureId,
      parent_id: null,
      name: period?.name ?? 'Organogram',
      typeLabel: period ? rootTypeLabel(period.kind, period.type) : null,
      level: ROOT_DEPTH,
      sort_order: 0,
    })
    .returning({ id: organizationUnit.id });
  return created!.id;
}
