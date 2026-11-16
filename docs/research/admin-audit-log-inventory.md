# Inventaris pencatatan audit dan log saat ini

Tiket: #450 (peta #434; bahan untuk #305, [Task] Security audit /admin, dan [Grilling] Pilihan alat log #455).
Dasar: pembacaan kode pada komit `ac8eb85` (cabang `develop`, 16 November 2026). Tidak ada produksi yang dipanggil dan tidak ada skrip yang dijalankan.

## Kesimpulan

1. `admin_audit` mencatat 24 aksi pada 5 berkas router, tetapi **perubahan status laporan (`setReportStatus`) sama sekali tidak tercatat**. Impor alumni (`uploadAlumniCsv`) tercatat sebagai `alumni_import`, hanya berupa agregat jumlah.
2. Penulisan audit **tidak atomik** pada sebagian besar prosedur. Audit ditulis sesudah mutasi dengan `ctx.db`, bukan dalam transaksi yang sama, sehingga mutasi dapat berhasil tanpa jejak.
3. Tidak ada pelacak galat dan tidak ada pustaka log. Log aplikasi hanya `console` dan hanya memuat metadata galat tRPC (path, kode, status, durasi). Tidak ada identitas aktor, IP, atau konteks, sehingga 401/403 tidak dapat ditelusuri ke pelaku.
4. Kejadian keamanan di luar `/admin` (login gagal, role berubah otomatis saat masuk, ekspor data, penolakan lintas lembaga) tidak tercatat.
5. Halaman Audit hanya menyediakan satu kolom pencarian; server sudah mendukung lima filter lain, tetapi tidak ada tombol ekspor atau kebijakan retensi.

## 1. Tabel kejadian × tercatat × tempat

Tempat pencatatan: tabel `admin_audit` (`src/server/db/schema.ts:127`) kecuali dinyatakan lain. "Atomik" berarti penulisan audit berada dalam transaksi yang sama dengan mutasi.

### 1.1 Aksi di `/admin`

| Kejadian | Prosedur (berkas) | Tercatat | `action` | Atomik | Catatan |
|---|---|---|---|---|---|
| Tambah Superadmin | `adminOps.superadminAdd` (`admin-ops.ts`) | Ya | `superadmin_add` | Ya | `metadata.previousRole` |
| Turunkan Superadmin | `adminOps.superadminRemove` | Ya | `superadmin_remove` | Ya | `metadata.nextRole` |
| Buat lembaga + Owner | `adminOps.lembagaCreate` | Ya | `lembaga_create` | Ya | summary memuat email |
| Tambah email terverifikasi | `adminOps.verifiedEmailAdd` | Ya | `verified_email_add` | Ya | summary memuat email |
| Hapus email terverifikasi | `adminOps.verifiedEmailRemove` | Ya | `verified_email_remove` | Ya | hanya bila baris ada |
| Buat akun | `adminConsole.userCreate` | Ya | `user_create` | Ya | summary memuat email |
| Ubah akun (nama, email, role, NIM, kontak, status) | `adminConsole.userUpdate` | Ya | `user_update` | Ya | metadata memuat `before` dan `after` penuh |
| Ubah profil lembaga | `adminConsole.lembagaUpdate` | Ya | `lembaga_update` | Ya | metadata `before`/`after` |
| Buat, ubah, hapus kegiatan | `eventCreate`, `eventUpdate`, `eventDelete` | Ya | `event_create`, `event_update`, `event_delete` | Tidak | tanpa metadata; `event_update` tidak memuat bidang yang berubah |
| Ubah, hapus blok profil lembaga | `lembagaProfileUpsert`, `lembagaProfileDelete` | Ya | `lembaga_profile_upsert`, `lembaga_profile_delete` | Tidak | tanpa metadata |
| Beri atau cabut grant akses | `grantSet`, `grantRevokeById` | Ya | `grant_set`, `grant_revoke` | Tidak | `grantRevokeById` tanpa metadata dan tanpa nama target |
| Atur atau cabut izin Operator | `operatorPermissionSet`, `operatorPermissionRevoke` | Ya | `admin_permission_set`, `admin_permission_revoke` | Tidak | `expiresAt` tidak ikut metadata |
| Ubah atau hapus keanggotaan | `membershipUpsert`, `membershipRemove` | Ya | `membership_upsert`, `membership_remove` | Tidak | tanpa metadata; summary memuat `userId` mentah |
| Tambah atau hapus penempatan | `placementAdd`, `placementRemove` | Ya | `placement_add`, `placement_remove` | Tidak | idem |
| Setujui atau cabut akses alternatif NIM | `altLogin.adminApprove`, `adminRevoke` | Ya | `alt_login_approve`, `alt_login_revoke` | Tidak | summary memuat NIM dan email kontak |
| **Impor alumni (unggah CSV)** | `admin.uploadAlumniCsv` (`admin.ts:108`) | **Ya, parsial** | `alumni_import` | Tidak | Hanya jumlah (`total`, `updated`, `pending`, `wisudaBatch`). Daftar NIM yang berubah tidak tercatat. `entityId` null. Penulisan `mahasiswa.status` dan `alumni_pending` terjadi tanpa transaksi (kegagalan di tengah menyisakan keadaan separuh tanpa audit). Audit juga ditulis walau jumlah nol. |
| **Ubah status laporan** | `admin.setReportStatus` (`admin.ts:59`) | **Tidak** | tidak ada | tidak berlaku | Hanya `UPDATE support SET status`. Status lama, status baru, dan pelaku tidak tersimpan di mana pun (tabel `support` tidak punya kolom pengubah). |
| Baca daftar laporan (data pelapor) | `admin.getAllReportsAdmin` | Tidak | tidak ada | tidak berlaku | Pembacaan; lihat kesenjangan G9. |
| Lihat detail akun, daftar akun, daftar audit | `userDetail`, `usersList`, `auditList` | Tidak | tidak ada | tidak berlaku | Pembacaan data pribadi tanpa jejak. |

