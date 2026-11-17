# Riset: infrastruktur pemberitahuan (Inbox dan email)

Tiket: AnmategraKMITB/Anmategra-APP#479 (peta #475). Sumber: cabang `develop`, klon dangkal. Dokumen ini hanya mencatat fakta dan risiko; tidak ada keputusan.

## Ringkasan

1. Notifikasi dalam aplikasi belum ada. Tabel `notification` ada, tetapi tidak dibaca dan tidak ditulis oleh kode aplikasi. "Inbox" yang ada di aplikasi adalah kotak permintaan keanggotaan, bukan notifikasi.
2. Pengiriman email belum ada. Tidak ada penyedia, antrean, templat, maupun batas kirim di kode, `package.json`, `Dockerfile`, atau `.github`.
3. Jumlah penerima per oprec tidak tercatat di repositori. Kapasitas server tercatat hanya pada peta #458 (satu node, 4 core, 16 GB).
4. `resultsRelease` dan `resultsWithdraw` adalah mutasi transaksional yang dapat menjadi titik pemicu, tetapi keduanya tidak menyimpan jejak "sudah dikirim", sehingga rilis ulang tidak dapat dibedakan dari rilis pertama selain lewat `recruitment_log`.

## 1. Inbox (notifikasi dalam aplikasi)

- Tabel `anmategra_notification` didefinisikan di `src/server/db/schema.ts:602-612` (kolom `user_id`, `title`, `content`, `type`, `read`, `timestamps`). Enum jenisnya hanya `'Association Request'` dan `'System'` (`schema.ts:573-576`). Relasi di `schema.ts:634-639` dan `schema.ts:163`. Tabel dibuat sejak migrasi awal (`drizzle/0000_orange_spyke.sql:140-146`).
- Pemakaian tabel itu di luar skema hanya `src/server/db/seeding/clear-db.ts:22,89` dan pembangkit data uji `src/server/db/seeding/generate_csv.py:423-443`. Tidak ada router, prosedur tRPC, atau komponen yang membaca atau menulisnya. Tidak ada pemicu basis data atau prosedur tersimpan.
- "Inbox" di antarmuka adalah kotak permintaan asosiasi: `src/app/lembaga/inbox/page.tsx`, `src/app/mahasiswa/inbox/page.tsx`, dan `src/app/manage/[lembagaId]/inbox/page.tsx`. Datanya dari `associationRequests` (`schema.ts:468-488`) dan `associationRequestsLembaga` (`schema.ts:491-512`) dengan status `Pending/Accepted/Declined` (`schema.ts:425-428`); kueri lembaga ada di `src/server/api/routers/lembaga.ts:211` (`getAllRequestAssociationSummary`). Ini bukan kanal pemberitahuan hasil oprec.
- Ada pula `transferInbox` (`src/server/api/routers/oprec/placement.ts:1629`) untuk permintaan pindah divisi bagi panitia oprec, bukan untuk pendaftar.
- Dasar yang tersedia untuk pendaftar: `myResult` (`src/server/api/routers/oprec/results.ts:579-600`) mengembalikan `visible` dan `releasedAt` per pendaftar. Pendaftar harus membuka halaman sendiri (model tarik, bukan dorong).
- Jejak peristiwa oprec: `recruitment_log` (`schema.ts:2768-2793`), ditulis lewat `logAction` (`src/server/api/routers/oprec/log.ts:7-26`) dalam transaksi yang sama dengan perubahan.

## 2. Email

- Tidak ditemukan pustaka atau pemanggilan email: pencarian `nodemailer|resend|sendgrid|smtp|mailgun|sendMail` pada `src`, `package.json`, `Dockerfile`, `docker`, `.github` tidak menghasilkan temuan relevan. Variabel lingkungan di `src/env.js` tidak memuat kredensial surel; satu-satunya yang berkaitan dengan surel adalah `SUPERADMIN_EMAILS` (`src/env.js:35,97`).
- Tidak ada antrean atau penjadwal: `package.json` tidak memuat pustaka antrean (pg-boss, bullmq, cron). Proses berjalan sebagai satu kontainer `next start` (`docker-entrypoint.sh:30`) setelah migrasi (`docker-entrypoint.sh:12-23`).
- Autentikasi memakai SSO Microsoft dan akun `@mahasiswa.itb.ac.id` / `@km.itb.ac.id` (`src/server/auth.ts:270-286`). Alamat tujuan tersedia di `users.email` (`schema.ts:51`, unik, wajib). Ada pula `contactEmail` pada akses alternatif (`schema.ts:86`) yang bukan alamat ITB.
- Peristiwa yang sudah memicu email: tidak ada. Satu-satunya pembatas laju di kode (`src/server/alt-login.ts:33,248`) berlaku untuk klaim akses alternatif, bukan pengiriman.

