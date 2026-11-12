import { sql } from 'drizzle-orm';

import { type createTestDb } from '~/test/test-db';

/** Jumlah baris tiap tabel aplikasi, urut nama tabel. */
export async function countAll(
  db: ReturnType<typeof createTestDb>['db'],
): Promise<Record<string, number>> {
  const tables = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public' and tablename like 'anmategra\\_%' order by tablename`,
  );
  const counts: Record<string, number> = {};
  for (const { tablename } of tables) {
    const [row] = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from ${sql.identifier(tablename)}`,
    );
    counts[tablename] = row!.n;
  }
  return counts;
}
