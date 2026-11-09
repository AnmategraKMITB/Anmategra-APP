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

Akun seed:

- `demo.admin@demo.anmategra.local`
- `demo.mahasiswa@demo.anmategra.local`
- `demo.lembaga@demo.anmategra.local`
- `13523094@mahasiswa.itb.ac.id`
- `anmategra@km.itb.ac.id`

Semua memakai password dari `DEMO_PASSWORD_HASH`. Email superadmin tetap mendapat role admin.

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
