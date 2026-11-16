---
title: Hasil dan Rilis
order: 7
description: Melihat status akhir, merilis hasil ke pendaftar, dan mengekspor data.
---

# Hasil dan Rilis

Bagian **Hasil** merangkum status akhir setiap pendaftar setelah penempatan.
Dari sini Anda merilis hasil sehingga pendaftar dapat melihatnya di Anmategra.

## Contoh kasus

**Pengumuman dijadwalkan pukul 19.00.** Tetapkan penempatan final sore harinya,
periksa rekap tiap divisi, lalu klik **Rilis hasil ke pendaftar** tepat pada
waktunya. Pendaftar membuka kembali tautan formulirnya dan langsung melihat
diterima di divisi mana.

**Ternyata ada satu nama yang salah divisi.** Klik **Tarik rilis**, isi
alasannya, perbaiki di Penempatan, lalu rilis ulang.

## Coba di sini

::demo[oprec-hasil]

## Membaca halaman Hasil

- **Keadaan hasil** menunjukkan keadaan penempatan (**Berjalan**, **Masa
  banding**, atau **Final**) dan apakah hasil **Sudah dirilis**.
- **Rekap per divisi** menunjukkan jumlah yang diterima dibandingkan kuota. Klik
  **Lihat nama diterima** untuk membuka daftarnya.
- **Tabel hasil** memuat **Status akhir** tiap pendaftar: **Diterima**, **Tidak
  diterima**, atau **Belum diputuskan**, serta divisi tempat ia diterima.

Gunakan **Cari nama atau NIM**, saringan divisi, dan **Status akhir** untuk
mempersempit tabel.

## Merilis hasil

1. Pastikan penempatan sudah **Final**. Jika belum, klik **Buka Penempatan**.
2. Klik **Rilis hasil ke pendaftar**.
3. Baca konfirmasinya, lalu klik **Rilis sekarang**.

Setelah dirilis, pendaftar hanya melihat diterima di divisi mana atau belum
diterima. Nilai, alasan, flag, dan catatan tidak ditampilkan.

Jika saat setup Anda memilih hasil **diumumkan sendiri**, tombol rilis tidak
tersedia dan hasil diumumkan di luar aplikasi.

## Menarik rilis

1. Klik **Tarik rilis**.
2. Isi **Alasan penarikan**. Alasan wajib diisi.
3. Konfirmasi.

Pendaftar tidak lagi melihat hasil sampai Anda merilisnya ulang.

## Mengekspor hasil

Klik **Ekspor CSV** atau **Ekspor XLSX**. Data yang diekspor tidak memuat
alasan, flag, atau catatan sensitif.

## Siapa yang bisa membuka Hasil

Akses menu **Hasil** ditentukan saat setup:

- **Admin oprec saja**;
- **Admin dan ketua divisi**; atau
- **Semua yang bisa mengatur oprec**.

> [!NOTE]
> Pendaftar yang diterima langsung menempati jabatan tujuan di organogram
> periode itu. Anda tidak perlu memasukkannya lagi satu per satu.

Lihat juga [Mendaftar oprec](/manual/mahasiswa/mendaftar-oprec) untuk tampilan
dari sisi pendaftar.
