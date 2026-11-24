import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ENTRYPOINT = resolve(__dirname, '../docker-entrypoint.sh');

let dir: string;

function stub(path: string, body: string) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
}

/** Menjalankan entrypoint dengan `drizzle-kit` palsu yang gagal `failures` kali dahulu. */
function run(failures: number, maxAttempts: number) {
  stub(
    join(dir, 'node_modules/.bin/drizzle-kit'),
    `n=$(cat "${dir}/count" 2>/dev/null || echo 0)
n=$((n + 1)); echo $n > "${dir}/count"
[ "$n" -gt ${failures} ]`,
  );
  stub(join(dir, 'node_modules/.bin/next'), `echo started >> "${dir}/log"`);
  const res = spawnSync('sh', [ENTRYPOINT], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      MIGRATE_MAX_ATTEMPTS: String(maxAttempts),
      MIGRATE_RETRY_DELAY: '0',
    },
  });
  const read = (f: string) => {
    try {
      return readFileSync(join(dir, f), 'utf8').trim();
    } catch {
      return '';
    }
  };
  return {
    status: res.status,
    attempts: Number(read('count')),
    log: read('log'),
  };
}

describe('docker-entrypoint.sh', () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'entrypoint-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('langsung menjalankan aplikasi bila migrasi berhasil', () => {
    const r = run(0, 5);
    expect(r.status).toBe(0);
    expect(r.attempts).toBe(1);
    expect(r.log).toBe('started');
  });

  it('mencoba ulang saat database belum tersedia, lalu menjalankan aplikasi', () => {
    const r = run(3, 5);
    expect(r.status).toBe(0);
    expect(r.attempts).toBe(4);
    expect(r.log).toBe('started');
  });

  it('menyerah dengan kode 1 setelah percobaan habis tanpa menjalankan aplikasi', () => {
    const r = run(99, 3);
    expect(r.status).toBe(1);
    expect(r.attempts).toBe(3);
    expect(r.log).toBe('');
  });
});
