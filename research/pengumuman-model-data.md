# Riset #476: Model data oprec (divisi, bidang, gelombang, status diterima, hubungan ke organogram)

Sumber: cabang `develop`, komit `c4af7e4`. Rujukan berbentuk `berkas:baris`. Dokumen ini memuat fakta dan hal yang belum pasti, tanpa keputusan.

## Ringkasan

1. Tidak ada entitas "bidang" tersendiri pada oprec. Entitas yang dibuka pada oprec adalah `recruitment_division`, yang menunjuk satu unit organogram (`organization_unit`) dan satu posisi (`organization_position`). "Bidang" dan "Divisi" hanyalah label jenis unit di organogram.
2. Status diterima disimpan di `placement_decision.decision` (`terima`/`tolak`) per pilihan (`application_choice`). Saat keputusan `terima` disimpan, baris `placement` dibuat pada saat itu juga. `resultsRelease` dan `resultsWithdraw` hanya mengubah `recruitment.results_released_at`.
3. Penerima otomatis masuk organogram sebagai baris `placement`, tetapi baris itu disembunyikan dari non-pengelola sampai hasil dirilis.
4. Satu pendaftar hanya dapat memiliki satu penerimaan aktif per oprec.

## 1. Model oprec, divisi, bidang, gelombang

- `recruitment`: schema.ts:2037-2194. Terikat pada periode (`periodId`, schema.ts:2043) dan satu form (`formId`, unik, schema.ts:2046 dan 2190). Satu periode boleh memiliki banyak oprec (komentar schema.ts:2045).
- `recruitment_division`: schema.ts:2250-2292. Kolom `unitId` (-> `organization_unit`) dan `positionId` (-> `organization_position`), keduanya `restrict`. Unik per (`recruitmentId`, `unitId`) (schema.ts:2288). Kuota tidak disalin; dibaca dari `organization_position.quota` (schema.ts:1979-1981, kolom `quota` di schema.ts:~935; 0 = tanpa batas).
- Divisi dan bidang: tabel `organization_unit` (schema.ts:828-866) memakai `kind` (`Bidang`, `Divisi`, `Subdivisi`; schema.ts:815-820) dan `typeLabel` bebas (schema.ts:850-852). Komentar schema.ts:851-852 dan 849 menyatakan `kind` dan `level` akan dibuang dan diganti `typeLabel`. Tidak ada tabel atau kolom "bidang" di tabel oprec. Wizard setup memakai nama level bawaan `['Bidang', 'Divisi']` bila organogram tidak punya label (setup.ts:64).
- Pilihan pendaftar: `application` (schema.ts:2323-2362), unik per (`recruitmentId`, `userId`) (schema.ts:2357). `application_choice` (schema.ts:2364-2398) menunjuk `recruitment_division`, unik per (`applicationId`, `divisionId`) dan per (`applicationId`, `rank`) bila rank tidak null (schema.ts:2391-2396). Asal pilihan: `dipilih`, `dialihkan`, `closerec` (schema.ts:2046-2047 pada blok konstanta `CHOICE_ORIGINS`).
- Batas pilihan: `min_choices`/`max_choices` (schema.ts:2095-2096). Setup menolak `maxChoices` melebihi jumlah divisi (setup.ts:354-359) dan unit ganda (setup.ts:360-365).
- Oprec tanpa divisi: input setup mewajibkan `divisions.min(1)` (oprec.type.ts:288-291). Skema tidak memaksa adanya baris divisi di level basis data; yang terlihat hanya pemeriksaan pada jalur setup.
- Gelombang: `recruitment_wave` (schema.ts:2197-2224): `label`, `startsAt`, `endsAt` (CHECK `ends_at > starts_at` menurut komentar schema.ts:2207), `sortOrder`. Gelombang bersifat opsional; `application.waveId` diisi dengan gelombang berjalan saat form dikirim (submission.ts:780), `onDelete: set null` (schema.ts:2335-2338). Maksimum 20 gelombang (oprec.type.ts:19).
- Gelombang tumpang tindih: ditolak. `waveOverlapMessage` (waves.ts:1-20) dipanggil di setup.ts:421 dan index.ts:298; bersebelahan dan bercelah diperbolehkan (waves.ts:2-4).
- Pemakaian gelombang: hanya pada gerbang pendaftaran (`checkApplyGate`, application.ts:136-190). Jika ada gelombang tetapi tidak ada yang berjalan, pendaftaran ditolak (application.ts:160-170). Oprec tanpa gelombang tidak dibatasi gelombang (application.ts:160). Pencarian gelombang berjalan memakai `find` yang mengambil gelombang pertama yang cocok (application.ts:118-126).
- Dalam kode yang dibaca, gelombang tidak dipakai pada keputusan penempatan maupun pada status diterima (pencarian `waveId` pada placement.ts tidak ditemukan; pemakaian di results.ts/applicants.ts/priority.ts/assess.ts tidak ditelusuri satu per satu).

