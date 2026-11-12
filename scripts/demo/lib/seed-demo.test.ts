import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestDb, resetDb } from '~/test/test-db';
import { DEMO_ACCOUNTS, seedDemo, type DemoDb } from './seed-demo';

const { db, close } = createTestDb();
const demoDb = db as unknown as DemoDb;

afterAll(close);
beforeEach(() => resetDb(db));

/** Jumlah baris tiap tabel aplikasi, urut nama tabel. */
export async function countAll(): Promise<Record<string, number>> {
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

describe('seedDemo', () => {
  it('membuat data untuk kelima peran', async () => {
    await seedDemo(demoDb);
    const c = await countAll();

    expect(c.anmategra_user).toBe(DEMO_ACCOUNTS.length);
    expect(c.anmategra_user).toBeGreaterThanOrEqual(10);
    // Owner/lembaga, kegiatan, organogram, anggota.
    expect(c.anmategra_lembaga).toBe(2);
    expect(c.anmategra_lembaga_period).toBeGreaterThanOrEqual(3);
    expect(c.anmategra_organization_unit).toBeGreaterThan(0);
    expect(c.anmategra_placement).toBeGreaterThan(0);
    expect(c.anmategra_lembaga_membership).toBeGreaterThan(0);
    // Admin Lembaga + Admin Kegiatan, dan Operator.
    expect(c.anmategra_access_grant).toBe(2);
    expect(c.anmategra_admin_permission).toBe(1);
    // Form dan oprec.
    expect(c.anmategra_form).toBe(3);
    expect(c.anmategra_recruitment).toBe(3);
    expect(c.anmategra_application).toBeGreaterThan(0);
    expect(c.anmategra_support).toBe(3);
  });

  it('oprec berstatus beragam dan akun demo bertanda is_demo', async () => {
    await seedDemo(demoDb);
    const statuses = await db.execute<{ status: string }>(
      sql`select distinct status from anmategra_recruitment order by status`,
    );
    expect(statuses.map((r) => r.status)).toEqual(['closed', 'draft', 'open']);
    const [row] = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from anmategra_user where not is_demo`,
    );
    expect(row!.n).toBe(0);
  });

  it('mempertahankan dua email nyata', async () => {
    await seedDemo(demoDb);
    const emails = DEMO_ACCOUNTS.map((a) => a.email);
    expect(emails).toContain('13523094@mahasiswa.itb.ac.id');
    expect(emails).toContain('anmategra@km.itb.ac.id');
  });

  it('idempoten: dua kali jalan menghasilkan jumlah baris sama', async () => {
    await seedDemo(demoDb);
    const first = await countAll();
    await seedDemo(demoDb);
    expect(await countAll()).toEqual(first);
  });
});
