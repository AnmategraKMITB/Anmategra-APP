/**
 * Import mahasiswa (misalnya satu angkatan baru) dari CSV ke users + mahasiswa.
 *
 * Per baris CSV:
 *   1. users     <- role='mahasiswa', email `<nim>@mahasiswa.itb.ac.id`
 *                   (email yang sama dengan akun Microsoft ITB-nya, jadi login pertama
 *                   langsung tersambung ke baris ini, bukan membuat akun baru)
 *   2. mahasiswa <- nim, nama, jurusan, angkatan
 *
 * Jurusan diturunkan dari 3 digit awal NIM lewat kode-program-studi.json, tabel yang
 * sama dengan yang dipakai auth.ts saat login, supaya penamaannya konsisten dengan
 * data yang sudah ada. Kolom `prodi` di CSV hanya dipakai kalau kodenya belum dikenal,
 * dan perbedaan nama antara CSV dan tabel dilaporkan. Angkatan = digit ke-4 dan ke-5
 * NIM + 2000. NIM TPB maupun NIM jurusan (program yang langsung berjurusan, misalnya
 * IUP) sama-sama disimpan di kolom `nim`: itu NIM yang dipakai untuk login saat ini.
 *
 * Hanya menambah: email atau NIM yang sudah ada dilewati dan tidak pernah diubah.
 * Semua insert jalan dalam satu transaksi.
 *
 * CSV berisi data pribadi: simpan di luar repo. Skrip ini tidak mencetak nama, email,
 * atau NIM; peringatan hanya menyebut nomor baris.
 *
 * Pemakaian:
 *   npm run db:seed-mahasiswa -- --file /path/ke/maba.csv --dry-run   # rencana saja
 *   npm run db:seed-mahasiswa -- --file /path/ke/maba.csv
 *
 * Format CSV: lihat data/README.md.
 */
import { parse } from 'csv-parse/sync';
import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import fs from 'fs';

import { db } from '../index.js';
import daftarProdi from '../kode-program-studi.json';
import { mahasiswa, users } from '../schema.js';

const DRY_RUN = process.argv.includes('--dry-run');
const fileArg = process.argv.indexOf('--file');
const CSV_PATH =
  fileArg !== -1 ? process.argv[fileArg + 1] : process.env.MAHASISWA_CSV;

const EMAIL_DOMAIN = 'mahasiswa.itb.ac.id';
const BATCH = 1000;

const jurusanByKode = new Map(
  (daftarProdi as { kode: number; jurusan: string }[]).map((p) => [
    p.kode,
    p.jurusan,
  ]),
);

interface Row {
  line: number;
  nim: number;
  email: string;
  name: string;
  jurusan: string;
  angkatan: number;
}

