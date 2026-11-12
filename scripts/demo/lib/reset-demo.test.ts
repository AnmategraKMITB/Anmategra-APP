import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import * as schema from '~/server/db/schema';
import { createTestDb, createUser, resetDb } from '~/test/test-db';
import { listAppTables, resetDemo, truncateAllTables } from './reset-demo';
import { seedDemo, type DemoDb } from './seed-demo';
import { countAll } from './test-helpers';

const { db, close } = createTestDb();
const demoDb = db as unknown as DemoDb;

afterAll(close);
beforeEach(() => resetDb(db));

describe('truncateAllTables', () => {
  it('mencakup setiap tabel yang didefinisikan di schema.ts', async () => {
    const defined = (Object.values(schema) as unknown[])
      .filter((v): v is PgTable => is(v, PgTable))
      .map((t) => getTableName(t))
      .sort();
    expect(defined.length).toBeGreaterThan(50);
    expect(await listAppTables(demoDb)).toEqual(defined);
  });

  it('mengosongkan semua tabel, termasuk recruitment*, access_grant, admin_permission', async () => {
    await seedDemo(demoDb);
    const before = await countAll(db);
    for (const t of [
      'anmategra_recruitment',
      'anmategra_recruitment_wave',
      'anmategra_recruitment_division',
      'anmategra_application',
      'anmategra_application_choice',
      'anmategra_placement_decision',
      'anmategra_access_grant',
      'anmategra_admin_permission',
    ]) {
      expect(before[t], t).toBeGreaterThan(0);
    }

    await truncateAllTables(demoDb);
    const after = await countAll(db);
    expect(Object.values(after).every((n) => n === 0)).toBe(true);
    expect(Object.keys(after)).toEqual(Object.keys(before));
  });
});

describe('resetDemo', () => {
  it('membuang data yang ditambahkan saat demo dan kembali ke kondisi seed', async () => {
    await seedDemo(demoDb);
    const baseline = await countAll(db);

    await createUser(db, { email: 'sisa-demo@test.local' });
    expect((await countAll(db)).anmategra_user).toBe(baseline.anmategra_user! + 1);

    await resetDemo(demoDb);
    expect(await countAll(db)).toEqual(baseline);
  });

  it('idempoten: dua kali jalan menghasilkan kondisi sama', async () => {
    await resetDemo(demoDb);
    const first = await countAll(db);
    await resetDemo(demoDb);
    expect(await countAll(db)).toEqual(first);
  });
});
