# Dokumentasi API & Database

Dokumentasi di folder ini **di-generate dari kode**, bukan ditulis ulang manual. Selama
kamu menjalankan `npm run docs` setelah mengubah router atau schema, dokumentasinya tidak
bisa basi — dan CI akan menolak PR yang lupa melakukannya.

Ada dua artefak:

| Artefak | Isi | Dilihat lewat |
|---|---|---|
| `openapi.json` | Procedure tRPC + Endpoint REST | Scalar di `http://localhost:3000/api/docs` |
| `schema.dbml` | Tabel Drizzle beserta relasinya | dbdocs.io (`npm run docs:db:publish`) |

---

## 1. Cara mengakses dokumentasi

### API (Scalar)

```bash
npm run dev
# buka http://localhost:3000/api/docs
```

Halaman itu Scalar yang membaca `/api/docs/openapi.json`. Di sana kamu bisa:

- **Telusuri per router** — sidebar dikelompokkan per tag (`lembaga`, `event`, `rapor`, dst).
- **Lihat level akses tiap endpoint** — setiap procedure punya baris `**Akses:**` yang
  menyebut siapa yang boleh memanggil (Public, Admin, Owner Lembaga, dan seterusnya).
- **Lihat bentuk input dan output** — schema-nya diturunkan langsung dari Zod, jadi persis
  sama dengan yang divalidasi server.
- **Baca daftar error** — 400/401/403/404 per endpoint, lengkap dengan kode tRPC-nya.

> `/api/docs` dan `/api/docs/openapi.json` sengaja **balas 404 di production**, sama seperti
> `/api/panel`, karena spec-nya memuat seluruh permukaan endpoint internal.

Kalau tim butuh URL yang bisa dibagikan tanpa menjalankan dev server, `openapi.json` bisa
diunggah apa adanya ke Scalar Registry, Bump.sh, atau Redocly.

### Database (dbdocs)

```bash
npx dbdocs login          # sekali per mesin
npm run docs:db:publish   # push schema.dbml ke dbdocs.io
```

Di CI, `dbdocs` memakai env `DBDOCS_TOKEN` sebagai ganti `login`.