### 1.2 Aksi Owner/Admin lembaga (di luar `/admin`, tetapi memakai tabel yang sama)

| Kejadian | Prosedur (`admin-grant.ts`) | Tercatat | Atomik |
|---|---|---|---|
| Beri akses Admin Lembaga | `grantLembagaAdmin` | Ya (`grant_set`) | Tidak (`ctx.db`; metadata memuat `previousFeatures`) |
| Cabut akses Admin Lembaga | `revokeLembagaAdmin` | Ya (`grant_revoke`) | Tidak (`ctx.db`) |
| Beri akses Admin Kepanitiaan | `grantEventAdmin` | Ya (`grant_set`) | Tidak (`ctx.db`) |
| Cabut akses Admin Kepanitiaan | `revokeEventAdmin` | Ya (`grant_revoke`) | Tidak (`ctx.db`) |

### 1.3 Perubahan data di luar `/admin` yang tidak tercatat

| Kejadian | Tempat | Tercatat |
|---|---|---|
| Role `mahasiswa`/`admin` menjadi `lembaga` otomatis saat masuk pertama kali | `src/server/auth.ts:199` (callback `jwt`) | Tidak |
| `emailVerified` dan nama diisi saat masuk Azure pertama kali | `src/server/auth.ts:324` | Tidak |
| Pemberian role `admin` sesaat lewat `SUPERADMIN_EMAILS` | `src/server/auth.ts:235` (hanya token, tanpa baris basis data) | Tidak (lihat G6) |
| Ganti foto akun lembaga oleh Admin Lembaga | `routers/lembaga.ts:665`; `routers/user.ts:257` | Tidak |
| Penggabungan placeholder TPB | `src/server/auth.ts:174-176` | Hanya `console.info`/`console.error` |
| Impor langsung ke basis data (seed, skrip, SQL manual) | `src/server/db/seeding/*`, psql | Tidak; melewati seluruh audit |

## 2. Kesenjangan, urut menurut dampak keamanan

