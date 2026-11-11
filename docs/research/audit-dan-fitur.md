# Skema audit log dan enforcement fitur grant

Riset untuk issue #316 (induk #315). Tanggal: 2026-11-12.

## Kesimpulan

1. Audit log yang ada adalah satu tabel, `admin_audit` (nama fisik `anmategra_admin_audit`). Tabel ini sudah cukup untuk mencatat grant/revoke oleh Owner dan Admin Lembaga tanpa kolom baru, karena `action`, `entity_type`, `entity_id`, `summary`, dan `metadata` (jsonb) bersifat generik. Saat ini jalur Owner/Admin Lembaga (`admin-grant.ts`) tidak menulis audit sama sekali; hanya jalur operator admin console yang menulis.
2. `features` pada `access_grant` ditegakkan oleh guard, tetapi tidak merata. Ada lima kunci valid (`admin`, `oprec`, `forms`, `events`, `organization`). Celah utama: fitur `forms` tidak konsisten antara API dan halaman, fitur `events` praktis tidak berpengaruh pada pengubahan kegiatan, `lembagaScopedProcedure` selalu menuntut `admin`, dan pemberi hibah tidak dibatasi oleh fitur yang ia miliki.

Basis kode: cabang `develop` (SHA 5312eee549c7b51fb56801b30b4f462284df6025). Berkas `access.ts`, `trpc.ts`, `schema.ts`, `admin-console.ts`, dan `forms/access.ts` identik (hash isi sama) dengan checkout lokal tempat nomor baris diambil. Hanya `routers/admin-grant.ts` berbeda di lokal (ada refactor ke `managed-scope.ts`, di luar mutasi grant), sehingga berkas itu dirujuk menurut nama prosedur, bukan nomor baris. Jalur rujukan berada di bawah `src/`; `server/...` berarti `src/server/...`. Temuan ini hanya hasil membaca kode: tidak ada kode produksi yang diubah dan tidak ada basis data yang dijalankan.

## 1. Audit log

### 1.1 Skema yang ada

`adminAudit` didefinisikan di `server/db/schema.ts:65-93` (migrasi `drizzle/0048_last_iron_fist.sql`). Komentarnya: "Jejak audit tindakan backoffice; append-only dari UI".

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | varchar(255) PK | UUID |
| `actor_id` | varchar(255) NOT NULL, FK `users.id` | tanpa `ON DELETE`, sehingga akun pelaku tidak dapat dihapus selama ada baris audit |
| `action` | varchar(64) NOT NULL | bebas, tanpa enum |
| `entity_type` | varchar(64) NOT NULL | bebas |
| `entity_id` | varchar(255) NULL | |
| `summary` | text NOT NULL | kalimat bahasa Indonesia |
| `metadata` | jsonb NULL | `Record<string, unknown>` |
| `ip` | varchar(64) NULL | tidak pernah terisi: helper `audit()` tidak menerima `ip` |
| `created_at` | timestamptz NOT NULL | default `CURRENT_TIMESTAMP` |

Indeks: `admin_audit_actor_idx(actor_id)` dan `admin_audit_created_idx(created_at)`. Tidak ada indeks pada `entity_type`, `entity_id`, atau `action`, padahal `auditList` menyaring ketiganya.

Tabel lain yang mirip, `recruitment_log` (`schema.ts:2611`), khusus oprec (terikat `recruitment_id`) sehingga bukan tempat yang tepat untuk grant. Pola `actor_id` nullable `ON DELETE SET NULL` pada tabel itu dapat ditiru.

### 1.2 Siapa yang menulis dan membaca

- Helper `audit(db, actorId, action, entityType, entityId, summary, metadata?)` ada di `server/api/routers/admin-console.ts:97-111`. Helper ini privat (tidak diekspor) dan dipanggil setelah mutasi dengan `ctx.db` biasa, bukan di dalam transaksi yang sama, sehingga mutasi dan audit tidak atomik.
- Satu-satunya pemakai `adminAudit` di `src/` adalah `admin-console.ts`. Aksi yang tercatat: `user_create`, `user_update`, `lembaga_update`, `event_create/update/delete`, `lembaga_profile_upsert/delete`, `grant_set`, `grant_revoke`, `admin_permission_set/revoke`, `membership_upsert/remove`, `placement_add/remove`. Nilai `entity_type`: `user`, `lembaga`, `event`, `grant`, `profil_lembaga`, `membership`, `placement`.
- Pembaca: `auditList` (`admin-console.ts:1404`) dengan guard `adminPermissionProcedure('audit.read')`. Izin ini milik operator admin console (`server/api/admin-permissions.ts`), bukan milik Owner atau Admin Lembaga. Tidak ada endpoint baca yang di-scope per lembaga.

