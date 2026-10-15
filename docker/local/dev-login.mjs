// Membuat cookie sesi NextAuth untuk user yang sudah ada di database lokal,
// supaya bisa masuk tanpa login Google/Microsoft. Hanya untuk pengembangan lokal:
// cookie ditandatangani dengan NEXTAUTH_SECRET lokal, jadi tidak berlaku di production.
//
// Jalankan di dalam container app:
//   docker compose -f compose.local.yml exec app node docker/local/dev-login.mjs lembaga
//   docker compose -f compose.local.yml exec app node docker/local/dev-login.mjs mahasiswa
//   docker compose -f compose.local.yml exec app node docker/local/dev-login.mjs lembaga <email>
// Lalu tempel baris yang dicetak ke console browser (F12 → Console) di halaman app.
import { encode } from 'next-auth/jwt';
import postgres from 'postgres';

const [role = 'lembaga', email] = process.argv.slice(2);
if (!['admin', 'lembaga', 'mahasiswa'].includes(role)) {
  throw new Error('role: admin | lembaga | mahasiswa');
}
if (process.env.NODE_ENV === 'production') {
  throw new Error('Tidak boleh dijalankan di production.');
}

const sql = postgres(process.env.DATABASE_URL);
const [u] = email
  ? await sql`select u.id, u.name, u.email, u.image, u.role, l.id as lembaga_id
      from anmategra_user u left join anmategra_lembaga l on l.user_id = u.id
      where u.email = ${email} limit 1`
  : await sql`select u.id, u.name, u.email, u.image, u.role, l.id as lembaga_id
      from anmategra_user u left join anmategra_lembaga l on l.user_id = u.id
      where u.role = ${role} ${role === 'lembaga' ? sql`and l.id is not null` : sql``}
      order by u.email limit 1`;
await sql.end();
if (!u) {
  throw new Error(
    `User ${email ?? `dengan role ${role}`} tidak ditemukan.` +
      (role === 'admin'
        ? " Dump tidak berisi admin; ubah dulu role satu user: update anmategra_user set role='admin' where email='...'"
        : ''),
  );
}

// Isi token mengikuti callback `jwt` di src/server/auth.ts.
const token = await encode({
  secret: process.env.NEXTAUTH_SECRET,
  maxAge: 30 * 24 * 60 * 60,
  token: {
    name: u.name,
    email: u.email,
    sub: u.id,
    id: u.id,
    role: u.role,
    lembagaId: u.lembaga_id ?? undefined,
    picture: u.image ?? '/images/placeholder/profile-pic.png',
  },
});
console.error(`Masuk sebagai ${u.email} (${u.role}). Tempel baris berikut ke console browser:`);
console.log(
  `document.cookie = "next-auth.session-token=${token}; path=/; max-age=2592000"; location.href = "/";`,
);
