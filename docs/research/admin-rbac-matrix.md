# Riset #449: Matriks RBAC `/admin`

Cabang: `research/admin-rbac-matrix`. Basis kode: `ac8eb85` (develop). Peta induk: #434.
Metode: baca kode saja; tidak ada panggilan ke produksi dan tidak ada skrip yang dijalankan. Nomor baris merujuk basis kode di atas.
Status: draf pertama. Bagian yang belum ditelusuri tuntas ditandai "perlu verifikasi".

## 1. Ringkasan eksekutif

1. Penegakan di sisi server konsisten untuk 41 prosedur konsol: semuanya memakai `adminPermissionProcedure(x)` atau `superadminProcedure`, dan keduanya membaca ulang basis data pada setiap panggilan (`src/server/api/trpc.ts:275-364`).
2. Kelemahan terbesar bukan pada gerbang prosedur, melainkan pada isi izin: beberapa izin "biasa" setara dengan hak yang jauh lebih tinggi (RBAC-01, 02, 03).
3. Peran pada token JWT (berlaku 30 hari) masih dipercaya di luar prosedur admin, sehingga Superadmin yang sudah diturunkan tetap berkuasa atas lembaga dan kegiatan (RBAC-04).
4. Menu, halaman, dan prosedur sejajar untuk 8 dari 9 tautan menu. Ketidaksejajaran ada pada halaman tanpa `AdminGuard` dan izin yang tidak pernah ditegakkan (`lembaga.members`).

## 2. Peran

| Kode | Peran | Cara penentuan (bukti) | Hak efektif |
|---|---|---|---|
| R0 | Anonim | tanpa sesi | `UNAUTHORIZED` pada semua prosedur admin (`trpc.ts:316`, `:340`) |
| R1 | Non-admin tanpa baris izin (mahasiswa/lembaga) | `users.role` bukan `admin`, tanpa `admin_permission` aktif | `FORBIDDEN`; `layout.tsx:31` mengalihkan ke `/${role}` |
| R2 | Operator | baris `admin_permission` dengan `revoked_at IS NULL` dan `expires_at` kosong atau di masa depan (`trpc.ts:285-295`); satu baris per pengguna (`schema.ts:1587` indeks unik) | himpunan `permissions`; `*` dikenali `hasAdminPermission` (`admin-permissions.ts:~88`) |
| R3 | Superadmin DB | `users.role = 'admin'` (`trpc.ts:299-300`) | semua izin, termasuk `superadminProcedure` |
| R4 | Superadmin darurat | email pada `SUPERADMIN_EMAILS` cocok dengan `users.email` (`trpc.ts:301`, `superadmin.ts:14`) | sama dengan R3; tidak dapat diturunkan dari panel (`admin-ops.ts:~105`) |
| R5 | Sesi akses alternatif (`alt`) | `token.alt` terisi (`auth.ts:~118-136`) | ditolak default oleh `altGuardMiddleware` (`trpc.ts:215-231`) karena prosedur admin tidak punya `meta.alt` |

Catatan: `'*'` tidak dapat disimpan lewat API karena `operatorPermissionSet` menolak semua nilai di luar `ADMIN_PERMISSIONS` (`admin-console.ts:1235-1240`). Baris berisi `*` hanya mungkin dibuat lewat basis data langsung.

## 3. Izin dan kelompok UI

16 izin pada `ADMIN_PERMISSIONS` (`admin-permissions.ts:6-23`), dikelompokkan pada UI Akses (`akses-page.tsx:26-66`, identik dengan `ADMIN_PERMISSION_GROUPS` yang tidak dipakai di tempat lain):

| Kelompok | Izin |
|---|---|
| Akun | `accounts.read`, `accounts.write`, `accounts.roles` |
| Lembaga | `lembaga.read`, `lembaga.write`, `lembaga.events`, `lembaga.organization`, `lembaga.forms`, `lembaga.oprec`, `lembaga.members` |
| Akses | `access.read`, `access.write` |
| Audit | `audit.read` |
| Laporan | `reports.read`, `reports.write` |
| Alumni | `alumni.write` |

Izin `lembaga.events|organization|forms|oprec` juga ditegakkan di luar `/admin`, lewat `ADMIN_SCOPE_PERMISSION` (`access.ts:42-47`) pada `canManageLembaga` dan `canManageEvent`, hanya untuk pengguna dengan `role !== 'lembaga'` (`access.ts:77`, `:140`). `lembaga.members` tidak ada pada peta itu (lihat RBAC-12).

## 4. Matriks halaman × izin × prosedur

