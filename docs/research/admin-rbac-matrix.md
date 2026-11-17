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
| RBAC-01 | Kritis | Operator `accounts.roles` dapat menjadi Superadmin darurat dengan menukar email | `admin-console.ts:458-526`, `trpc.ts:299-301` |
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
