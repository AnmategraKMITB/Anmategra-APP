# Riset #478: Data pendaftar dan aturan privasi kontak

Sumber: cabang `develop`, komit `c4af7e4` (klon dangkal). Rujukan berbentuk `berkas:baris`. Dokumen ini hanya memuat fakta dan hal yang belum dapat dipastikan. Tidak ada keputusan di dalamnya.

## 1. Data per pendaftar dan per mahasiswa

Fakta:

| Data | Tabel dan kolom | Rujukan |
|---|---|---|
| Nama | `user.name`; salinan `mahasiswa.nama` (komentar: kolom redundan) | `src/server/db/schema.ts:46-50`, `:251` |
| Email | `user.email` (wajib, unik) | `schema.ts:50` |
| Foto | `user.image` | `schema.ts:55` |
| NIM, NIM TPB | `mahasiswa.nim`, `mahasiswa.nim_tpb` | `schema.ts:249-250` |
| Prodi | `mahasiswa.jurusan` | `schema.ts:252` |
| Angkatan | `mahasiswa.angkatan` | `schema.ts:253` |
| WhatsApp, ID LINE | `mahasiswa.whatsapp`, `mahasiswa.line_id` | `schema.ts:254-255` |
| Status aktif/alumni | `mahasiswa.status` | `schema.ts:263` |
| Tiga sakelar kontak | `mahasiswa.show_whatsapp`, `show_line`, `show_email`, bawaan `false` | `schema.ts:260-262`; migrasi `drizzle/0052_mahasiswa_contact_visibility.sql` |
| Rapor tampil | `mahasiswa.rapor_visible`, bawaan `true` | `schema.ts:256` |
| Akun disembunyikan | `user.hidden_at` | `schema.ts:57-58` |
| Pendaftar oprec | `application` (`recruitment_id`, `user_id`, `wave_id`, `form_submission_id`, `source`, `willing_to_move`, `submitted_at`) | `schema.ts:2322-2347` |
| Status hasil oprec | `recruitment.placement_state`, `results_released_at`, `results_visible_to_applicants` (bawaan `false`) | `schema.ts:2079-2089` |
| Keanggotaan lembaga | `lembaga_membership` (`status` aktif dst., `cohort_year`) | `schema.ts:714-735` |

Tidak ada tabel pendaftar yang menyimpan kontak. Pendaftar adalah baris `application` yang menunjuk ke `user` dan `mahasiswa`; kontak tetap berada di `mahasiswa`.

## 2. Cara kerja `canViewContact` dan `show_*`

Fakta (`src/server/api/contact.ts`):

- Granularitas: per bidang (WhatsApp, LINE, email), bukan per akun. Tiga sakelar milik mahasiswa itu sendiri (`contact.ts:32-45`).
- Pemanggil tunggal bernama `contactAccess` (`contact.ts:223-239`). `canViewContact` hanya pembungkus per bidang (`contact.ts:241-248`).
- Aturan: bidang terlihat bila sakelarnya menyala, atau bila penonton memiliki "akses penuh" (`contact.ts:231-238`). Akses penuh berarti semua bidang terlihat.
- Akses penuh dimiliki: pemilik akun (`contact.ts:208`); Superadmin berperan `admin` (`:209`); Operator berizin `accounts.read` (`:210`, `:49-66`); serta Owner dan Admin lembaga atau kegiatan tempat mahasiswa terlibat, lewat `canManageLembaga` dan `canManageEvent` (`:145-197`).
- Definisi "terlibat" (`contact.ts:69-142`): anggota lembaga berstatus `aktif`; penempatan pada kegiatan yang statusnya bukan `Ended` dan struktur organisasinya aktif; pengajuan asosiasi berstatus `Pending` (kegiatan dan lembaga); pelamar oprec dengan `recruitment.status != 'draft'` dan `placement_state != 'final'`.
- Optimasi: bila ketiga sakelar menyala, kueri izin dilewati (`contact.ts:228-233`).
- Akun tersembunyi: `loadMahasiswaProfile` mengembalikan `null` bagi penonton yang tidak berhak, sehingga tidak dapat dibedakan dari akun yang tidak ada (`src/server/api/mahasiswa-profile.ts:41-80`). Penonton yang berhak: pemilik, Superadmin, Operator `accounts.read` (`contact.ts:203-211`).
- Pemakai `contactAccess`: `mahasiswa-profile.ts:82` (profil mahasiswa, dipanggil dari `routers/profile.ts:37-` `getMahasiswa`) dan `routers/rapor.ts:23` (`visibleContactFields`, kontak pada rapor; bidang tersembunyi menjadi string kosong, `rapor.ts:29-32`).
- Pemilik mengubah sakelar lewat `editProfilMahasiswa` (`routers/user.ts`, blok `lineId/whatsapp/showWhatsapp/showLine/showEmail`).
- Bidang nama, NIM, prodi, angkatan, dan foto tidak melewati `contactAccess`; semuanya dikirim apa adanya pada profil (`mahasiswa-profile.ts:89-109`).