| # | Kesenjangan | Dampak | Bukti |
|---|---|---|---|
| G1 | Login gagal dan penolakan masuk tidak tercatat. `signIn` mengembalikan `false` (domain salah, email tidak terverifikasi, akun demo di produksi, tenant Azure salah) tanpa log. Percobaan klaim akses alternatif yang ditolak (`AltClaimError`, `rate_*`) hanya menjadi respons, tanpa log. | Tinggi: serangan tebak akun, penyalahgunaan alt-login, dan enumerasi tidak terdeteksi. Menghambat #305 dan model ancaman penguji iseng. | `auth.ts:252-300`; `routers/alt-login.ts:50-90` |
| G2 | Penolakan 401/403 hanya berupa satu baris `console.warn` tanpa aktor, IP, atau input ringkas. Di mode pengembangan malah mencetak `error.message`. | Tinggi: akses lintas lembaga berulang tidak dapat dikaitkan ke akun. | `log-error.ts`; `app/api/trpc/[trpc]/route.ts:26-34` |
| G3 | `setReportStatus` tanpa audit. | Tinggi untuk integritas: laporan pengguna dapat ditutup atau diabaikan tanpa jejak siapa dan kapan. Syarat eksplisit tiket. | `admin.ts:59-104` |
| G4 | Audit tidak atomik pada `event_*`, `lembaga_profile_*`, `grant*` (admin-console), `operatorPermission*`, `membership*`, `placement*`, `alt_login_*`, `alumni_import`, serta keempat prosedur `admin-grant.ts`. Mutasi dapat berhasil tanpa baris audit bila `INSERT` audit gagal. | Sedang-tinggi: jejak hilang diam-diam justru pada aksi kontrol akses (`operatorPermission*`, `grant*`). | lihat tabel 1.1 |
| G5 | Tidak ada galat klien dan tidak ada pelacak galat; log produksi hanya `console` tanpa korelasi ke pengguna. | Sedang: insiden tidak dapat direkonstruksi. | `package.json` tanpa Sentry/pino/winston; hanya `log-error.ts` |
| G6 | Akun `SUPERADMIN_EMAILS` mendapat role `admin` hanya di token JWT; masuknya akun darurat tidak tercatat, dan tindakannya tampil dalam audit hanya bila ada baris `users` untuk `actor_id`. `auditList` memakai `innerJoin(users)`; aktor tanpa baris `users` tidak tampil. | Sedang: akun darurat (paling berkuasa) tanpa jejak masuk. | `auth.ts:232-237`; `admin-console.ts:1453` |
| G7 | Pembacaan data pribadi oleh admin (`userDetail`, `usersList`, `getAllReportsAdmin`, `adminList` alt-login) dan ekspor data tidak tercatat. Belum ada fitur ekspor, sehingga ekspor belum menjadi risiko. | Sedang (privasi): tidak ada jawaban atas "siapa melihat data siapa". | router terkait |
| G8 | `alumni_import` hanya agregat; daftar NIM yang berubah status, dan status lama, tidak tersimpan. Tidak ada cara membatalkan atau menelusuri impor salah. | Sedang: perubahan massal (hingga 20.000 NIM) tidak dapat direkonstruksi. | `admin.ts:108-155`; `type/admin.type.ts:69` |
| G9 | Perubahan role di luar `/admin` (otomatis menjadi `lembaga` saat masuk) tidak tercatat. | Rendah-sedang. | `auth.ts:199` |
| G10 | Kolom `admin_audit.ip` ada, tetapi tidak ada penulis audit yang mengisinya (`audit()` di `admin-console.ts`, `writeAudit` di `admin-grant.ts`, dan insert langsung tidak memberikan `ip`). Fungsi `clientIp` ada hanya di `alt-login.ts`. | Rendah-sedang: kolom mati. | `schema.ts:140`; seluruh penulis |
| G11 | Operasi langsung ke basis data (SQL, skrip seed) melewati audit. Lingkupnya ditentukan oleh #448. | Bergantung #448. | `db/seeding/*` |

## 3. Isi `summary` dan `metadata`, serta risiko data pribadi

