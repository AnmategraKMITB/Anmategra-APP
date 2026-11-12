/**
 * Reset data demo: mengosongkan semua tabel aplikasi lalu menjalankan seed.
 *
 *   APP_ENV=demo NEXT_PUBLIC_APP_ENV=demo DATABASE_URL=... npm run demo:reset
 *
 * Menolak berjalan kecuali APP_ENV=demo dan DATABASE_URL menunjuk database
 * lokal atau database yang namanya/hostnya memuat "demo". Lihat guard.ts.
 */
import { assertDemoResetAllowed } from './lib/guard';

// Penjaga dijalankan sebelum modul database dimuat, supaya koneksi tidak
// pernah dibuka pada lingkungan yang salah.
const target = assertDemoResetAllowed({
  APP_ENV: process.env.APP_ENV,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
});
console.log(`Mereset database "${target.database}" pada ${target.host}…`);

const { db } = await import('~/server/db');
const { resetDemo } = await import('./lib/reset-demo');

const result = await resetDemo(db);
console.log(`✓ ${result.cleared} tabel dikosongkan.`);
for (const email of result.accounts) console.log(`✓ ${email}`);
console.log('\nSelesai. Gunakan password dari DEMO_PASSWORD_HASH deployment demo.');
process.exit(0);