Kolom "Menu" = `admin-nav.tsx:7-16`. "Halaman" = pemeriksaan pada rute. "Sejajar" = menu, halaman, dan prosedur menuntut izin yang sama.

### 4.1 Halaman

| Rute | Menu | Halaman | Sumber pemeriksaan halaman | Sejajar |
|---|---|---|---|---|
| `/admin` (laporan) | `reports.read` | tanpa `AdminGuard`; memanggil `admin.getAllReportsAdmin` di server (`app/admin/page.tsx:15`) | layout (izin apa pun) + prosedur | Ya, tetapi gagal dengan galat 500, bukan pengalihan, bila izin kurang (RBAC-13) |
| `/admin/[laporanId]` | tidak ada | tanpa `AdminGuard`; prosedur sama (`[laporanId]/page.tsx:~21`) | idem | Sebagian |
| `/admin/akun` | `accounts.read` | `AdminGuard accounts.read` (`akun/page.tsx:6`) | klien | Ya |
| `/admin/akun/[userId]` | (turunan akun) | `AdminGuard accounts.read` (`akun/[userId]/page.tsx:11`) | klien | Ya |
| `/admin/lembaga` | `lembaga.read` | `AdminGuard lembaga.read` (`lembaga/page.tsx:6`) | klien | Ya |
| `/admin/lembaga/[lembagaId]` | (turunan) | `AdminGuard lembaga.read` (`lembaga/[lembagaId]/page.tsx:11`) | klien | Ya |
| `/admin/lembaga/[lembagaId]/organogram/[periodId]` | tautan dari detail lembaga bila `lembaga.organization` (`lembaga-detail.tsx:454`) | tanpa guard; kueri DB langsung di server (`organogram/[periodId]/page.tsx:14-27`) | layout saja | Tidak (RBAC-13) |
| `/admin/akses` | `access.read` | `AdminGuard access.read` (`akses/page.tsx:6`) | klien | Ya |
| `/admin/email-terverifikasi` | `accounts.write` | `AdminGuard accounts.write` (`email-terverifikasi/page.tsx:6`) | klien | Ya |
| `/admin/alumni` | `alumni.write` | `AdminGuard alumni.write` (`alumni/page.tsx:6`) | klien | Ya |
| `/admin/superadmin` | `superadmin` (semu) | `AdminGuard superadmin` (`superadmin/page.tsx:6`) | klien | Ya (hanya `*` yang lolos) |
| `/admin/audit` | `audit.read` | `AdminGuard audit.read` (`audit/page.tsx:6`) | klien | Ya |

Lapis pertama untuk semua rute: `middleware.ts:39-41` (wajib login) lalu `middleware.ts:135-137` yang meneruskan `/admin/*` tanpa pemeriksaan peran, lalu `app/admin/layout.tsx:8-31` (izin apa pun, atau `role === 'admin'` dari token). Penegak sebenarnya tetap prosedur tRPC.

### 4.2 Prosedur

Singkatan peran: S = Superadmin (R3/R4), O(x) = Operator dengan izin x. Semua baris juga ditolak untuk R0/R1/R5.

#### `adminConsole` (`routers/admin-console.ts`)

