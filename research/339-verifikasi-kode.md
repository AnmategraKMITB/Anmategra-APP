# Verifikasi kode K-06, K-07, M-09, L-10, M-14

Tiket: #351 (peta #344, temuan QA #339). Basis kode: `develop` @ `d81eb19`. Tidak ada kode aplikasi yang diubah.

## Ringkasan

| Butir | Hasil | Usulan |
|---|---|---|
| K-06 | **Tidak terbukti** dapat dilewati; ada celah pertahanan berlapis | Tiket implementasi kecil (opsional, prioritas rendah) |
| K-07 | **Terbukti** | Tiket implementasi (digabung dengan penyambungan wizard, gelombang 1) |
| M-09 | **Terbukti perilakunya, bukan bug**: kuota 0 = tanpa batas | Tiket Frontend kecil untuk keterangan; tanpa keputusan |
| L-10 | **Terbukti** (kode mati di halaman login) | Tiket implementasi Frontend |
| M-14 | **Ambigu**: kode tidak pernah menghasilkan 503; butuh log infrastruktur | Tetap di kabut (butuh log Cloudflare/origin) |

## K-06: `updateSubmission` tanpa konteks oprec

Status: **tidak terbukti dapat dilewati**.

- `updateSubmission` (`src/server/api/routers/form/submission.ts:804`) tidak memuat oprec. Ia hanya menolak bila `current.allowEditAfterSubmit` salah (`:833`) dan memanggil `prepareAnswers(tx, current.id, input.answers)` tanpa argumen `oprec` (`:863`).
- Kunci "edit setelah kirim" untuk form oprec ditegakkan di tiga tempat lain:
  - `form.update` menolak `allowEditAfterSubmit: true`, `allowMultipleSubmissions: true`, dan `maxResponses` bila form terikat oprec (`routers/form/form.ts:233-248`).
  - Pengikatan form ke oprec mereset ketiga bidang itu dalam transaksi yang sama: `routers/oprec/setup.ts:297-305` (wizard) dan `routers/oprec/index.ts:130-138` (`create`), dan form yang sudah punya jawaban ditolak (`index.ts:118-127`).
  - Karena itu form terikat selalu punya `allowEditAfterSubmit = false`, sehingga `updateSubmission` ditolak di `:833`.
- Lapisan kedua: seandainya saklar tetap menyala, `prepareAnswers` tanpa oprec membuat blok Pilihan gagal ("hanya berlaku untuk formulir oprec", `submission.ts:424`), jadi jawaban tidak dapat diganti, dan tabel pendaftar tidak ikut berubah.
- Celah: tidak ada pemeriksaan eksplisit di `updateSubmission` (pertahanan berlapis). Tidak ada jalur API yang saya temukan untuk menyalakan saklar pada form terikat.

Usulan: tiket implementasi kecil, prioritas rendah. Tambahkan penolakan eksplisit di `updateSubmission` bila form terikat oprec (`loadBoundOprec`) beserta tes. Tidak perlu keputusan produk.

## K-07: pemberian akses S17 di klien, di luar transaksi

Status: **terbukti**.

- `wizard.tsx:209` memanggil `createFromSetup`; setelah sukses, `wizard.tsx:210-226` memanggil `grantEventAdmin` per identifier secara berurutan dari browser (`:214`), masing-masing sebagai mutasi sendiri.
- `grantEventAdmin` (`routers/admin-grant.ts:205`) memberi akses fitur `oprec` per orang tanpa kaitan dengan `createFromSetup` (transaksi terpisah). Akibat:
  - Bila `createFromSetup` sukses lalu browser ditutup, jaringan putus, atau salah satu grant gagal, oprec sudah ada tetapi sebagian/seluruh pengelola tidak mendapat akses. Kegagalan hanya ditampilkan di layar akhir (`results`), tidak dicoba ulang dan tidak tersimpan.
  - Pengelola yang tidak ditemukan baru diketahui setelah oprec dibuat. Validasi di klien hanya memeriksa daftar tidak kosong (`model.ts:367`).
- Temuan tambahan: pada grant yang sudah ada, `grantEventAdmin` menimpa `features` dengan `input.features` (`admin-grant.ts:245`). Memberi `['oprec']` ke orang yang sudah punya fitur lain menghapus fitur itu. Perlu keputusan/konfirmasi (gabung atau timpa) sebelum diubah.
- `buildInput` mengirim hitungan `managerIdentifiers` saja ke server (`model.ts:434`), bukan daftarnya.

Usulan: tiket implementasi, masuk gelombang 1 (penyambungan wizard). Pindahkan grant ke server: `createFromSetup` menerima daftar pengelola, memvalidasi semuanya sebelum menulis, lalu memberi akses dalam transaksi yang sama. Pertanyaan terbuka: penggabungan `features` (lihat di atas).

## M-09: kuota 0 pada "Peringkat dalam kuota"

Status: **perilaku terbukti, bukan bug**; kuota 0 berarti tanpa batas.

