# Inventaris operasi basis data manual dan celahnya terhadap /admin

Tiket: #448 (peta #434). Dasar: kode cabang `develop` pada komit `ac8eb85`, dibaca tanpa menjalankan skrip dan tanpa mengakses basis data. Tindakan produksi yang pernah dilakukan lewat SQL hanya diketahui dari komentar pada skrip, README, dan tiket; riwayat produksi sebenarnya tidak diperiksa.

## Kesimpulan

1. Kebutuhan awal tiket #304 sudah terpenuhi di `/admin`: Superadmin, lembaga beserta akun Owner, Operator beserta izinnya, email terverifikasi, impor alumni, pembuatan akun mahasiswa dan lembaga satuan, serta koreksi angkatan, jurusan, NIM, dan status alumni.
2. Celah terbesar ada pada operasi yang menghapus atau menggabung data: tidak ada prosedur `/admin` untuk menggabung akun ganda, menghapus akun, menghapus lembaga, atau membersihkan data uji (oprec, form, bagian organogram). Dua yang pertama hanya tersedia sebagai skrip CLI.
3. Operasi massal berulang (impor mahasiswa satu angkatan, seed lembaga dari CSV) masih berupa skrip CLI. Impor alumni sudah punya padanan berbentuk unggah CSV, jadi pola yang sama dapat dipakai.
4. Skrip penerapan sekali pakai (organogram, `phase0-cleanup`) tidak perlu masuk `/admin`.
5. Pencatatan audit belum menyeluruh: skrip penggabungan akun tidak menulis `admin_audit`, dan penghapusan kegiatan oleh Owner (`event/delete.ts`) tidak diaudit.
6. Perubahan `SUPERADMIN_EMAILS` tetap lewat variabel lingkungan sesuai keputusan #312.

## Cara membaca tabel

- **Status:** `sudah ada di /admin`, `usul masuk /admin`, `tetap manual`, atau `tidak diperlukan`.
- **Risiko:** R = rendah, S = sedang, **T = tinggi**. Operasi bertanda **T** wajib mendapat konfirmasi tambahan (misalnya mengetik ulang email atau nama sasaran, seperti pola `assertConfirmEmail`) dan satu baris `admin_audit`.
- Nama tabel memakai awalan `anmategra_` pada basis data; di sini ditulis tanpa awalan.
- Frekuensi adalah perkiraan dari sifat operasinya, bukan dari catatan penggunaan.

## A. Operasi yang sudah punya padanan di /admin