| Prosedur | Baris | Izin | Halaman pemakai | Catatan |
|---|---|---|---|---|
| `stats` | 124 | `accounts.read` | akun | membocorkan `SUPERADMIN_EMAILS` (RBAC-07) |
| `myAdminPermissions` | 144 | login saja | semua (guard) | membaca DB; `['*']` bagi S |
| `usersList` | 153 | `accounts.read` | akun | |
| `usersSearch` | 223 | `accounts.read` | pemilih pengguna | |
| `userDetail` | 257 | `accounts.read` | akun/[id] | memuat kontak (WA, LINE) |
| `userCreate` | 393 | `accounts.write` | akun | |
| `userUpdate` | 458 | `accounts.write`; email/role/verifikasi butuh `accounts.roles` (467-478) | akun/[id] | RBAC-01, 02 |
| `lembagaList` | 574 | `lembaga.read` | lembaga | |
| `lembagaGroups` | 632 | `lembaga.read` | lembaga | |
| `lembagaSearch` | 641 | `lembaga.read` | pemilih lembaga | |
| `eventsSearch` | 671 | `access.read` | akses | izin berbeda dari domainnya (kegiatan) |
| `positionsSearch` | 692 | `accounts.write` | akun/[id] | |
| `lembagaDetail` | 722 | `lembaga.read` | lembaga/[id] | memuat `ownerEmail` |
| `lembagaUpdate` | 811 | `lembaga.write` | lembaga/[id] | `parentId` mengubah cakupan hibah (RBAC-11) |
| `eventCreate` / `eventUpdate` / `eventDelete` | 865 / 899 / 933 | `lembaga.events` | lembaga/[id] | |
| `lembagaProfileList` | 959 | `lembaga.read` | lembaga/[id] | |
| `lembagaProfileUpsert` / `Delete` | 973 / 1011 | `lembaga.write` | lembaga/[id] | |
| `accessOptions` | 1026 | `access.read` | akses | |
| `grantsList` | 1048 | `access.read` | akses | |
| `grantSet` | 1112 | `access.write` | akses | tanpa batas subset dan tanpa kedaluwarsa (RBAC-03) |
| `grantRevokeById` | 1195 | `access.write` | akses | tanpa pemeriksaan keberadaan hibah |
| `operatorPermissionsList` | 1213 | `access.read` | akses | |
| `operatorPermissionSet` | 1230 | `access.write` + aturan subset (1241-1253) | akses | RBAC-05, 06 |
| `operatorPermissionRevoke` | 1289 | `access.write` | akses | tanpa hierarki sasaran (RBAC-05) |
| `membershipUpsert` / `Remove` | 1307 / 1359 | `accounts.write` | akun/[id] | bukan `lembaga.members` (RBAC-12) |
| `placementAdd` / `Remove` | 1374 / 1407 | `accounts.write` | akun/[id] | RBAC-10 |
| `auditList` | 1422 | `audit.read` | audit | metadata memuat cuplikan "before" |

#### `adminOps` (`routers/admin-ops.ts`)

| Prosedur | Baris | Izin | Halaman |
|---|---|---|---|
| `superadminList` / `Add` / `Remove` | 33 / 54 / 93 | `superadminProcedure` | superadmin |
| `lembagaCreate` | 163 | `lembaga.write` (juga menyisipkan `verified_users`, baris 211) | lembaga |
| `verifiedEmailList` / `Add` / `Remove` | 227 / 236 / 260 | `accounts.write` | email-terverifikasi |

#### `admin` (legacy, `routers/admin.ts`) dan `altLogin`

| Prosedur | Baris | Izin | Halaman |
|---|---|---|---|
| `admin.getAllReportsAdmin` | 18 | `reports.read` | `/admin`, `/admin/[laporanId]` |
| `admin.setReportStatus` | 59 | `reports.write`; tanpa catatan audit | papan laporan |
| `admin.uploadAlumniCsv` | 108 | `alumni.write` | alumni |
| `altLogin.claim` | `alt-login.ts:50` | publik (`meta.alt = 'any'`) | halaman login alternatif |
| `altLogin.adminPendingCount` / `adminList` | 92 / 109 | `accounts.read` | akun |
| `altLogin.adminApprove` / `adminRevoke` | 164 / 189 | `accounts.write` | akun (panel alt) |

#### `adminGrant` (`routers/admin-grant.ts`)

Bukan konsol `/admin`, tetapi memakai peran token: `lembagaOwnerProcedure` / `lembagaScopedProcedure` / `eventScopedProcedure` bergantung pada `canManageLembaga` / `canManageEvent`, yang meloloskan `role === 'admin'` dari token (`access.ts:75`, `:132`) dan Operator berizin `lembaga.*` (`access.ts:77-79`). Detail pada RBAC-03 dan RBAC-04.

### 4.3 Matriks peran × izin (ringkas)

| Izin | R0/R1/R5 | R2 tanpa izin itu | R2 dengan izin | R3/R4 |
|---|---|---|---|---|
| semua izin `ADMIN_PERMISSIONS` | tolak | tolak (`FORBIDDEN`, `trpc.ts:354`) | lolos | lolos (`trpc.ts:346`) |
| `superadminProcedure` | tolak | tolak | tidak ada izin yang membukanya | lolos |
| `*` pada baris R2 | n/a | n/a | lolos semua izin; hanya via DB | n/a |

## 5. Ketidaksesuaian dan tingkat dampak

Skala: Kritis (ambil alih Superadmin), Tinggi (lintas batas izin atau pelewatan pencabutan), Sedang (kebocoran atau efek di luar label izin), Rendah (konsistensi, UX, jejak audit).