Kaitan dengan #313: peta #313 mencatat tiga kolom boolean `show_*` bawaan tersembunyi, penegakan terpusat `canViewContact`, dan pengelola melihat anggota aktif serta pelamar yang diproses (keputusan pada #310). Kode di atas sesuai dengan catatan itu. Peta tersebut juga mencatat #299 (privasi kontak) selesai lewat PR #325.

## 3. Halaman publik atau semi-publik yang menampilkan nama mahasiswa

Fakta:

- Halaman publik tanpa login: `/profile-lembaga/[lembagaId]` dan `/profile-kegiatan/[profileKegiatanId]` (`src/app/(public)/`), serta `/manual`, `/slides`, `/privasi`, `/privacy`, `/ketentuan`, `/terms` (`src/middleware.ts:18-36`).
- Prosedur publik `getLembagaPublic` (`routers/profile.ts:286-356`) dan `getKegiatanPublic` (`:358-`) tidak memilih data mahasiswa. Isinya data lembaga, daftar kegiatan, dan tautan pendaftaran. Foto yang dikembalikan adalah foto akun lembaga (`users.image` milik lembaga).
- Daftar peserta kegiatan (nama, NIM, prodi, foto, posisi, divisi) ada pada `getKegiatan`, yang berupa `protectedProcedure` (`routers/profile.ts:201-279`, daftar pada `:240-269`). Hanya penempatan yang sudah dirilis yang masuk (`placementReleased`, `routers/organization/membership.ts:77`; definisi di `src/server/api/oprec-release.ts:17-24`).
- Pencarian mahasiswa `searchMahasiswa` (`routers/user.ts:185-`) berupa `protectedProcedure`; mengembalikan `userId`, nama, NIM; menyaring akun `hidden_at`, akun lembaga, dan anggota yang sudah ada (`user.ts:233`).
- Organogram (`src/app/lembaga/organogram`) dan anggota (`src/app/lembaga/anggota`) berada di bawah prefiks peran `lembaga`, jadi memerlukan login.
- `landing.ts` memiliki beberapa prosedur publik (`getRecentEvents`, `getAllEvents`, `getTopEvents`, `getAllEventIds`, `getAllLembagaIds`) dan menyaring `hiddenAt` pada `:322`, `:369`, `:392`. `profil.getAllProfilKM` dan `kegiatan.getAllPublic`/`getByIdPublic` juga publik.
- Hasil oprec bagi pelamar: `myResult` hanya menjawab pelamar itu sendiri, dan baru setelah `results_visible_to_applicants` benar serta `results_released_at` terisi (`routers/oprec/results.ts:579-637`).
- Daftar pelamar dan hasil bagi pengelola (`applicants`, `resultsList`) mengembalikan nama, NIM, prodi, angkatan, gelombang, sumber, waktu kirim; tidak memilih email, WhatsApp, atau LINE (`routers/oprec/applicants.ts:544-`, `results.ts:370-`; pencarian kata "email|whatsapp|lineId" pada kedua berkas dan `applicants-export.ts` tidak menemukan kecocokan).

Hal yang tidak dapat dipastikan:

- Tidak ada halaman publik yang menampilkan daftar nama mahasiswa pada kode yang dibaca. Namun, saya tidak membaca seluruh komponen UI di `src/app/(public)`; keyakinan ini bertumpu pada isi prosedur publik.
- Isi `profil.getAllProfilKM`, `kegiatan.getByIdPublic`, dan seluruh prosedur `landing.ts` tidak dibaca baris demi baris. Apakah ada nama mahasiswa di sana belum terverifikasi, kecuali penyaringan `hiddenAt` yang tampak.
- Rute `/prototype/*` dilewatkan middleware (`middleware.ts:37-40`); gerbangnya ada di `src/app/prototype/layout.tsx` (isi tidak dibaca).
- Cara hasil oprec "diumumkan di luar Anmategra" ditampilkan tidak ditelusuri.

## 4. Matriks data x siapa yang boleh melihat

Penonton: P = pemilik akun; S = Superadmin; O = Operator `accounts.read`; K = Owner/Admin lembaga atau kegiatan tempat mahasiswa terlibat; M = mahasiswa atau akun terautentikasi lain; U = pengunjung tanpa login. "ya*" berarti bergantung pada sakelar `show_*` pemilik. Kolom M untuk nama/NIM/prodi/angkatan mengacu pada profil dan pencarian tanpa penyaringan sakelar.

| Data | P | S | O | K | M | U |
|---|---|---|---|---|---|---|
| WhatsApp | ya | ya | ya | ya | ya* | tidak (kode tidak menyediakan jalur publik) |
| ID LINE | ya | ya | ya | ya | ya* | tidak |
| Email | ya | ya | ya | ya | ya* | tidak |
| Nama | ya | ya | ya | ya | ya (profil, pencarian) kecuali akun tersembunyi | tidak lewat prosedur publik yang dibaca |
| NIM | ya | ya | ya | ya | ya (profil, pencarian, daftar peserta) | tidak |
| Prodi, angkatan | ya | ya | ya | ya | ya (profil) | tidak |
| Foto | ya | ya | ya | ya | ya | tidak untuk mahasiswa |
| Akun tersembunyi (`hidden_at`) | ya | ya | ya | tidak | tidak (dianggap tidak ada) | tidak |
| Daftar pelamar oprec | tidak (hanya diri sendiri lewat `myResult`) | ya | tidak diperiksa | ya, lewat izin oprec | tidak | tidak |
| Hasil oprec milik sendiri | ya, setelah dirilis | tidak diperiksa | tidak diperiksa | n/a | tidak | tidak |

