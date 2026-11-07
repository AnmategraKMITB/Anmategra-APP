# Deploy organogram: migrasi, backfill, dan pemeriksaan

Untuk menaikkan `develop` yang memuat pembacaan anggota lewat organogram (migrasi `0034` sampai `0038`) ke staging atau produksi.

**Yang perlu diketahui dulu**
- Sejak versi ini, daftar anggota lembaga dan panitia dibaca **dari organogram**, tanpa fallback ke tabel lama. Kalau periode atau lembaga belum diimpor ke organogram, daftar anggotanya kosong. Karena itu backfill (langkah 5) harus jalan **segera** setelah aplikasi naik.
- Anggota baru yang ditambah sesudah deploy hanya ditulis ke organogram. Tabel `keanggotaan` dan `kehimpunan` tidak lagi diperbarui (masih ada, belum dibuang). Jadi **mengembalikan ke versi lama setelah pengguna mulai bekerja akan kehilangan perubahan itu**; satu-satunya jalan mundur adalah restore cadangan.
- Container aplikasi menjalankan `npm run db:migrate` saat start (`docker-entrypoint.sh`), jadi migrasi terpasang otomatis begitu deploy selesai.

## Ringkasan urutan
1. Cadangkan basis data.
2. Preflight (`preflight.sql`), putuskan apakah `phase0-cleanup.sql` perlu.
3. Deploy `develop` (migrasi `0034`–`0038` jalan otomatis).
4. Tandai periode kepengurusan (`mark-kepengurusan.sql`).
5. Backfill (`backfill.ts`): `--dry` dulu, lalu sungguhan.
6. Verifikasi (`verify.sql`) dan uji asap di aplikasi.

Contoh perintah di bawah memakai `psql` di dalam kontainer database. Ganti `<db-container>`, `<user>`, dan `<db>` dengan nilai server; ambil kredensial dari environment kontainer (`docker exec <db-container> env | grep POSTGRES`) dan jangan menempelkannya ke chat atau berkas.

## 1. Cadangan
```bash
docker exec <db-container> pg_dump -U <user> -Fc <db> > anmategra-sebelum-organogram-$(date +%F).dump
```
Simpan di luar server. Uji bahwa berkasnya bisa dibaca (`pg_restore --list <berkas> | head`).

## 2. Preflight
```bash
docker exec -i <db-container> psql -U <user> -d <db> < scripts/organogram/preflight.sql
```
Baca hasilnya:
- **Skema sudah melewati Fase 1** (tabel `anmategra_lembaga_period` ada, `anmategra_event` tidak): lewati pembersihan dan langsung ke langkah 3.
- **Skema masih lama** (tabel `anmategra_event` ada, migrasi < 0029, mis. produksi di 0016): jalankan `phase0-cleanup.sql` **sebelum** deploy, karena skrip itu memakai nama tabel lama dan harus selesai sebelum migrasi Fase 1 mengubah namanya. Ini satu kali saja, idempoten, dan menolak lanjut bila menemukan acuan tak terduga. Uji kering dulu: `sed 's/^COMMIT;/ROLLBACK;/' scripts/organogram/phase0-cleanup.sql | docker exec -i <db-container> psql -U <user> -d <db> -v ON_ERROR_STOP=1`; lalu sungguhan:
  ```bash
  docker exec -i <db-container> psql -U <user> -d <db> -v ON_ERROR_STOP=1 < scripts/organogram/phase0-cleanup.sql
  ```
  Dalam kasus ini deploy di langkah 3 akan memasang seluruh migrasi sekaligus (misalnya `0017` sampai `0038`); itu normal, tetapi pastikan cadangan langkah 1 sudah ada dan baca `production-migration-notes.md` (di luar repo) untuk pemetaan event dan lembaga yang diputuskan.

## 3. Deploy
Deploy `develop` seperti biasa (Dokploy). Setelah container naik, periksa log: harus ada `Applying database migrations...` lalu migrasi berhasil. Ulangi preflight; jumlah migrasi terpasang harus 39 (0000 sampai 0038) dan bagian 5 menampilkan sebaran jenis periode (semua `kegiatan`).