## 3. Penerima dan beban

- Jumlah pendaftar per oprec tidak tertulis di repositori. Satu pendaftar adalah satu baris `application` per pasangan oprec dan pengguna (`schema.ts:2322-2364`, indeks unik `application_recruitment_user_unique`). Jumlah penerima sama dengan `count(application)` untuk oprec itu (dapat dihitung dari basis data produksi; tidak dilakukan di sini).
- Pengiriman satu per satu dari proses aplikasi akan berbagi sumber daya dengan lalu lintas web. Kolam koneksi basis data 20 (`src/server/db/index.ts:20`). Kontainer tidak punya batas memori atau CPU di `Dockerfile`; batas diatur di sisi Dokploy dan masih menjadi pokok peta #458 (crash loop, iowait, batas sumber daya, 6 tiket turunan belum selesai).
- Server: satu node Docker Swarm, 4 core, 16 GB (deskripsi peta #458). Batas kirim penyedia surel belum diketahui karena penyedia belum ada.
- Mutasi rilis kini ringan (satu `UPDATE` dan satu `INSERT` log dalam satu transaksi). Penambahan pengiriman di dalam transaksi itu akan memperpanjang kunci baris `recruitment` (`results.ts:508-511`, `.for('update')`).

## 4. Pemicu `resultsRelease` dan `resultsWithdraw`

- `resultsRelease` (`src/server/api/routers/oprec/results.ts:497-541`): hanya admin; mengunci baris `recruitment` (`.for('update')`); menolak bila `placementState !== 'final'`, bila `resultsVisibleToApplicants` salah, atau bila `resultsReleasedAt` sudah terisi ("Hasil sudah dirilis"); lalu mengisi `resultsReleasedAt` dan mencatat `hasil_dirilis` dengan `detail: { undecided }`. Mengembalikan `{ releasedAt, undecided }`.
- `resultsWithdraw` (`results.ts:543-574`): hanya admin; menolak bila belum dirilis; mengosongkan `resultsReleasedAt` dan mencatat `hasil_ditarik` dengan `detail: { reason }`.
- Antarmuka: `src/app/_components/oprec/hasil/release-panel.tsx:34-55` memanggil kedua mutasi.
- Efek lain dari `resultsReleasedAt`: gerbang berlakunya penempatan (`src/server/api/oprec-release.ts:22-25`, `placementReleased`) dan tampilan `myResult`.
- Risiko kirim ganda:
  - Dalam satu rilis, penjaga `resultsReleasedAt !== null` dan kunci `FOR UPDATE` mencegah dua rilis serentak.
  - Setelah tarik lalu rilis ulang, `resultsReleasedAt` kembali `null` lalu terisi lagi, sehingga penjaga tidak membedakan rilis pertama dari rilis ulang. Tidak ada kolom, tabel, atau kunci idempoten yang menyimpan "pemberitahuan sudah dikirim" per pendaftar.
  - Satu-satunya jejak adalah baris `recruitment_log` berjenis `hasil_dirilis` dan `hasil_ditarik` (jumlahnya dapat dihitung per oprec).
  - Isi hasil dapat berubah antara rilis pertama dan rilis ulang (penempatan dapat diubah setelah penarikan); `undecided` ikut berubah. Pendaftar yang sama dapat menerima dua pemberitahuan berbeda.
  - Bila pengiriman dilakukan di luar transaksi (setelah commit), kegagalan di tengah tidak punya catatan progres untuk dilanjutkan.
  - Tombol di `release-panel.tsx` memanggil mutasi dari klien; percobaan ulang jaringan dari klien tertahan oleh penjaga "sudah dirilis".

## Hal yang belum diketahui

- Jumlah pendaftar riil per oprec dan batas kirim penyedia surel (tidak ada di repositori).
- Batas sumber daya kontainer aktual di Dokploy (di luar repositori; lihat #458).
- Apakah tabel `notification` masih dimaksudkan untuk dipakai atau sisa awal proyek (tidak ada penjelasan di kode).
