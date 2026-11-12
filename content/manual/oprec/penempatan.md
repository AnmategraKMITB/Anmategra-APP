---
title: Penempatan
order: 6
description: Memutuskan penerimaan per divisi, masa banding, closerec, dan penetapan final.
---

# Penempatan

Bagian **Penempatan** adalah tempat keputusan dibuat: siapa diterima di divisi
mana. Di sini Anda juga memantau kuota, menangani banding, dan menetapkan
penempatan menjadi final.

## Contoh kasus

**Divisi Acara punya kuota 2, tetapi ada tiga pendaftar yang layak.** Terima dua
teratas lebih dulu. Jika ketua divisi tetap ingin menerima yang ketiga,
Anmategra meminta konfirmasi karena kuota sudah terisi, lalu mencatat penerimaan
itu sebagai di atas kuota untuk ditinjau.

**Seorang pendaftar ditolak di pilihan pertamanya, lalu divisi itu berubah
pikiran.** Masuk ke masa banding, lalu gunakan **Terima lewat banding** dan
tuliskan alasannya.

## Coba di sini

::demo[oprec-penempatan]

## Memutuskan pendaftar

1. Buka oprec, lalu pilih bagian **Penempatan**.
2. Pilih **Divisi**.
3. Periksa **Skor & status** dan urutan **Pilihan** tiap pendaftar.
4. Klik **Terima** atau **Tolak** pada kolom **Tindakan**.

Kolom **Keputusan** berubah menjadi **Diterima** atau **Ditolak**. Pendaftar
yang belum diputuskan berstatus **Menunggu**. Pendaftar yang diterima langsung
menempati jabatan tujuan di organogram.

### Mengisi keputusan dari penilaian

Agar tidak memutuskan satu per satu:

1. Klik **Isi dari penilaian**.
2. Periksa pratinjau: berapa yang akan diterima, ditolak, dan dilewati di tiap
   divisi, serta sisa kuotanya.
3. Jika ada yang melebihi kuota, pilih **Tolak yang melebihi kuota** atau
   **Tetap masukkan semuanya**.
4. Klik **Terapkan**.

Hanya pendaftar yang belum diputuskan yang diisi. Keputusan yang sudah ada tidak
ditimpa.

### Jika kuota sudah terisi

Saat Anda menerima pendaftar di divisi yang kuotanya penuh, dialog **Kuota
divisi sudah terisi** muncul. Klik **Tetap terima** untuk melanjutkan.
Penerimaan di atas kuota tercatat dan ditandai untuk ditinjau.

### Penempatan bertahap

Jika oprec diatur bertahap per pilihan, pilihan 1 diproses lebih dulu. Pilihan 2
dan 3 seorang pendaftar berstatus **menunggu pilihan sebelumnya** sampai
pilihan di atasnya diputuskan. Pendaftar yang sudah diterima di satu divisi
ditandai **sudah diterima di pilihan lain** pada divisi berikutnya.

## Keadaan penempatan

Penempatan bergerak melalui tiga keadaan:

| Keadaan          | Yang bisa dilakukan                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------ |
| **Berjalan**     | Keputusan masih bebas diubah.                                                              |
| **Masa banding** | Pendaftar yang ditolak bisa diterima lewat banding, dan divisi bisa meminta pindah.        |
| **Final**        | Semua perubahan dikunci.                                                                   |

1. Klik **Masuk masa banding** setelah keputusan awal selesai.
2. Tangani banding dan permintaan pindah.
3. Klik **Tetapkan final**, lalu **Lanjutkan**.

Anda dapat **Kembali ke berjalan** dari masa banding. Permintaan pindah yang
masih terbuka akan dibatalkan.

### Menerima lewat banding

1. Saat **Masa banding**, cari pendaftar yang berstatus **Ditolak**.
2. Klik **Terima lewat banding**.
3. Isi **Alasan**, lalu klik **Terima**.

### Meminta atau memindahkan pendaftar

Pendaftar yang sudah diterima di satu divisi dapat dipindahkan ke divisi lain.

- Pengelola oprec memakai **Pindahkan** dan memilih **Divisi tujuan**.
- Ketua divisi memakai **Kirim permintaan**. Permintaan muncul di kotak masuk
  divisi tujuan pada panel **Permintaan pindah**, lalu disetujui atau ditolak di
  sana.

Semua permintaan pindah harus selesai sebelum penempatan ditetapkan final. Bila
masih ada, pilih **Batalkan semua** atau **Setujui semua**.

## Closerec

Closerec menambahkan orang langsung ke divisi tanpa lewat pendaftaran. Jalur ini
hanya ada jika diaktifkan saat setup.

1. Buka panel **Closerec**, lalu klik **Tambah closerec**.
2. Isi **Email atau NIM** dan pilih divisi.
3. Tambahkan **Catatan** bila perlu, lalu klik **Tambah**.

Penempatan closerec tidak dihitung ke kuota. Gunakan **Cabut closerec** untuk
melepas orang itu dari divisinya.

## Visibilitas antar divisi

Pada panel **Visibilitas antar divisi**, pengelola mengatur apakah ketua divisi
boleh melihat nama yang sudah diterima divisi lain. Bawaan berlaku untuk semua
pasangan divisi, dan Anda dapat menambah **pengecualian per pasangan**. Ketua
divisi hanya bisa melihat nama, tanpa mengubah apa pun.

## Riwayat tindakan

Setiap baris pendaftar memiliki **Riwayat tindakan** yang mencatat siapa
memutuskan apa dan kapan, termasuk banding, pemindahan, dan closerec.

> [!WARNING]
> Setelah **Final**, keputusan tidak bisa diubah dari halaman ini. Periksa
> kuota dan permintaan pindah sebelum menetapkannya.

Lanjutkan ke [Hasil dan rilis](/manual/oprec/hasil).
