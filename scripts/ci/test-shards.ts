/**
 * Membagi berkas tes ke beberapa shard CI dan membuktikan tidak ada yang hilang.
 *
 *   bun scripts/ci/test-shards.ts plan --shards 3 --shard 1 --out files.txt [--timings a.json ...]
 *   bun scripts/ci/test-shards.ts verify --files files.txt --junit report.xml
 *
 * `plan` membagi semua berkas tes (pola yang sama dengan `bun test`) dengan
 * algoritme LPT memakai durasi per berkas yang dicatat run penuh di develop
 * (`bun test --update-timings`). Pembagiannya deterministik, jadi setiap shard
 * menghitung pembagian yang sama, memastikan gabungan semua shard sama persis
 * dengan seluruh berkas tes, lalu menulis bagiannya sendiri.
 *
 * `verify` membaca laporan JUnit shard itu dan gagal bila berkas yang benar-benar
 * dijalankan berbeda dari bagiannya. Dua langkah ini bersama membuktikan bahwa
 * gabungan shard menjalankan setiap berkas, tanpa job yang menunggu job lain.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

// Pola bawaan `bun test`: <nama>.test|_test|.spec|_spec.<ekstensi JS/TS>.
const TEST_FILE = /(\.test|_test|\.spec|_spec)\.(c|m)?[jt]sx?$/;

export function listTestFiles(): string[] {
  const out = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard'],
    {
      encoding: 'utf8',
    },
  );
  return out
    .split('\n')
    .filter((f) => TEST_FILE.test(f) && !f.split('/').includes('node_modules'))
    .sort();
}

export function readTimings(paths: string[]): Map<string, number> {
  const times = new Map<string, number>();
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const data = JSON.parse(readFileSync(path, 'utf8')) as {
      files?: Record<string, number>;
    };
    for (const [file, ms] of Object.entries(data.files ?? {})) {
      times.set(file, Math.max(times.get(file) ?? 0, ms));
    }
  }
  return times;
}

/** LPT: berkas terlama lebih dulu, selalu ke shard yang paling ringan. */
export function partition(
  files: string[],
  times: Map<string, number>,
  shards: number,
): string[][] {
  const known = [...times.values()].sort((a, b) => a - b);
  // Berkas baru (belum punya durasi) dianggap sepanjang median.
  const fallback = known.length ? known[Math.floor(known.length / 2)]! : 1000;
  const cost = (f: string) => times.get(f) ?? fallback;
  const order = [...files].sort(
    (a, b) => cost(b) - cost(a) || a.localeCompare(b),
  );
  const bins = Array.from({ length: shards }, () => ({
    load: 0,
    files: [] as string[],
  }));
  for (const file of order) {
    const bin = bins.reduce((min, b) => (b.load < min.load ? b : min));
    bin.files.push(file);
    bin.load += cost(file);
  }
  return bins.map((b) => b.files.sort());
}

export function assertCoversAll(all: string[], parts: string[][]) {
  const seen = parts.flat();
  const dupes = seen.filter((f, i) => seen.indexOf(f) !== i);
  const missing = all.filter((f) => !seen.includes(f));
  const extra = seen.filter((f) => !all.includes(f));
  if (dupes.length || missing.length || extra.length) {
    throw new Error(
      `Pembagian shard rusak. Ganda: ${dupes.join(', ') || '-'}; hilang: ${missing.join(', ') || '-'}; asing: ${extra.join(', ') || '-'}`,
    );
  }
}

/** Berkas tes dari laporan JUnit `bun test`: testsuite tingkat atas, name == file. */
export function filesInJunit(xml: string): string[] {
  const files = new Set<string>();
  for (const m of xml.matchAll(/<testsuite name="([^"]+)" file="([^"]+)"/g)) {
    if (m[1] === m[2]) files.add(m[2]!);
  }
  return [...files].sort();
}

function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      shards: { type: 'string' },
      shard: { type: 'string' },
      out: { type: 'string' },
      timings: { type: 'string', multiple: true, default: [] },
      files: { type: 'string' },
      junit: { type: 'string' },
    },
  });

  if (positionals[0] === 'plan') {
    const shards = Number(values.shards);
    const shard = Number(values.shard);
    const all = listTestFiles();
    const times = readTimings(values.timings);
    const parts = partition(all, times, shards);
    assertCoversAll(all, parts);
    const mine = parts[shard - 1]!;
    writeFileSync(values.out!, mine.join('\n') + '\n');
    const loads = parts.map(
      (p) => p.reduce((s, f) => s + (times.get(f) ?? 0), 0) / 1000,
    );
    console.log(
      `${all.length} berkas tes, ${times.size} berdurasi; shard ${shard}/${shards} dapat ${mine.length} berkas. Beban per shard (s): ${loads.map((l) => l.toFixed(1)).join(' / ')}`,
    );
    return;
  }

  if (positionals[0] === 'verify') {
    const expected = readFileSync(values.files!, 'utf8')
      .split('\n')
      .filter(Boolean)
      .sort();
    const ran = filesInJunit(readFileSync(values.junit!, 'utf8'));
    const notRun = expected.filter((f) => !ran.includes(f));
    const unexpected = ran.filter((f) => !expected.includes(f));
    if (notRun.length || unexpected.length) {
      console.error(`Tidak dijalankan: ${notRun.join(', ') || '-'}`);
      console.error(`Di luar bagian shard: ${unexpected.join(', ') || '-'}`);
      process.exit(1);
    }
    console.log(`Shard menjalankan tepat ${ran.length} berkas bagiannya.`);
    return;
  }

  console.error(
    'Pakai: test-shards.ts plan|verify (lihat komentar di atas berkas).',
  );
  process.exit(2);
}

if (import.meta.main) main();