## 2. Penentu status diterima dan perilaku rilis/tarik

- Kolom penentu: `placement_decision.decision` bertipe `DecisionType` = `'terima' | 'tolak'` (schema.ts:2519-2520, kolom di schema.ts:2806-2841). Unik per `choiceId` (schema.ts:2833). Tidak ada status cadangan (komentar schema.ts:2805).
- Status hasil perhitungan (`application_choice.computed_status`): `belum_lengkap`, `perlu_ditinjau`, `lolos`, `tidak_lolos` (schema.ts:2056-2063, kolom schema.ts:2386-2388). Ini terpisah dari keputusan terima/tolak.
- Penempatan per divisi: keputusan melekat pada pilihan, dan pilihan melekat pada divisi, sehingga penempatan per divisi ditentukan oleh `application_choice.divisionId`.
- Dua metode: `manual` dan `prioritas` (schema.ts:2011-2012; kolom `placement_method` schema.ts:2139-2142). Jalur manual: `decide` (placement.ts:743-897). Jalur lain: `autofillCommit` (placement.ts:947), `appealAccept` (placement.ts:1227), `directMove` (placement.ts:1305), `closerecAdd` (placement.ts:1867).
- Tahap penempatan: `placementState` `berjalan` -> `masa_banding` -> `final` (schema.ts:1986; transisi di placement.ts:1076-1081). Setelah `final`, `decide` ditolak (placement.ts:754-756). Dari `final` hanya boleh kembali ke `masa_banding` (placement.ts:1079).
- `resultsRelease` (results.ts:497-541): hanya admin; syarat `placementState === 'final'` (results.ts:513-515), `resultsVisibleToApplicants` true (results.ts:516-520), dan belum dirilis (results.ts:521-523). Efeknya hanya `UPDATE recruitment SET results_released_at = now` (results.ts:526-529) dan catatan log `hasil_dirilis` dengan jumlah pilihan belum diputuskan (results.ts:524, 530-536). Rilis tidak memblokir bila masih ada yang belum diputuskan.
- `resultsWithdraw` (results.ts:543-575): hanya admin, alasan wajib, mengosongkan `results_released_at` (results.ts:563-566), log `hasil_ditarik`. Baris `placement_decision` dan `placement` tidak dihapus.
- Tampilan pendaftar: `myResult` (results.ts:577-632) mengembalikan `released: false` bila `visible` false atau `releasedAt` null (results.ts:604-606). Jika dirilis, ia membaca `placement_decision` berstatus `terima` dan nama unit divisi (results.ts:608-631), bukan tabel `placement`.
- Rilis tidak mengunci tahap: tidak ada rujukan `resultsReleasedAt` di placement.ts, sehingga `setPlacementState` tidak memeriksa status rilis (hasil grep).
- Jika `resultsVisibleToApplicants` false (hasil diumumkan di luar Anmategra), rilis tidak mungkin dilakukan (results.ts:516-520), dan penempatan berlaku begitu `final` (oprec-release.ts:5-8, 21-23).

## 3. Hubungan ke organogram

