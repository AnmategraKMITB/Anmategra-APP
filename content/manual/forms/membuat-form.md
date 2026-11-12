---
title: Membuat Form
order: 1
description: Membuat form, menambah pertanyaan, dan menyusunnya menjadi beberapa bagian.
---

# Membuat Form

Menu **Forms** dipakai lembaga untuk mengumpulkan jawaban dari mahasiswa:
survei, pendataan, presensi, atau formulir pendaftaran. Pengisi masuk dengan
akun mahasiswanya, jadi nama dan NIM tercatat tanpa perlu ditanyakan.

## Contoh kasus

**Himpunan ingin mendata ukuran jaket angkatan.** Buat form dengan satu
pertanyaan **Dropdown** berisi ukuran dan satu **Teks pendek** untuk nama
punggung. Bagikan tautannya, lalu unduh hasilnya sebagai CSV.

**Kepanitiaan ingin survei minat sebelum rekrutmen.** Buat form dengan
pertanyaan lanjutan yang hanya muncul bagi yang pernah menjadi panitia. Lihat
[Pertanyaan bersyarat](/manual/forms/alur-bersyarat).

## Coba di sini

::demo[forms-builder]

## Membuat form baru

1. Buka menu **Forms** di sidebar.
2. Untuk form milik lembaga, klik **Buat form**. Untuk form milik satu
   kegiatan, pilih kegiatannya pada bagian **Form kegiatan** lebih dulu.
3. Isi **Judul** dan, jika perlu, **Deskripsi**.
4. Konfirmasi. Form baru berstatus **Draf** dan pembuat form langsung terbuka.

## Mengenal pembuat form

Pembuat form memiliki beberapa tab:

- **Konten** — menyusun pertanyaan, bagian, dan pesan penutup.
- **Alur** — melihat urutan dan percabangan pertanyaan sebagai diagram.
- **Penilaian** — menyusun kriteria penilaian. Hanya untuk formulir oprec.
- **Pratinjau** — mencoba form seperti yang dilihat pengisi.

Perubahan tersimpan otomatis. Tanda **Menyimpan…** berubah menjadi
**Tersimpan** setelah selesai. Gunakan **Urungkan** dan **Ulangi** untuk
membatalkan atau mengulang perubahan terakhir.

## Menambah pertanyaan

1. Pada tab **Konten**, klik **Tambah konten**.
2. Pilih jenis pertanyaan.
3. Tulis pertanyaannya. Tambahkan **Keterangan** atau **Ilustrasi** bila perlu.
4. Lengkapi pengaturan sesuai jenisnya, misalnya daftar pilihan.
5. Nyalakan tanda wajib jika pertanyaan harus dijawab.

| Jenis               | Dipakai untuk                                             |
| ------------------- | --------------------------------------------------------- |
| **Teks pendek**     | Jawaban satu baris. Bisa dibatasi format email, nomor HP, atau NIM. |
| **Teks panjang**    | Jawaban beberapa baris, misalnya alasan.                  |
| **Angka**           | Bilangan, dengan nilai minimal dan maksimal.              |
| **Tanggal**         | Memilih satu tanggal.                                     |
| **Pilihan tunggal** | Memilih satu dari beberapa pilihan.                       |
| **Dropdown**        | Pilihan tunggal dalam daftar turun.                       |
| **Pilihan ganda**   | Memilih beberapa pilihan, dengan batas minimal dan maksimal. |
| **Kotak centang**   | Persetujuan ya atau tidak.                                |
| **Matriks**         | Tabel pilihan untuk tiap baris.                           |
| **Skala**           | Penilaian dalam rentang angka, tampil sebagai angka atau bintang. |
| **Tautan**          | Alamat situs atau berkas.                                 |
| **Unggah berkas**   | Pengisi mengunggah berkas. Atur jenis, jumlah, dan ukuran maksimalnya. |
| **Blok teks**       | Penjelasan tanpa pertanyaan.                              |
| **Pilihan tujuan**  | Memilih divisi secara berurutan. Khusus formulir oprec.   |

## Mengatur urutan

Pada setiap kartu pertanyaan tersedia **Naikkan**, **Turunkan**,
**Duplikat**, **Pindahkan ke bagian**, dan **Hapus**. Anda juga dapat membuka
panel **Halaman** lalu menyeret pertanyaan ke posisi atau bagian lain.

## Membagi form menjadi bagian

Bagian membuat form panjang tampil halaman demi halaman.

1. Klik **Tambah bagian**.
2. Isi **Judul bagian** dan, jika perlu, **Deskripsi bagian**.
3. Tambahkan atau pindahkan pertanyaan ke dalamnya.

Saat menghapus bagian, pilih apakah pertanyaannya **dipindahkan ke bagian
lain** atau **dihapus beserta bagiannya**.

## Mengatur pesan penutup (ending)

Di bagian paling bawah tab **Konten** terdapat **Ending**, yaitu pesan yang
tampil setelah jawaban terkirim. Klik **Tambah ending** untuk membuat lebih dari
satu. Ending bersyarat dicek lebih dulu. Jika tidak ada yang cocok, pengisi
melihat ucapan terima kasih standar.

## Menghapus pertanyaan yang sudah dijawab

Pertanyaan yang sudah memiliki jawaban tidak benar-benar dihapus, tetapi
diarsipkan. Pertanyaan hilang dari form, sedangkan jawaban lama tetap tersimpan.

> [!WARNING]
> Tautan berkas yang diunggah pengisi dapat dibuka oleh siapa pun yang
> memilikinya. Jangan meminta dokumen pribadi yang tidak boleh tersebar.

Lanjutkan ke [Pertanyaan bersyarat](/manual/forms/alur-bersyarat) atau
[Menerbitkan dan membagikan](/manual/forms/menerbitkan-dan-membagikan).