| Aksi | Isi | Risiko |
|---|---|---|
| `user_create`, `lembaga_create`, `grant_set/revoke`, `admin_permission_set`, `verified_email_*`, `superadmin_*`, `alt_login_*` | `summary` memuat **email** (institusi atau kontak); `alt_login_*` memuat **NIM + email kontak** | Data pribadi, tetapi perlu untuk akuntabilitas. Tidak ada kata sandi, token, atau KTM. Email kontak alt-login tidak diverifikasi (bisa email pribadi pihak lain). |
| `user_update` | `metadata: { before, mahasiswaBefore, after: input }`. `before` adalah baris `users` penuh; `mahasiswaBefore` adalah baris `mahasiswa` penuh (NIM, `lineId`, `whatsapp`, jurusan, status); `after` memuat masukan formulir termasuk `confirmEmail` bila diisi | **Tertinggi.** Kontak (`whatsapp`, `lineId`) tersalin permanen ke JSON audit dan terus ada walau akun diubah atau dihapus. `userUpdate` memuat semua kolom `users` sehingga kolom baru di masa depan ikut tersalin otomatis. Perlu allowlist bidang dan penyamaran kontak. |
| `lembaga_update` | `before`/`after` penuh baris lembaga | Rendah (data publik lembaga), tetapi sama-sama tanpa allowlist. |
| `membership_*`, `placement_*` | summary memuat `userId` mentah | Rendah; identitas hanya bisa dipetakan dengan gabungan tabel. |
| `grant_*` (Owner) | `targetUserId`, `features`, `propagate` | Rendah; tanpa email di metadata. |
| `alumni_import` | jumlah dan batch | Rendah. Namun NIM tidak ikut sehingga juga tidak dapat ditelusuri (G8). |

Temuan: tidak ada sanitasi sentral. Dua fungsi pembantu (`audit` dan `writeAudit`) menerima `metadata` bebas dan tidak memfilter kunci. `auditList` mengembalikan `metadata` utuh ke klien (`admin-console.ts:1447`), walau antarmuka belum menampilkannya; siapa pun dengan `audit.read` dapat membacanya dari respons jaringan. Dengan demikian `audit.read` secara efektif memberi akses ke kontak mahasiswa.

Log aplikasi (`log-error.ts`) sudah dirancang tanpa data pribadi (tanpa `message`, `stack`, input, header). Pengecualian: cabang `NODE_ENV === 'development'` mencetak `error.message`; `form/services.ts` mencetak `formId`; `auth.ts:174` mencetak hasil penggabungan placeholder (isi tidak diverifikasi di riset ini).

## 4. Halaman Audit

| Aspek | Klien (`audit-page.tsx`) | Server (`adminConsole.auditList`) |
|---|---|---|
| Filter | Satu kolom pencarian teks (`ilike` pada `summary` atau `action`) | `search`, `action`, `entityType`, `actorId`, `from`, `to` (lihat `AdminAuditListInputSchema`). Lima filter terakhir **tidak dipakai** antarmuka |
| Pengurutan | `created_at` dan `action` | sama; `actor` tidak dapat diurutkan |
| Kolom tampil | Waktu, Aktor (nama, email), Aksi + jenis entitas, Ringkasan | juga mengembalikan `entityId` dan `metadata` (tidak ditampilkan) |
| Paginasi | Server (`page`, `pageSize` tetap `PAGE_SIZE`) | `limit/offset` dengan `count` terpisah |
| Ekspor | Tidak ada | Tidak ada |
| Retensi | Tidak ada | Tidak ada penghapusan, arsip, atau tugas terjadwal; tabel tumbuh tanpa batas. Hanya klaim KTM alt-login yang punya retensi (7 hari, `KTM_RETENTION_MS`) |
| Imutabilitas | Tidak ada prosedur ubah/hapus audit di UI | Tidak ada pembatas di basis data (tanpa trigger atau hak `INSERT`-saja) |
| Izin `audit.read` | Menu `Audit` tampil bila punya `audit.read` (`admin-nav.tsx`); halaman dibungkus `AdminGuard permission="audit.read"` | `adminPermissionProcedure('audit.read')`; Superadmin lolos otomatis. Tidak ada pemisahan "lihat ringkasan" dan "lihat metadata". Izin ini satu-satunya yang terkait audit; tidak ada izin ekspor |
| Pencarian | Tidak ada pelarian karakter `%`/`_` yang diverifikasi dalam riset ini (`likeOf` tidak diperiksa); risiko hanya kinerja | |
| Indeks | `admin_audit_actor_idx`, `admin_audit_created_idx`; tidak ada indeks `action`/`entity_type`, jadi filter itu akan memindai penuh bila diaktifkan pada tabel besar | |
| Aktor dihapus | `innerJoin(users)` menyembunyikan baris bila pengguna tidak ada | |

## 5. Log aplikasi