- Skema: `organization_position.quota` "0 = tanpa batas" (`src/server/db/schema.ts:878-880`).
- `rankCandidates` (`src/lib/oprec/scoring.ts:250`): `if (quota <= 0 || pool.length <= quota)` seluruh kandidat dalam pool diberi `lolos` (`:273-276`). Untuk metode `peringkat_kuota_minimum`, yang di bawah nilai minimum tetap `tidak_lolos`. Untuk `peringkat_kuota` murni, semua kandidat tidak gugur lolos tanpa penyaringan.
- `recompute.ts:71` dan `:230` meneruskan `quotaOf.get(divisionId) ?? 0`; divisi tak dikenal juga diperlakukan tanpa batas.
- UI penempatan dan hasil konsisten menampilkan "Tanpa batas" (`placement-view.tsx:340,358`, `division-summary.tsx:77`, `autofill-dialog.tsx:91`; wizard `steps-dasar.tsx:209`). Tetapi opsi "Peringkat dalam kuota" di wizard (`steps-lanjut.tsx:130-136`) tidak menjelaskan bahwa divisi berkuota 0 meloloskan semua kandidat.

Usulan: bukan keputusan produk baru. Tiket Frontend kecil (digabung dengan butir Frontend mandiri): keterangan di wizard dan ringkasan bahwa kuota 0 = semua kandidat lolos. Bila pemilik produk menghendaki perilaku lain, itu tiket keputusan terpisah (belum ada indikasi).

## L-10: tautan form saat belum login

Status: **terbukti**; penyebab di halaman login, bukan di middleware.

- Middleware benar: `decideFormsPath` mengarahkan pengguna belum login dari `/forms/<id>` ke `/authentication?callbackUrl=<path+query>` (`src/lib/forms-path.ts:24-27`, dipakai `src/middleware.ts`). `fill-page.tsx:23` juga melakukan hal sama.
- Halaman login mendefinisikan `signInTo` yang membaca `callbackUrl` dan memvalidasinya dengan `isSafeFormsCallback` (`src/app/authentication/page.tsx:20-23`), tetapi **tidak dipakai di mana pun**. Kedua tombol memanggil `signIn("azure-ad")` dan `signIn("google")` langsung (`:52`, `:64`) tanpa `callbackUrl`, sehingga NextAuth kembali ke `/` dan middleware mengalihkannya ke beranda peran.
- Form login demo (`demo-login-form.tsx:19-29`) memakai `redirect: false` lalu `window.location.assign(result?.url ?? '/')`, juga tanpa `callbackUrl`.
- `git log` menunjukkan `signInTo` bagian dari perubahan yang sama dengan commit awal halaman; tidak ada konsumen.

Usulan: tiket implementasi Frontend kecil: tombol memakai `signInTo`, form demo meneruskan `callbackUrl` yang lolos `isSafeFormsCallback`, plus tes untuk `isSafeFormsCallback`/alur. Tanpa keputusan produk; masih dalam peta karena terkait Oprec (tautan form pendaftaran).

## M-14: tRPC 503

Status: **ambigu**; tidak dapat disimpulkan dari kode, dan kode tidak pernah menghasilkan 503 pada jalur tRPC.

- Pencarian `503`/`SERVICE_UNAVAILABLE` hanya menemukan `api/docs/openapi.json/route.ts:27` (tidak relevan). `rethrow` mengubah galat tak dikenal menjadi `INTERNAL_SERVER_ERROR` (500) (`routers/form/services.ts:713-717`). Jadi 503 datang dari lapisan di depan aplikasi (proxy Cloudflare atau origin yang tidak merespons), bukan dari tRPC.
- Aplikasi berjalan sebagai kontainer Node (`Dockerfile`, `docker-entrypoint.sh`: `db:migrate` lalu `next start`), bukan Workers. Tidak ada konfigurasi Cloudflare di repo. Migrasi berjalan di setiap start kontainer, sehingga start dingin/restart berarti jendela origin tidak tersedia.
- Faktor pendukung dari kode:
  - Pool `postgres` max 20, `connect_timeout` 10 dtk, tanpa `statement_timeout`/`lock_timeout` (`src/server/db/index.ts:19-23`). Transaksi dengan `FOR UPDATE` bisa menunggu lama.
  - Klien memakai `unstable_httpBatchStreamLink` (`src/trpc/react.tsx:50`): beberapa panggilan satu batch satu permintaan HTTP; bila permintaan itu 503, semua panggilan di batch tampak gagal walau sebagian sudah berjalan.
  - Di produksi `onError` tRPC tidak aktif (`api/trpc/[trpc]/route.ts:24-30`), jadi galat server hanya terlihat lewat `console.error` di `rethrow`.
  - Tidak ada retry otomatis di klien untuk mutasi; "data tersimpan padahal 503" sesuai dengan permintaan yang sampai ke origin tetapi respons gagal kembali.
- Tidak dapat dibuktikan: apakah masalahnya timeout proxy, restart kontainer, atau pool habis.

Usulan: tetap sebagai kabut di #344 sampai ada log Cloudflare/origin pada jam kejadian. Satu tiket kecil yang dapat dikerjakan tanpa log: aktifkan logging `onError` di produksi (path, kode, durasi) agar kejadian berikutnya dapat dikorelasikan. Pertanyaan terbuka: akses log dan jam kejadian QA.