function readCsv(): Row[] {
  if (!CSV_PATH) {
    console.error(
      'Berikan file lewat --file /path/ke/file.csv (atau env MAHASISWA_CSV).',
    );
    process.exit(1);
  }
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV tidak ditemukan: ${CSV_PATH}`);
    process.exit(1);
  }
  const records = parse(fs.readFileSync(CSV_PATH, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as unknown as Record<string, string | undefined>[];

  const rows: Row[] = [];
  const seenNim = new Set<number>();
  const emailMismatch: number[] = [];
  const unknownCode = new Map<number, { prodi: string; count: number }>();
  const nameDiffs = new Map<string, number>();

  records.forEach((rec, i) => {
    const line = i + 2; // header + 1-indexed
    const nimText = rec.nim ?? '';
    const name = rec.name ?? rec.nama ?? '';

    if (!/^\d{8}$/.test(nimText) || !name) {
      console.warn(`baris ${line}: dilewati — butuh nim 8 digit dan name`);
      return;
    }
    const nim = Number(nimText);
    if (seenNim.has(nim)) {
      console.warn(`baris ${line}: dilewati — NIM sudah muncul di baris lain`);
      return;
    }
    seenNim.add(nim);

    const email = `${nimText}@${EMAIL_DOMAIN}`;
    if (rec.email && rec.email.toLowerCase() !== email)
      emailMismatch.push(line);

    const kode = Number(nimText.slice(0, 3));
    const prodi = rec.prodi ?? '';
    let jurusan = jurusanByKode.get(kode);
    if (!jurusan) {
      if (!prodi) {
        console.warn(
          `baris ${line}: dilewati — kode ${kode} tidak dikenal dan kolom prodi kosong`,
        );
        return;
      }
      jurusan = prodi;
      const u = unknownCode.get(kode) ?? { prodi, count: 0 };
      u.count += 1;
      unknownCode.set(kode, u);
    } else if (prodi && prodi !== jurusan) {
      const key = `${kode}: "${prodi}" (CSV) vs "${jurusan}" (dipakai)`;
      nameDiffs.set(key, (nameDiffs.get(key) ?? 0) + 1);
    }

    rows.push({
      line,
      nim,
      email,
      name,
      jurusan,
      angkatan: Number(nimText.slice(3, 5)) + 2000,
    });
  });

  if (emailMismatch.length > 0) {
    console.warn(
      `${emailMismatch.length} baris punya email selain <nim>@${EMAIL_DOMAIN}; dipakai email dari NIM (baris ${emailMismatch.join(', ')})`,
    );
  }
  for (const [kode, u] of unknownCode) {
    console.warn(
      `kode ${kode} belum ada di kode-program-studi.json: ${u.count} baris memakai prodi dari CSV ("${u.prodi}")`,
    );
  }
  if (nameDiffs.size > 0) {
    console.log('beda nama prodi (dipakai nama dari kode-program-studi.json):');
    for (const [k, n] of nameDiffs) console.log(`   ${k} — ${n} baris`);
  }
  return rows;
}

async function inChunks<T, R>(
  items: T[],
  fn: (chunk: T[]) => Promise<R[]>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += BATCH) {
    out.push(...(await fn(items.slice(i, i + BATCH))));
  }
  return out;
}

async function main() {
  const rows = readCsv();
  console.log(
    `\n${DRY_RUN ? '[DRY RUN] ' : ''}${rows.length} baris valid dari CSV`,
  );

  const existingUsers = await inChunks(rows, (chunk) =>
    db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(
        inArray(
          users.email,
          chunk.map((r) => r.email),
        ),
      ),
  );
  const userByEmail = new Map(existingUsers.map((u) => [u.email, u]));

  const existingByNim = await inChunks(rows, (chunk) =>
    db
      .select({
        nim: mahasiswa.nim,
        userId: mahasiswa.userId,
        jurusan: mahasiswa.jurusan,
      })
      .from(mahasiswa)
      .where(
        inArray(
          mahasiswa.nim,
          chunk.map((r) => r.nim),
        ),
      ),
  );
  const nimTaken = new Set(existingByNim.map((m) => m.nim));
  const userHasMahasiswa = new Set(existingByNim.map((m) => m.userId));
  const storedJurusan = new Map(existingByNim.map((m) => [m.nim, m.jurusan]));

  const newUsers: Row[] = [];
  const mahasiswaForExistingUser: { row: Row; userId: string }[] = [];
  let alreadyComplete = 0;
  // Mahasiswa yang sudah ada dengan jurusan berbeda, misalnya login sebelum diimpor
  // dengan kode prodi yang saat itu belum dikenal (auth.ts mengisinya "TPB").
  const jurusanDiffs = new Map<string, number>();
  const notMahasiswaRole: number[] = [];

  for (const r of rows) {
    const user = userByEmail.get(r.email);
    if (!user) {
      if (nimTaken.has(r.nim)) {
        // NIM sudah dipakai mahasiswa dengan email lain: jangan buat duplikat.
        console.warn(
          `baris ${r.line}: dilewati — NIM sudah terdaftar di akun lain`,
        );
        continue;
      }
      newUsers.push(r);
    } else if (user.role !== 'mahasiswa') {
      notMahasiswaRole.push(r.line);
    } else if (userHasMahasiswa.has(user.id) || nimTaken.has(r.nim)) {
      alreadyComplete += 1;
      const stored = storedJurusan.get(r.nim);
      if (stored !== undefined && stored !== r.jurusan) {
        const key = `"${stored}" -> "${r.jurusan}"`;
        jurusanDiffs.set(key, (jurusanDiffs.get(key) ?? 0) + 1);
      }
    } else {
      // Sudah pernah login (akun dibuat) tapi baris mahasiswa belum ada.
      mahasiswaForExistingUser.push({ row: r, userId: user.id });
    }
  }

  if (jurusanDiffs.size > 0) {
    console.warn(
      'mahasiswa yang sudah ada dengan jurusan berbeda dari CSV (tidak diubah):',
    );
    for (const [k, n] of jurusanDiffs) console.warn(`   ${k} — ${n} orang`);
  }
  if (notMahasiswaRole.length > 0) {
    console.warn(
      `${notMahasiswaRole.length} email sudah dipakai akun non-mahasiswa, dilewati (baris ${notMahasiswaRole.join(', ')})`,
    );
  }

  const byAngkatan = new Map<number, number>();
  for (const r of newUsers) {
    byAngkatan.set(r.angkatan, (byAngkatan.get(r.angkatan) ?? 0) + 1);
  }
  console.log(`   user + mahasiswa baru:          ${newUsers.length}`);
  console.log(
    `   mahasiswa untuk akun yang ada:  ${mahasiswaForExistingUser.length}`,
  );
  console.log(`   sudah ada (dilewati):           ${alreadyComplete}`);
  if (byAngkatan.size > 0) {
    console.log(
      `   angkatan baru: ${[...byAngkatan]
        .map(([a, n]) => `${a} (${n})`)
        .join(', ')}`,
    );
  }

  if (DRY_RUN) {
    console.log('\nDry run: tidak ada yang ditulis.');
    return;
  }
  if (newUsers.length === 0 && mahasiswaForExistingUser.length === 0) {
    console.log('\nTidak ada yang perlu ditambahkan.');
    return;
  }

  await db.transaction(async (tx) => {
    const withIds = newUsers.map((r) => ({ row: r, id: crypto.randomUUID() }));
    for (let i = 0; i < withIds.length; i += BATCH) {
      const chunk = withIds.slice(i, i + BATCH);
      await tx.insert(users).values(
        chunk.map(({ row, id }) => ({
          id,
          name: row.name,
          email: row.email,
          emailVerified: new Date(),
          role: 'mahasiswa' as const,
        })),
      );
    }

    const mahasiswaRows = [
      ...withIds.map(({ row, id }) => ({ row, userId: id })),
      ...mahasiswaForExistingUser,
    ];
    for (let i = 0; i < mahasiswaRows.length; i += BATCH) {
      const chunk = mahasiswaRows.slice(i, i + BATCH);
      await tx.insert(mahasiswa).values(
        chunk.map(({ row, userId }) => ({
          userId,
          nim: row.nim,
          nama: row.name,
          jurusan: row.jurusan,
          angkatan: row.angkatan,
        })),
      );
    }
  });

  console.log(
    `\nusers: +${newUsers.length}, mahasiswa: +${newUsers.length + mahasiswaForExistingUser.length}`,
  );
  console.log('Selesai.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Import gagal:', err);
    process.exit(1);
  });
