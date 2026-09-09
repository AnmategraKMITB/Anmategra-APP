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
2. npm 10+ (`packageManager` di `package.json` pin ke `npm@10.9.0`)
3. PostgreSQL aktif di lokal

### Instalasi
```
git clone <repo-url>
cd anmategra-app
cp .env.example .env
npm install
```

Isi `.env`, minimal `DATABASE_URL` bener, contoh:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/anmategra"
```

`husky` prepare hook otomatis jalan pas `npm install` (setup lint-staged pre-commit).

### Setup Database

Opsi A — manual:
```
psql -U postgres
CREATE DATABASE anmategra;
\q

npm run db:push
```

Opsi B — pakai Docker (lihat `scripts/start-database.sh`):
```
./scripts/start-database.sh
npm run db:push
```

Perintah db lain yang tersedia:
- `npm run db:generate` — generate migration dari schema (drizzle-kit generate)
- `npm run db:migrate` — jalanin migration (drizzle-kit migrate)
- `npm run db:studio` — buka Drizzle Studio buat liat data
- `npm run db:seed` — generate csv + seed database (dev only)
- `npm run db:seed-lembaga` — seed akun lembaga resmi dari `src/server/db/seeding/data/lembaga-official.csv` (idempotent)
- `npm run db:backfill-lembaga-descriptions` — lengkapi deskripsi lembaga yang kosong
- `npm run db:refresh-lembaga` — jalanin `scripts/refresh-lembaga.sh` (refresh data lembaga dari sumber resmi)
- `npm run db:summarize-lembaga` — jalanin `scripts/km-summarize.ts` (ringkas profil lembaga)
- `npm run db:clear` — kosongin database

### Menjalankan Project
```
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000).

Script lain:
- `npm run build` — build production
- `npm run start` — jalanin hasil build
- `npm run lint` — cek lint (next lint)
- `npm run docs` — regenerate dokumentasi API & database di `docs/api/`

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
├── docker-entrypoint.sh    # Entry container: jalanin db:migrate lalu npm run start
└── drizzle.config.ts       # Config drizzle-kit
```

Config tool lain (`next.config.js`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.cjs`, `.eslintrc.cjs`, `prettier.config.js`, `components.json`) sengaja ditaruh di root karena masing-masing tool nyari file itu di situ secara default.

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
npm run dev
# buka http://localhost:3000/api/docs
```

- **API** — Scalar di [`/api/docs`](http://localhost:3000/api/docs): seluruh procedure tRPC
  dan endpoint REST, lengkap dengan level akses, bentuk input/output, dan daftar error.
- **Database** — `docs/api/schema.dbml`, bisa di-publish ke dbdocs.io lewat
  `npm run docs:db:publish` atau di-paste ke [dbdiagram.io](https://dbdiagram.io).

Setelah mengubah router tRPC atau `src/server/db/schema.ts`, jalankan `npm run docs` dan
commit hasilnya — CI menolak PR yang dokumentasinya sudah tidak sinkron.

Panduan lengkap (cara menulis penjelasan, aturan `.meta({ access })`, cara memanggil
endpoint dari luar): **[`docs/api/README.md`](docs/api/README.md)**.

## TRPC Panel

- [Anmategra Panel](http://localhost:3000/api/panel)

Buat mencoba endpoint dengan sesi login kamu. Untuk membaca kontrak API-nya, pakai
`/api/docs` di atas.

