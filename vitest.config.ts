import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // Modul yang memuat `~/env` (mis. trpc.ts) tidak memvalidasi variabel lingkungan saat tes.
    env: { SKIP_ENV_VALIDATION: '1' },
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    // Membuat database uji (bila belum ada) dan menerapkan seluruh migrasi.
    globalSetup: ['./src/test/global-setup.ts'],
    // Semua berkas tes memakai satu database uji, jadi tidak boleh paralel.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