### 1.3 Pencatatan grant yang ada

Jalur operator (`admin-console.ts`, izin `access.write`):

- `grantSet` (sekitar baris 1094-1175) memanggil `audit(... input.revoke ? 'grant_revoke' : 'grant_set', input.kind, input.targetId, summary, { identifier, targetId, features })`. `entity_type` bernilai `lembaga` atau `event`; `entity_id` adalah id lembaga atau periode.
- `grantRevokeById` (sekitar 1177-1193) mencatat `grant_revoke` dengan `entity_type='grant'`, `entity_id=grantId`, `summary='Mencabut akses'`, tanpa `metadata`. Dari baris ini saja tidak terlihat siapa penerima dan lembaga mana.
- Kelemahan `grantSet`: audit selalu ditulis meski tidak ada baris yang berubah (revoke pada hibah yang tidak ada); `features` pada revoke hanya nilai bawaan `['admin']`, bukan fitur yang benar-benar dicabut; `propagate`, id pengguna penerima, dan nilai sebelumnya tidak dicatat.

Jalur Owner/Admin Lembaga (`server/api/routers/admin-grant.ts`): `grantLembagaAdmin`, `revokeLembagaAdmin`, `grantEventAdmin`, `revokeEventAdmin` hanya melakukan `insert`/`update` pada `access_grant`. Tidak ada panggilan audit. Jejak satu-satunya adalah kolom `granted_by`, `revoked_at`, `revoked_by` pada barisnya sendiri, dan jejak itu tertimpa: pada grant ulang, baris yang sama dipakai ulang (indeks unik `access_grant_lembaga_user_unique` dan `access_grant_period_user_unique`, `schema.ts:1461-1467`), `granted_by` diganti, dan `revoked_at`/`revoked_by` di-null-kan. Riwayat hanya bertahan bila ada baris audit.

### 1.4 Bisakah grant oleh Owner/Admin Lembaga dicatat di tabel yang sama

Bisa, tanpa migrasi, dengan ketentuan berikut:

- `actor_id` NOT NULL dan FK ke `users`: Owner dan Admin Lembaga adalah baris `users`, jadi terpenuhi.
- `action` memakai `grant_set` dan `grant_revoke` yang sama agar filter `auditList` tetap berfungsi; `entity_type` `lembaga`/`event` dan `entity_id` mengikuti konvensi `grantSet`.
- Pembeda jalur ditaruh di `metadata`, misalnya `via: 'owner' | 'admin_lembaga' | 'operator'`. Nilai `lembagaAccess` sudah tersedia di konteks (`ctx.lembagaAccess`, `trpc.ts:327-352`).

`metadata` yang disarankan untuk semua jalur grant (agar konsisten): `grantId`, `targetUserId`, `targetEmail`, `lembagaId`, `periodId`, `features`, `previousFeatures` (atau `previousStatus`), `propagate`, `via`.

Kolom baru bersifat opsional dan hanya perlu bila ada kebutuhan berikut:

| Kebutuhan | Tambahan |
| --- | --- |
| Owner melihat log lembaganya sendiri tanpa izin `audit.read` | kolom `lembaga_id varchar(255) NULL` (FK `lembaga.id`, `ON DELETE SET NULL`) dengan indeks `(lembaga_id, created_at)`; `period_id` opsional, atau diturunkan dari `events.org_id` |
| Penyaringan cepat per entitas | indeks `(entity_type, entity_id)` |
| Mengisi IP | tambahkan parameter `ip` ke `audit()`; kolom sudah ada |
| Log tetap ada saat akun pelaku dihapus | ubah `actor_id` menjadi nullable `ON DELETE SET NULL` |

Tanpa kolom `lembaga_id`, penyaringan per lembaga harus membaca `metadata->>'lembagaId'` (jsonb tanpa indeks), dan endpoint baca untuk non-operator belum ada. Penulisan audit sebaiknya berada dalam transaksi yang sama dengan mutasi `access_grant`, dan helper `audit()` perlu diekstrak dari `admin-console.ts` agar dapat dipakai `admin-grant.ts`.

