---
title: Konsol Admin
order: 1
description: Mengelola akun, lembaga, akses pengelola, dan jejak audit sebagai admin.
---

# Konsol Admin

Konsol admin tersedia untuk akun dengan peran **admin**. Dari sini admin
menangani laporan, mengelola akun dan lembaga, memberi akses pengelola, dan
memeriksa jejak tindakan.

## Menu admin

| Menu        | Yang dilakukan                                                                 |
| ----------- | ------------------------------------------------------------------------------ |
| **Laporan** | Menindaklanjuti laporan masalah dari mahasiswa dan lembaga.                    |
| **Akun**    | Mencari, membuat, dan mengubah akun mahasiswa atau lembaga.                    |
| **Lembaga** | Mengelola profil lembaga, kegiatan, kepengurusan, dan organogramnya.           |
| **Akses**   | Mengatur operator admin dan pengelola lembaga atau kegiatan.                   |
| **Audit**   | Membaca jejak tindakan: akun, lembaga, pemberian akses, dan izin operator.     |

## Contoh kasus

**Ketua pelaksana meminta wakilnya ikut mengelola oprec, tanpa memberi akun
lembaga.** Buka **Akses**, cari nama wakil itu, pilih kegiatannya, centang
fitur **OPREC**, lalu klik **Beri akses**. Wakil tersebut hanya bisa mengelola
oprec pada kegiatan itu.

## Coba di sini

::demo[admin-akses]

## Mengelola akun

1. Buka **Akun**.
2. Gunakan **Cari cepat akun** dengan nama, email, atau NIM, atau saring tabel
   berdasarkan role dan status.
3. Klik nama untuk membuka editor lengkap.
4. Ubah **Identitas akun** atau **Profil mahasiswa**, lalu simpan.

Halaman detail akun juga menampilkan **Afiliasi lembaga**, **Penempatan
organogram**, **Akses**, dan riwayat kepanitiaan.

Untuk membuat akun baru, klik **Tambah akun**. Akun lembaga baru otomatis
memiliki profil lembaga.

> [!IMPORTANT]
> Perubahan email atau role baru berlaku setelah pengguna itu login ulang.

## Mengelola lembaga

1. Buka **Lembaga**, lalu cari berdasarkan nama, singkatan, atau jenis.
2. Klik nama lembaga.
3. Ubah **Profil lembaga** atau **Blok profil lembaga** seperti visi dan misi.
4. Pada daftar **Kegiatan** dan **Kepengurusan**, tambah atau ubah periode.
5. Pada **Struktur organogram**, klik **Buka editor** untuk menyunting
   organogram lembaga itu.

## Memberi akses

Ada dua jenis akses:

- **Operator admin** — izin memakai sebagian konsol admin, misalnya hanya
  melihat akun atau mengubah laporan.
- **Pengelola lembaga/kegiatan** — izin mengelola fitur tertentu pada satu
  lembaga atau kegiatan.

Untuk memberi akses pengelola:

1. Buka **Akses**.
2. Cari penerima dengan nama, email, atau NIM.
3. Pilih lingkup: lembaga, atau periode/kegiatan tertentu.
4. Centang fitur yang diberikan: **OPREC**, **Formulir**,
   **Kegiatan/kepengurusan**, atau **Organogram**.
5. Jika perlu, isi **Berlaku sampai** dan centang **Berlaku juga untuk lembaga
   turunan**.
6. Klik **Beri akses**.

Akses yang sedang berlaku tampil pada tabel **Akses aktif** dan dapat dicabut
kapan saja.

## Membaca audit

Buka **Audit** untuk melihat siapa melakukan apa dan kapan. Gunakan kolom
**Cari ringkasan atau aksi** untuk menemukan tindakan tertentu.

> [!NOTE]
> Beri akses sesempit yang dibutuhkan. Akses per fitur dan per kegiatan lebih
> aman daripada membagikan akun lembaga.
