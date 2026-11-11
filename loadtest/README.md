# Load test

Mensimulasikan banyak mahasiswa yang login bersamaan saat open recruitment: membuka daftar
kegiatan, membuka halaman kegiatan, mengisi formulir, lalu mengirim lamaran.

Fitur oprec/formulir belum ada di aplikasi, jadi "mengirim lamaran" memakai mutation yang paling
mirip: `users.requestAssociation` (mahasiswa melamar ke kegiatan dengan divisi & posisi). Setiap
lamaran langsung ditarik lagi (`users.deleteRequestAssociation`) supaya database kembali seperti
semula dan iterasi berikutnya bisa melamar ulang. Semua lamaran uji memakai divisi `LOADTEST`.

Per iterasi, satu pengguna menjalankan:

1. `GET /mahasiswa/kegiatan` + query yang dipanggil browser (profil, daftar kegiatan)
2. `GET /mahasiswa/profile-kegiatan/[id]` + query (profil, status lamaran)
3. jeda "mengisi formulir"
4. kirim lamaran, cek status, tarik lagi

JS/CSS halaman diunduh sekali per pengguna, seperti browser dengan cache.

## Mode

| `MODE` | Mengisi formulir | Jeda antar-iterasi | Gambaran |
|---|---|---|---|
| `steady` | 30–90 dtk | 10–30 dtk | puncak oprec yang realistis |
| `deadline` | 5–15 dtk | 2–5 dtk | stres: semua orang submit terus-menerus menjelang tenggat |

Ambang lulus (gagal kalau terlampaui): error < 1%, p95 halaman < 2 dtk, p95 query & submit < 1 dtk.

## Menjalankan

**Jangan pernah diarahkan ke production.** Test ini menulis ke database dan membebani server.
Pakai staging: salinan aplikasi + database di server dengan spesifikasi yang sama.

1. Di staging (dari root repo, dengan `DATABASE_URL` dan `NEXTAUTH_SECRET` milik staging), buat
   sesi login untuk 600 mahasiswa yang sudah ada dan pilih 5 kegiatan:

   ```bash
   node loadtest/make-sessions.mjs 600 5
   ```

   Hasilnya `loadtest/.data/targets.json` (di-gitignore). Salin ke mesin yang menjalankan k6.

2. Jalankan k6 dari mesin lain (bukan server yang diuji, supaya tidak berebut CPU):

   ```bash
   docker run --rm --network host -v "$PWD/loadtest":/scripts -w /scripts \
     -e BASE_URL=https://staging.example -e USERS=600 -e MODE=steady \
     grafana/k6:2.3.0 run oprec-load.js
   ```

   Opsi lain: `RAMP` (default `2m`) dan `HOLD` (default `5m`).

3. Pantau CPU & memori server selama test (`htop`, `docker stats`).

4. Bersihkan sisa lamaran kalau test dihentikan di tengah jalan:

   ```sql
   delete from anmategra_association_request where division = 'LOADTEST';
   ```

   Lalu hapus `loadtest/.data/`.

## Hasil terakhir (November 2026)

Diuji di laptop dengan server (Next.js build production + Postgres 15 default) dipatok ke
2 core fisik / 4 thread, setara VPS 4 vCPU; k6 di core lain. Data: dump production, 5 kegiatan.
Versi aplikasi: Next 15.5 / React 19 (branch security upgrades), baris "teroptimasi" memakai
branch `perf/BE/request-overhead` (matcher middleware, dedup query halaman, cache sesi).

| Skenario | Setup server | Req/dtk | p95 halaman | p95 submit | Error |
|---|---|---|---|---|---|
| 600 `steady` | 1 proses `next start` | ~86 | 100 ms | 61 ms | 0% |
| 600 `deadline` | 1 proses | ~175 (mentok) | 7,8 dtk | 4,9 dtk | 0,09% |
| 600 `deadline` | 3 proses + nginx yang melayani `/_next/static` | ~277 | 2,1 dtk | 1,1 dtk | 0,02% |
| 1000 `deadline` | 1 proses | ~240 (mentok) | 12,1 dtk | 7,3 dtk | 0,21% (timeout) |
| 1000 `deadline` | 3 proses teroptimasi + nginx | ~345 | 5,1 dtk | 2,7 dtk | 0,00% |

Kapasitas per thread (satu jenis request terus-menerus):

| Request | Sebelum | Teroptimasi |
|---|---|---|
| File JS/CSS lewat Node.js | ~1.000/dtk | ~3.000/dtk |
| Query tRPC (profil + daftar kegiatan) | ~155/dtk | ~170/dtk |
| Halaman `/mahasiswa/kegiatan` | ~100/dtk | sama |
| Halaman detail kegiatan | ~55/dtk | ~66/dtk |

Kesimpulan:

- Puncak oprec realistis dengan 600 pengguna bersamaan cuma memakai sekitar setengah kapasitas
  **satu** proses Node.js.
- Satu proses `next start` hanya memakai ±1 core. Di bawah beban ekstrem, proses itu yang jadi
  leher botol, bukan database (Postgres maksimal ±55–65% satu core).
- Skenario `deadline` dengan 1000 pengguna menghasilkan ±13.400 lamaran dalam 6 menit (±36 per
  detik), jauh di atas oprec sungguhan. Dengan 3 proses + nginx, semuanya tetap terlayani tanpa
  error, hanya lebih lambat (p95 halaman 5 dtk).
- Untuk memakai seluruh 4 vCPU: jalankan 2–4 proses di belakang reverse proxy, dan biarkan proxy
  (atau CDN) yang melayani `/_next/static` dengan cache panjang.
- nginx di Docker: naikkan batas file descriptor (`worker_rlimit_nofile 65535;` dan
  `ulimits: nofile` 65535 di container). Batas bawaan 1024 habis di ±1000 koneksi dan nginx mulai
  membalas 500 / menolak koneksi.
