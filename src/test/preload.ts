import { afterAll, beforeEach } from 'bun:test';
import postgres from 'postgres';
import { vi } from 'vitest';

/**
 * Dimuat `bun test` sebelum setiap berkas tes (lihat bunfig.toml).
 *
 * Tiap worker `--parallel` memakai database uji sendiri, supaya TRUNCATE di
 * satu berkas tidak menghapus data berkas lain yang sedang berjalan. Nama
 * databasenya diturunkan dari TEST_DATABASE_URL ditambah nomor worker.
 */
const worker = process.env.BUN_TEST_WORKER_ID ?? '0';
const base = new URL(
  process.env.TEST_DATABASE_BASE_URL ??
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:password@localhost:5432/anmategra_test',
);
process.env.TEST_DATABASE_BASE_URL ??= base.toString();
const url = new URL(base);
url.pathname = `${base.pathname}_w${worker}`;
process.env.TEST_DATABASE_URL = url.toString();
process.env.SKIP_ENV_VALIDATION = '1';

// Preload berjalan sebelum tiap berkas. Migrasi yang sudah diterapkan
// dilewati, jadi setelah berkas pertama langkah ini hanya satu kueri.
// Impor dinamis: test-db.ts membaca TEST_DATABASE_URL saat dimuat, jadi ia
// baru boleh dimuat setelah URL per worker di atas dipasang.
const { default: setup } = await import('./global-setup');
await setup();

// Tanpa `--isolate`, preload hanya berjalan sekali dan `vi.mock` serta modul
// satu berkas terbawa ke berkas berikutnya. `bun test` mengabaikan script
// `test` di package.json, jadi pengecekan ini yang memastikan flag-nya dipakai.
const loadedFor = Bun.main;
beforeEach(() => {
  if (Bun.main !== loadedFor) {
    throw new Error(
      'Berkas tes berbagi modul dengan berkas lain. Jalankan `bun run test` atau `bun test --isolate=modules`.',
    );
  }
});

// Proses worker dan database-nya tetap sama antarberkas, jadi semua yang bisa
// bocor dikembalikan setelah tiap berkas: isi database, timer, mock, dan env.
const env = { ...process.env };
afterAll(async () => {
  const sql = postgres(process.env.TEST_DATABASE_URL!, {
    max: 1,
    onnotice: () => undefined,
  });
  try {
    // Sama dengan resetDb di test-db.ts: semua tabel aplikasi.
    const [row] = await sql<{ name: string | null }[]>`
      select string_agg(quote_ident(tablename), ', ') as name from pg_tables
      where schemaname = 'public' and tablename like 'anmategra\\_%'
    `;
    if (row?.name) await sql.unsafe(`truncate table ${row.name} cascade`);
  } finally {
    await sql.end();
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const key of Object.keys(process.env)) {
    if (!(key in env)) delete process.env[key];
  }
  Object.assign(process.env, env);
});
