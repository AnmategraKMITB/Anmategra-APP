---
title: Pengaturan dan Status Oprec
order: 8
description: Mengubah jawaban setup, memperpanjang oprec, menutup pendaftaran, dan mengatur tim penilai.
---

# Pengaturan dan Status Oprec

Bagian **Pengaturan** memuat jawaban setup yang masih bisa diubah setelah oprec
dibuat: jadwal, syarat pendaftar, cara penilaian, tim penilai, penempatan, dan
hasil. Hanya pengelola oprec yang melihat bagian ini.

## Contoh kasus

**Pendaftar masih sedikit dan oprec perlu diperpanjang seminggu.** Buka
**Pengaturan**, lalu pada **Dasar dan jadwal** ubah tanggal berakhir gelombang
yang sedang berjalan, atau tambahkan gelombang baru. Klik **Simpan perubahan**.
Jika pendaftaran sudah ditutup, klik **Buka lagi pendaftaran** di bagian atas
halaman.

## Mengubah status oprec

Status oprec dan tombol untuk mengubahnya tampil di bagian atas setiap halaman
oprec, di sebelah tombol **Formulir**.

| Status saat ini | Tombol                    | Akibatnya                                                       |
| --------------- | ------------------------- | --------------------------------------------------------------- |
| **Draf**        | **Buka pendaftaran**      | Formulir terbit dan menerima pendaftaran.                       |
| **Dibuka**      | **Tutup pendaftaran**     | Formulir berhenti menerima jawaban.                             |
| **Ditutup**     | **Buka lagi pendaftaran** | Formulir kembali menerima jawaban, misalnya untuk perpanjangan. |

Menutup dan membuka lagi pendaftaran meminta konfirmasi lebih dulu. Oprec yang
sudah punya pendaftar tidak bisa kembali ke **Draf**.

## Kapan berkas bisa dinilai

Bagian **Nilai** baru bisa diisi setelah:

- gelombang pendaftar itu berakhir, untuk oprec bergelombang;
- pendaftaran ditutup, untuk oprec tanpa gelombang dan untuk pendaftar yang
  masuk sebelum gelombang dibuat; atau
- **Buka penilaian sebelum pendaftaran ditutup** dinyalakan di Pengaturan.

Nyalakan pilihan terakhir bila penilai perlu mulai bekerja selagi pendaftaran
masih berjalan.

## Mengubah pengaturan

1. Buka oprec, lalu pilih bagian **Pengaturan**.
2. Ubah isian yang diperlukan. Pertanyaannya sama dengan pertanyaan setup.
3. Klik **Simpan perubahan** di bagian bawah layar, atau **Batalkan** untuk
   kembali ke isian tersimpan.

Pengaturan dikelompokkan menjadi:

- **Status dan penilaian** — penilaian lebih awal.
- **Dasar dan jadwal** — nama oprec dan gelombang.
- **Pendaftar dan pilihan** — syarat pendaftar, jumlah pilihan, dan daftar
  divisi yang dibuka.
- **Penilaian** — cara memutuskan, metode status, nilai minimum atau ambang,
  sumber nilai dan bobotnya, jumlah penilai minimum per berkas, siapa penilai,
  syarat gugur, hak veto ketua, dan penyembunyian identitas pendaftar.
- **Tim penilai** — ketua divisi dari organogram dan penilai tambahan.
- **Penempatan dan hasil** — penempatan bertahap, visibilitas antar divisi,
  akses menu Hasil, rilis hasil ke pendaftar, dan closerec.

> [!WARNING]
> Mengubah cara status ditentukan (metode, nilai minimum, sumber nilai, bobot,
> atau jumlah penilai minimum) menghitung ulang skor dan status otomatis semua
> pendaftar. Keputusan penempatan yang sudah dibuat tidak ikut berubah.

## Yang tidak bisa diubah di sini

- **Jumlah pilihan** dikunci begitu ada pendaftar, supaya pilihan yang sudah
  dikirim tetap sah.
- **Gelombang yang sudah punya pendaftar** tidak bisa dihapus. Tanggalnya tetap
  bisa diubah.
- **Kuota** diatur pada jabatan di organogram. Lihat
  [Menyusun organogram](/manual/organogram/menyusun-organogram).
- **Kriteria penilaian** diatur di tab **Penilaian** pada formulir. Lihat
  [Formulir dan kriteria penilaian](/manual/oprec/formulir-dan-kriteria).
- **Penempatan di luar pilihan** ditentukan saat setup, karena ikut membentuk
  pertanyaan di formulir.

## Mengatur tim penilai

Ketua divisi ikut menilai divisinya, kecuali oprec hanya memakai penilai umum.
Untuk menambah penilai lain:

1. Pada **Tim penilai**, isi **Email atau NIM** penilai.
2. Pilih apa yang dinilainya: **Penilaian umum** atau satu divisi.
3. Klik **Tambah penilai**.

Penilai masuk dengan akunnya sendiri, sehingga setiap skor tercatat atas
namanya. Nilai yang sudah diisi tetap tersimpan meski penilainya dihapus.