| ID | Dampak | Ringkas | Bukti |
|---|---|---|---|
| RBAC-01 | Tinggi (Kritis bila ada alamat darurat belum terdaftar sebagai akun) | Operator `accounts.write`+`accounts.roles` dapat menjadi Superadmin darurat dengan mengganti email akun (miliknya atau akun lain) ke alamat `SUPERADMIN_EMAILS` yang belum terpakai | `admin-console.ts:458-526`, `trpc.ts:299-301` |
| RBAC-02 | Tinggi | `accounts.roles` + `accounts.write` mengambil alih akun non-admin mana pun, termasuk Operator berizin lebih besar | `admin-console.ts:518`, `admin-ops.ts:236-248`, `auth.ts:187-218`, `:269-275` |
| RBAC-03 | Tinggi | `access.write` memberi diri sendiri hibah `admin` pada lembaga atau kegiatan mana pun; hibah tidak pernah kedaluwarsa | `admin-console.ts:1112-1193`, `access.ts:74-110` |
| RBAC-04 | Tinggi | Peran `admin` pada token (30 hari) dipercaya di luar prosedur admin | `access.ts:75`, `:132`; `contact.ts:209`; `admin-grant.ts:137`; `prototype/layout.tsx:43`; `layout.tsx:14`; `auth.ts:344` |
| RBAC-05 | Sedang | `operatorPermissionSet/Revoke` tanpa hierarki sasaran; Operator memperpanjang izinnya sendiri | `admin-console.ts:1230-1305` |
| RBAC-06 | Sedang | Pembatas subset memakai peran token, bukan hasil DB | `admin-console.ts:1241` |
| RBAC-07 | Sedang | `stats` mengirim `SUPERADMIN_EMAILS` ke semua pemegang `accounts.read` | `admin-console.ts:140` |
| RBAC-08 | Sedang | `accounts.write` (berlabel "Ubah profil akun") dapat mencetak akun lembaga lewat daftar email terverifikasi | `admin-ops.ts:236-248`, `auth.ts:269-275` |
| RBAC-09 | Sedang | `accounts.write` menyetujui akses alternatif: sesi masuk sebagai mahasiswa sasaran | `alt-login.ts:164-186`, `server/alt-login.ts:358-390` |
| RBAC-10 | Sedang | `accounts.write` menempatkan siapa pun pada jabatan organogram, memberi hak sunting organogram tanpa `lembaga.organization` | `admin-console.ts:1374-1405`, `organization-access.ts:~20-80` |
| RBAC-11 | Sedang | `lembaga.write` mengubah `parentId`, sehingga hibah `propagate` induk baru menjangkau lembaga itu | `admin-console.ts:832`, `access.ts:112-130` |
| RBAC-12 | Sedang | Izin `lembaga.members` tidak ditegakkan di mana pun; `*` tidak dapat disimpan via API | `admin-permissions.ts:16`, `access.ts:42-47`, `admin-console.ts:1235-1240` |
| RBAC-13 | Sedang | Halaman tanpa guard: `/admin`, `/admin/[laporanId]`, organogram | `app/admin/page.tsx`, `organogram/[periodId]/page.tsx:14-27` |
| RBAC-14 | Rendah | Lima implementasi "izin aktif" dengan jam berbeda; layout memakai peran token | `trpc.ts:291` (jam aplikasi), `layout.tsx:19-23`, `access.ts:60`, `prototype/layout.tsx:49` (`now()` DB), `contact.ts:49-62` |
| RBAC-15 | Rendah | UI tidak menangani `FORBIDDEN` setelah pencabutan; guard klien berstale 30 detik | `trpc/query-client.ts:13`, `admin-guard.tsx:29-35` |
| RBAC-16 | Rendah | Celah audit: `setReportStatus` tanpa audit, upaya ditolak tidak tercatat, metadata `before` memuat baris pengguna utuh | `admin.ts:59-103`, `admin-console.ts:552-558` |
| RBAC-17 | Rendah | UI Akses butuh izin lintas kelompok (cari pengguna = `accounts.read`, cari lembaga = `lembaga.read`) agar `access.write` berguna | `admin-entity-search.tsx:44-58` |
| RBAC-18 | Info | `organization.structure.get` tidak menolak pengguna terautentikasi mana pun; `/admin` tidak dibatasi `ADMIN_HOST`; `adminProcedure` identik dengan `superadminProcedure` | `structure.ts:90-176`, `middleware.ts:47-53`, `trpc.ts:329` |

Rincian dan syarat tiap temuan ada pada bagian 6.

## 6. Rincian temuan