Catatan matriks: kolom K tidak otomatis berlaku bagi semua pengelola; harus pengelola lembaga atau kegiatan yang melibatkan mahasiswa itu (`contact.ts:145-197`). Sel "tidak diperiksa" berarti saya tidak menelusuri izinnya (`oprecScopedProcedure` dan `oprecAssessProcedure` di `trpc.ts` tidak dibaca isinya).

## 5. Rute publik, middleware, dan pembatasan laju

Fakta:

- Berkas `src/middleware.ts` (bukan `proxy.ts`) menangani rute. `/_next`, `/api`, `/images`, `/robots.txt`, `/sitemap.xml`, dan sejenisnya dilewatkan tanpa pemeriksaan (`middleware.ts:6-17`, `:52-54`). Jadi tRPC di bawah `/api` tidak dijaga middleware; penjagaan ada pada jenis prosedur (`publicProcedure` bertanda `access: 'public'`, `protectedProcedure` menolak tanpa sesi, `src/server/api/trpc.ts:242-264`).
- `PUBLIC_ROUTES` (`/profile-lembaga`, `/profile-kegiatan`, `/404`) dibuka tanpa token (`middleware.ts:18-22`, `:124-126`). Rute lain tanpa token dialihkan ke `/authentication` (`:129-131`).
- Sesi "akses alternatif" dibatasi ke halaman pengajuan dan isi form (`middleware.ts:73-93`); middleware dan `altGuardMiddleware` di tRPC sama-sama menolak selebihnya.
- Satu-satunya pembatas laju yang ditemukan: percobaan login demo, per proses, dalam memori, 8 percobaan per 10 menit (`src/server/demo-auth.ts:30-60`). Komentar pada berkas itu sendiri menyebut perlu Redis/Upstash untuk multi-instance.
- Pencarian kata `rate-limit|ratelimit|throttle` pada `src` hanya menemukan `demo-auth.ts` dan `auth.ts`. Tidak ada pembatas laju pada prosedur publik tRPC maupun pada `searchMahasiswa`.
- `searchMahasiswa` membatasi hasil dengan `input.limit ?? 10` (`user.ts`), tetapi batas atas `limit` pada skema masukan tidak diperiksa.

Hal yang tidak dapat dipastikan: apakah ada pembatas laju di luar aplikasi (reverse proxy, CDN, Nginx). Konfigurasi penyebaran tidak termasuk bahan yang dibaca.

## 6. Pola yang dapat dipakai ulang untuk halaman publik

Fakta tentang pola yang sudah ada di kode:

1. Satu pintu untuk kontak: panggil `contactAccess` atau `loadMahasiswaProfile`, dan kirim `null` atau string kosong untuk bidang yang tidak berhak. Jangan membaca kolom kontak langsung dari tabel (`mahasiswa-profile.ts:89-109`, `rapor.ts:10-33`).
2. Pemilihan kolom eksplisit pada prosedur publik: `getLembagaPublic` memakai `columns` terbatas dan keluaran bertipe (`.output(...)`) sehingga bidang tak terduga tidak bocor (`profile.ts:286-312`).
3. Penyaringan akun tersembunyi `isNull(users.hiddenAt)` pada pencarian dan landing (`user.ts:233`, `landing.ts:322`).
4. Penempatan hanya dihitung bila sudah dirilis lewat `placementReleased` (`oprec-release.ts:17-24`), sehingga hasil oprec yang belum dirilis tidak muncul pada daftar anggota.
5. Penanda akses prosedur (`meta({ access: 'public' | 'authenticated' })`, `trpc.ts:242-264`) dan tes `contact.test.ts` serta `mahasiswa-profile.test.ts` sebagai tempat menambah kasus.

Yang belum ada (fakta): pembatas laju umum untuk rute publik, serta prosedur publik yang mengembalikan daftar nama mahasiswa. Bila halaman pengumuman akan publik, jalur itu belum memiliki pola siap pakai selain butir 1 sampai 4.

## 7. Ringkasan hal yang belum pasti

- Isi UI publik dan prosedur `landing`, `profil.getAllProfilKM`, `kegiatan.*Public` tidak dibaca penuh.
- Izin `oprecScopedProcedure`, `oprecAssessProcedure`, serta bidang `lembagaScopedProcedure` tidak ditelusuri.
- Batas atas parameter `limit` pencarian.
- Pembatasan laju di tingkat infrastruktur.
- Nomor baris pada beberapa rujukan berasal dari potongan yang dibaca; bila `develop` berubah, nomor dapat bergeser.
