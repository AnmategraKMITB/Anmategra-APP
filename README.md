# Anmategra App

Build With [T3 Stack](https://create.t3.gg/)

## Tentang Anmategra

Anmategra platform manajemen data kemahasiswaan/lembaga di ITB. Fungsi utama:

- **Lembaga & Keanggotaan** — data lembaga, anggota, posisi/divisi, request asosiasi anggota ke lembaga
- **Kegiatan/Event** — pengelolaan event, panitia, pendaftaran
- **Profil** — profil mahasiswa & lembaga, pemetaan profil ke kegiatan/lembaga
- **Rapor & Best Staff** — penilaian lembaga, riwayat best staff per periode
- **Role-based access** — 3 peran: `admin`, `lembaga`, `mahasiswa`

Tech stack: [T3 Stack](https://create.t3.gg/) (Next.js, tRPC, Drizzle ORM, NextAuth, Tailwind), PostgreSQL.

## Setup untuk Developer Baru

### Prasyarat

1. Node.js v20+
2. Bun canary yang dipatok repo: `sh scripts/install-bun.sh` (memasang ke `~/.bun/bin`; tambahkan ke `PATH`)
3. PostgreSQL aktif di lokal

### Instalasi

```
git clone <repo-url>
cd anmategra-app
cp .env.example .env
bun install
```

Isi `.env`, minimal `DATABASE_URL` bener, contoh:

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/anmategra"
```

`husky` prepare hook otomatis jalan pas `bun install` (setup lint-staged pre-commit).

### Setup Database

Opsi A — manual:

```
psql -U postgres
CREATE DATABASE anmategra;
\q

bun run db:push
```

Opsi B — pakai Docker (lihat `scripts/start-database.sh`):

```
./scripts/start-database.sh
bun run db:push
```

Opsi C — app + database sekaligus di Docker (`compose.local.yml`):

```
docker compose -f compose.local.yml up --build
```

- Postgres 15 jalan di port host `5433`, app (`next dev`, hot reload) di `3000`. Ubah lewat `APP_PORT` / `DB_PORT`.
- Kalau ada `anmategra.dump` di folder induk repo, dump itu dipulihkan saat pertama kali jalan, lalu `db:migrate` menyusulkan migrasi yang belum ada. Lokasi lain: set `DB_DUMP_DIR` / `DB_DUMP_FILE`.
- Kredensial OAuth boleh dibiarkan kosong (diisi placeholder), tetapi login baru berfungsi dengan kredensial sungguhan di `.env`.
- Masuk tanpa OAuth: `docker compose -f compose.local.yml exec app node docker/local/dev-login.mjs <admin|lembaga|mahasiswa> [email]`, lalu tempel baris yang dicetak ke console browser. Dump tidak berisi admin, jadi ubah dulu role satu user di database lokal.
- Ulang dari dump: `docker compose -f compose.local.yml down -v`.

Perintah db lain yang tersedia:

- `bun run db:generate` — generate migration dari schema (drizzle-kit generate)
- `bun run db:migrate` — jalanin migration (drizzle-kit migrate)
- `bun run db:studio` — buka Drizzle Studio buat liat data
- `bun run db:seed` — generate csv + seed database (dev only)
- `bun run db:seed-lembaga` — seed akun lembaga resmi dari `src/server/db/seeding/data/lembaga-official.csv` (idempotent)
- `bun run db:seed-mahasiswa --file <csv>` — impor mahasiswa (misalnya satu angkatan baru); hanya menambah, format di `src/server/db/seeding/data/README.md`
- `bun run db:backfill-lembaga-descriptions` — lengkapi deskripsi lembaga yang kosong
- `bun run db:refresh-lembaga` — jalanin `scripts/refresh-lembaga.sh` (refresh data lembaga dari sumber resmi)
- `bun run db:summarize-lembaga` — jalanin `scripts/km-summarize.ts` (ringkas profil lembaga)
- `bun run db:clear` — kosongin database

### Menjalankan Project

```
bun run dev
```

Buka [http://localhost:3000](http://localhost:3000).

Script lain:

- `bun run build` — build production
- `bun run start` — jalanin hasil build
- `bun lint` — lint dengan `bun lint` (`.oxlintrc.json`: semua kategori aturan menyala, plus aturan bertipe). Pelanggaran lama dicatat di `oxlint-suppressions.json`; pelanggaran baru membuat CI gagal. Setelah memperbaiki pelanggaran lama, jalankan `bun run lint:prune` dan commit perubahan file itu.
- `bun fmt` — format semua berkas (`.prettierrc.json`, termasuk urutan import dan urutan class Tailwind). CI menjalankan `bun fmt --check`.
- `bun run check` — cek tipe dengan TypeScript 7 (`bun check`), setelah `next typegen` membuat tipe rute di `.next/types`. Paket `typescript` di `package.json` tetap versi 6 karena Next 15 dan `lifecycle-writes.test.ts` butuh API JavaScript-nya, yang tidak ada di TypeScript 7.
- `bun run test` — jalankan tes otomatis (`bun test`, paralel per core); lihat [Menjalankan Tes](#menjalankan-tes). `bun run test:watch` mengulang tes setiap berkas berubah.
- `bun run docs` — regenerate dokumentasi API & database di `docs/api/`

### Menjalankan Tes

Tes memakai `bun test` (berkas tes tetap mengimpor dari `vitest`; Bun memetakannya ke `bun:test`) dan **PostgreSQL asli**, bukan mock, supaya aturan akses diuji terhadap skema yang sama dengan produksi.

```
bun run test
```

- Database uji terpisah dari database pengembangan. Alamatnya dari `TEST_DATABASE_URL`; bawaannya `postgresql://postgres:password@localhost:5432/anmategra_test`. Nama database **wajib memuat kata `test`**; kalau tidak, tes menolak jalan karena tiap kasus mengosongkan tabel.
- Tiap worker memakai database sendiri: nama dari `TEST_DATABASE_URL` ditambah `_w<nomor worker>` (mis. `anmategra_test_w1`). `src/test/preload.ts` (lewat `bunfig.toml`) membuatnya bila belum ada (dari `template0`) dan menerapkan semua migrasi di `drizzle/` sebelum tiap berkas; migrasi yang sudah diterapkan dilewati.
- Tiap berkas dimuat dengan modul baru (`--isolate=modules`) dan sesudahnya database, timer, mock, dan env dikembalikan. Urutan tes diacak; seed dicetak di akhir run, ulangi dengan `bun run test --seed=<seed>`. `bun test` tanpa `--isolate` sengaja gagal.
- Untuk Postgres lokal khusus tes, matikan durabilitas supaya TRUNCATE tidak menunggu disk (10x lebih cepat): `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password --tmpfs /var/lib/postgresql/data postgres:15-alpine -c fsync=off -c synchronous_commit=off -c full_page_writes=off`.
- Berkas tes diberi akhiran `.test.ts` dan diletakkan di samping kodenya. Helper database dan pabrik data ada di `src/test/test-db.ts`.
- Tes tidak butuh `.env` lengkap: kode yang diuji tidak boleh memuat `~/env`. Prosedur yang butuh sesi atau NextAuth sebaiknya diuji lewat logika yang dipisah, seperti `src/server/api/access.ts`.
- CI menjalankan `bun run test` pada job `Test` dengan PostgreSQL 15 sekali pakai (tmpfs, tanpa fsync).

### Login Microsoft (SSO ITB)

Mahasiswa login dengan akun `@mahasiswa.itb.ac.id` lewat Microsoft Entra ID milik ITB. Anmategra
punya app registration sendiri di directory ITB:

- **Supported account types:** _Accounts in any organizational directory_ (multitenant).
- **Redirect URI** (platform **Web**): `https://anmategra.com/api/auth/callback/azure-ad`, ditambah
  `http://localhost:<APP_PORT>/api/auth/callback/azure-ad` untuk lokal.
- **Client secret** dibuat di _Certificates & secrets_ lalu diisi ke `AZURE_AD_CLIENT_SECRET`.
  Secret punya tanggal kedaluwarsa: catat tanggalnya dan perbarui sebelum lewat. Secret yang
  kedaluwarsa membuat login Microsoft gagal dengan `?error=OAuthCallback`.
- `AZURE_AD_TENANT_ID` = `db6e1183-4c65-405c-82ce-7cd53fa6e9dc` (directory ITB). Token dari tenant
  lain ditolak, walaupun email-nya berakhiran `@mahasiswa.itb.ac.id`.
- Pastikan app registration punya minimal 2 owner supaya aksesnya tidak hilang saat pengurus
  berganti.

Kalau login gagal, log server mencetak `[next-auth][error][OAUTH_CALLBACK_ERROR]` beserta kode
`AADSTS…` dari Microsoft. Kode itu yang menjelaskan penyebabnya, misalnya `AADSTS7000222` (secret
kedaluwarsa), `AADSTS7000215` (secret salah), atau `AADSTS50011` (redirect URI belum didaftarkan).

## Struktur Project

```
.
├── src/
│   ├── app/            # Next.js App Router — halaman & API routes
│   ├── components/      # Komponen UI reusable (di luar shadcn/ui)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility umum (SEO helper, dll)
│   ├── server/
│   │   ├── api/routers/  # tRPC routers (business logic per domain)
│   │   ├── auth.ts       # Konfigurasi NextAuth
│   │   └── db/
│   │       ├── schema.ts    # Skema Drizzle ORM (source of truth tabel)
│   │       └── seeding/     # Script & data CSV buat seed database
│   ├── trpc/            # Setup client/server tRPC
│   ├── types/            # Shared TypeScript types
│   └── utils/            # Fungsi utility lain
├── drizzle/              # Migration SQL & snapshot (hasil drizzle-kit generate)
├── scripts/              # Script dev/data: start-database.sh, refresh-lembaga.sh, dll
├── docs/api/             # Dokumentasi API & DB hasil generate (OpenAPI + DBML)
├── public/                # Static assets
├── Dockerfile              # Build image production
├── docker-entrypoint.sh    # Entry container: jalanin db:migrate lalu bun run start
└── drizzle.config.ts       # Config drizzle-kit
```

Config tool lain (`next.config.js`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.cjs`, `.oxlintrc.json` (`bun lint`), `.prettierrc.json` (`bun fmt`), `bunfig.toml`, `components.json`) sengaja ditaruh di root karena masing-masing tool nyari file itu di situ secara default.

## Lisensi

Kode sumber Anmategra dilisensikan di bawah **GNU Affero General Public License v3.0 atau
yang lebih baru** (AGPL-3.0-or-later). Teks lengkapnya ada di [`LICENSE`](LICENSE).

Intinya: siapa pun boleh memakai, mempelajari, mengubah, dan membagikan kode ini. Kalau kamu
menjalankan versi yang sudah diubah sebagai layanan web (misalnya fork untuk kampus lain),
kamu **wajib menyediakan kode sumber versi ubahanmu** kepada penggunanya dengan lisensi yang
sama.

Lisensi ini hanya berlaku untuk **kode**. Logo dan nama KM ITB, Kabinet, Kemenkoan PSDM, dan
Anmategra (di `public/images/logo/`) milik masing-masing pemiliknya dan tidak ikut dilisensikan
di bawah AGPL.

## Branch Name Convention

```
<tipe>/<BE/FE> /<deskripsi>
```

Contoh : `feat/BE/LandingPage`

## Aturan Semantic Commit

1. Format Umum :

```
<tipe>(<scope>): <deskripsi>
```

2. Tipe Commit :

- `feat`: Menambahkan fitur baru.
- `fix`: Memperbaiki bug.
- `docs`: Mengubah dokumentasi.
- `style`: Perubahan yang tidak mempengaruhi logika (formatting, spasi, dll).
- `refactor`: Perubahan kode yang tidak menambah fitur atau memperbaiki bug.
- `test`: Menambahkan atau memperbaiki pengujian.
- `chore`: Tugas rutin yang tidak termasuk dalam kategori di atas (pengaturan build, perubahan dependensi, dll).

Contoh : `fix(api): resolve CORS issue`

## Penamaan Component atau Actions

1. Komponen (Components) :

- Format : `PascalCase`
- Contoh : `UserProfile`, `NavBar`, `Button`

2. Actions :

- Format : `camelCase`
- Contoh : `fetchUserData`, `updateProfile`, `handleSubmit`

3. Folder dan File :

- Format : `kebab-case`
- Contoh : `user-profile.tsx`, `nav-bar.tsx`, `api-enpoint.ts`

## Dokumentasi API & Database

Dokumentasinya di-generate dari kode, jadi tidak bisa basi selama di-regenerate.

```bash
bun run dev
# buka http://localhost:3000/api/docs
```

- **API** — Scalar di [`/api/docs`](http://localhost:3000/api/docs): seluruh procedure tRPC
  dan endpoint REST, lengkap dengan level akses, bentuk input/output, dan daftar error.
- **Database** — `docs/api/schema.dbml`, bisa di-publish ke dbdocs.io lewat
  `bun run docs:db:publish` atau di-paste ke [dbdiagram.io](https://dbdiagram.io).

Setelah mengubah router tRPC atau `src/server/db/schema.ts`, jalankan `bun run docs` dan
commit hasilnya — CI menolak PR yang dokumentasinya sudah tidak sinkron.

Panduan lengkap (cara menulis penjelasan, aturan `.meta({ access })`, cara memanggil
endpoint dari luar): **[`docs/api/README.md`](docs/api/README.md)**.

## Mencoba Endpoint

tRPC Panel (`/api/panel`) sudah dihapus: paketnya tidak dirawat lagi dan mengunci Zod 3.
Kontrak API dibaca di `/api/docs`, dan cara memanggil endpoint (termasuk dengan sesi login)
ada di [`docs/api/README.md`](docs/api/README.md) bagian 2.