- Organogram menyimpan orang pada `placement` (schema.ts:961-998): `positionId` -> `organization_position`, `userId`, `source` (`oprec`/`closerec`/`manual`/`import`; schema.ts:951-956), `applicationChoiceId` (schema.ts:975-977; null untuk manual/impor), unik per (`positionId`, `userId`) (schema.ts:991). Komentar schema.ts:~960 menyebut tabel ini menggantikan `keanggotaan` dan `kehimpunan` (Fase 2D).
- Otomatis, dan pada saat keputusan: setiap keputusan `terima` pada `decide` menghapus placement sibling lalu menyisipkan placement baru dengan `source: 'oprec'`, `positionId` dari divisi (placement.ts:825-840). Keputusan `tolak` menghapus placement pilihan itu (placement.ts:850-854). Pola yang sama berada pada fungsi bersama (placement.ts:2386-2409), dan `closerec` memakai `source: 'closerec'` (placement.ts:1916, 2391). Jadi pengisi organogram adalah kode oprec, bukan peristiwa rilis.
- Rilis menentukan keterlihatan, bukan keberadaan: `placementReleased` (oprec-release.ts:17-25) benar bila `applicationChoiceId` null (manual/impor), atau `results_released_at` tidak null, atau (`placement_state = 'final'` dan hasil tidak ditampilkan ke pendaftar). Komentar oprec-release.ts:4-9: sebelum rilis, penempatan tidak masuk daftar anggota, profil, maupun hak akses pengurus.
- Pemakai filter itu: daftar anggota periode (membership.ts:77, dilewati bila `includeUnreleased`), keanggotaan per pengguna (membership.ts:539), hak akses organisasi (organization-access.ts:73), dan halaman struktur (structure.ts:139; pengelola melihat semuanya, `isManager`, structure.ts:139).
- Akibat tarik rilis: placement tetap ada, tetapi menjadi tidak terlihat bagi non-pengelola bila `visibleToApplicants` true, karena `results_released_at` kembali null dan kondisi `final AND NOT visible` salah (oprec-release.ts:21-23). Ini inferensi dari ekspresi SQL; belum diuji dengan data.
- Penghapusan unit/posisi dicegah selama ada placement (`on delete restrict`, schema.ts:926-927, 967) dan selama dibuka di oprec (schema.ts:2262-2269).

## 4. Penerimaan ganda

- Satu aplikasi per pengguna per oprec (schema.ts:2357). Pilihan dalam satu aplikasi dibatasi satu penerimaan: `deriveChoiceStage` menutup semua pilihan lain begitu ada keputusan `terima` (allocation.ts:64-76), dan `decide` menolak pilihan tertutup (placement.ts:785-792). Penerimaan baru juga menghapus placement sibling lebih dulu (placement.ts:825-833).
- Mode bertahap (`stagedPlacement`, default true; schema.ts:2138) hanya mengaktifkan satu pilihan pada satu waktu; mode sekaligus mengaktifkan semuanya yang belum ditolak/gagal (allocation.ts:78-98).
- Perpindahan: `transferRequest` pada masa banding dan `moveAcceptance` memindahkan penerimaan dari divisi A ke B (placement.ts:333-384, `fromChoice` placement dihapus pada placement.ts:381-383); jadi bukan dua penerimaan sekaligus.
- Lintas gelombang: gelombang hanya label pada `application`; karena aplikasi unik per (oprec, pengguna), satu pengguna tidak dapat memiliki dua aplikasi pada gelombang berbeda dalam oprec yang sama. Antar oprec dalam satu periode tidak ada pembatas yang terbaca di sini; satu orang boleh memegang banyak posisi (schema.ts:~960).
- Closerec: dapat menambahkan penempatan di luar pilihan; tidak dihitung ke kuota (allocation.ts:108-110). Apakah closerec dapat membuat orang yang sudah diterima menjadi diterima di divisi kedua tidak ditelusuri (placement.ts:1867-1967).

## Hal yang tidak dapat dipastikan

1. Nomor baris yang ditandai `~` diperkirakan dari pembacaan sebagian; periksa ulang sebelum dikutip sebagai rujukan tetap.
2. Apakah ada CHECK basis data yang mewajibkan oprec memiliki minimal satu divisi. Hanya validasi Zod pada setup yang terlihat; migrasi SQL tidak dibaca.
3. Cara kerja "bidang" sebagai pengelompokan divisi pada halaman pengumuman: model hanya memberi hierarki `organization_unit.parent_id` (schema.ts:~838) dan `typeLabel`; tidak ada kode oprec yang mengelompokkan hasil per induk unit (tidak ditelusuri secara menyeluruh).
4. Perilaku pengumuman bila `resultsVisibleToApplicants` true tetapi `placement_state` bukan `final`: rilis diblokir, tetapi `placementReleased` bisa benar lebih awal bila `results_released_at` terisi lalu tahap diturunkan kembali ke `masa_banding`; tidak ada pemeriksaan yang mencegahnya, dan tidak diuji.
5. Pemakaian `application.waveId` di luar gerbang pendaftaran (results.ts, applicants.ts, priority.ts, assess.ts) tidak dibaca rinci.
6. Perilaku data produksi nyata (komentar schema.ts:810-812 menyebut data produksi datar) tidak dapat diverifikasi dari kode.
7. Tidak ada eksekusi aplikasi atau pengujian; seluruh temuan berasal dari pembacaan statis.