**RBAC-01.** `userUpdate` hanya mengunci email akun yang sudah `role = 'admin'` (`admin-console.ts:495-504`). Email akun lain, termasuk akun Operator sendiri, dapat diganti ke nilai apa pun yang lolos skema (`admin-console.type.ts:8`). `loadAdminAccess` menilai Superadmin dari `users.email` terhadap `SUPERADMIN_EMAILS` pada setiap panggilan (`trpc.ts:299-301`), sehingga akun itu langsung menjadi Superadmin tanpa login ulang. Syarat: alamat darurat belum dimiliki baris `users` mana pun (kolom `email` unik, `schema.ts:51`), misalnya akun darurat yang belum pernah masuk. Perbaikan yang disarankan: tolak perubahan email ke alamat darurat pada `userUpdate`/`userCreate`/`lembagaCreate`.

**RBAC-02.** Rantai pengambilalihan akun non-admin: ganti email sasaran ke Google milik penyerang (`admin-console.ts:518`), tambahkan alamat itu ke `verified_users` bila bukan `@km.itb.ac.id` (`admin-ops.ts:236-248`), lalu masuk lewat Google. `signIn` dan `jwt` memetakan login ke baris `users` berdasarkan email (`auth.ts:269-275`, `:294-334`). Sasaran yang berupa Operator dengan izin lebih besar memberi eskalasi horizontal ke atas. Konfirmasi `confirmEmail` hanya mengetik ulang email lama (`admin-console.ts:506-508`), bukan kontrol dua orang. Perbaikan: larang `accounts.roles` mengubah email akun yang memegang `admin_permission` aktif atau hibah; wajibkan audit tegas.

**RBAC-03.** `grantSet` tidak membandingkan hibah dengan hak pemberi dan tidak punya masa berlaku (`access_grant` tidak punya kolom `expires_at`; hanya `status` dan `revoked_at`, `schema.ts:1508-1517`). `access.write` tanpa `accounts.*` sudah cukup bila pemberi tahu identifier sasaran: ia dapat memberi dirinya fitur `admin` pada lembaga mana pun. `canManageLembaga` kemudian memberi akses `'admin'` (`access.ts:100-110`) ke seluruh pengelolaan lembaga/kegiatan (forms, oprec, anggota, nilai). Ini melewati batas "Operator tidak melebihi izinnya" yang hanya ditegakkan pada `operatorPermissionSet` (`admin-console.ts:1241-1253`). Hibah baru atas dirinya juga tidak butuh `lembaga.*`.

**RBAC-04.** `session.user.role` berasal dari JWT (`auth.ts:240-247`, `maxAge` 30 hari, `auth.ts:344`). Prosedur admin membaca ulang DB, tetapi jalur lain mempercayai token: `canManageLembaga`/`canManageEvent` (`access.ts:75`, `:132`) yang dipakai ratusan prosedur `lembagaScopedProcedure` dan rute `app/api/lembaga/*`; `canViewHiddenAccount` (`contact.ts:209`); `assertGrantableFeatures` (`admin-grant.ts:137`); `prototype/layout.tsx:43`; dan `app/admin/layout.tsx:14` (layout memberi `['*']`, tetapi prosedur tetap menolak). Akibatnya Superadmin yang diturunkan (atau yang sudah diganti emailnya) tetap mengelola setiap lembaga dan kegiatan hingga token berakhir. Uji `admin-ops.test.ts:176-192` hanya meliputi prosedur admin. Perbaikan: ganti `role === 'admin'` pada jalur itu dengan `loadAdminAccess(...).isSuperadmin`, atau segarkan peran di callback `jwt`.

**RBAC-05/06.** `operatorPermissionSet` menimpa baris sasaran mana pun, termasuk milik Operator lain yang berizin lebih besar atau milik pemberi sendiri (memperpanjang `expiresAt`, `admin-console.ts:1255-1274`). Operator tidak dapat menambah izin di luar miliknya, tetapi dapat menghapus izin Operator lain (menurunkan) dan memperpanjang miliknya. Pemeriksaan subset memakai `ctx.session.user.role !== 'admin'` (`:1241`) bukan hasil `loadAdminAccess`, jadi akun darurat (token `admin` hanya setelah login, `auth.ts:234`) atau Superadmin yang baru ditambahkan lewat DB tanpa login ulang diperlakukan sebagai Operator, dan token Superadmin lama yang sudah diturunkan melewati batas subset. Selain itu, `ctx.adminPermissions` untuk Superadmin adalah `['*']` (`trpc.ts:350`) sehingga cabang `own.includes` tidak pernah terpakai bagi mereka.

