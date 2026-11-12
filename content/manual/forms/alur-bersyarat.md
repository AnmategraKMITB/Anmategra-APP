---
title: Pertanyaan Bersyarat
order: 2
description: Menampilkan pertanyaan hanya jika jawaban sebelumnya memenuhi syarat.
---

# Pertanyaan Bersyarat

Pertanyaan bersyarat hanya muncul jika jawaban pada pertanyaan sebelumnya
memenuhi aturan. Pengisi tetap berada di satu halaman: pertanyaan lanjutan
muncul begitu syaratnya terpenuhi.

## Contoh kasus

**Anda hanya ingin menanyakan pengalaman kepada yang pernah menjadi panitia.**
Pasang aturan pada pertanyaan pengalaman: tampil jika "Apakah Anda pernah
menjadi panitia?" **adalah** "Ya". Pengisi yang menjawab "Tidak" tidak
melihat pertanyaan itu dan tidak perlu mengisinya.

## Coba di sini

::demo[forms-kondisi]

## Memasang aturan

1. Pada tab **Konten**, buka pertanyaan yang ingin diberi syarat.
2. Klik **Tampil jika…**.
3. Pilih **Pertanyaan acuan**.
4. Pilih **Operator**, misalnya **adalah**, **bukan**, **salah satu dari**,
   atau **tidak kosong**.
5. Isi **Nilai** yang dibandingkan.

Ringkasan aturan tampil pada tombolnya, misalnya "Tampil jika Pernah menjadi
panitia adalah Ya". Klik **Hapus kondisi** untuk melepas aturan. Tanpa
aturan, pertanyaan selalu tampil.

## Lebih dari satu aturan

Anda dapat menambahkan beberapa aturan pada satu pertanyaan, lalu memilih
apakah pertanyaan tampil bila **semua aturan cocok** atau **salah satu aturan
cocok**.

## Yang perlu diketahui

- Aturan hanya dapat mengacu pada pertanyaan yang letaknya **lebih awal**.
  Pertanyaan pertama tidak memiliki acuan.
- Pertanyaan pilihan, teks, angka, skala, tanggal, dan kotak centang dapat
  dijadikan acuan.
- Pertanyaan wajib yang sedang tersembunyi **tidak menghalangi** pengiriman.
- Bagian dan ending juga dapat diberi syarat dengan cara yang sama.

## Melihat alur

Buka tab **Alur** untuk melihat form sebagai diagram. Garis putus-putus berarti
tampil bersyarat. Klik kotak untuk mengatur kondisinya, atau **Buka di Konten**
untuk berpindah ke pertanyaannya. Gunakan **Perkecil**, **Perbesar**, dan **Pas
ke layar** untuk mengatur tampilan diagram.

> [!TIP]
> Setelah memasang aturan, buka tab **Pratinjau** dan coba setiap jalur
> jawaban. Cara ini paling cepat untuk menemukan aturan yang keliru.

Lanjutkan ke [Menerbitkan dan membagikan](/manual/forms/menerbitkan-dan-membagikan).