| # | Operasi | Cara jalan kini | Pelaku | Tabel tersentuh | Risiko / dapat dibatalkan | Frekuensi | Padanan /admin | Status |
|---|---|---|---|---|---|---|---|---|
| A1 | Tambah dan hapus Superadmin | `adminOps.superadminAdd` dan `superadminRemove` (`admin-ops.ts`); Superadmin terakhir dan akun `SUPERADMIN_EMAILS` dilindungi | Superadmin | `users` | **T**; dapat dibatalkan (tambah ulang); sudah ada ketik ulang email dan audit | Jarang | Halaman Superadmin | sudah ada di /admin |
| A2 | Tambah lembaga baru beserta akun Owner | `adminOps.lembagaCreate` (satu lembaga per panggilan) | Operator `lembaga.write` | `users`, `lembaga`, `verified_users`, `admin_audit` | S; tidak ada prosedur hapus untuk membatalkan | Beberapa kali per tahun | Halaman Lembaga | sudah ada di /admin |
| A3 | Ubah data lembaga dan blok profil | `lembagaUpdate`, `lembagaProfileUpsert`, `lembagaProfileDelete` | Operator `lembaga.write` | `lembaga`, `profil_lembaga` | R; `lembagaProfileDelete` tanpa konfirmasi tetapi diaudit | Sering | Halaman Lembaga | sudah ada di /admin |
| A4 | Buat akun mahasiswa atau lembaga satuan | `adminConsole.userCreate` | Operator `accounts.write` | `users`, `mahasiswa` atau `lembaga` | S; dapat disembunyikan lewat `hiddenAt`, tidak dapat dihapus | Jarang | Halaman Akun | sudah ada di /admin |
| A5 | Koreksi angkatan, jurusan, NIM, NIM TPB, status alumni | `adminConsole.userUpdate` (bagian `mahasiswa`); `before` dan `after` disimpan di audit | Operator `accounts.write` | `users`, `mahasiswa` | S; dapat dikembalikan dari metadata audit | Sesekali | Halaman Akun | sudah ada di /admin |
| A6 | Ubah email atau role akun | `userUpdate` dengan izin `accounts.roles` dan konfirmasi ketik ulang email; ke atau dari `admin` diblokir | Operator `accounts.roles` | `users` | **T** (mengambil alih akun); dapat dikembalikan | Jarang | Halaman Akun | sudah ada di /admin |
| A7 | Impor alumni dari CSV wisuda | `admin.uploadAlumniCsv` | Operator `alumni.write` | `mahasiswa`, `alumni_pending`, `admin_audit` | S; tidak ada tombol urungkan, tetapi angka tercatat di audit | Tiap wisuda | Halaman Alumni | sudah ada di /admin |
| A8 | Email terverifikasi (daftar putih login) | `verifiedEmailAdd` dan `verifiedEmailRemove` | Operator `accounts.write` | `verified_users` | S; dapat dibatalkan | Sering | Halaman Email terverifikasi | sudah ada di /admin |
| A9 | Persetujuan akun alternatif (login non-SSO) | `altLogin.adminApprove` dan `adminRevoke` | Operator `accounts.write` | tabel akun alternatif | S; dapat dibatalkan | Sesekali | Halaman Akun | sudah ada di /admin |
| A10 | Beri atau cabut izin Operator dan hibah akses | `operatorPermissionSet`, `operatorPermissionRevoke`, `grantSet`, `grantRevokeById` | Operator `access.write` | `admin_permission`, `access_grant` | **T** untuk izin Operator; dapat dikembalikan | Jarang | Halaman Akses | sudah ada di /admin |
| A11 | Keanggotaan dan penempatan organogram | `membershipUpsert`, `membershipRemove`, `placementAdd`, `placementRemove` | Operator `accounts.write` | `lembaga_membership`, `placement` | S; dapat dibatalkan | Sesekali | Halaman Lembaga | sudah ada di /admin |
| A12 | Buat, ubah, hapus periode atau kegiatan lembaga | `eventCreate`, `eventUpdate`, `eventDelete`; hapus ditolak bila periode punya anggota | Operator `lembaga.events` | `events` | S; hapus tidak dapat dibatalkan, tetapi diaudit | Sesekali | Halaman Lembaga | sudah ada di /admin (hanya untuk periode tanpa anggota) |
| A13 | Tinjau laporan pengguna | `getAllReportsAdmin`, `setReportStatus` | Operator `reports.*` | `support` | R | Sering | Halaman Laporan | sudah ada di /admin |
| A14 | Sembunyikan akun dari publik | `userUpdate.hidden` | Operator `accounts.write` | `users.hidden_at` | R; dapat dibatalkan | Jarang | Halaman Akun | sudah ada di /admin |

## B. Operasi yang kini hanya lewat skrip, SQL, atau variabel lingkungan

