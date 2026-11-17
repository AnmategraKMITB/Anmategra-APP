# Riset ekspor Hasil oprec (tiket #477)

Commit `develop` yang dibaca: `c4af7e433fea5e5e4d381e6f03007b8491f71964`. Dokumen ini hanya memuat fakta dari kode; tidak ada rekomendasi atau keputusan.

## Ringkasan jawaban

1. Ekspor memuat semua pendaftar beserta status tiap pilihannya, bukan hanya yang diterima. Tidak ada filter status pada pengambilan data (`src/server/api/routers/oprec/results.ts:385-403`) maupun pada rute (`src/app/api/oprec/[recruitmentId]/hasil/route.ts:47-55`). Tab Rekap (CSV dan XLSX) memuat semua pendaftar (`route.ts:57-77`, `route.ts:94-98`). Tab per divisi (hanya XLSX) memuat hanya pendaftar yang diterima di divisi tersebut (`route.ts:104-107`). CSV tidak memiliki tab divisi.
2. Rekap berisi 5 kolom identitas, kolom `Pilihan 1..N`, dan `Diterima di` (`src/server/api/routers/oprec/applicants-export.ts:99-107`). Tab divisi berisi 5 kolom (`route.ts:23-29`). Pengunduh adalah admin oprec, serta pengurus atau penilai menurut mode `resultsAccess` (`results.ts:56-80`, `src/lib/oprec/results.ts:13-18`). Ekspor tidak mengikuti status rilis.
3. Pembatasan pada yang diterima akan menyentuh `route.ts` (pengisian `rows` dan `resultsTable`) dan `applicants-export.ts` (`resultsTable`). Tidak ditemukan uji untuk rute ekspor maupun `resultsTable`.

## Pertanyaan 1: cakupan baris ekspor

Rute `GET` memanggil `resultsOverview` lalu `resultsList` berulang per halaman (ukuran `RESULTS_MAX_PAGE_SIZE` = 100, `src/server/api/types/oprec.type.ts:232`) sampai seluruh baris terkumpul (`route.ts:45-55`). Panggilan itu tidak mengirim `search`, `divisionId`, maupun status. `resultsList` membentuk klausa `where` hanya dari `recruitmentId`, `search`, dan `divisionId` (`results.ts:385-403`); tidak ada kondisi pada keputusan atau status akhir. Baris yang dikembalikan membawa `finalStatus` (`diterima`, `belum_diputuskan`, `tidak_diterima`; `results.ts:465`, `src/lib/oprec/results.ts:32-38`), tetapi rute tidak menyaring berdasarkan nilai itu.

**Tab Rekap, CSV dan XLSX.** Semua baris `rows` dipetakan ke `resultsTable` (`route.ts:57-77`). Setiap pilihan diberi status `diterima`, `ditolak`, atau `belum` dari `choice.decision` (`route.ts:65-74`) dan ditulis sebagai `<label> · <status>` dengan status `Diterima`, `Ditolak`, atau `Belum diputuskan` (`applicants-export.ts:88-92`, `applicants-export.ts:116-121`). Pendaftar yang tidak diterima di mana pun tetap muncul dengan kolom `Diterima di` kosong (`applicants-export.ts:122`). CSV memakai tabel yang sama (`route.ts:82-84`); XLSX menulisnya pada tab `Rekap` (`route.ts:94-98`).

**Tab per divisi, hanya XLSX.** Untuk setiap divisi di `overview.divisions`, baris disaring dengan `row.acceptedDivisionId === division.id` (`route.ts:104-107`), sehingga hanya pendaftar yang diterima di divisi itu yang masuk (`route.ts:112-122`). `acceptedDivisionId` berasal dari pilihan berkeputusan `terima` (`results.ts:457`, `results.ts:466`).

