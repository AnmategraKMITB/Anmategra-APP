import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Menjalankan seed mock oprec lewat vitest: router oprec memuat NextAuth, yang
 * tidak bisa dimuat `tsx` biasa. Tanpa globalSetup, jadi langsung ke DATABASE_URL.
 */
export default defineConfig({
  resolve: {
    alias: { '~': fileURLToPath(new URL('../../src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    env: { SKIP_ENV_VALIDATION: '1' },
    include: ['scripts/oprec/seed-mock.seed.ts'],
    root: fileURLToPath(new URL('../..', import.meta.url)),
  },
});
