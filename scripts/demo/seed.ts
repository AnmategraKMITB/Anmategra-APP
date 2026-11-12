/**
 * Seed data demo. Idempoten; jalankan hanya dengan APP_ENV=demo.
 *
 *   APP_ENV=demo DATABASE_URL=... npx tsx scripts/demo/seed.ts
 *
 * Password semua akun demo berasal dari DEMO_PASSWORD_HASH di env deployment.
 */
import { db } from '~/server/db';
import { seedDemo } from './lib/seed-demo';

if (process.env.APP_ENV !== 'demo') {
  throw new Error('Seed demo hanya boleh dijalankan saat APP_ENV=demo.');
}

const { accounts } = await seedDemo(db);
for (const email of accounts) console.log(`✓ ${email}`);

console.log('\nSelesai. Gunakan password dari DEMO_PASSWORD_HASH deployment demo.');
process.exit(0);