Mulai titik ini daftar anggota akan kosong sampai langkah 4 dan 5 selesai. Lakukan di jam sepi.

## 4. Tandai periode kepengurusan
Tiga periode yang sebenarnya kepengurusan (Anmategra 2024/2025, Anmategra 2025/2026, Kepengurusan BP UKJ 2025/2026) ditandai `kepengurusan` agar tidak tampil sebagai kegiatan di daftar publik.
```bash
docker exec -i <db-container> psql -U <user> -d <db> -v ON_ERROR_STOP=1 < scripts/organogram/mark-kepengurusan.sql
```
Skrip ini satu transaksi, idempoten, dan **menolak lanjut kalau jumlah periode yang cocok bukan 3**. Pada staging yang namanya berbeda, ubah daftar nama di dalam berkas (dua tempat) mengikuti periode yang memang kepengurusan.

## 5. Backfill
Skrip TypeScript memakai kode aplikasi, jadi dijalankan dari checkout `develop` di laptop, menunjuk ke basis data server lewat terowongan SSH:
```bash
# di server: cari alamat kontainer database
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <db-container>
```
```bash
# di laptop: buka terowongan (biarkan jalan di terminal terpisah)
ssh -N -L 5440:<ip-kontainer>:5432 <user>@<server>
```
```bash
# di laptop, dari akar repo yang sudah `git pull` ke develop terbaru dan `npm ci`
export SKIP_ENV_VALIDATION=1
export DATABASE_URL='postgresql://<user>:<password>@localhost:5440/<db>'
npx tsx --tsconfig scripts/organogram/tsconfig.json scripts/organogram/backfill.ts --dry
```
`--dry` menjalankan semuanya lalu me-rollback dan hanya melaporkan jumlah. Periksa ringkasannya (jumlah periode dibuat, periode diimpor, unit/jabatan/penempatan) dan pastikan `pasangan (periode, orang) di keanggotaan` masuk akal. Bila sudah sesuai, jalankan tanpa `--dry`:
```bash
npx tsx --tsconfig scripts/organogram/tsconfig.json scripts/organogram/backfill.ts
```
Yang dilakukan: lembaga yang punya `kehimpunan` tetapi belum punya periode kepengurusan mendapat periode "2025/2026" (On going); setiap periode yang organogramnya masih kosong diimpor dengan usulan bawaan (ejaan Staff/Staf dan sejenisnya dilipat; baris "-"/"-" tetap hanya anggota lembaga); lalu `participant_count` dan `member_count` dihitung ulang. Periode yang sudah berisi dilewati, jadi aman diulang. Hasilnya bisa dirapikan kemudian di editor.

## 6. Verifikasi
```bash
docker exec -i <db-container> psql -U <user> -d <db> < scripts/organogram/verify.sql
```
Semua kolom di bagian "Harus nol" harus bernilai 0. Lalu uji asap di aplikasi dengan akun uji:
- halaman Anggota lembaga dan Panitia kegiatan menampilkan bagian dan jabatan;
- profil mahasiswa dan profil lembaga memuat keanggotaan;
- tambah, ubah, dan hapus satu anggota uji di lembaga dan di kegiatan;
- editor organogram terbuka di `/lembaga/kegiatan/<id>/organogram`, tombol Simpan bekerja;
- daftar kegiatan publik tidak memuat periode kepengurusan.

## Berkas di folder ini
| Berkas | Fungsi |
|---|---|
| `preflight.sql` | Pemeriksaan sebelum deploy (hanya membaca) |
| `phase0-cleanup.sql` | Pembersihan data lembaga/event produksi; hanya bila preflight menunjukkan belum jalan |
| `mark-kepengurusan.sql` | Menandai tiga periode kepengurusan |
| `backfill.ts`, `auth-stub.ts`, `tsconfig.json` | Backfill ke organogram (`--dry` untuk uji kering) |
| `verify.sql` | Pemeriksaan sesudah backfill |

Tabel `keanggotaan`, `kehimpunan`, `organization_role`, dan trigger lama dibuang di PR berikutnya, setelah versi ini berjalan stabil.
