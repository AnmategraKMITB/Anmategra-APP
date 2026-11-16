import path from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import {
  TEST_DATABASE_URL,
  assertTestDatabaseName,
  silentNotice,
} from './test-db';

/**
 * Menyiapkan database uji sekali per run: membuatnya bila belum ada, lalu
 * menerapkan seluruh migrasi dari `drizzle/`. Migrasi yang sudah diterapkan
 * dilewati, jadi run berikutnya cepat.
 */
export default async function setup() {
  const name = assertTestDatabaseName(TEST_DATABASE_URL);

  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';
  const admin = postgres(adminUrl.toString(), {
    max: 1,
    onnotice: silentNotice,
  });
  try {
    const exists = await admin`select 1 from pg_database where datname = ${name}`;
    if (exists.length === 0) {
      // `template0` menghindari galat versi collation pada `template1` lokal.
      await admin.unsafe(`create database "${name}" template template0`);
    }
  } finally {
    await admin.end();
  }

  const client = postgres(TEST_DATABASE_URL, { max: 1, onnotice: silentNotice });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: path.resolve(process.cwd(), 'drizzle'),
    });
  } finally {
    await client.end();
  }
}
