/**
 * Mengembalikan database demo ke kondisi awal: mengosongkan SEMUA tabel
 * aplikasi, lalu menjalankan seed.
 *
 * Daftar tabel dibaca dari katalog PostgreSQL (awalan `anmategra_` pada skema
 * `public`), bukan daftar tulisan tangan, sehingga tabel baru otomatis ikut
 * (termasuk `recruitment*`, `access_grant`, `admin_permission`). Tabel migrasi
 * Drizzle berada di skema `drizzle` dan tidak tersentuh.
 */
import { sql } from 'drizzle-orm';

import { seedDemo, type DemoDb } from './seed-demo';

const TABLE_PREFIX = 'anmategra_';

export async function listAppTables(db: DemoDb): Promise<string[]> {
  const rows = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables
        where schemaname = 'public' and tablename like ${TABLE_PREFIX.replace('_', '\\_') + '%'}
        order by tablename`,
  );
  return rows.map((r) => r.tablename);
}

/** Satu pernyataan TRUNCATE ... CASCADE di dalam transaksi; mengembalikan nama tabel. */
export async function truncateAllTables(db: DemoDb): Promise<string[]> {
  const tables = await listAppTables(db);
  if (tables.length === 0) return tables;
  const list = sql.join(
    tables.map((t) => sql`${sql.identifier(t)}`),
    sql`, `,
  );
  await db.transaction(async (tx) => {
    await tx.execute(sql`truncate table ${list} restart identity cascade`);
  });
  return tables;
}

export async function resetDemo(db: DemoDb) {
  const tables = await truncateAllTables(db);
  const seeded = await seedDemo(db);
  return { cleared: tables.length, ...seeded };
}
