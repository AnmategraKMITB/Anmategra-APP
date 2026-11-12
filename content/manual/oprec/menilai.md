---
title: Menilai Berkas
order: 5
description: Memberi skor, memakai tampilan sheet, dan mengubah status secara manual.
---

# Menilai Berkas

Bagian **Nilai** adalah tempat penilai membaca jawaban pendaftar dan memberi
skor. Anda hanya melihat lingkup penilaian yang ditugaskan kepada Anda, misalnya
penilaian umum atau satu divisi.

## Contoh kasus

**Anda penilai Divisi Acara dan ada 30 berkas yang harus selesai malam ini.**
Buka **Nilai**, pilih lingkup **Divisi Acara**, lalu kerjakan antrean dari atas.
Gunakan papan ketik: `1`–`5` memberi skor, `Enter` lanjut ke kriteria
berikutnya, dan `J`/`K` pindah pendaftar.

## Coba di sini

::demo[oprec-nilai]

## Menilai per berkas

Penilai yang memakai akun mahasiswa membuka halaman ini lewat tautan yang
dibagikan pengelola oprec.

1. Buka oprec, lalu pilih bagian **Nilai**.
2. Pilih **Lingkup penilaian** jika Anda memiliki lebih dari satu.
3. Pastikan **Tampilan** berada di **Per berkas**.
4. Pilih pendaftar dari **Antrean penilaian**. Centang **Belum selesai** untuk
   hanya menampilkan yang belum Anda nilai.
5. Baca jawaban yang terkait dengan tiap kriteria.
6. Beri skor **1** (Kurang sekali) sampai **5** (Sangat baik) pada kriteria
   berjenis skor.
7. Pada kriteria **Gugur manual**, pilih **Memenuhi**, **Perlu ditinjau**, atau
   **Tidak memenuhi**.
8. Tambahkan **Catatan untuk kriteria ini** bila perlu.

Skor tersimpan otomatis. Tanda **Tersimpan** muncul setelah perubahan terakhir
berhasil disimpan.

## Menilai lewat sheet

Pilih tampilan **Sheet** untuk melihat semua pendaftar dan semua kriteria dalam
satu tabel. Tampilan ini cocok untuk membandingkan pendaftar atau mengisi skor
dengan cepat setelah wawancara.

## Bagaimana status dihitung

Skor tiap kriteria dikalikan bobotnya, lalu dijumlahkan menjadi nilai 0–100.
Status mengikuti **metode status** yang dipilih saat setup:

- **Peringkat dalam kuota** — yang teratas sebanyak kuota lolos.
- **Peringkat dalam kuota dengan nilai minimum** — yang teratas sebanyak kuota
  dan tidak di bawah nilai minimum lolos.
- **Ambang nilai** — nilai di atas ambang lolos.

Karena memakai peringkat, status seorang pendaftar dapat berubah ketika berkas
lain selesai dinilai.

## Memberi label (flag)

Gunakan **Label** untuk menandai berkas, misalnya "Prioritas" atau "Perlu
wawancara ulang".

1. Klik **Label** pada berkas.
2. Pilih label yang ada, atau klik **Buat label**.
3. Isi **Nama label** dan pilih **Warna label**.
4. Centang **Sensitif** jika label hanya boleh terlihat pengambil keputusan.
5. Klik **Buat dan pakai**.

## Mengubah status secara manual

Pengambil keputusan dapat menimpa status hasil hitungan.

1. Pada berkas, klik **Ubah status**.
2. Pilih **Status baru**.
3. Tuliskan alasan perubahan. Alasan wajib diisi.
4. Centang **Alasan sensitif** jika alasan hanya boleh terlihat pengambil
   keputusan.
5. Klik **Simpan**.

Status tersebut ditandai **diubah manual**. Klik **Kembalikan ke hitungan**
untuk memakai status hasil hitungan lagi.

> [!NOTE]
> Jika nilai bergeser setelah status diubah manual, berkas ditandai **perlu
> ditinjau ulang** agar keputusan itu diperiksa kembali.

Lanjutkan ke [Penempatan](/manual/oprec/penempatan).
