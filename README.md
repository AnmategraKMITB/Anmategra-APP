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

# Anmategra App

Build With [T3 Stack](https://create.t3.gg/)

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
```
psql -U postgres
CREATE DATABASE anmategra;
\q

npm run db:push
```

Perintah db lain yang tersedia:
- `npm run db:generate` — generate migration dari schema (drizzle-kit generate)
- `npm run db:migrate` — jalanin migration (drizzle-kit migrate)
- `npm run db:studio` — buka Drizzle Studio buat liat data
- `npm run db:seed` — generate csv + seed database (dev only)
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

## TRPC Panel

- [Anmategra Panel](http://localhost:3000/api/panel)

