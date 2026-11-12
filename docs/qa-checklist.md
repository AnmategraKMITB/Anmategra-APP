# Daftar Periksa QA per Peran

Daftar ini dipakai untuk menguji Anmategra secara bertahap, dari login sampai fitur utama, satu peran pada satu waktu. Isi kolom **Hasil** dengan `Lulus` atau `Gagal` dan catat tautan tiket pada kolom **Catatan** untuk setiap butir yang gagal. Satu temuan gagal dibuatkan satu tiket bug terpisah, berlabel `bug`, dengan langkah, hasil yang diharapkan, dan hasil yang terjadi.

## Persiapan

- Gunakan lingkungan staging dan data uji. Jangan menguji pada data pilot sungguhan.
- Siapkan akun: satu akun mahasiswa, satu pemilik lembaga, satu admin lembaga atau kegiatan, satu operator, dan satu superadmin (`SUPERADMIN_EMAILS`).
- Siapkan satu periode kegiatan dengan organogram aktif. Setiap divisi punya satu ketua, dan satu bagian (misalnya HR) punya anggota.
- Pastikan migrasi 0053 dan 0054 sudah berjalan, dan `NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID` terisi bila menguji pertanyaan berkas.
- Catat tanggal, versi (hash commit), dan nama penguji di bagian akhir.

## 1. Anonim (belum login)

| # | Langkah | Yang diharapkan | Hasil | Catatan |
|---|---------|-----------------|-------|---------|
| A1 | Buka `/manual` dan `/api/manual` | Terbuka tanpa login | | |
| A2 | Buka tautan form oprec yang terbit | Diarahkan ke halaman login | | |
| A3 | Login dengan Google | Kembali ke form oprec yang sama (#366) | | |
| A4 | Ulangi A2–A3 dengan Microsoft | Kembali ke form yang sama | | |
| A5 | Buka `/manage` dan `/prototype` tanpa login | `/manage` ke login; `/prototype` meminta kata sandi atau menolak | | |
| A6 | Buka tautan form yang masih Draf | Tidak dapat diisi | | |

## 2. Mahasiswa

| # | Langkah | Yang diharapkan | Hasil | Catatan |
|---|---------|-----------------|-------|---------|
| M1 | Login lalu buka beranda | Beranda termuat, tanpa menu admin | | |
| M2 | Buka form oprec yang terbuka | Form tampil; pilihan tujuan sesuai divisi yang dibuka | | |
| M3 | Pilih tujuan melebihi batas maksimum | Ditolak dengan pesan jelas | | |
| M4 | Unggah gambar pada pertanyaan berkas | Berkas masuk Drive pelamar; akses diatur "Siapa saja yang memiliki link" | | |
| M5 | Kirim form | Pendaftaran tercatat; kirim kedua kali ditolak | | |
| M6 | Buka form oprec setelah ditutup | Tidak dapat mengirim | | |
| M7 | Buka halaman admin lewat URL langsung | Ditolak | | |
| M8 | Lihat hasil setelah dirilis (bila diizinkan) | Status sesuai pengaturan akses hasil | | |

## 3. Lembaga / Owner

| # | Langkah | Yang diharapkan | Hasil | Catatan |
|---|---------|-----------------|-------|---------|
| L1 | Login lalu buka kegiatan | Daftar kegiatan lembaga tampil | | |
| L2 | Buka organogram | Organogram aktif dapat dilihat dan diubah | | |
| L3 | Buka wizard oprec pada periode tanpa organogram | Peringatan organogram muncul di langkah pertama | | |
| L4 | Isi gelombang yang tumpang tindih | Ditolak dengan pesan yang menyebut kedua gelombang | | |
| L5 | Pilih penilai umum dari bagian kosong, atau ketua menilai pada divisi tanpa ketua | Ditolak; pesan menyebut nama bagian atau divisi | | |
| L6 | Kurangi jumlah divisi di bawah jumlah pilihan | Jumlah pilihan menyesuaikan tanpa galat | | |
| L7 | Lihat opsi pengelola "bagian tertentu" dan "hanya ketua" | Nonaktif dengan keterangan | | |
| L8 | Selesaikan wizard | Oprec berstatus draf; ringkasan menampilkan tanggal gelombang | | |
| L9 | Ringkasan pada konfigurasi tidak lengkap | Peringatan dengan tautan ke langkah terkait; tanpa peringatan bila lengkap | | |
| L10 | Terbitkan form tanpa syarat lengkap | Ditolak dengan pesan yang menyebut kekurangan | | |
| L11 | Terbitkan form dengan syarat lengkap | Form terbit dan oprec terbuka bersamaan | | |
| L12 | Buka tab Penempatan pada oprec tanpa pendaftar | Terkunci dengan keterangan alasan | | |
| L13 | Tekan Tutup form lalu batalkan | Konfirmasi muncul; batal tidak mengubah status | | |
| L14 | Tutup form dan konfirmasi | Form dan oprec ikut ditutup | | |
| L15 | Kembalikan form ke Draf saat sudah ada pendaftar | Ditolak | | |

## 4. Admin Lembaga / Kegiatan

| # | Langkah | Yang diharapkan | Hasil | Catatan |
|---|---------|-----------------|-------|---------|
| D1 | Login dan buka kegiatan yang diberi akses | Hanya kegiatan yang diizinkan terlihat | | |
| D2 | Buka oprec | Menu sesuai fitur yang diberikan | | |
| D3 | Lihat dan nilai pendaftar | Penilaian tersimpan; gugur dan skor sesuai kriteria | | |
| D4 | Buka Penempatan setelah ada pendaftar | Tab terbuka; alokasi dapat dijalankan | | |
| D5 | Buka menu Hasil | Akses sesuai pengaturan (admin, admin dan ketua, semua) | | |
| D6 | Buka kegiatan yang tidak diberi akses | Ditolak | | |

## 5. Superadmin / Operator

| # | Langkah | Yang diharapkan | Hasil | Catatan |
|---|---------|-----------------|-------|---------|
| S1 | Login sebagai superadmin | Semua lembaga dan kegiatan terlihat | | |
| S2 | Login sebagai operator | Hanya cakupan izin aktif yang terlihat | | |
| S3 | Buka `/prototype` | Superadmin dan operator masuk tanpa kata sandi | | |
| S4 | Buka `/prototype` sebagai pengguna biasa | Meminta kata sandi bila `PROTOTYPE_PASSWORD` diatur | | |
| S5 | Buka `/manual` | Tetap dapat diakses publik | | |

## Penutup

- Penguji: ______  Tanggal: ______  Versi: ______
- Jumlah butir lulus: ___ / gagal: ___
- Tiket bug yang dibuat: ______
