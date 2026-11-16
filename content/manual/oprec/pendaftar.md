---
title: Memantau Pendaftar
order: 4
description: Melihat ringkasan, menyaring, dan membuka berkas pendaftar oprec.
---

# Memantau Pendaftar

Bagian **Pendaftar** menampilkan semua orang yang sudah mengirim formulir oprec.
Bagian ini hanya tersedia untuk pengelola oprec.

## Contoh kasus

**Pendaftaran sudah berjalan tiga hari dan Anda ingin tahu divisi mana yang
sepi peminat.** Buka **Pendaftar** dan lihat ringkasan **Per pilihan**. Batang
tiap divisi menunjukkan jumlah peminatnya dibandingkan kuota, sehingga Anda tahu
divisi mana yang perlu dipromosikan lagi.

## Coba di sini

::demo[oprec-pendaftar]

## Membaca ringkasan

Bagian atas halaman menampilkan:

- **Total pendaftar** dan pembagiannya **per gelombang**;
- **Progres penilaian**, yaitu berapa berkas yang sudah selesai dinilai; dan
- **Per pilihan**, yaitu jumlah pendaftar yang memilih tiap divisi.

Klik batang sebuah divisi untuk menyaring tabel ke pendaftar yang memilih
divisi itu di pilihan mana pun. Klik lagi untuk menghapus saringannya.

## Menyaring dan mengurutkan

Gunakan baris **Saringan pendaftar**:

- **Cari nama atau NIM** untuk menemukan satu orang;
- **Tujuan** untuk satu divisi;
- **Status pilihan** untuk **Lolos**, **Tidak lolos**, **Perlu ditinjau**,
  **Belum lengkap**, atau **Gugur**;
- **Syarat umum** untuk melihat siapa yang memenuhi kriteria gugur;
- **Flag** untuk label yang diberikan penilai;
- **Kelompokkan** berdasarkan gelombang, angkatan, atau program studi; dan
- **Urutkan** berdasarkan nama atau waktu kirim.

## Membuka berkas

1. Klik baris pendaftar.
2. Panel **Berkas pendaftar** terbuka dan menampilkan identitas, gelombang, dan
   kesediaan dipindahkan.
3. Periksa **Pilihan dan status** untuk melihat skor dan status tiap pilihan.
4. Gulir ke bawah untuk membaca jawaban formulir dan flag.
5. Klik **Tutup**.

## Arti status pilihan

| Status             | Artinya                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| **Belum lengkap**  | Belum cukup penilai yang memberi skor.                                   |
| **Lolos**          | Nilainya memenuhi metode status oprec, misalnya masuk peringkat kuota.   |
| **Tidak lolos**    | Nilainya tidak memenuhi metode status.                                   |
| **Perlu ditinjau** | Ada kriteria yang ditandai perlu ditinjau, atau nilainya berubah setelah statusnya diubah manual. |
| **Gugur**          | Tidak memenuhi kriteria gugur.                                           |

Status dengan keterangan **diubah manual** ditetapkan oleh pengambil keputusan,
bukan dari hitungan nilai.

## Mengekspor data

Klik **Ekspor CSV** atau **Ekspor XLSX** untuk mengunduh daftar pendaftar.

> [!NOTE]
> Status di halaman ini adalah hasil penilaian, bukan keputusan akhir.
> Keputusan terima atau tolak dibuat di [Penempatan](/manual/oprec/penempatan).

Lanjutkan ke [Menilai berkas](/manual/oprec/menilai).