## 2. Enforcement `features` pada `access_grant`

### 2.1 Penyimpanan dan daftar fitur valid

- Kolom `access_grant.features` adalah `text[] NOT NULL DEFAULT ARRAY['admin']` (`schema.ts:1431-1434`). Tidak ada CHECK di basis data; validasi hanya di zod.
- Daftar valid, `GRANT_FEATURES` di `server/api/access.ts:26-33`: `admin`, `oprec`, `forms`, `events`, `organization`. `admin` berarti semua kemampuan. Zod memakai daftar ini di `server/api/types/admin-grant.type.ts` (`min(1)`, `max(5)`, bawaan `['admin']`) dan `server/api/types/admin-console.type.ts:159-165`.
- Pencocokan: `hasFeature` (`access.ts:36-37`) meloloskan hibah bila `features` memuat `'admin'` atau fitur yang diminta. Hanya hibah `status='active'` yang dipertimbangkan.
- Kolom `can_grant`, `parent_grant_id`, `cascade_revoke` ada tetapi tidak dipakai kode mana pun (sesuai komentar `schema.ts:1409-1411`; pencarian di `src/` selain `schema.ts` tidak menemukan pemakaian).

### 2.2 Guard

`canManageLembaga(db, userId, role, sessionLembagaId, lembagaId, feature='admin')` (`access.ts:65`) dan `canManageEvent(..., eventId, feature='admin')` (`access.ts:122`). Urutan: `role==='admin'` lolos; operator dengan izin yang sesuai (hanya `organization` -> `lembaga.organization` dan `events` -> `lembaga.events`, `access.ts:39-60`) lolos; Owner (`role==='lembaga'` dan `lembagaId` sama) lolos untuk fitur apa pun; hibah lembaga (termasuk `propagate` ke turunan, batas kedalaman 16); `canManageEvent` juga mewarisi dari `canManageLembaga` induk dengan fitur yang sama, lalu memeriksa hibah periode.

Pemakai dan fitur yang diminta:

| Guard / pemakai | Fitur | Lokasi |
| --- | --- | --- |
| `lembagaScopedProcedure` | `admin` (bawaan) | `server/api/trpc.ts:327` |
| `lembagaOwnerProcedure` | Owner saja | `trpc.ts:353` |
| `eventScopedProcedure` | `events` | `trpc.ts:370` |
| `formScopedProcedure` | `forms` | `trpc.ts:407` |
| `oprecScopedProcedure`, `oprecPeriodProcedure` | `oprec` | `trpc.ts:461`, `trpc.ts:500` |
| `resolveAssessAccess` | `oprec` | `routers/oprec/assess-access.ts:45` |
| `resolveOrganogramAccess`, `organization/structure.ts:184`, `organization/import.ts` (preview, commit, `createCurrentPeriod`), halaman organogram | `organization` | |
| `app/api/lembaga/[lembaga_id]/anggota/route.ts` (GET dan POST) | `admin` (bawaan) | |

### 2.3 Celah dan ketidakkonsistenan