Belum mau publish? `schema.dbml` bisa langsung di-paste ke [dbdiagram.io](https://dbdiagram.io)
untuk melihat ERD-nya tanpa akun.

### Scalar vs `/api/panel`

Keduanya berguna, untuk hal berbeda:

| | `/api/docs` (Scalar) | `/api/panel` (tRPC Panel) |
|---|---|---|
| Untuk | membaca kontrak: schema, akses, error | mencoba endpoint dengan sesi login kamu |
| Tipe data | JSON Schema (bahasa-agnostik) | tipe TypeScript |
| Bisa dibagikan ke luar | ya, `openapi.json` berdiri sendiri | tidak |

Rule of thumb: **paham dulu di Scalar, coba di panel.**

---

## 2. Cara memanggil endpoint

tRPC bukan REST, tapi wire format-nya tetap deterministik:

- **Query** → `GET /api/trpc/<router>.<procedure>?input=<json>`
- **Mutation** → `POST /api/trpc/<router>.<procedure>` dengan JSON body

Transformer-nya superjson, jadi input dan output selalu dibungkus `{ "json": ... }`:

```bash
# Query
curl 'http://localhost:3000/api/trpc/lembaga.getInfo?input=%7B%22json%22%3A%7B%22lembagaId%22%3A%22abc%22%7D%7D'

# Mutation
curl -X POST http://localhost:3000/api/trpc/event.toggleHighlight \
  -H 'Content-Type: application/json' \
  -d '{"json":{"id":"abc"}}'
```

Autentikasinya session cookie NextAuth (`next-auth.session-token`, di HTTPS jadi
`__Secure-next-auth.session-token`). Login dulu lewat aplikasi, lalu panggilan dari browser
yang sama otomatis membawa cookie-nya.

Endpoint di tag `excel` adalah route REST biasa (`src/app/api/**`) dan **tidak** memakai
envelope superjson.

---

## 3. Cara memakai dokumentasi ini untuk development

### Mau menambah endpoint baru

1. Tulis procedure seperti biasa di `src/server/api/routers/`.
2. **Pakai `.output()`.** Ini bukan sekadar demi dokumentasi — output tanpa schema tampil
   kosong di Scalar, dan responsnya tidak tervalidasi saat runtime. Taruh schema-nya di
   `src/server/api/types/<router>.type.ts` mengikuti pola yang sudah ada.
3. Pakai `z.object({ ... })`, bukan `z.custom<T>()`. `z.custom` tidak punya padanan JSON
   Schema, jadi hasilnya schema kosong di dokumentasi.
4. `npm run docs`, lalu commit `docs/api/` bersama perubahan kodenya.

### Mau menambah procedure builder baru (level akses baru)

Setiap builder di `src/server/api/trpc.ts` **wajib** memanggil `.meta({ access: ... })`,
dan `access`-nya harus terdaftar di tipe `ApiMeta`:

```ts
export const contohProcedure = protectedProcedure
  .meta({ access: 'authenticated' })
  .use(({ ctx, next }) => { /* ... */ });
```

Kalau lupa, `npm run docs:api` sengaja gagal dan menyebut procedure mana saja yang bolong.
Ini disengaja: salah label akses lebih berbahaya daripada dokumentasi yang gagal
di-generate — endpoint privat bisa terdokumentasi sebagai publik.

### Mau mengubah tabel database

1. Ubah `src/server/db/schema.ts`, jalankan `npm run db:generate` seperti biasa.
2. `npm run docs:db` supaya `schema.dbml` ikut terbarui.
3. Tabel baru? Tambahkan penjelasannya di `schema-notes.json` (lihat bagian berikutnya).

### Mau memahami domain yang belum kamu sentuh

Urutan yang paling cepat:

1. Buka **dbdocs / `schema.dbml`** dulu untuk melihat tabel dan relasinya.
2. Lalu **Scalar**, filter ke tag yang relevan, baca level akses dan bentuk datanya.
3. Baru masuk ke `src/server/api/routers/<domain>.ts`.

### Mau meng-generate API client

`openapi.json` adalah OpenAPI 3.0.3 yang valid (dicek Redocly di CI), jadi bisa langsung
dipakai `openapi-typescript`, `orval`, atau generator lain — berguna kalau nanti ada
konsumen di luar aplikasi Next.js ini (mobile app, service lain, skrip internal).

---

## 4. Menambahkan prosa (penjelasan tulisan tangan)

Generator hanya bisa menyimpulkan *bentuk* data, bukan *maksudnya*. Penjelasan manusia
disimpan di file terpisah supaya **tidak pernah tertimpa** saat regenerate:

| Berkas | Sumber | Ditulis oleh |
|---|---|---|
| `openapi.json` | router tRPC + `rest-openapi.json` + `api-notes.json` | generator |
| `schema.dbml` | skema Drizzle + `schema-notes.json` | generator |
| `api-notes.json` | — | manusia |
| `rest-openapi.json` | — | manusia |
| `schema-notes.json` | — | manusia |

- **Procedure tRPC** → `api-notes.json`, key `router.procedure`:
  ```json
  {
    "lembaga.getInfo": {
      "summary": "Detail satu lembaga",
      "description": "Dipakai halaman profil lembaga. Tidak menyertakan daftar anggota.",
      "deprecated": false
    }
  }
  ```
- **Tabel/kolom** → `schema-notes.json`, key nama tabel di DB (dengan prefix `anmategra_`):
  ```json
  {
    "anmategra_lembaga": {
      "note": "Satu baris per lembaga (himpunan, UKM, BSO).",
      "columns": { "type": "Null untuk lembaga lama yang belum dikategorikan." }
    }
  }
  ```
- **Endpoint REST non-tRPC** (`src/app/api/**`) → `rest-openapi.json`, fragmen OpenAPI biasa
  yang di-merge apa adanya ke `paths` dan `components.schemas`.

Setelah mengedit salah satunya, jalankan `npm run docs`.

**Ini bagian yang paling butuh kontribusi tim.** Kalau kamu baru saja mengerjakan satu
domain dan paham seluk-beluknya, tulis satu-dua kalimat di `api-notes.json` /
`schema-notes.json` selagi masih hangat di kepala.

---

## 5. Perintah

```bash
npm run docs        # generate keduanya
npm run docs:api    # hanya openapi.json
npm run docs:db     # hanya schema.dbml
npm run docs:check  # gagal kalau hasil generate beda dari yang di-commit (dipakai CI)
npm run docs:db:publish   # push schema.dbml ke dbdocs.io
```

CI menjalankan `npm run docs:check` sebelum build, jadi PR yang mengubah router atau schema
tanpa regenerate docs akan gagal. Perbaikannya selalu sama: `npm run docs`, lalu commit.

---

## 6. Cara kerjanya (kalau perlu mengutak-atik generator)

- `scripts/gen-openapi.cts` membaca `appRouter._def.procedures` — introspeksi router,
  bukan parsing file. Tidak ada satu pun router yang perlu diubah demi dokumentasi.
  Ekstensinya `.cts` (bukan `.ts`) karena `package.json` memakai `"type": "module"`,
  sementara provider NextAuth butuh interop CJS.
- Zod → JSON Schema lewat `zod-to-json-schema` (`target: 'openApi3'`).
- `scripts/gen-dbml.ts` memakai `drizzle-dbml-generator`, lalu menyisipkan isi
  `schema-notes.json` ke DBML hasilnya.
- Output-nya sengaja dibuat deterministik (tidak baca env, versi diambil dari
  `package.json`) supaya `docs:check` tidak gagal palsu hanya karena beda environment.

---

## 7. Batasan yang diketahui

- Level akses di spec berasal dari meta `access` pada procedure builder di
  `src/server/api/trpc.ts`. Procedure builder baru **wajib** diberi `.meta({ access })`;
  kalau tidak, `npm run docs:api` sengaja gagal dan menyebut procedure mana saja yang
  bolong — daripada diam-diam melabeli endpoint privat sebagai publik.
- Tiga endpoint masih memakai `z.custom<T>()` untuk output-nya (`event.create`,
  `event.update`, `users.editProfilMahasiswa`), sehingga schema-nya tampil kosong di Scalar.
  Ganti ke `z.object({ ... })` kalau endpoint-nya perlu terdokumentasi utuh.
- Prosa manual masih tipis: baru sebagian procedure yang punya deskripsi di
  `api-notes.json`, dan catatan per-kolom di `schema-notes.json` baru sedikit.
