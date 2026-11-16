---
title: Pengaturan dan Ekspor
order: 2
description: Mengatur nama level, rank, kunci edit, serta mengekspor dan mengimpor organogram.
---

# Pengaturan dan Ekspor

Tab **Pengaturan** menyesuaikan organogram dengan istilah lembaga Anda. Halaman
ini juga menjelaskan tampilan tabel, ekspor, dan impor dari data lama.

## Contoh kasus

**Kabinet memakai istilah Kemenkoan dan Kementerian, bukan Bidang dan
Divisi.** Pilih skema **Kabinet KM** pada **Nama level**. Semua label di bagan
dan tombol tambah langsung mengikuti.

**Himpunan Anda memiliki Sekretaris dan Bendahara di bawah Ketua.** Tambahkan
keduanya sebagai rank baru, lalu atur urutannya di bawah Wakil.

## Coba di sini

::demo[organogram-pengaturan]

## Nama level

Nama level berlaku per kedalaman. Bagian baru memakai nama dari sini, dan tiap
bagian tetap bisa menimpanya lewat **Sebutan** di panel Detail.

1. Buka tab **Pengaturan**.
2. Pilih salah satu **Skema siap pakai**, atau ketik nama tiap level sendiri.
3. Gunakan **Tambah level** atau **Hapus level terakhir** untuk mengatur jumlah
   level.

| Skema               | Nama level                                   |
| ------------------- | -------------------------------------------- |
| **Kepanitiaan ITB** | Bidang, Divisi, Subdivisi                    |
| **Himpunan**        | Departemen, Divisi, Unit Kerja               |
| **Kabinet KM**      | Kemenkoan, Kementerian, Kedirjenan, Biro     |

Kolom yang dikosongkan memakai sebutan bawaan, yaitu **Bagian**.

## Rank jabatan

Rank menyatakan senioritas di dalam bagian, dari yang paling senior ke yang
paling junior. Rank bawaan adalah **Kepala**, **Wakil**, **Koordinator**, dan
**Staf**.

- Ganti nama rank langsung pada kolomnya.
- Gunakan **Lebih senior** dan **Lebih junior** untuk mengubah urutan.
- Klik **Tambah rank** untuk rank baru.
- Klik **Kembalikan rank bawaan** untuk kembali ke empat rank awal.

Rank yang masih dipakai jabatan tidak bisa dihapus.

## Kunci edit

Nyalakan **Kunci edit** agar anggota yang ditempatkan tidak bisa mengubah
organogram. Pemilik dan admin tidak terpengaruh. Hanya pemilik dan admin yang
dapat mengubah kunci.

## Tampilan tabel

Tab **Tabel** menampilkan semua jabatan beserta bagian, rank, jenis, kuota,
jumlah terisi, dan orangnya. Gunakan kolom **Cari jabatan, bagian, atau orang**
untuk menyaring.

- **Salin untuk Sheets** — menyalin tabel untuk ditempel ke spreadsheet.
- **Unduh Excel** dan **Unduh CSV** — mengunduh tabel sebagai berkas.

## Mengekspor bagan

1. Klik **Ekspor** pada editor.
2. Pilih **Format**: **PNG** atau **SVG**.
3. Atur **Sampai kedalaman** jika hanya ingin sebagian level.
4. Pilih isi bagan: **Tampilkan jabatan**, **Tampilkan nama orang**, dan
   **Sertakan judul**.
5. Atur **Ketajaman** untuk PNG, lalu periksa **Pratinjau**.
6. Klik **Unduh**.

## Menyembunyikan bagian dari bagan

Bagian atau jabatan tertentu dapat disembunyikan dari bagan tanpa dihapus.
Gunakan **Sembunyikan dari bagan** pada panel Struktur atau Detail, dan
**Tampilkan di bagan** untuk memunculkannya lagi.

## Mengimpor dari data lama

Jika periode itu sudah memiliki daftar anggota atau panitia dengan divisi dan
posisi berupa teks, Anmategra dapat mengusulkan struktur awalnya.

1. Pada organogram yang masih kosong, pilih **Impor dari data lama**.
2. Tinjau usulan bagian dan jabatan.
3. Perbaiki nama, gunakan **Gabung ke** untuk menyatukan ejaan yang sama, atau
   centang **Lewati** untuk yang tidak perlu.
4. Klik **Impor**.

Tidak ada yang tersimpan sebelum Anda menekan **Impor**. Organogram yang sudah
berisi tidak bisa diimpor.

> [!TIP]
> Atur nama level dan rank sebelum menambah banyak bagian. Label di bagan dan
> hasil ekspor akan langsung konsisten.

Lanjutkan ke [Alur oprec](/manual/oprec/alur-oprec) jika organogram ini akan
dipakai untuk rekrutmen.