**Pemanggil UI.** Satu-satunya pemanggil adalah dua tautan unduh `Ekspor CSV` dan `Ekspor XLSX` pada `src/app/_components/oprec/hasil/hasil-view.tsx:205-220` (href `/api/oprec/${recruitmentId}/hasil?format=${format}`, baris 216). Tautan dinonaktifkan bila `overallTotal === 0` (`hasil-view.tsx:181`, `207-212`). Tautan tidak membawa parameter pencarian, divisi, atau filter status, sehingga filter layar (`hasil-view.tsx:39`, `116-143`, `180`) tidak memengaruhi ekspor. Halaman dirender oleh `src/app/_components/oprec/hasil-page.tsx:14` dari tiga rute halaman (`src/app/manage|mahasiswa|lembaga/kegiatan/[kegiatanId]/oprec/[recruitmentId]/hasil/page.tsx:1`).

## Pertanyaan 2: kolom, akses, dan rilis

**Kolom.** Lihat bagian Daftar kolom. Komentar kode menyatakan ekspor tidak memuat alasan, flag, atau catatan sensitif (`route.ts:31-34`, `applicants-export.ts:68-69`, `applicants-export.ts:94-97`); pemetaan pada `route.ts:57-77` memang tidak meneruskan `reason`, `tag`, maupun `origin`.

**Akses.** Rute memakai `createCaller` dengan konteks sesi permintaan (`route.ts:42`). Tiga prosedur yang dipanggil (`resultsOverview`, `resultsList`, `resultsLogExport`) memakai `oprecAssessProcedure` (`results.ts:296`, `370`, `639`), yang menolak dengan `FORBIDDEN` bila pengguna bukan admin, Kadiv, penilai umum, atau penilai tambahan (`src/server/api/trpc.ts:627-661`; peran pada `src/server/api/routers/oprec/assess-access.ts:49-89`). Lalu `assertResultsAccess` memberlakukan `resultsAccess` (`results.ts:56-80`):
- admin oprec selalu lolos (`results.ts:57`);
- mode `admin`: selain admin ditolak (`results.ts:58-63`);
- mode `admin_ketua` (bawaan, `src/lib/oprec/results.ts:17`): lolos bila `deciderDivisionIds` tidak kosong, yaitu pengurus divisi bila `headDecides` (`results.ts:65-72`, `assess-access.ts:71-73`);
- mode `semua`: lolos bila `divisionIds` tidak kosong, yaitu pengurus divisi (kecuali mode penilai `umum`) atau penilai tambahan berlingkup divisi (`results.ts:74-79`, `assess-access.ts:74-80`). Penilai umum (`divisionIds` kosong) ditolak pada mode ini.

Kode galat dipetakan ke status HTTP 401/403/404/400/409 (`route.ts:15-21`, `138-143`). Data yang diekspor mencakup seluruh pendaftar tanpa pembatasan lingkup divisi bagi pengelola non-admin; filter `divisionId` tidak dikirim rute.

**Status rilis.** Tidak ada pemeriksaan `resultsReleasedAt`, `placementState`, atau `resultsVisibleToApplicants` pada rute, `resultsList`, maupun `resultsLogExport` (`results.ts:370-373`, `639-642`). Status tersebut hanya dibaca `resultsOverview` untuk ditampilkan (`results.ts:325-339`) dan dipakai pada rilis (`results.ts:496-538`). Ekspor dengan demikian tersedia sebelum maupun sesudah rilis, dan dapat memuat keputusan yang belum final. Setiap ekspor dicatat sebagai aksi `hasil_diekspor` dengan format (`results.ts:638-651`, dipanggil di `route.ts:80`).

## Pertanyaan 3: bagian kode yang terdampak

Bagian yang membentuk isi ekspor:
- `route.ts:46-55`: pengumpulan `rows` (semua pendaftar).
- `route.ts:57-77`: pemetaan ke `resultsTable`, termasuk status per pilihan.
- `route.ts:94-98`: tab Rekap XLSX; `route.ts:82-84`: CSV.
- `route.ts:104-107`: filter tab divisi (sudah memakai `acceptedDivisionId`).
- `applicants-export.ts:98-126`: `resultsTable` (header, kolom pilihan berstatus, `Diterima di`), serta konstanta `RESULT_STATUS` (`applicants-export.ts:88-92`).
- `hasil-view.tsx:205-220`: tautan unduh, bergantung pada `overallTotal` (jumlah semua pendaftar).
- `results.ts:370-403`: `resultsList` (sumber baris; mendukung `divisionId` dan `search`, tanpa filter status; skema pada `oprec.type.ts:232-241`).

