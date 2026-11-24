/**
 * Membagi berkas tes ke beberapa shard CI dan membuktikan tidak ada yang hilang.
 *
 *   bun scripts/ci/test-shards.ts plan --shards 3 --shard 1 --out <dir> [--timings a.json ...] [--changed-from <sha>]
 *   bun scripts/ci/test-shards.ts verify --out <dir>
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
 *
 * Dengan `--changed-from` (hanya di PR) shard menjalankan sebagian saja: berkas
 * tes yang bisa dicapai diff lewat import (`bun test --changed`), ditambah tes
 * yang membaca berkas lewat fs dan berkas itu berubah (FS_INPUTS). Bila diff
 * menyentuh RERUN_ALL, semua tes tetap dijalankan. Run penuh di merge queue
 * menjalankan semuanya sebelum apa pun masuk develop.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

// Pola bawaan `bun test`: <nama>.test|_test|.spec|_spec.<ekstensi JS/TS>.
const TEST_FILE = /(\.test|_test|\.spec|_spec)\.(c|m)?[jt]sx?$/;

/**
 * Masukan yang tidak terlihat lewat graf import. Bila salah satunya berubah,
 * seleksi dimatikan dan semua tes dijalankan.
 */
const RERUN_ALL = [
  'package.json',
  'bun.lock',
  'bunfig.toml', // preload tes
  'tsconfig.json', // alias path
  '.nvmrc',
  'scripts/install-bun.sh', // versi Bun
  'src/test/', // preload, global-setup, helper database
  'drizzle/', // migrasi dijalankan sebelum tiap berkas
  '.github/', // workflow dan action CI
  'scripts/ci/',
];

/** Tes yang membaca berkas lewat fs, bukan import: tes itu ikut bila berkasnya berubah. */
const FS_INPUTS: Record<string, string[]> = {
  // Memindai sumber router untuk penulisan status langsung.
  'src/server/api/lifecycle-writes.test.ts': ['src/server/api/'],
  // Menjalankan skrip entrypoint Docker.
  'scripts/docker-entrypoint.test.ts': ['docker-entrypoint.sh'],
};

const matches = (file: string, inputs: string[]) =>
  inputs.some((i) => (i.endsWith('/') ? file.startsWith(i) : file === i));

function changedFiles(base: string): string[] {
  return execFileSync('git', ['diff', '--name-only', base, 'HEAD'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
}

/** Salinan terurut; `toSorted` belum ada di lib ES2022 tsconfig. */
function sorted<T>(items: Iterable<T>, compare?: (a: T, b: T) => number): T[] {
  const copy = [...items];
  copy.sort(compare);
  return copy;
}

function listTestFiles(): string[] {
  const out = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard'],
    {
      encoding: 'utf8',
    },
  );
  return sorted(
    out
      .split('\n')
      .filter(
        (f) => TEST_FILE.test(f) && !f.split('/').includes('node_modules'),
      ),
  );
}

function readTimings(paths: string[]): Map<string, number> {
  const times = new Map<string, number>();
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const data: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const files =
      typeof data === 'object' && data !== null && 'files' in data
        ? data.files
        : null;
    if (typeof files !== 'object' || files === null) continue;
    for (const [file, ms] of Object.entries(files)) {
      if (typeof ms === 'number') {
        times.set(file, Math.max(times.get(file) ?? 0, ms));
      }
    }
  }
  return times;
}

/** LPT: berkas terlama lebih dulu, selalu ke shard yang paling ringan. */
function partition(
  files: string[],
  times: Map<string, number>,
  shards: number,
): string[][] {
  const known = sorted(times.values(), (a, b) => a - b);
  // Berkas baru (belum punya durasi) dianggap sepanjang median.
  const fallback = known.length ? known[Math.floor(known.length / 2)]! : 1000;
  const cost = (f: string) => times.get(f) ?? fallback;
  const order = sorted(
    files,
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
  return bins.map((b) => sorted(b.files));
}

function assertCoversAll(all: string[], parts: string[][]) {
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
function filesInJunit(xml: string): string[] {
  const files = new Set<string>();
  for (const m of xml.matchAll(/<testsuite name="([^"]+)" file="([^"]+)"/g)) {
    if (m[1] === m[2]) files.add(m[2]!);
  }
  return sorted(files);
}

const lines = (f: string) =>
  existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean) : [];

function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      shards: { type: 'string' },
      shard: { type: 'string' },
      out: { type: 'string' },
      timings: { type: 'string', multiple: true, default: [] },
      'changed-from': { type: 'string' },
    },
  });
  const out = values.out!;

  if (positionals[0] === 'plan') {
    const shards = Number(values.shards);
    const shard = Number(values.shard);
    const all = listTestFiles();
    const times = readTimings(values.timings);
    const parts = partition(all, times, shards);
    assertCoversAll(all, parts);
    const mine = parts[shard - 1]!;
    mkdirSync(out, { recursive: true });
    writeFileSync(`${out}/files.txt`, mine.join('\n') + '\n');

    let mode = 'full';
    let forced: string[] = [];
    const base = values['changed-from'];
    if (base) {
      const changed = changedFiles(base);
      const rerun = changed.filter((f) => matches(f, RERUN_ALL));
      if (rerun.length) {
        console.log(
          `Semua tes dijalankan; diff menyentuh: ${rerun.join(', ')}`,
        );
      } else {
        mode = 'selective';
        forced = mine.filter((t) =>
          changed.some((f) => matches(f, FS_INPUTS[t] ?? [])),
        );
        console.log(
          `Seleksi: tes yang dicapai ${changed.length} berkas berubah` +
            (forced.length ? `, ditambah ${forced.join(', ')}` : ''),
        );
      }
    }
    writeFileSync(`${out}/mode`, mode);
    writeFileSync(`${out}/forced.txt`, forced.map((f) => f + '\n').join(''));
    const loads = parts.map(
      (p) => p.reduce((s, f) => s + (times.get(f) ?? 0), 0) / 1000,
    );
    console.log(
      `${all.length} berkas tes, ${times.size} berdurasi; shard ${shard}/${shards} dapat ${mine.length} berkas. Beban per shard (s): ${loads.map((l) => l.toFixed(1)).join(' / ')}`,
    );
    return;
  }

  if (positionals[0] === 'verify') {
    const mine = lines(`${out}/files.txt`);
    const forced = lines(`${out}/forced.txt`);
    const mode = readFileSync(`${out}/mode`, 'utf8');
    const ran = [`${out}/junit.xml`, `${out}/junit-forced.xml`]
      .filter((f) => existsSync(f))
      .flatMap((f) => filesInJunit(readFileSync(f, 'utf8')));
    const unexpected = ran.filter((f) => !mine.includes(f));
    // Run penuh: tepat bagiannya. Seleksi: bagian dari bagiannya, dan tes yang
    // dipaksa (FS_INPUTS) harus ikut.
    const required = mode === 'full' ? mine : forced;
    const notRun = required.filter((f) => !ran.includes(f));
    if (notRun.length || unexpected.length) {
      console.error(`Tidak dijalankan: ${notRun.join(', ') || '-'}`);
      console.error(`Di luar bagian shard: ${unexpected.join(', ') || '-'}`);
      process.exit(1);
    }
    console.log(
      mode === 'full'
        ? `Shard menjalankan tepat ${ran.length} berkas bagiannya.`
        : `Seleksi: shard menjalankan ${new Set(ran).size} dari ${mine.length} berkas bagiannya.`,
    );
    return;
  }

  console.error(
    'Pakai: test-shards.ts plan|verify (lihat komentar di atas berkas).',
  );
  process.exit(2);
}

main();