| # | Operasi | Cara jalan kini | Pelaku | Tabel tersentuh | Risiko / dapat dibatalkan | Frekuensi | Padanan /admin | Status |
|---|---|---|---|---|---|---|---|---|
| B1 | Gabung akun ganda (placeholder NIM TPB ke akun NIM jurusan) | `npm run akun:gabung-tpb` (`scripts/akun/gabung-akun-tpb.ts`, memakai `server/akun/gabung-akun.ts`); tanpa `--apply` berupa dry-run dalam transaksi yang di-rollback; `DATABASE_URL` diisi tangan | Pengembang dengan akses basis data | Semua tabel yang punya FK ke `users.id` (dibaca dari katalog), `mahasiswa`, `accounts`; menghapus baris `users` asal | **T**; tidak dapat dibatalkan setelah `--apply` kecuali dengan restore cadangan; skrip tidak menulis `admin_audit` | Tiap angkatan baru atau tiap ada kasus | Tidak ada | usul masuk /admin (pratinjau dry-run, konfirmasi ketik ulang NIM kedua akun, audit dengan laporan `moved` dan `dropped`) |
| B2 | Hapus akun | Tidak ada skrip maupun prosedur. Satu-satunya penghapusan `users` terjadi di dalam penggabungan (B1). | (tidak ada) | `users` dan seluruh tabel anak | **T** | Tidak diketahui | Hanya `hidden` (A14) | usul masuk /admin atau tetap manual; menunggu keputusan pemilik (lihat pertanyaan Q2) |
| B3 | Hapus lembaga | Tidak ada prosedur maupun skrip pada `develop` | (tidak ada) | `lembaga`, `users`, serta seluruh data periode, organogram, oprec, dan form | **T** | Tidak diketahui | Tidak ada | usul masuk /admin atau tetap manual; menunggu keputusan (Q2) |
| B4 | Bersihkan data uji (mis. tiket #352: bagian "[UJI]", oprec dan form uji pada Tim Formatur KAT ITB 2025) | SQL tangan ke produksi, dicatat pada tiket | Pemilik dengan akses produksi | `organization_unit`, `organization_position`, `recruitment`, `form`, dan turunannya | **T**; tidak dapat dibatalkan | Insidental | Hanya `eventDelete` untuk periode tanpa anggota. Oprec non-draf dan form tidak dapat dihapus lewat `/admin`; oprec draf tanpa pendaftar dapat dihapus oleh pengelola oprec (`oprec/index.ts`). | usul masuk /admin (tandai atau hapus per kegiatan dengan hitungan baris yang akan terhapus dan audit); alternatifnya tetap manual |
| B5 | Impor mahasiswa satu angkatan dari CSV | `npm run db:seed-mahasiswa` (`seeding/seed-mahasiswa.ts`): membuat `users` dan `mahasiswa`, jurusan dan angkatan diturunkan dari NIM | Pengembang | `users`, `mahasiswa` | S; bersifat tambah-saja, sehingga dapat dibatalkan dengan menghapus baris yang dibuat, tetapi tidak ada prosedurnya | Tiap tahun ajaran | Tidak ada (A4 hanya satuan) | usul masuk /admin (unggah CSV, pola seperti A7, dengan pratinjau dan audit) |
| B6 | Seed lembaga resmi dari CSV | `npm run db:seed-lembaga` (`seeding/seed-lembaga.ts`): membuat `verified_users`, `users`, `lembaga`; mengubah baris yang berbeda dari CSV, sel kosong tidak menghapus | Pengembang | `verified_users`, `users`, `lembaga` | S; idempoten, tetapi menimpa data yang diubah tangan bila CSV berbeda | Jarang | A2 untuk satuan | tetap manual (CSV adalah artefak repo); usul impor CSV hanya jika pemilik menghendaki |
| B7 | Isi deskripsi lembaga yang kosong | `npm run db:backfill-lembaga-descriptions` (ada `--dry-run`); tidak menimpa deskripsi yang sudah ada | Pengembang | `lembaga.description` | R | Sekali atau jarang | A3 | tidak diperlukan |
| B8 | Perbarui berkas data resmi lembaga | `db:refresh-lembaga`, `scripts/fetch-lembaga.py`, `build-lembaga-csv.py`, `merge-lembaga-xlsx.cjs`, `apply-merge.cjs`, `db:summarize-lembaga` (memanggil layanan ringkasan eksternal lewat `SUMMARY_*`). Hanya menyentuh berkas CSV, bukan basis data. | Pengembang | Tidak ada (berkas repo) | R | Jarang | Tidak relevan | tidak diperlukan |
| B9 | Atur syarat angkatan kuliah pada oprec yang sedang dibuka | `psql -f scripts/oprec/set-angkatan.sql -v oprec_id=... -v dari=... -v sampai=...`; satu transaksi, mendukung `-v selesai=ROLLBACK` | Pengembang | `recruitment_requirement` (syarat `angkatan_kuliah`) | S; dapat dikembalikan dengan menjalankan ulang; pendaftar yang sudah masuk tidak terpengaruh | Insidental | Wizard oprec mengatur syarat angkatan, tetapi tampaknya terkunci selama oprec dibuka (lihat `oprec.test.ts`, "terkunci selama dibuka"; tidak diverifikasi untuk syarat angkatan secara khusus) | usul masuk /admin sebagai pengecualian Superadmin dengan audit; atau tetap manual (Q5) |
| B10 | Penerapan organogram: `preflight.sql`, `phase0-cleanup.sql`, `mark-kepengurusan.sql`, `backfill.ts`, `verify.sql` | Urutan pada `scripts/organogram/README.md`, lewat `psql` di kontainer dan terowongan SSH | Pengembang dengan akses server | `lembaga`, `events`, `lembaga_period`, `organization_*`, `placement`, `keanggotaan`, `kehimpunan` | **T** (`phase0-cleanup` menggabung lembaga ganda dan menunjuk ulang FK; tidak dapat dibatalkan tanpa restore); README mewajibkan cadangan dan menyediakan dry-run | Sekali per lingkungan | Tidak ada | tidak diperlukan (penerapan sekali; tinggal catat sebagai selesai di produksi) |
| B11 | Migrasi skema | `npm run db:migrate` otomatis saat kontainer mulai (`docker-entrypoint.sh`); `db:push` dan `db:generate` untuk pengembangan | Sistem deploy | Seluruh skema | **T** | Tiap deploy | Tidak ada | tetap manual (otomatis) |
| B12 | Ubah daftar Superadmin darurat | Ubah variabel `SUPERADMIN_EMAILS` pada lingkungan server lalu mulai ulang | Pemilik server | Tidak ada (env); sesi dipromosikan saat login (`auth.ts`) | **T** | Sangat jarang | Hanya dapat dilihat (`stats.superadmins`) dan dilindungi dari perubahan panel (`superadminRemove`) | tetap manual (sesuai keputusan #312) |
| B13 | Cadangan dan pemulihan basis data | `pg_dump` dan `pg_restore` lewat kontainer (README organogram) | Pemilik server | Seluruh basis data | **T** | Sebelum operasi berisiko | Tidak ada | tetap manual |
| B14 | Kosongkan seluruh basis data | `npm run db:clear` (`seeding/clear-db.ts`) menghapus tiap tabel; pada bagian yang dibaca tidak tampak penjaga lingkungan seperti pada reset demo | Pengembang | Hampir semua tabel | **T**; tidak dapat dibatalkan | Pengembangan lokal | Tidak ada | tidak diperlukan di /admin; usul tambah penjaga seperti `guard.ts` (di luar lingkup tiket ini) |
| B15 | Seed dan reset basis data demo | `npm run demo:seed`, `demo:reset`; reset ditolak kecuali `APP_ENV=demo` dan basis data lokal atau bernama demo (`scripts/demo/lib/guard.ts`) | Pengembang | Semua tabel (hanya demo) | **T** bila penjaga salah; penjaga ada dan diuji | Sesuai kebutuhan demo | Tidak ada | tetap manual |
| B16 | Seed data dev lain: `db:seed`, `db:seed-csv`, `seed:oprec-mock` (komentar: jangan dijalankan ke produksi) | CLI | Pengembang | Banyak tabel | S pada dev; **T** bila salah sasaran | Pengembangan | Tidak ada | tidak diperlukan |
| B17 | Basis data lokal dan pembangkit dokumen | `scripts/start-database.sh`, `docs:api`, `docs:db`, `docs:check` | Pengembang | Tidak ada (lokal atau berkas) | R | Sering | Tidak relevan | tidak diperlukan |

## C. Operasi di luar /admin yang menyentuh data serupa

| # | Operasi | Lokasi | Catatan | Status |
|---|---|---|---|---|
| C1 | Akun sementara anggota manual | `lembaga.addAnggotaManual` dan `event/update.ts` | Menyisipkan `users` dan `mahasiswa` bawaan `aktif` tanpa memeriksa `alumni_pending` (tiket #314). Akibatnya alumni tampil aktif sampai dikoreksi lewat A5. | Perbaikan bug di #314, bukan operasi `/admin` |
| C2 | Hapus kegiatan oleh Owner | `event/delete.ts` | Menolak bila punya panitia; tidak memanggil `audit`, berbeda dengan `adminConsole.eventDelete` | Celah audit; masuk bahan riset audit (#450) |
| C3 | Hapus oprec draf, hapus form | `oprec/index.ts`, `form/form.ts` | Dilakukan pengelola kegiatan, bukan Superadmin; syarat: oprec draf tanpa pendaftar | Tidak diperlukan |

## Operasi berisiko tinggi

Daftar yang perlu konfirmasi tambahan (ketik ulang email, NIM, atau nama sasaran) dan baris `admin_audit`:

- Sudah memenuhi: A1, A6, sebagian A10 (konfirmasi dan audit ada pada A1 dan A6; pada A10 audit ada, konfirmasi tidak diperiksa lebih lanjut).
- Perlu ditambahkan bila masuk `/admin`: B1 (gabung akun), B2 (hapus akun), B3 (hapus lembaga), B4 (pembersihan data uji).
- Tetap di luar `/admin`: B10 sampai B15. Risikonya diredam oleh cadangan, dry-run, dan penjaga lingkungan, bukan oleh UI.

## Pertanyaan untuk pemilik (bahan [Grilling] Lingkup operasi basis data manual, #454)

1. Penggabungan akun ganda (B1): apakah pembuatan tombol di `/admin` perlu, atau cukup skrip bila kasusnya hanya muncul sekali per angkatan? Bila perlu, siapa yang boleh menjalankannya (hanya Superadmin atau Operator dengan izin baru)?
2. Hapus akun (B2) dan hapus lembaga (B3): apakah penghapusan permanen perlu ada sama sekali, atau cukup menyembunyikan (`hiddenAt`) dan menonaktifkan? Bila perlu, apa yang terjadi pada data turunan (anggota, riwayat, oprec, form): ikut terhapus, atau penghapusan ditolak selama masih ada data?
3. Pembersihan data uji (B4): apakah fitur khusus perlu, atau cukup penanda `isDemo`/uji pada kegiatan yang disembunyikan dari publik? Siapa yang berhak menghapus oprec dan form non-draf?
4. Impor mahasiswa per angkatan (B5): apakah dipindahkan ke `/admin` sebagai unggah CSV seperti impor alumni, dan siapa yang menyiapkan CSV-nya?
5. Syarat angkatan oprec yang sedang dibuka (B9): apakah Superadmin boleh mengubahnya lewat `/admin`, atau perubahan itu tetap permintaan khusus ke pengembang?
6. Seed lembaga dari CSV (B6): apakah penambahan lembaga massal (mis. UKM baru satu semester) cukup lewat A2 satu per satu, atau perlu impor CSV?
7. Kegiatan oleh Owner tanpa audit (C2): apakah semua penghapusan, termasuk oleh Owner, harus tercatat?
8. Konfirmasi tambahan: apakah pola mengetik ulang email atau nama sasaran cukup untuk semua operasi bertanda T, atau perlu persetujuan dua orang untuk beberapa di antaranya?
9. Catatan tindakan produksi lewat SQL yang pernah dilakukan (selain #352 dan README organogram) tidak ada di repositori. Adakah daftar atau catatan serah terima (`handoff-*`) di luar repositori yang perlu ditambahkan ke inventaris ini?

## Batasan riset

- Dokumen `handoff-*` dan `production-migration-notes.md` (disebut README organogram) tidak ada di repositori; isinya tidak diperiksa.
- Apakah Superadmin dapat bertindak atas oprec dan form kegiatan lewat izin `lembaga.oprec` dan `lembaga.forms` tidak ditelusuri; kedua izin ada pada `ADMIN_PERMISSIONS`.
- Kolom `Frekuensi` dan sebagian `Risiko` adalah perkiraan dari kode dan komentar, bukan data penggunaan nyata.
- Padanan `/admin` diperiksa dari prosedur tRPC pada `admin-console.ts`, `admin-ops.ts`, `admin.ts`, dan `alt-login.ts`; tampilan UI tiap halaman tidak diperiksa satu per satu.