**RBAC-07.** `stats` mengembalikan `superadmins: env.SUPERADMIN_EMAILS` (`admin-console.ts:140`), padahal hanya halaman akun yang memakai hitungan (`akun-page.tsx:210-213`); tidak ada pemakai daftar itu. Daftar membuka target RBAC-01 dan phishing. Perbaikan: hapus bidang.

**RBAC-08.** Daftar email terverifikasi memutuskan siapa boleh masuk lewat Google non-ITB (`auth.ts:269-275`). `accounts.write` (label "Ubah profil akun") sehingga dapat mengizinkan identitas luar, dan `lembagaCreate` (butuh `lembaga.write`) juga menyisipkan ke daftar itu (`admin-ops.ts:211`).

**RBAC-09.** `adminApprove` menyetujui klaim akses alternatif sehingga pemohon bersesi sebagai mahasiswa sasaran untuk mengisi form (`server/alt-login.ts:358-390`; sesi `alt='claim'`, `auth.ts:118-136`). Dampak dibatasi oleh `altGuardMiddleware` pada form saja; tetapi izin `accounts.write` tidak menyiratkan hak ini dalam label UI.

**RBAC-10.** `placementAdd` menempatkan pengguna mana pun pada jabatan organogram. `resolveOrganogramAccess` memberi hak sunting unit kepada pemegang penempatan (`organization-access.ts`), sehingga `accounts.write` setara dengan sebagian `lembaga.organization` dan menembus kunci edit untuk unit tertentu. `placementRemove` dan `membershipRemove` menghapus berdasarkan id tanpa memeriksa lembaga, tanpa batas cakupan.

**RBAC-11.** `lembagaUpdate` menerima `parentId` (`admin-console.ts:832`) tanpa pemeriksaan siklus selain diri sendiri (`:819`). Hibah `propagate` pada induk menjangkau semua turunan (`access.ts:112-130`), jadi `lembaga.write` + `access.write` menggeser cakupan hak. `MAX_LEMBAGA_TREE_DEPTH = 16` hanya pengaman penelusuran.

**RBAC-12.** `lembaga.members` terdaftar pada `ADMIN_PERMISSIONS` dan UI (`akses-page.tsx:44`) tetapi tidak ada pada `ADMIN_SCOPE_PERMISSION` (`access.ts:42-47`) maupun prosedur mana pun; pemberi mengira memberi hak, padahal tidak ada efek. Sebaliknya `GRANT_FEATURES` (`access.ts:26-32`) tidak punya `members`. Lalu: `'*'` dikenali oleh `hasAdminPermission` dan UI (`admin-nav.tsx:26-27`) tetapi ditolak oleh `operatorPermissionSet`; jalur DB langsung tetap sah.

**RBAC-13.** `/admin` dan `/admin/[laporanId]` memanggil `admin.getAllReportsAdmin` di server tanpa `AdminGuard`; Operator tanpa `reports.read` yang membuka URL mendapat galat (prosedur menolak, tetapi tidak ada pengalihan). Halaman organogram tidak memanggil prosedur admin apa pun: ia menjalankan kueri DB langsung dan merender `OrganogramWorkspace` untuk sesi mana pun yang lolos layout (izin admin apa pun, termasuk `audit.read`). Data organogram diambil lewat `organization.structure.get`, yang hanya `protectedProcedure` (`structure.ts:90`), sehingga struktur terbaca; sunting dibatasi `resolveOrganogramAccess`. Perlu verifikasi: apakah `OrganogramWorkspace` membuka kontrol sunting bagi Operator tanpa `lembaga.organization` (prosedur `save` menolak lewat `canManageEvent(..., 'organization')`, `structure.ts:191`).

**RBAC-14.** Definisi "izin aktif" disalin di lima tempat: `trpc.ts:285-295` (jam proses, `new Date()`), `admin/layout.tsx:19-23` (`now()` DB), `access.ts:57-62` (`now()` DB), `prototype/layout.tsx:44-52`, `contact.ts:49-62`. Selisih jam proses dan DB membuka jendela detik. Perbaikan: satu fungsi `loadAdminAccess` untuk semua.

**RBAC-15.** Guard klien memakai `myAdminPermissions` dengan `staleTime` 30 detik (`query-client.ts:13`), tidak ada penanganan global untuk `FORBIDDEN`. Menu tetap tampil hingga data usang diperbarui; penegakan tetap server.

**RBAC-16.** `auditList` memuat `metadata` penuh, termasuk `before` baris pengguna (`admin-console.ts:552-558`), sehingga `audit.read` membaca data pribadi yang butuh `accounts.read`. `grantRevokeById` dan `operatorPermissionRevoke` mencatat audit sekalipun tidak ada baris yang berubah. Tidak ada log untuk percobaan ditolak. `setReportStatus` tidak menulis `admin_audit`.