**Uji yang terdampak.** Pencarian `applicants-export`, `resultsTable`, `resultsFilename`, `safeSheetName`, `safeCell`, `resultsList`, `resultsLogExport`, dan `hasil_diekspor` pada berkas `*.test.*` tidak menemukan acuan. Uji terkait Hasil yang ada hanyalah `src/lib/oprec/results.test.ts` (`resultsMode` baris 5-16, `fallbackReason` baris 19, `finalStatus` baris 29), yang tidak menyentuh kode ekspor, dan `src/server/api/oprec-release.test.ts` (baris 39, 56; perilaku penempatan sebelum rilis, bukan ekspor). Tidak ditemukan uji e2e di repositori. Dengan demikian tidak ada uji yang akan gagal akibat perubahan isi ekspor, dan tidak ada uji yang melindungi perilaku ekspor saat ini.

## Kutipan kode

Tidak ada filter status pada pengumpulan baris (`route.ts:46-55`):

```ts
const rows: Awaited<ReturnType<typeof api.oprec.resultsList>>['rows'] = [];
for (let page = 1; ; page++) {
  const data = await api.oprec.resultsList({
    recruitmentId,
    page,
    pageSize: RESULTS_MAX_PAGE_SIZE,
  });
  rows.push(...data.rows);
  if (rows.length >= data.total || data.rows.length === 0) break;
}
```

Klausa `where` pada `resultsList` (`results.ts:385-403`) hanya berisi `recruitmentId`, `search`, dan `divisionId`:

```ts
const parts = [eq(application.recruitmentId, ctx.recruitment.id)];
if (input.search) { ... }
if (input.divisionId) { ... }
const where = and(...parts)!;
```

Satu-satunya filter status, pada tab divisi (`route.ts:104-107`):

```ts
const accepted = rows.filter(
  (row) => row.acceptedDivisionId === division.id,
);
```

Pemetaan status pilihan di Rekap (`route.ts:65-74`):

```ts
choices: row.choices.map((choice) => ({
  rank: choice.rank,
  label: choice.label,
  status:
    choice.decision === 'terima' ? ('diterima' as const)
    : choice.decision === 'tolak' ? ('ditolak' as const)
    : ('belum' as const),
})),
```

Penegakan akses (`results.ts:56-80`, dipanggil di `results.ts:299`, `373`, `642`) dan tiadanya pemeriksaan rilis pada `resultsList` (`results.ts:370-373`):

```ts
resultsList: oprecAssessProcedure
  .input(ResultsListInputSchema)
  .query(async ({ ctx, input }) => {
    assertResultsAccess(ctx.assess, resultsMode(ctx.recruitment));
```

## Daftar kolom

**Rekap, CSV dan XLSX** (`applicants-export.ts:99-107`, isi baris `108-124`), sebanyak 6 + `maxChoices` kolom:
1. `Gelombang` (`waveLabel`)
2. `Nama`
3. `NIM`
4. `Program studi`
5. `Angkatan`
6. `Pilihan 1` sampai `Pilihan N`, dengan N = `maxChoices` recruitment (`route.ts:76`); isi `<label divisi> · Diterima|Ditolak|Belum diputuskan`, kosong bila pilihan tidak ada
7. `Diterima di` (label divisi tempat diterima, atau kosong)

**Tab per divisi, hanya XLSX** (`route.ts:23-29`, isi `route.ts:113-121`): `Nama`, `NIM`, `Program studi`, `Angkatan`, `Gelombang`.

Rincian lain: baris pertama dibekukan dan ditebalkan, lebar kolom 22 (`route.ts:95`, `99-102`, `111`, `123-126`); sel berawalan `= + - @` tab atau CR diberi apostrof (`applicants-export.ts:146-151`); CSV memakai BOM UTF-8 dan CRLF (`applicants-export.ts:46-51`); nama berkas `<slug>-hasil.<ext>` (`applicants-export.ts:153-158`); nama tab maksimal 31 karakter dan unik (`applicants-export.ts:128-144`).
