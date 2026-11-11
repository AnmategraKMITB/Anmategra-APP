// Menyiapkan data untuk load test: cookie sesi NextAuth untuk N mahasiswa yang sudah ada di
// database, plus daftar kegiatan yang akan "dilamar". Hasilnya ditulis ke
// loadtest/.data/targets.json (di-gitignore; token di dalamnya terenkripsi, tanpa data pribadi
// dalam bentuk teks biasa).
//
// Jalankan dari root repo, di environment yang sama dengan server yang diuji (butuh
// DATABASE_URL dan NEXTAUTH_SECRET milik environment itu):
//   node loadtest/make-sessions.mjs [jumlah_user=600] [jumlah_kegiatan=5]
//
// JANGAN dijalankan ke database production: load test ini menulis (lalu menghapus) data.
import { encode } from 'next-auth/jwt';
import { mkdirSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';

const users = Number(process.argv[2] ?? 600);
const eventCount = Number(process.argv[3] ?? 5);
if (!process.env.DATABASE_URL || !process.env.NEXTAUTH_SECRET) {
  throw new Error(
    'Butuh DATABASE_URL dan NEXTAUTH_SECRET dari environment yang diuji.',
  );
}
if (process.env.NODE_ENV === 'production' && !process.env.LOADTEST_ALLOW) {
  throw new Error(
    'NODE_ENV=production. Set LOADTEST_ALLOW=1 hanya kalau ini memang staging.',
  );
}

const sql = postgres(process.env.DATABASE_URL);
const students = await sql`
  select u.id, u.name, u.email, u.image
  from anmategra_user u
  join anmategra_mahasiswa m on m.user_id = u.id
  where u.role = 'mahasiswa'
  order by random()
  limit ${users}`;
const events = await sql`
  select id from anmategra_event order by start_date desc nulls last limit ${eventCount}`;
await sql.end();

if (students.length < users)
  console.warn(`Hanya ada ${students.length} mahasiswa.`);
if (events.length === 0) throw new Error('Tidak ada kegiatan di database.');

const sessions = await Promise.all(
  students.map(async (u) => ({
    userId: u.id,
    token: await encode({
      secret: process.env.NEXTAUTH_SECRET,
      maxAge: 24 * 60 * 60,
      token: {
        sub: u.id,
        id: u.id,
        name: u.name,
        email: u.email,
        role: 'mahasiswa',
        picture: u.image ?? '/images/placeholder/profile-pic.png',
      },
    }),
  })),
);

mkdirSync(new URL('.data/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('.data/targets.json', import.meta.url),
  JSON.stringify({ sessions, events: events.map((e) => e.id) }),
);
console.log(
  `${sessions.length} sesi dan ${events.length} kegiatan → loadtest/.data/targets.json`,
);