**RBAC-17.** Lihat `admin-entity-search.tsx:44-58`: pemilih memakai `usersSearch` (`accounts.read`), `lembagaSearch` (`lembaga.read`), `eventsSearch` (`access.read`), `positionsSearch` (`accounts.write`). Operator dengan hanya `access.write` tidak dapat memakai UI, tetapi dapat memanggil `grantSet` langsung bila tahu id. Ini bukan celah, melainkan ketidaksesuaian menu-prosedur.

**RBAC-18.** (a) `structure.get` mengembalikan seluruh organogram, termasuk nama dan penempatan, kepada pengguna login mana pun yang tahu `periodId`; belum dipastikan apakah ini disengaja. (b) `ADMIN_HOST` hanya mengalihkan root; `/admin` tetap bisa dibuka lewat host utama (`middleware.ts:47-53`). (c) `adminProcedure` dan `superadminProcedure` sama (`trpc.ts:311-329`).

## 7. Eskalasi hak (ringkasan)

| Dari | Ke | Lewat | Dihalangi? |
|---|---|---|---|
| `accounts.roles` | Superadmin DB (`role = 'admin'`) | `userUpdate` | Ya (`admin-console.ts:489-494`) |
| `accounts.write`+`accounts.roles` | Superadmin darurat | ganti email | Tidak (RBAC-01) |
| `accounts.write`+`accounts.roles` | akun lain | ganti email + login | Tidak (RBAC-02) |
| `access.write` | izin Operator melebihi miliknya | `operatorPermissionSet` | Ya (`:1241-1253`), tetapi tergantung peran token (RBAC-06) |
| `access.write` | hak penuh atas lembaga/kegiatan mana pun | `grantSet` | Tidak (RBAC-03) |
| `access.write` | memperpanjang `expiresAt` sendiri | `operatorPermissionSet` pada diri sendiri | Tidak (RBAC-05) |
| `accounts.write` | hak sunting organogram | `placementAdd` | Tidak (RBAC-10) |
| `lembaga.write` | cakupan hibah `propagate` | `parentId` | Tidak (RBAC-11) |
| Operator | Superadmin | `superadminAdd` | Ya (`superadminProcedure`) |
| Superadmin diturunkan | tetap berkuasa atas lembaga | token lama | Tidak (RBAC-04) |

## 8. Izin dicabut atau kedaluwarsa pada sesi berjalan

| Jalur | Perilaku | Bukti |
|---|---|---|
| Prosedur `adminPermissionProcedure` / `superadminProcedure` | Berlaku seketika: DB dibaca pada setiap panggilan; baris dicabut/kedaluwarsa menghasilkan `FORBIDDEN` | `trpc.ts:275-364`; uji `admin-ops.test.ts:194-218` |
| Halaman server (`layout.tsx`) | Dievaluasi per navigasi; peran `admin` dari token | `layout.tsx:12-31` |
| Guard dan menu klien | Berdasarkan `myAdminPermissions`; usang hingga 30 detik atau navigasi | `admin-guard.tsx:28-35`, `query-client.ts:13` |
| `canManageLembaga/Event` untuk Operator | Berlaku seketika (kueri DB, `now()`); izin dicabut berhenti bekerja | `access.ts:49-62`; uji `access.test.ts:328-367` |
| `canManageLembaga/Event` untuk `role === 'admin'` di token | Tidak berhenti sampai token berakhir | RBAC-04 |
| Hibah `access_grant` | Hanya `status`/`revoked_at`; tidak ada kedaluwarsa | `schema.ts:1508-1517` |
| Sesi alt | Dihitung ulang tiap permintaan; dicabut seketika | `auth.ts:118-136` |
| Akun darurat | Tidak pernah dicabut dari panel; hanya lewat perubahan env dan penerapan ulang | `admin-ops.ts:~105` |
| Penurunan Superadmin | Prosedur admin: seketika. Jalur token: setelah token berakhir (maks. 30 hari) | RBAC-04 |
| Operator dengan `revoked_at` lalu `operatorPermissionSet` lagi | Baris dihidupkan kembali (`revokedAt: null`) | `admin-console.ts:1262-1267` |

Catatan: mutasi yang sedang berjalan saat pencabutan tidak diputar balik; kueri `FORBIDDEN` berikutnya menolak.

## 9. Usulan tes otomatis (masukan `/to-spec`)