1. **`forms`: API dan halaman tidak sejalan.** `formScopedProcedure` meminta `forms`, tetapi `loadManagedForm` dan `canManageEventForms` (`src/app/_components/forms/access.ts`) memakai fitur bawaan `admin`. Hibah `['forms']` lolos di API, tetapi halaman builder, halaman respons, halaman daftar form kegiatan, dan unggahan (`src/app/api/uploadthing/core.ts:57`) menolaknya (`notFound()`). Komentar berkas itu menyatakan "Aturannya sama dengan `formScopedProcedure`", yang tidak benar untuk fitur.
2. **`createForEvent`/`listByEvent` meminta `events`, bukan `forms`** (`routers/form/form.ts:140,187`, memakai `eventScopedProcedure`). Hibah `['forms']` tidak dapat membuat atau mendaftar form kegiatan, sedangkan hibah `['events']` dapat.
3. **`lembagaScopedProcedure` selalu meminta `admin`.** Maka `createForLembaga`, `listByLembaga` (`form.ts:105,175`), `listLembagaAdmins`, `grantEventAdmin`, dan `revokeEventAdmin` tidak dapat dipakai hibah lembaga berfitur terbatas. Fitur terbatas di tingkat lembaga hanya efektif lewat pewarisan ke event, `formScopedProcedure`, `oprec*`, dan jalur `organization`.
4. **Fitur `events` praktis tidak berpengaruh pada kegiatan.** Satu-satunya pemakai `eventScopedProcedure` adalah `listEventAdmins` dan dua prosedur form di atas. Seluruh mutasi kegiatan (`routers/event/create.ts`, `update.ts`, `delete.ts`: `createEvent`, `updateEvent`, `addNewPanitia`, `removePanitia`, `editPanitia`, `toggleHighlight`, dan seterusnya) memakai `lembagaProcedure`, yaitu guard berbasis role `lembaga`. Akibatnya Admin Lembaga, Admin Kepanitiaan, hibah berfitur `events`, dan izin operator `lembaga.events` ("Kelola kegiatan/kepengurusan") tidak dapat mengubah kegiatan lewat router ini. `lembagaProcedure` (`trpc.ts:292`) menolak setiap sesi yang `role`-nya bukan `lembaga` (`trpc.ts:286`) dan tidak memeriksa `access_grant`.
5. **Pemberi hibah tidak dibatasi fitur miliknya.** `grantEventAdmin` memakai `lembagaScopedProcedure` (cukup Admin Lembaga berfitur `admin`, tidak harus Owner) dan menerima `features` apa saja, termasuk `admin`. `can_grant` tidak diperiksa. Admin Lembaga dapat memberi dan mencabut hibah kepanitiaan siapa pun di lembaganya. Hanya `grantLembagaAdmin` dan `revokeLembagaAdmin` yang Owner-only.
6. **Jalur Owner mengabaikan `propagate`.** `grantLembagaAdmin` tidak menerima atau menyetel `propagate` dan tidak meresetnya saat grant ulang; hanya jalur operator (`grantSet`) yang menyetelnya. Hibah buatan Owner tidak pernah menjangkau lembaga turunan, dan nilai `propagate` yang ditinggalkan operator bertahan setelah Owner mengubah hibah itu.
7. **Revoke Owner tidak memeriksa baris dan status.** `revokeLembagaAdmin` dan `revokeEventAdmin` melakukan `update` tanpa menyaring `status='active'`, sehingga pencabutan ulang menimpa `revoked_at`/`revoked_by` asli. `grantRevokeById` (operator) tidak memeriksa keberadaan hibah dan selalu menulis audit.
8. **Operator hanya terpetakan untuk dua fitur.** `ADMIN_SCOPE_PERMISSION` hanya memuat `organization` dan `events`. Operator yang bukan `role==='admin'` tidak pernah lolos untuk `oprec`, `forms`, atau `admin`.
9. **Tidak ada constraint basis data atas nilai `features`.** Nilai tak dikenal dari SQL langsung diam-diam tidak pernah cocok; array kosong membuat hibah tidak berguna namun tetap `active` dan tampil di daftar.
10. **Pemeriksaan hanya per halaman.** `app/manage/layout.tsx:13` dan `middleware.ts:28` menyerahkan pemeriksaan ke tiap halaman; bila satu halaman lupa memeriksa fitur, tidak ada jaring pengaman. `managed-scope.ts` meneruskan `features` ke UI hanya sebagai informasi tampilan.

## 3. Saran tindak lanjut (belum dikerjakan)

1. Ekstrak `audit()` menjadi modul bersama; panggil dari keempat mutasi `admin-grant.ts` dalam transaksi yang sama; samakan bentuk `metadata` dengan jalur operator.
2. Putuskan apakah Owner perlu membaca log; bila ya, tambah `lembaga_id` dan prosedur baca ber-scope lembaga.
3. Seragamkan fitur `forms` antara `formScopedProcedure`, `loadManagedForm`, `canManageEventForms`, dan `form.createForEvent/listByEvent`.
4. Batasi `grantEventAdmin` agar pemberi tidak dapat memberi fitur yang tidak ia miliki (atau jadikan Owner-only), dan manfaatkan `can_grant` bila pendelegasian memang diinginkan.
5. Tambah CHECK `features <@ ARRAY[...]` dan `cardinality(features) > 0`.
6. Putuskan apakah mutasi kegiatan perlu bermigrasi dari `lembagaProcedure` ke guard berfitur `events`.
