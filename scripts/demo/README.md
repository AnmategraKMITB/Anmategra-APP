# Admin console dan demo deployment

Dua deployment dari codebase yang sama:

| Host | `APP_ENV` | Database | Login |
| --- | --- | --- | --- |
| `anmategra.com` | `production` | produksi | SSO ITB/Google |
| `admin.anmategra.com` | `production` | produksi | SSO ITB/Google, role admin |
| `demo.anmategra.com` | `demo` | database demo terpisah | email/password demo |

`admin.anmategra.com` mengarah ke `/admin`. `demo.anmategra.com` hanya boleh berjalan dengan `APP_ENV=demo`; middleware menolak host demo pada build produksi.

## Env penting

```env
APP_ENV=production            # atau demo
NEXT_PUBLIC_APP_ENV=production # harus sama dengan APP_ENV
SUPERADMIN_EMAILS=13523094@mahasiswa.itb.ac.id,anmategra@km.itb.ac.id
ADMIN_HOST=admin.anmategra.com
DEMO_HOST=demo.anmategra.com
```

- `SUPERADMIN_EMAILS` mempromosikan sesi menjadi `admin` setelah login. Role di database tidak perlu diubah.
- `DEMO_PASSWORD_HASH` hanya diperlukan di deployment demo.
- Jangan memakai `DATABASE_URL` atau `NEXTAUTH_SECRET` yang sama antara produksi dan demo.
- Build image demo dengan `--build-arg NEXT_PUBLIC_APP_ENV=demo`; build produksi dengan `production`.
- Set `NEXTAUTH_URL` sesuai host deployment (`https://demo.anmategra.com` atau `https://anmategra.com`).

## Menyiapkan demo

```bash
# 1. Buat hash password (minimal 12 karakter)
npx tsx scripts/demo/hash-password.ts "password-demo-yang-panjang"

# 2. Isi DEMO_PASSWORD_HASH dan APP_ENV=demo di environment demo

# 3. Migrasi dan seed akun demo
npm run db:migrate
APP_ENV=demo npx tsx scripts/demo/seed.ts
```

Seed (`scripts/demo/seed.ts`) idempoten dan mengisi data untuk kelima peran. Semua akun memakai password dari `DEMO_PASSWORD_HASH`; email superadmin tetap mendapat role admin.

| Peran skenario | Email | Data terkait |
| --- | --- | --- |
| Superadmin | `demo.admin@demo.anmategra.local` | role `admin` |
| Mahasiswa | `demo.mahasiswa@demo.anmategra.local` | NIM 13523001; pelamar diterima di Demo Fest 2026; belum melamar oprec terbuka |
| Owner Lembaga | `demo.lembaga@demo.anmategra.local` | lembaga Himpunan Demo (HMD) |
| Admin Lembaga | `demo.admin-lembaga@demo.anmategra.local` | `access_grant` fitur `admin` pada HMD |
| Admin Kegiatan | `demo.admin-kegiatan@demo.anmategra.local` | `access_grant` (`oprec`, `forms`, `organization`) pada Demo Fest 2026 |
| Operator | `demo.operator@demo.anmategra.local` | `admin_permission`: `accounts.read`, `lembaga.read`, `audit.read`, `reports.read`, `reports.write` |
| Anggota | `demo.mhs1` sampai `demo.mhs8@demo.anmategra.local` | panitia, pelamar, anggota HMD |
| Superadmin kedua (email nyata) | `13523094@mahasiswa.itb.ac.id` | mahasiswa NIM 13523094 |
| Superadmin kedua (email nyata) | `anmategra@km.itb.ac.id` | lembaga Anmategra (ANM) |

Data HMD: kepengurusan 2025/2026, Demo Fest 2025 (selesai), Demo Fest 2026 (berjalan, organogram 4 bidang, panitia terisi), Open Recruitment Staf 2026/2027; tiga oprec (selesai dengan hasil dirilis, terbuka dengan pendaftar, draf), tiga laporan berstatus berbeda, dan permintaan asosiasi yang menunggu.

## Mereset data demo

```bash
APP_ENV=demo NEXT_PUBLIC_APP_ENV=demo DATABASE_URL=<database demo> npm run demo:reset
```

Perintah ini mengosongkan semua tabel aplikasi (`anmategra_*`, termasuk `recruitment*`, `access_grant`, `admin_permission`) dengan satu `TRUNCATE ... CASCADE` dalam transaksi, lalu menjalankan seed. Daftar tabel dibaca dari katalog PostgreSQL, jadi tabel baru ikut otomatis. Tabel migrasi Drizzle tidak disentuh. Menjalankannya dua kali menghasilkan kondisi yang sama. Variabel lingkungan harus dikirim dari shell (`tsx` tidak membaca `.env`).

Penjaga lingkungan (`scripts/demo/lib/guard.ts`) menolak berjalan, sebelum koneksi database dibuka, kecuali:

- `APP_ENV=demo` (dan `NEXT_PUBLIC_APP_ENV=demo` bila diisi);
- `DATABASE_URL` terisi dan menunjuk host lokal (`localhost`, `127.0.0.1`, `::1`) atau host/nama database yang memuat kata `demo`.

Untuk hanya menambah data tanpa menghapus: `npm run demo:seed` (idempoten).

## Pengamanan demo

- Pasang HTTP Basic Auth, Cloudflare Access, atau IP allowlist di reverse proxy untuk `demo.anmategra.com`.
- Jangan pernah mengarahkan `demo.anmategra.com` ke database produksi.
- Demo ditandai `users.is_demo`; login kredensial hanya menerima akun demo.
- Akun demo memakai domain `@demo.anmategra.local`, bukan email nyata.
- `hidden_at` menyembunyikan akun dari pencarian mahasiswa/landing; admin tetap melihatnya.
- Rate limit login demo: 8 percobaan per email per 10 menit (per proses).

## Backoffice produksi

- `/admin/akun`: membuat akun mahasiswa/lembaga, menandai demo, menyembunyikan akun.
- `/admin/akses`: memberi/mencabut akses admin lembaga atau periode.
- `/admin/audit`: jejak tindakan admin.
- Hanya `users.role = admin` atau email di `SUPERADMIN_EMAILS` yang bisa membuka `/admin`.
- Akun nyata yang dibuat lebih awal memakai email yang sama dan login lewat SSO; verifikasi/invite tetap diperlukan sebelum memberi akses.