Pola: tes basis data seperti `admin-ops.test.ts` (`createCallerFactory`, `makeOperator`, `codeOf`). Satu tabel parametrik untuk pagar izin menutup 41 prosedur sekaligus.

| ID | Cakupan | Tes | Jenis |
|---|---|---|---|
| T-01 | Semua prosedur `adminConsole`, `adminOps`, `admin`, `altLogin.admin*` | Parametrik: tiap prosedur × {anonim, mahasiswa, lembaga, Operator tanpa izin, Operator berizin tepat, Superadmin}. Harapkan {401, 403, 403, 403, bukan 403, bukan 403}. Daftar prosedur diturunkan dari `appRouter` (meta `access`) agar prosedur baru gagal bila lupa guard | integrasi DB |
| T-02 | Matriks halaman-menu-prosedur | Untuk tiap entri `LINKS` pada `admin-nav.tsx` dan `AdminGuard` pada `app/admin/**/page.tsx`, pastikan izin identik dengan izin prosedur utama halaman (uji statis berbasis berkas) | unit statis |
| T-03 | `userUpdate` (RBAC-01/02) | Operator `accounts.write+roles` mengganti email ke alamat darurat: harap ditolak; mengganti email Operator lain berizin: harap ditolak | integrasi DB |
| T-04 | `operatorPermissionSet` | Subset, `*`, izin tak dikenal, sasaran diri sendiri, sasaran Operator berizin lebih besar, perpanjangan `expiresAt` sendiri | integrasi DB |
| T-05 | `grantSet` (RBAC-03) | Operator `access.write` memberi diri `admin` pada lembaga: setelah perbaikan harap ditolak atau hanya fitur yang dimilikinya | integrasi DB |
| T-06 | Pencabutan seketika | Panggil prosedur, cabut/kedaluwarsakan, panggil ulang tanpa membuat ulang sesi: `FORBIDDEN`. Ulangi untuk `canManageLembaga` | integrasi DB (ada sebagian) |
| T-07 | Token usang (RBAC-04) | Token `role: 'admin'`, DB `role: 'mahasiswa'`: `lembagaScopedProcedure`, `eventScopedProcedure`, `canViewHiddenAccount` harap `FORBIDDEN` | integrasi DB |
| T-08 | Kedaluwarsa tepat batas | `expires_at = now()` dan `now()-1ms`; batas jam proses vs DB (RBAC-14) | unit + DB |
| T-09 | `lembaga.members` (RBAC-12) | Uji kontrak: tiap izin pada `ADMIN_PERMISSIONS` dipakai minimal satu prosedur atau peta cakupan | unit statis |
| T-10 | `stats` (RBAC-07) | Keluaran tidak memuat bidang email darurat | unit |
| T-11 | Halaman tanpa guard (RBAC-13) | Render `/admin` dan organogram sebagai Operator `audit.read` saja: harap dialihkan/ditolak | e2e / komponen |
| T-12 | Peran non-admin dengan `'*'` pada DB | `hasAdminPermission` dan `loadAdminAccess` dengan `['*']` | unit |
| T-13 | Audit | Setiap mutasi konsol menulis tepat satu baris `admin_audit`; `setReportStatus` termasuk; `before` tidak memuat bidang kontak | integrasi DB |
| T-14 | `lembagaUpdate` (RBAC-11) | `parentId` siklus tak langsung (A→B→A) ditolak | integrasi DB |
| T-15 | Superadmin terakhir | Akun darurat tidak dapat diturunkan; menurunkan diri ditolak (sudah ada, `admin-ops.test.ts:128-145`) | regresi |

Per baris matriks (bagian 4.2): prosedur yang diliput T-01 saja = semua baris kecuali yang bertanda RBAC; baris `userUpdate`, `operatorPermissionSet/Revoke`, `grantSet`, `placementAdd` mendapat tes khusus T-03 sampai T-05; baris `adminApprove` mendapat tes sesi alt (`server/alt-login.db.test.ts` sudah ada, perlu menambah kasus Operator tanpa `accounts.write`).

## 10. Batas riset ini

- Tidak ada kode yang dijalankan; semua pernyataan perilaku berasal dari pembacaan. Alur RBAC-02 dan RBAC-01 butuh uji integrasi untuk dipastikan.
- Belum dibaca penuh: komponen UI `akses-page.tsx`, `akun-detail.tsx`, dan `OrganogramWorkspace` hanya diperiksa pada bagian izin; rute `app/api/*` selain `lembaga/*` tidak diperiksa.
- Nomor baris bertanda `~` perlu dicek ulang sebelum dikutip pada laporan akhir.