| Pertanyaan | Temuan | Tempat |
|---|---|---|
| `console` di `src/server` | Ada. Aplikasi (non-seed): `log-error.ts` (warn/error), `trpc.ts:195` (`[TRPC] path took Nms`), `auth.ts:174,176`, `uploads.ts:13`, `form/services.ts` (5 panggilan). Seed dan skrip memakai `console.log` luas | berkas bersangkutan |
| Pelacak galat | **Tidak ada** (tidak ada Sentry, pino, winston, `instrumentation.ts`) | `package.json` |
| Galat klien | Tidak dikumpulkan | tidak ada |
| Login gagal | Tidak dicatat | `auth.ts` |
| 401/403 | Satu baris `warn` JSON (`event, path, code, httpStatus, type, durationMs`); tanpa aktor/IP | `log-error.ts` |
| Perubahan role di luar `/admin` | Tidak dicatat | `auth.ts:199` |
| Format | Hanya galat tRPC yang terstruktur JSON; sisanya teks bebas | |
| Penyimpanan | stdout proses; retensi mengikuti platform hosting (belum diperiksa) | |

## 6. Kejadian daftar #305 yang belum tercatat sama sekali

| Kejadian #305 | Status |
|---|---|
| Galat aplikasi klien dan server dengan jejak | Server: hanya metadata galat tRPC, tanpa stack. Klien: tidak ada |
| Login gagal | Belum tercatat |
| Penolakan akses 401/403 | Hanya `console.warn` tanpa aktor |
| Perubahan role dan hibah akses | Hibah dan perubahan di `/admin`: tercatat. Role otomatis di `auth.ts`, dan masuknya `SUPERADMIN_EMAILS`: belum |
| Ekspor data | Fitur ekspor belum ada; tidak ada yang dicatat |
| Peringatan pola mencurigakan | Belum ada (tidak ada agregasi atau alarm) |
| Lonjakan login gagal, penolakan lintas lembaga berulang | Belum tercatat, sehingga belum dapat dideteksi |

## 7. Bahan untuk [Grilling] Pilihan alat log (#455)

Pertanyaan retensi:

1. Berapa lama `admin_audit` disimpan (mis. 1 tahun, 5 tahun, tanpa batas)? Apakah ada kewajiban dari KM ITB, ITB, atau UU PDP?
2. Apakah log keamanan (login gagal, 401/403) mengikuti retensi yang sama dengan `admin_audit`, atau lebih pendek (mis. 30–90 hari) karena memuat IP?
3. Sesudah retensi lewat: dihapus, diarsipkan ke berkas dingin, atau dianonimkan (hapus email, NIM, kontak; pertahankan aksi dan waktu)?
4. Bagaimana permintaan hapus data pribadi (hak subjek data) diselaraskan dengan audit yang bersifat append-only dan memuat email atau NIM?
5. Siapa pemilik dan pembaca log: hanya Superadmin, atau Operator dengan izin? Perlu izin terpisah untuk `metadata` dan ekspor?

Hubungan `admin_audit` dengan alat log:

6. Peran: apakah `admin_audit` tetap menjadi catatan bisnis (siapa mengubah apa) di basis data, sedangkan alat log menampung galat dan kejadian keamanan? Atau alat log menjadi sumber tunggal dan `admin_audit` hanya diteruskan (diekspor) ke sana?
7. Bila tetap dua sistem: apakah audit diteruskan ke alat log sebagai cadangan antiubah (karena tabel basis data dapat diubah lewat SQL)?
8. Sumber kebenaran untuk tampilan: apakah halaman `/admin/audit` tetap membaca basis data, atau memakai panel alat log?
9. Siapa yang menanggung perbaikan G3 (laporan), G4 (atomik), dan G10 (IP) apa pun alat yang dipilih? Ketiganya mandiri dari pilihan alat.
10. Apakah IP dan agen pengguna boleh disimpan di log (data pribadi menurut UU PDP) dan berapa lama?
11. Apakah log dapat di-host sendiri di server ITB (pembatas dari #305) dan siapa yang mengoperasikannya?

## Keterbatasan

- Hanya kode pada `develop` `ac8eb85` yang dibaca. Konfigurasi hosting, retensi platform, dan isi nyata tabel `admin_audit` tidak diperiksa.
- Atomisitas dinilai dari penulisan `ctx.db` versus `tx` di berkas sumber; `admin-console.ts` hanya diperiksa pada pemanggilan `audit(...)`.
- Isi `likeOf` dan `auth.ts:174` tidak diperiksa mendalam.
