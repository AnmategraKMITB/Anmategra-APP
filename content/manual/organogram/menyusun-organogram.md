---
title: Menyusun Organogram
order: 1
description: Membuat struktur bagian, menambah jabatan, dan menempatkan orang.
---

# Menyusun Organogram

Organogram adalah susunan bagian dan jabatan sebuah kepengurusan atau
kepanitiaan. Anda cukup menyusun strukturnya. Bagan digambar otomatis, tanpa
perlu mengatur posisi kotak satu per satu.

Setiap periode atau kegiatan memiliki satu organogram. Organogram juga menjadi
dasar [Oprec](/manual/oprec/alur-oprec): divisi yang dibuka dan kuotanya diambil
dari sini.

## Contoh kasus

**Kepanitiaan baru terbentuk dan strukturnya masih berubah-ubah.** Susun
bidang dan divisi di panel Struktur. Ketika sebuah divisi dipindah ke bidang
lain, seret saja di panel itu. Bagan menyusun ulang dirinya sendiri.

**Anda butuh gambar struktur untuk proposal.** Setelah struktur selesai, klik
**Ekspor** dan unduh bagannya sebagai PNG atau SVG. Lihat
[Pengaturan dan ekspor](/manual/organogram/pengaturan-dan-ekspor).

## Coba di sini

::demo[organogram-editor]

## Membuka organogram

1. Buka menu **Organogram** di sidebar.
2. Pilih periode atau kegiatan.
3. Jika organogram belum ada, klik **Buat organogram** untuk membuat kerangka
   kosong.

Untuk organogram kepengurusan lembaga, klik **Buat periode** lebih dulu pada
bagian **Organogram kepengurusan**.

## Mengenal editor

- **Struktur** (kiri) — pohon bagian. Di sini Anda menambah, mengganti nama,
  dan memindahkan bagian.
- **Bagan** (tengah) — gambar organogram yang tersusun otomatis.
- **Detail** (kanan) — isi bagian yang dipilih: nama, sebutan, deskripsi kerja,
  jabatan, dan orangnya.

Tab **Tabel** menampilkan semua jabatan dalam satu daftar, dan tab
**Pengaturan** mengatur nama level, rank, dan kunci edit.

## Menambah bagian

1. Pilih bagian induk di panel **Struktur**.
2. Klik **Tambah … di dalam …**. Nama tombol mengikuti level, misalnya
   **Tambah Divisi di dalam Operasional**.
3. Ketik nama bagian baru.

Kedalaman tidak dibatasi pada tiga level. Nama tiap level, misalnya Bidang,
Divisi, dan Subdivisi, dapat diubah di tab **Pengaturan**.

### Pintasan papan ketik

| Tombol                | Fungsi                         |
| --------------------- | ------------------------------ |
| `Enter`               | Tambah sejajar di bawah        |
| `Shift` + `Enter`     | Tambah di dalam                |
| `F2` atau klik dua kali | Ganti nama                   |
| `Alt` + `↑` `↓`       | Naik atau turun urutan         |
| `Alt` + `←` `→`       | Naik atau turun tingkat        |
| `Delete`              | Hapus                          |
| `Ctrl/Cmd` + `Z`      | Urungkan (dengan `Shift`: ulangi) |

## Menambah jabatan

1. Pilih bagian, lalu lihat panel **Detail**.
2. Pada bagian **Jabatan**, klik **Tambah**.
3. Isi nama jabatan.
4. Pilih **Rank**, misalnya Kepala, Wakil, Koordinator, atau Staf.
5. Pilih **Jenis**: **Struktural** atau **Nonstruktural**.
6. Isi **Kuota**, yaitu jumlah orang yang dapat mengisi jabatan itu.

Satu bagian dapat memiliki lebih dari satu jabatan. Jabatan dapat diseret untuk
mengubah urutan atau dipindahkan ke bagian lain.

## Menempatkan orang

1. Klik **Simpan** lebih dulu jika jabatannya baru dibuat.
2. Pada jabatan, ketik minimal dua huruf di kolom **Cari nama atau NIM**.
3. Pilih orangnya dari hasil pencarian.

Angka di samping jabatan menunjukkan jumlah terisi dibandingkan kuota,
misalnya `1/2`. Jika kuota sudah penuh, Anmategra meminta konfirmasi sebelum
menambahkan orang berikutnya.

## Menyimpan perubahan

Perubahan pada organogram **tidak** tersimpan otomatis. Tanda **Ada perubahan
belum disimpan** muncul sampai Anda klik **Simpan**. Gunakan **Urungkan** dan
**Ulangi** selama belum disimpan.

Jika orang lain menyimpan versi yang lebih baru saat Anda masih mengedit,
Anmategra menampilkan peringatan **Organogram sudah diubah orang lain**. Klik
**Muat ulang** untuk mengambil versi terbaru. Perubahan Anda yang belum
disimpan akan terbuang.

## Menghapus bagian

Pilih bagian, lalu gunakan **Zona Bahaya** di panel Detail. Menghapus bagian
juga menghapus sub-bagian beserta seluruh jabatannya. Penghapusan baru berlaku
setelah **Simpan** dan masih bisa diurungkan sebelum itu.

> [!WARNING]
> Bagian yang masih memiliki orang tidak bisa dihapus. Pindahkan atau
> keluarkan dulu orang yang ditempatkan di sana.

> [!NOTE]
> Di layar kecil organogram hanya bisa dilihat. Buka di laptop untuk
> mengubahnya.

Lanjutkan ke [Pengaturan dan ekspor](/manual/organogram/pengaturan-dan-ekspor).
