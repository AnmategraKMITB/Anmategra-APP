# Riset: data pendaftar dan aturan privasi kontak untuk pengumuman hasil oprec

Tiket: [#478](https://github.com/AnmategraKMITB/Anmategra-APP/issues/478), peta [#475](https://github.com/AnmategraKMITB/Anmategra-APP/issues/475).
Sumber kode: cabang `develop`, komit `c4af7e4` (klon dangkal). Semua rujukan `berkas:baris` mengacu pada komit itu.

Catatan konvensi: repositori belum memiliki direktori `research/`. Catatan riset terdekat berada di `docs/` (`docs/qa-checklist.md`, `docs/api/`), dan tiket #478 meminta hasil berupa komentar. Berkas ini sengaja memakai jalur `research/pengumuman-privasi.md` sesuai perintah tugas. Menurut isi tiket, cabang `research/*` hanya arsip dan tidak dimerge. Dokumen ini hanya memuat temuan, opsi, dan celah; tidak ada keputusan.

## 1. Ringkasan

1. **Tabel `mahasiswa` menyimpan identitas dan kontak; tidak ada tabel pendaftar yang menyalin data itu.** NIM, prodi (`jurusan`), angkatan, nama salinan, ID LINE, dan WhatsApp berada di `mahasiswa` (`src/server/db/schema.ts:245-265`); email dan nama akun berada di `users` (`schema.ts:45-63`). Pendaftar oprec hanya menaut ke akun lewat `application.userId` (`schema.ts:2322-2364`). Jawaban formulir bebas berada di `form_answer.value` (JSONB, `schema.ts:1889-1915`) dan isinya tidak dapat ditentukan dari skema.
2. **`canViewContact` sudah diterapkan sesuai keputusan #310, dengan tiga selisih kecil.** Penentuannya per bidang (WhatsApp, LINE, email) dan per penonton (`src/server/api/contact.ts:222-248`). Selisih: (a) kode memakai empat titik panggil di `rapor.ts`, bukan lima; (b) cakupan pelibatan memasukkan panitia kegiatan yang belum `Ended` dan membaca `placement`, bukan `keanggotaan`/`kehimpunan`; (c) Operator hanya lolos lewat izin `accounts.read`. Lihat bagian 3.
3. **Nama, NIM, prodi, dan foto mahasiswa tidak dikendalikan toggle `show_*`.** Semua pengguna yang login (peran apa pun, termasuk akun `lembaga`) dapat melihat daftar anggota/panitia beserta nama, NIM, dan jurusan, serta mencari mahasiswa berdasarkan nama atau NIM. Hanya `hidden_at` yang menyaring sebagian jalur, dan sebagian jalur tidak menyaringnya.
4. **Tidak ada halaman publik tanpa login yang menampilkan nama mahasiswa.** Halaman `/profile-kegiatan/[id]` memang memuat komponen daftar anggota, tetapi diberi `anggota={[]}` (`src/app/(public)/profile-kegiatan/[profileKegiatanId]/page.tsx:194-199`). Satu-satunya jalur yang mungkin memuat nama adalah gambar organogram unggahan (`page.tsx:164-175`); isi gambarnya tidak dapat diperiksa dari kode.
5. **Tidak ada pembatasan laju atau perlindungan pengambilan massal pada rute publik maupun tRPC.** Pembatas yang ada hanya untuk login demo (`src/server/demo-auth.ts:35-44`, di memori satu proses) dan klaim akses alternatif (`src/server/alt-login.ts:33-34`, berbasis basis data). Rute `/api` dikecualikan dari middleware (`src/middleware.ts:7-8,177-181`). Berkas yang berperan sebagai middleware bernama `src/middleware.ts`; tidak ada `proxy.ts`.

## 2. Jawaban per pertanyaan

### Pertanyaan 1. Data per pendaftar dan per mahasiswa, dan tabelnya

Keputusan tercatat: #299 (pembaruan cakupan) dan #310 menetapkan tiga kolom `show_whatsapp`, `show_line`, `show_email` pada `mahasiswa`. Kondisi kode: kolom itu ada (`schema.ts:260-262`, bawaan `false`).

| Data | Tabel dan kolom | Rujukan |
|---|---|---|
| Nama akun | `users.name` | `schema.ts:50` |
| Email akun | `users.email` (wajib, unik) | `schema.ts:51` |
| Foto | `users.image` | `schema.ts:56` |
| Peran akun | `users.role` (`admin`, `lembaga`, `mahasiswa`) | `schema.ts:43,57` |
| Penyembunyian akun | `users.hidden_at` | `schema.ts:60-61` |
| Nama (salinan untuk kinerja) | `mahasiswa.nama` | `schema.ts:251` |
| NIM, NIM TPB | `mahasiswa.nim`, `mahasiswa.nim_tpb` | `schema.ts:249-250` |
| Prodi | `mahasiswa.jurusan` | `schema.ts:252` |
| Angkatan | `mahasiswa.angkatan` | `schema.ts:253` |
| ID LINE, WhatsApp | `mahasiswa.line_id`, `mahasiswa.whatsapp` | `schema.ts:254-255` |
| Toggle kontak | `mahasiswa.show_whatsapp`, `show_line`, `show_email` | `schema.ts:260-262` |
| Toggle rapor | `mahasiswa.rapor_visible` | `schema.ts:256` |
| Status aktif/alumni | `mahasiswa.status` | `schema.ts:263` |
| NIM alumni belum punya akun | `alumni_pending.nim`, `wisuda_batch` | `schema.ts:269-286` |
| Pendaftar oprec | `application` (`recruitment_id`, `user_id`, `wave_id`, `form_submission_id`, `source`, `willing_to_move`, `submitted_at`) | `schema.ts:2322-2364` |
| Pilihan divisi pendaftar | `application_choice` (`division_id`, `rank`, `origin`, `score`, `computed_status`) | `schema.ts:2366-2399` |
| Jawaban formulir | `form_submission` dan `form_answer.value` (JSONB, label bidang disalin saat kirim) | `schema.ts:1850-1882`, `1889-1915` |
| Rilis hasil | `recruitment.results_released_at`, `results_visible_to_applicants` | `schema.ts:2083-2089` |
| Penempatan | `placement` (`position_id`, `user_id`, `source`, `application_choice_id`) | `schema.ts:961-989` |
| Keanggotaan lembaga | `lembaga_membership` (`status`, `joined_at`, `ended_at`) | `schema.ts:714-735` |
| Keanggotaan lama | `keanggotaan` (`position`, `division` sebagai teks) | `schema.ts:431-453` |
| Klaim akses alternatif | `alt_login_claim` (`nim`, `contact_email`, `ktm`, `ip`) | `schema.ts:71-94` |

Observasi:
- Tidak ada kolom kontak khusus pendaftar; kontak pendaftar sama dengan kontak mahasiswa.
- Email tidak memiliki toggle terpisah selain `show_email`, dan nilainya diambil dari `users.email` (`src/server/api/mahasiswa-profile.ts:94`), bukan dari kolom `mahasiswa`.
- Bidang kontak lain (kontak selain WhatsApp, LINE, email) belum ada, selaras dengan #310 ("ditambahkan hanya saat bidangnya ada").
- Ekspor hasil dan daftar hasil oprec memuat nama, NIM, prodi, angkatan; tidak memuat kontak (`src/server/api/routers/oprec/results.ts:408-417`). Pencarian kontak di `oprec/*` tidak ditemukan (`grep` untuk `lineId`/`whatsapp` pada direktori itu kosong).

### Pertanyaan 2. Cara kerja `canViewContact` dan `show_*`

**Keputusan yang tercatat (rujukan apa adanya)**
- #307 dan #299: toggle terpisah per bidang; bawaan tersembunyi dari mahasiswa lain; selalu terlihat oleh Owner dan Admin pengelola lembaga/kegiatan tempat mahasiswa menjadi anggota, serta Superadmin dan Operator; pengguna tidak dapat menyembunyikan akunnya sendiri, hanya Superadmin dan Operator yang dapat memberi `hiddenAt`; akun tersembunyi tidak tampil bagi non-admin; `getMahasiswaByNim` hanya mengembalikan nama, NIM, jurusan, angkatan, foto, dan status.
- #310: tiga kolom boolean; pengelola melihat anggota aktif serta pelamar oprec dan pengaju asosiasi yang diproses, bukan anggota `keluar` dan alumni; satu fungsi `canViewContact(viewer, targetUserId, bidang)` sebagai satu-satunya penentu, dipakai oleh `getMahasiswaById`, `profile.getMahasiswa`, dan lima prosedur di `rapor.ts`; bidang tidak berhak dihilangkan dari respons; pemilik akun, Superadmin, dan Operator dengan `accounts.read` selalu lolos; email tampil hanya bila `show_email` aktif atau penonton berhak.
- Status #313: peta ditutup dan dilanjutkan di #434; #299 selesai lewat PR #325 (catatan status pelaksanaan pada tubuh #313).

**Kondisi kode saat ini**
- Penentu: `contactAccess` (`contact.ts:223-239`) menghitung tiga bidang sekaligus; `canViewContact` hanya membaca satu bidang (`contact.ts:241-248`). Penentuannya per bidang untuk toggle, tetapi akses penuh (`full`) berlaku untuk seluruh bidang sekaligus per akun target (`contact.ts:231-233`).
- Urutan keputusan: bila ketiga toggle aktif, tidak ada kueri izin (`contact.ts:228-229`); selain itu `hasFullContactAccess` (`contact.ts:213-220`) memeriksa (1) pemilik akun, Superadmin (`role === 'admin'`), atau Operator berizin `accounts.read` (`contact.ts:203-211`), lalu (2) Owner/Admin pelibat (`managesInvolvement`, `contact.ts:145-197`).
- Cakupan pelibatan (`involvedScopes`, `contact.ts:69-142`): anggota `aktif` di `lembaga_membership` (`contact.ts:72-80`); penempatan pada struktur aktif kegiatan yang statusnya bukan `Ended` (`contact.ts:81-100`); pengaju asosiasi kegiatan dan lembaga berstatus `Pending` (`contact.ts:101-118`); pelamar oprec yang oprec-nya bukan `draft` dan `placement_state` bukan `final` (`contact.ts:119-129`).
- Pengelola: `canManageLembaga` dan `canManageEvent` dengan fitur bawaan `admin` (`contact.ts:172-178,185-191`; `src/server/api/access.ts:67-117,124-`). Owner lewat jalur cepat (`contact.ts:162-167`). Hibah dengan fitur `oprec`, `forms`, atau `organization` saja tidak memenuhi `hasFeature('admin')` untuk fitur `admin` (`access.ts:36-37`), sehingga Manager tidak melihat kontak. Operator dengan izin `lembaga.*` tidak lolos jalur ini karena `ADMIN_SCOPE_PERMISSION` tidak memetakan fitur `admin` (`access.ts:42-47,54-55`); Operator lolos hanya lewat `accounts.read`.
- Penyaringan akun tersembunyi: `loadMahasiswaProfile` mengembalikan `null` bila `hidden_at` terisi dan penonton bukan pemilik/Superadmin/Operator `accounts.read` (`mahasiswa-profile.ts:75-80`).
- Titik pemakaian: `profile.getMahasiswa` (`src/server/api/routers/profile.ts:37-51`), `users.getMahasiswaById` dan `users.getMahasiswaByNim` (`src/server/api/routers/user.ts:565-599`), serta `visibleContactFields` pada empat titik di `rapor.ts` (`rapor.ts:238,456,627,733`; definisi `rapor.ts:40-62`). Dua titik terakhir berada di prosedur `*Public` yang berstatus `protectedProcedure` (`rapor.ts:532,643`).
- Pengubahan toggle: hanya pemilik akun berperan `mahasiswa` lewat `editProfilMahasiswa` (`user.ts:251-273`) dan dialog profil (`src/app/_components/profile-mahasiswa/edit-profile-dialog.tsx:47-49`).
- Pengujian: `src/server/api/contact.test.ts`, `src/server/api/mahasiswa-profile.test.ts`.

**Selisih keputusan dan kode**
- #310 menyebut lima prosedur di `rapor.ts`; kode memiliki empat titik panggil `visibleContactFields`.
- #310 menyebut anggota aktif pada `lembaga_membership`/`keanggotaan`/`kehimpunan`; `contact.ts` membaca `lembaga_membership` dan `placement`, tidak membaca `keanggotaan` maupun `kehimpunan` (impor `contact.ts:4-16`). Tabel `keanggotaan` masih ada (`schema.ts:431`).
- Kode menambahkan panitia kegiatan yang belum `Ended` sebagai pelibatan (`contact.ts:100`); #310 tidak menyebutnya secara eksplisit.
- #307 menyebut `getMahasiswaByNim` hanya mengembalikan nama, NIM, jurusan, angkatan, foto, dan status. Kode mengembalikan juga `raporVisible`, tiga `show*`, serta `lineId`, `whatsapp`, dan `email` yang bernilai `null` bila tidak berhak (`mahasiswa-profile.ts:89-109`).

### Pertanyaan 3. Halaman publik atau semi-publik dengan nama mahasiswa

**Publik tanpa login (prosedur `publicProcedure`, `trpc.ts:242-244`)**

| Halaman atau prosedur | Data tampil | Rujukan |
|---|---|---|
| `/profile-lembaga/[id]` (`profile.getLembagaPublic`) | nama, akronim, deskripsi, jumlah anggota, tanggal, tipe, foto akun lembaga, daftar kegiatan; tanpa nama mahasiswa | `profile.ts:286-356`; halaman `src/app/(public)/profile-lembaga/[lembagaId]/page.tsx:30-32` |
| `/profile-kegiatan/[id]` (`profile.getKegiatanPublic`) | data kegiatan, lembaga, tautan pendaftaran; tanpa daftar peserta | `profile.ts:358-408`; halaman `.../profile-kegiatan/[profileKegiatanId]/page.tsx:22-24` |
| Daftar anggota pada halaman kegiatan publik | kosong: `anggota={[]}` | `.../page.tsx:194-199` |
| Organogram kegiatan publik | gambar unggahan (`organogram_image`) dalam dialog | `.../page.tsx:164-175`; `src/app/_components/profile-kegiatan/organogram-dialog.tsx:19-57` |
| Daftar dan landing | kegiatan dan lembaga saja | `landing.ts:41,95,241,529,551`; `kegiatan.ts:24,37`; `profil.ts:12` |
| Sitemap | ID kegiatan dan lembaga | `src/app/sitemap.ts:23-43` |
| Manual, slides, halaman legal | konten statis | `middleware.ts:29-36` |

Nama mahasiswa tidak muncul pada prosedur publik di atas. Isi gambar organogram tidak dapat diverifikasi dari kode.

**Semi-publik (harus login, peran apa pun)**

| Prosedur | Data tampil | Penyaring `hidden_at` | Rujukan |
|---|---|---|---|
| `profile.getKegiatan` (`protectedProcedure`) | semua panitia: nama, NIM, jurusan, foto, posisi, divisi | tidak ada | `profile.ts:201-276` |
| `profile.getLembaga` | semua anggota lembaga: nama, NIM, jurusan, posisi, divisi | tidak ada | `profile.ts:96-195` (kolom pada baris 165-168, 185-187) |
| `users.getAnggotaById`, `getPanitiaById`, `getPanitiaByName` | nama, NIM, divisi, posisi per orang | tidak ada | `user.ts:601-747` |
| `users.searchMahasiswa` | nama dan NIM; pencarian atas nama atau NIM; tanpa anggota yang sudah masuk | ada | `user.ts:186-246` (filter `user.ts:233`) |
| `landing.searchAll` | nama, NIM, jurusan, foto; maksimum 10 per kueri | ada | `landing.ts:297-335` (filter `landing.ts:322`) |
| `profile.getMahasiswa`, `users.getMahasiswaById/ByNim` | profil lengkap sesuai aturan kontak; NIM, jurusan, angkatan, status selalu tampil | ada (hasilnya `NOT_FOUND`) | bagian 2, pertanyaan 2 |
| Sidebar profil | `getMahasiswaById` untuk pengguna sendiri | ada | `src/app/_components/layout/sidebar.tsx:164` |

Siapa yang boleh: setiap sesi yang valid. Prosedur ini tidak membedakan peran `mahasiswa`, `lembaga`, atau `admin` (`trpc.ts:254-267`). Tata letak `/mahasiswa` dan `/lembaga` mengalihkan peran lain (`src/app/mahasiswa/layout.tsx:9-11`; `src/app/lembaga/layout.tsx:19-20`), tetapi pengalihan itu tidak membatasi pemanggilan tRPC langsung.

Organogram dan alumni: editor organogram berada di rute login (`src/app/manage/kegiatan/[kegiatanId]/organogram/page.tsx`, `src/app/mahasiswa/kegiatan/[kegiatanId]/organogram/page.tsx`); halaman alumni hanya ada di `/admin/alumni` (`src/app/admin/alumni/page.tsx`). Tidak ditemukan halaman alumni publik atau semi-publik.

### Pertanyaan 4. Rute publik di middleware dan pelindung pengambilan massal

**Penanganan rute** (`src/middleware.ts`; tidak ada `proxy.ts`):
- Lewat tanpa pemeriksaan: `/_next`, `/api`, `/images`, `/favicon.ico`, `/manifest.json`, `/robots.txt`, `/sitemap.xml`, `/msal-redirect` (`middleware.ts:6-17,52-54`); `matcher` juga mengecualikannya (`middleware.ts:177-181`). Akibatnya `/api/trpc` tidak melewati middleware; pemeriksaan sesi dilakukan di prosedur tRPC (`trpc.ts:242-267`) dan route handler (`src/app/api/lembaga/[lembaga_id]/nilai/route.ts:18-20`).
- Rute publik berbagi: `/manual`, `/slides`, `/privasi`, `/privacy`, `/ketentuan`, `/terms` (`middleware.ts:29-36,106-112`). Purwarupa `/prototype` dilewatkan dan dijaga di tata letaknya (`middleware.ts:37-40`).
- Rute publik berprofil: `/profile-lembaga`, `/profile-kegiatan`, `/404` terbuka hanya bila tanpa token (`middleware.ts:18-22,123-126`). Bila sudah login, rute itu dialihkan ke `/<role>/...` (`middleware.ts:150-168`), sehingga ada salinan semi-publik di `/mahasiswa/profile-*` (`robots.ts:18-20` menyebut duplikasi).
- Rute lain tanpa token dialihkan ke `/authentication` (`middleware.ts:128-131`). `/manage` membutuhkan token (`middleware.ts:114-121`). `/admin` dijaga tata letaknya sendiri (`middleware.ts:143-148`).
- Sesi akses alternatif dibatasi ke halaman pengajuan dan isi form (`middleware.ts:73-93`).
- `robots.txt`: mengizinkan `/`, melarang `/api/`, `/admin/`, `/lembaga/`, `/mahasiswa/`, `/authentication`, dan lain-lain; situs `dev` dilarang seluruhnya (`src/app/robots.ts:4-27`).

**Pembatasan laju dan perlindungan massal**
- Tidak ada pembatas laju pada `src/app/api/trpc/[trpc]/route.ts:1-50` maupun pada `trpc.ts` (middleware tRPC hanya `timingMiddleware` dan `altGuardMiddleware`, `trpc.ts:181-233`). Pencarian kata `rate`/`throttle`/`429` pada `src`, `docker`, `Dockerfile`, dan `next.config.js` hanya menemukan dua pembatas khusus di bawah ini.
- Login demo: pembatas di memori, per proses, 8 percobaan per 10 menit; berkas sendiri menyebut perlu Redis/Upstash untuk multi-instance (`demo-auth.ts:31-44`).
- Klaim akses alternatif: maksimum 3 klaim per email dan 10 per IP per jam, berbasis tabel `alt_login_claim` (`src/server/alt-login.ts:33-34,248-266`); IP dibaca dari `x-forwarded-for` atau `x-real-ip` (`src/server/api/routers/alt-login.ts:39-41`).
- Batas ukuran: `landing.searchAll` memakai `limit = 10` (`landing.ts:302`); `users.searchMahasiswa` memakai `input.limit ?? 10` (`user.ts:236`); batas atas `input.limit` tidak diperiksa dalam penelusuran ini. `getKegiatan` dan `getLembaga` mengembalikan seluruh anggota tanpa paginasi (`profile.ts:247-266`).
- Pagination pada hasil oprec: `resultsList` memakai `pageSize` dan `page` (`results.ts:427-428`).
- Pengujian beban ada di `loadtest/` (tujuan kapasitas, bukan perlindungan penyalahgunaan; `loadtest/README.md`).
- Pembatas di tingkat proksi (Nginx, Cloudflare) tidak dapat diverifikasi dari repositori.

## 3. Matriks data x siapa yang boleh melihat

Keterangan: `Y` boleh; `-` tidak boleh; `T` bergantung toggle; `?` tidak dapat diverifikasi dari kode. Kolom "Pengelola" mencakup Owner Lembaga, Admin Lembaga, dan Admin Kegiatan (hibah fitur `admin`) atas lembaga/kegiatan yang melibatkan mahasiswa itu.

| Data | Publik tanpa login | Mahasiswa login (lain) | Pendaftar sendiri | Pengelola (Owner/Admin/Admin Kegiatan) | Superadmin/Operator |
|---|---|---|---|---|---|
| Nama, foto | - (kecuali `?` gambar organogram) | Y (`profile.ts:201-276`; `landing.ts:297-335`) | Y | Y | Y |
| NIM | - | Y (`profile.ts:247-266`; `user.ts:583-599`) | Y | Y | Y |
| Prodi (`jurusan`) | - | Y (`profile.ts:252` area; `mahasiswa-profile.ts:99`) | Y | Y | Y |
| Angkatan | - | Y lewat profil (`mahasiswa-profile.ts:100`) | Y | Y; juga di hasil oprec (`results.ts:413`) | Y |
| Status aktif/alumni | - | Y (`mahasiswa-profile.ts:101`) | Y | Y | Y |
| WhatsApp | - | T `show_whatsapp` (`contact.ts:235`) | Y (`contact.ts:208`) | Y bila terlibat (`contact.ts:219`) | Y (Operator hanya `accounts.read`, `contact.ts:210`) |
| ID LINE | - | T `show_line` (`contact.ts:236`) | Y | Y bila terlibat | Y (sama) |
| Email | - | T `show_email` (`contact.ts:237`; `mahasiswa-profile.ts:94`) | Y | Y bila terlibat | Y (sama) |
| Nilai toggle `show_*` | - | Y, terkirim ke klien (`mahasiswa-profile.ts:105-107`) | Y | Y | Y |
| Akun `hidden_at` terisi | tidak terlihat | tersembunyi pada profil dan pencarian (`mahasiswa-profile.ts:75-80`; `user.ts:233`; `landing.ts:322`), tetapi masih tampil pada daftar anggota/panitia (`profile.ts:201-276`) | Y | Y pada profil bila pemilik/Superadmin/Operator; pengelola biasa tidak (`contact.ts:203-211`) | Y |
| Hasil penempatan pribadi | - | - | Y setelah rilis dan `results_visible_to_applicants` (`results.ts:579-636`) | Y | Y |
| Daftar hasil oprec (nama, NIM, prodi, angkatan, pilihan) | - | - | - | Y bila admin oprec; pengurus divisi dan penilai menurut mode (`results.ts:56-79`) | Y (Superadmin lewat `canManageEvent`, `access.ts:132`) |
| Identitas pada mode blind | - | - | - | tersembunyi bagi non-admin (`priority.ts:287-295`) | Y |
| Jawaban formulir pendaftaran | - | - | Y miliknya | menurut fitur `forms`/`oprec` (tidak dipetakan di riset ini) | ? |
| Gambar organogram | Y (`page.tsx:164-175`) | Y | Y | Y | Y |

## 4. Pola yang dapat dipakai ulang untuk halaman publik

1. **Prosedur terbuka dengan keluaran dibatasi skema.** `publicProcedure` dengan `.output(...)` dan daftar kolom eksplisit (`profile.ts:286-311`, `358-408`) sebagai cetakan; kolom yang tidak dipilih tidak terkirim.
2. **Halaman server di grup `(public)` dengan `cache()`** agar `generateMetadata` dan halaman berbagi satu kueri, serta `catch` yang mengembalikan `robots: { index: false }` (`.../profile-lembaga/[lembagaId]/page.tsx:29-68`; `.../profile-kegiatan/[profileKegiatanId]/page.tsx:21-67`). Tata letak publik membaca sesi tanpa memaksa login (`src/app/(public)/layout.tsx:5-12`).
3. **Pendaftaran rute di middleware.** Rute tanpa awalan peran masuk `PUBLIC_SHARED_ROUTES` (`middleware.ts:29-36`); rute dengan awalan lembaga/kegiatan memakai `PUBLIC_ROUTES` (`middleware.ts:18-22`) dan menanggung pengalihan ke `/<role>/...` bagi yang login (`middleware.ts:150-168`). Catatan: `/api` tidak melewati middleware.
4. **Penegakan terpusat dan penghilangan bidang.** Pola `contactAccess`/`canViewContact`: satu fungsi, bidang tidak berhak dihilangkan dari respons, bukan disembunyikan di klien (`contact.ts:222-248`; `mahasiswa-profile.ts:89-109`).
5. **Penyembunyian akun yang tidak dapat dibedakan dari "tidak ada".** `loadMahasiswaProfile` mengembalikan `null` (`mahasiswa-profile.ts:41-45,75-80`).
6. **Penyaring `hidden_at` pada kueri daftar.** `isNull(users.hiddenAt)` (`landing.ts:322`; `user.ts:233`).
7. **Pelepasan hasil bertahap.** Gerbang `resultsReleasedAt` dan `resultsVisibleToApplicants` pada `myResult` (`results.ts:603-605`) dan `resultsRelease` (`results.ts:497-541`).
8. **Identitas samaran.** `blindCode` untuk pengelola non-admin (`priority.ts:287-295`).
9. **Pembatas laju berbasis tabel** dengan jendela per IP (`alt-login.ts:248-266`) sebagai model yang tahan multi-instance, berbeda dari pembatas memori (`demo-auth.ts:35-44`).
10. **Pengujian per peran** pada `contact.test.ts` dan `mahasiswa-profile.test.ts` sebagai pola uji untuk aturan visibilitas baru.

## 5. Celah dan pertanyaan terbuka (tanpa keputusan)

1. Nama, NIM, dan prodi mahasiswa belum memiliki toggle; `show_*` hanya mengatur WhatsApp, LINE, dan email. Belum ada keputusan tercatat tentang visibilitas nama, NIM, dan prodi untuk halaman pengumuman.
2. Siapa yang boleh melihat daftar yang diterima belum diputuskan (tiket #480, `wayfinder` pada peta #475, tubuh peta bagian "Tiket"). Matriks di atas hanya memetakan pola yang ada.
3. `profile.getKegiatan`, `profile.getLembaga`, `getAnggotaById`, `getPanitiaById`, dan `getPanitiaByName` tidak menyaring `users.hidden_at`, padahal #299 menyatakan akun tersembunyi tidak tampil bagi non-admin. `searchMahasiswa`, `searchAll`, dan profil menyaringnya.
4. Prosedur semi-publik tidak membatasi peran penelepon (mahasiswa, lembaga, admin sama-sama lolos) dan `getMahasiswaByNim` memungkinkan penelusuran berdasarkan NIM. Tidak ada pembatas laju, sehingga pengambilan massal oleh akun yang login tidak terhalang. Pembatas di tingkat proksi tidak dapat diverifikasi.
5. Halaman publik pengumuman akan menjadi pintu masuk tanpa login; `/api` tidak melewati middleware, sehingga semua perlindungan harus berada di prosedur atau di luar aplikasi. Tidak ada contoh pembatas laju pada prosedur publik yang sudah ada.
6. Daftar peserta pada halaman kegiatan publik sengaja dikosongkan (`page.tsx:194-199`); alasannya tidak tercatat di kode atau tiket yang dibaca. Komponen daftar sudah mendukung pencarian nama dan paginasi klien (`src/app/_components/profile-kegiatan/profil-kegiatan-comp.tsx:17-58`).
7. Gambar organogram publik dapat memuat nama; kebijakan isinya tidak diatur oleh kode.
8. Kontak bagi pelamar yang ditolak: `involvedScopes` hanya mencakup pelamar pada oprec yang belum `final` (`contact.ts:126-127`); setelah `final`, pelamar yang tidak diterima keluar dari cakupan pengelola. Perilaku bagi yang diterima mengikuti `placement` dan status kegiatan (`contact.ts:100`). Dampak ke pengumuman perlu dipertimbangkan.
9. `application.willing_to_move` dan skor pilihan (`schema.ts:2346,2383`) adalah data pendaftar yang bukan kontak dan belum dipetakan ke aturan privasi; jawaban formulir (`form_answer.value`) dapat berisi data pribadi yang bebas.
10. Selisih kode dan keputusan pada bagian 2 (lima vs empat titik panggil; `keanggotaan`/`kehimpunan` vs `placement`; bentuk keluaran `getMahasiswaByNim`).
11. Rute `/api/lembaga/.../anggota` dan `/api/oprec/.../pendaftar|hasil` tidak dibaca isinya; hanya pemeriksaan sesi pada sebagian berkas yang terverifikasi (`nilai/route.ts:18-44`).
12. Perilaku dan pembatas pada lingkungan produksi (proksi, CDN, WAF) tidak dapat diverifikasi dari klon.

## 6. Daftar sumber

Tiket: #478, #475 (peta), #313 (peta akses/privasi; ditutup, dilanjutkan di #434), #307, #308, #309, #310, #311, #312, #299 (termasuk komentar). Komentar #313 hanya memuat catatan penutupan; keputusan berada di tubuh #313 dan komentar turunan.

Kode (`develop`, komit `c4af7e4`):
- `src/server/db/schema.ts`
- `src/server/api/contact.ts`, `contact.test.ts`
- `src/server/api/mahasiswa-profile.ts`
- `src/server/api/access.ts`
- `src/server/api/trpc.ts`
- `src/server/api/routers/profile.ts`, `user.ts`, `rapor.ts`, `landing.ts`, `kegiatan.ts`, `profil.ts`, `alt-login.ts`
- `src/server/api/routers/oprec/results.ts`, `priority.ts`, `assess-access.ts`
- `src/server/alt-login.ts`, `src/server/demo-auth.ts`
- `src/middleware.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`
- `src/app/(public)/layout.tsx`, `src/app/(public)/profile-lembaga/[lembagaId]/page.tsx`, `src/app/(public)/profile-kegiatan/[profileKegiatanId]/page.tsx`
- `src/app/_components/profile-kegiatan/organogram-dialog.tsx`, `profil-kegiatan-comp.tsx`
- `src/app/_components/profile-mahasiswa/edit-profile-dialog.tsx`, `src/app/_components/layout/sidebar.tsx`
- `src/app/mahasiswa/layout.tsx`, `src/app/lembaga/layout.tsx`
- `src/app/api/trpc/[trpc]/route.ts`, `src/app/api/lembaga/[lembaga_id]/nilai/route.ts`
- `loadtest/README.md`
