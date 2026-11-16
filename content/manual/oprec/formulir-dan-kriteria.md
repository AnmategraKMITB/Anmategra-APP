---
title: Formulir dan Kriteria Penilaian
order: 3
description: Melengkapi formulir oprec dan menyusun kriteria yang dinilai penilai.
---

# Formulir dan Kriteria Penilaian

Formulir oprec adalah form biasa yang terikat ke satu oprec. Karena itu
formulir ini memiliki dua hal tambahan: pertanyaan **Pilihan tujuan** dan tab
**Penilaian** untuk menyusun kriteria.

## Formulir oprec

Formulir yang dibuat dari templat oprec sudah berisi:

- satu pertanyaan **Pilihan tujuan**, tempat pendaftar memilih divisi secara
  berurutan;
- kotak **bersedia dipindahkan**, bila Anda mengizinkan penempatan di luar
  pilihan;
- kolom tautan untuk setiap lampiran wajib; dan
- satu bagian per divisi, bila Anda memilih pengelompokan per divisi.

Identitas pendaftar diambil dari akun Anmategra, jadi Anda tidak perlu
menanyakan nama dan NIM. Satu akun hanya dapat mengirim satu pendaftaran.

Untuk menambah atau mengubah pertanyaan, buka **Forms**, pilih formulir oprec,
lalu ikuti [Membuat form](/manual/forms/membuat-form).

### Bagian yang hanya tampil untuk pemilih divisi tertentu

1. Pada pembuat formulir, buka bagian yang ingin diatur.
2. Pilih satu atau lebih tujuan pada pengaturan bagian itu.
3. Klik **Simpan**.

Bagian tersebut hanya tampil bagi pendaftar yang memilih divisi itu. Kosongkan
pilihan tujuannya agar bagian **tampil bagi semua pendaftar**.

## Menyusun kriteria penilaian

Kriteria disusun per **slot**. Slot dibuat otomatis: satu slot **Umum** untuk
penilaian semua berkas dan satu slot untuk setiap divisi yang dibuka.

::demo[oprec-kriteria]

1. Buka formulir oprec, lalu pilih tab **Penilaian**.
2. Pilih slot di daftar **Slot penilaian**.
3. Klik **Tambah kriteria**.
4. Isi **Nama**, misalnya "Motivasi bergabung".
5. Pilih **Jenis**:
   - **Skor** — penilai memberi skor 1 sampai 5;
   - **Gugur otomatis** — pendaftar gugur bila jawabannya cocok dengan aturan;
     atau
   - **Gugur manual** — penilai menandai memenuhi atau tidak.
6. Untuk jenis **Skor**, isi **Bobot** dalam persen.
7. Pada **Pertanyaan terkait**, centang pertanyaan yang dinilai kriteria ini.
8. Klik **Simpan**.

Total bobot kriteria skor dalam satu slot sebaiknya 100%. Slot yang totalnya
belum 100% ditandai **Total bobot belum 100%**.

### Aturan gugur otomatis

Kriteria **Gugur otomatis** membutuhkan satu pertanyaan acuan, operator, dan
nilai. Contoh: pertanyaan "Bersedia mengikuti seluruh rangkaian?" **adalah**
"Tidak". Pendaftar yang menjawab demikian langsung berstatus
**Gugur** tanpa menunggu penilai.

### Tampilan Daftar dan Kanvas

Tab **Penilaian** memiliki dua tampilan:

- **Daftar** — kriteria per slot, seperti pada simulasi di atas.
- **Kanvas** — pertanyaan di kiri dan kriteria di kanan, dihubungkan dengan
  tali. Pilih satu kriteria, lalu klik pertanyaan untuk menyambung atau
  melepasnya.

### Ekspor dan impor lewat spreadsheet

Gunakan **Ekspor atau impor** untuk mengunduh kriteria atau pertanyaan sebagai
CSV, atau menempel kembali dari spreadsheet. Baris yang bermasalah dilewati saat
impor. Unduh **Templat kosong** jika ingin melihat bentuk kolomnya lebih dulu.

> [!WARNING]
> Perubahan kriteria menghitung ulang status semua pendaftar. Menghapus
> kriteria juga menghapus penilaian yang sudah masuk untuk kriteria itu.

Lanjutkan ke [Memantau pendaftar](/manual/oprec/pendaftar).
