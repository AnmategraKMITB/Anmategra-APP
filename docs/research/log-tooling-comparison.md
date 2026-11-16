# Perbandingan alat log dan pemantauan galat

Tiket: [#451](https://github.com/AnmategraKMITB/Anmategra-APP/issues/451). Peta induk: [#434](https://github.com/AnmategraKMITB/Anmategra-APP/issues/434). Tiket terkait: [#305](https://github.com/AnmategraKMITB/Anmategra-APP/issues/305), [#218](https://github.com/AnmategraKMITB/Anmategra-APP/issues/218). Tanggal akses seluruh sumber: 16 November 2026. Tidak ada alat yang dipasang dan tidak ada akun layanan yang dibuat.

## Kesimpulan

Rekomendasi: **GlitchTip hosting mandiri di server ITB** untuk galat aplikasi, ditambah **`admin_audit` yang sudah ada** untuk kejadian keamanan, dan **log kontainer dengan rotasi** sebagai sumber log mentah. GlitchTip dipilih karena memakai SDK Sentry, berlisensi MIT, dan menurut dokumentasinya cukup dengan 512 MB RAM serta PostgreSQL. Dengan demikian, data galat tidak meninggalkan server ITB dan beban pada server 4 inti tetap kecil. Grafana Loki dengan Grafana menjadi tahap lanjutan bila pencarian log dan peringatan atas pola keamanan memang diperlukan.

## Kondisi kode saat ini (cabang `develop`)

- Tidak ada pelacak galat atau pustaka log. Log berupa `console`, dan jumlah pemanggilan `console.error` serta `console.warn` di `src` adalah 63.
- `src/server/api/log-error.ts` sudah menulis log galat tRPC berformat JSON satu baris, hanya berisi `path`, `code`, `httpStatus`, `type`, dan `durationMs`. Pesan galat, input, dan token sengaja dikecualikan. Penangannya ada di `onError` pada `src/app/api/trpc/[trpc]/route.ts`.
- `src/instrumentation.ts` sudah ada dan hanya menjalankan pemantau event loop. Berkas ini menjadi tempat pemasangan SDK.
- Tabel `admin_audit` (`src/server/db/schema.ts`) memuat `actor_id`, `action`, `entity_type`, `entity_id`, `summary`, `metadata`, `ip`, dan `created_at`. Isinya tindakan admin, bukan kejadian keamanan seperti login gagal atau penolakan 401/403.

## Tabel perbandingan

Sel yang bertanda "(tidak terverifikasi)" tidak dinyatakan pada halaman dokumentasi yang dibaca dan perlu diuji sebelum keputusan final.

| Dimensi | Sentry terkelola (SaaS) | Sentry hosting mandiri | GlitchTip (mandiri) | Grafana Loki + Grafana | ELK / Kibana | Hanya `admin_audit` + log kontainer |
|---|---|---|---|---|---|---|
| Biaya | Developer gratis (1 pengguna, 5 ribu galat, retensi 30 hari). Team US$29/bulan (US$26 tahunan, 50 ribu galat). Kelebihan kuota ditagih tambahan. | Tanpa biaya lisensi (Functional Source License, menjadi Apache 2.0 setelah 2 tahun). Biaya berupa perangkat keras dan waktu operator. | Hosting mandiri gratis (MIT). Dokumentasi meminta donasi sukarela US$5 per pengguna per bulan, tanpa fitur yang dikunci. | Gratis (Loki berlisensi AGPLv3). Biaya berupa server dan waktu operator. | Gratis pada tingkat Basic (Elastic License; kode sumber juga tersedia di bawah AGPLv3 sejak 2024). Fitur tertentu, seperti aturan peringatan berbasis deteksi anomali, berbayar. | Tanpa biaya tambahan. |
| Beban sumber daya (server 4 inti, tanpa batas per layanan) | Tidak ada di server ITB. Hanya SDK pada aplikasi. | Berat: minimum 4 inti, RAM 16 GB ditambah swap 16 GB (disarankan 32 GB), disk 20 GB, I/O disk tinggi, puluhan layanan (Kafka, ClickHouse, Snuba, dan lain-lain). Tidak muat di server yang sama dengan aplikasi tanpa risiko. | Ringan: disarankan 512 MB RAM, minimum 256 MB mode semua-dalam-satu; Valkey/Redis opsional. Disk kira-kira 30 GB per 1 juta kejadian per bulan. | Sedang. Mode biner tunggal tersedia, tetapi panduan ukuran resmi hanya memuat tingkat besar (di atas 38 inti), sehingga kebutuhan skala kecil tidak terverifikasi. Ditambah satu proses Grafana dan agen pengirim log. | Berat: Elasticsearch berbasis JVM dan ingin menguasai seluruh host; perlu pengaturan sistem (`vm.max_map_count`, batas berkas dan thread). Angka minimum tidak dinyatakan pada halaman yang dibaca (tidak terverifikasi). | Hampir nol. |
| Hosting di server ITB | Tidak berlaku (layanan luar). | Mungkin, tetapi hanya pada mesin khusus. Distro yang disarankan Debian/Ubuntu; dukungan "tanpa jaminan". | Mudah: Docker Compose, PostgreSQL 14 ke atas, proksi balik. Basis data dapat memakai PostgreSQL yang sama (instans terpisah lebih aman). | Mudah secara teknis (biner tunggal, penyimpanan berkas lokal). Dokumentasi menyebut penyimpanan berkas hanya untuk pengembangan atau uji coba; penyimpanan objek (S3/GCS) dianjurkan. | Sedang sampai sulit: tiga komponen (Elasticsearch, Kibana, pengirim log) dan penyetelan sistem. | Sudah berjalan. |
| Data pribadi dan lokasi data | Pilihan wilayah AS (Iowa) atau UE (Frankfurt) saat membuat organisasi, tidak dapat diubah. Akun, log audit, dan metadata organisasi tetap disimpan di AS. Data galat keluar dari ITB. | Seluruh data di ITB. | Seluruh data di ITB. Pembersihan data pribadi bergantung pada SDK dan konfigurasi (tidak terverifikasi). | Seluruh data di ITB. | Seluruh data di ITB. | Seluruh data di ITB. |
| Integrasi Next.js dan tRPC | Resmi: `@sentry/nextjs`, `instrumentation.ts` dengan `onRequestError`, `global-error.tsx`, dan `Sentry.trpcMiddleware`. Opsi `dataCollection` mengatur data yang dikirim. | Sama dengan SaaS (SDK yang sama). | SDK Sentry; Next.js tercantum di daftar SDK GlitchTip. Keserasian dengan fitur terbaru SDK (mis. `trpcMiddleware`) tidak dinyatakan secara rinci (tidak terverifikasi). | Tidak ada pelacak galat. Log JSON dari `console` dikirim lewat agen. Sudah selaras dengan `log-error.ts`. | Sama seperti Loki: log JSON dikirim lewat agen. Tanpa SDK galat. | Tidak ada jejak tumpukan. Hanya log JSON dan baris audit. |
| Peringatan | Email pada Developer; integrasi dan jenis tambahan pada Team ke atas. | Lengkap. | Peringatan lewat email dan integrasi. Rincian tidak ada di halaman yang dibaca (tidak terverifikasi). | Peringatan Grafana atau Loki ruler dengan kueri LogQL; cocok untuk pola seperti lonjakan login gagal. | Aturan peringatan Kibana; sebagian tingkat berbayar. | Tidak ada. Perlu skrip atau kueri berkala. |
| Usaha pemeliharaan tim kecil | Paling rendah. | Tinggi: pembaruan rutin, banyak layanan, dukungan terbatas pada upaya terbaik. | Rendah sampai sedang: tiga atau empat kontainer, pembaruan lewat Compose. | Sedang: konfigurasi retensi (compactor), label, kueri LogQL, dan satu dasbor tambahan. Retensi bawaan Loki adalah selamanya. | Tinggi. | Paling rendah, tetapi tidak memenuhi kebutuhan galat dan peringatan. |

## Rekomendasi: GlitchTip mandiri, `admin_audit`, dan log kontainer

Alasan:

1. **Data tetap di ITB.** Hanya GlitchTip, Sentry mandiri, Loki, ELK, dan opsi tanpa alat baru yang menjaga data di server sendiri. Hal ini sejalan dengan butir #305 tentang perlakuan data pribadi dan dengan rencana migrasi di #218.
2. **Beban paling kecil di antara alat yang menyediakan pelacakan galat.** Rujukan resmi GlitchTip menyebut 512 MB RAM. Sentry mandiri membutuhkan 16 GB ditambah swap.
3. **Biaya nol dan lisensi MIT.** Tidak ada ketergantungan pada kuota atau tagihan.
4. **Integrasi kecil.** SDK Sentry pada Next.js dipasang lewat `src/instrumentation.ts` yang sudah ada. Pemanggilan `captureException` dapat ditambahkan pada `onError` tRPC tanpa mengubah `log-error.ts`.
5. **Kejadian keamanan tidak membutuhkan alat baru pada tahap awal.** Penolakan akses dan login gagal dapat ditulis ke `admin_audit` atau log JSON, dan retensinya dikelola dengan SQL serta rotasi log.

Pengaturan yang disarankan:

- Atur `max-size` dan `max-file` pada driver `json-file` Docker. Bawaan Docker adalah tanpa rotasi, sehingga log tumbuh tanpa batas.
- Matikan pengiriman data pengguna pada SDK (`dataCollection: { userInfo: false }`) dan jangan menyalakan `attachRpcInput` pada tRPC, agar input tidak masuk ke galat. Pola ini mengikuti prinsip `log-error.ts`.
- Pasang GlitchTip pada basis data terpisah, dengan batas memori per kontainer agar tidak mengganggu aplikasi, karena server tidak memiliki batas per layanan.

Risiko yang harus diuji sebelum keputusan final (tanpa memasang di produksi): keserasian SDK Sentry versi terbaru dengan GlitchTip, kemampuan pembersihan data pribadi di sisi server GlitchTip, dan rincian peringatan GlitchTip. Bila salah satu gagal, cadangannya adalah Sentry terkelola wilayah UE hanya untuk galat, dengan catatan bahwa data meninggalkan ITB.

## Alternatif yang ditolak

- **Sentry terkelola.** Data galat berada di luar ITB, dan akun serta metadata organisasi tetap di AS. Kuota gratis kecil (5 ribu galat, satu pengguna, peringatan hanya lewat email). Dapat dipertimbangkan sebagai cadangan sementara sebelum server ITB siap, bukan sebagai pilihan utama.
- **Sentry hosting mandiri.** Kebutuhan 16 GB RAM ditambah swap dan I/O tinggi tidak sesuai dengan server 4 inti tanpa batas per layanan, dan dukungan resmi tanpa jaminan.
- **ELK/Kibana.** Terlalu berat dan rumit bagi tim kecil, penyetelan sistem diperlukan, dan sebagian fitur peringatan berbayar. Tidak ada pelacak galat bawaan.
- **Grafana Loki dengan Grafana (sebagai pilihan utama).** Tidak ada pelacakan galat dengan jejak tumpukan. Panduan ukuran resmi tidak mencakup skala kecil, dan retensi harus dikonfigurasi. Tetap menjadi kandidat tahap kedua untuk pencarian log dan peringatan pola keamanan.
- **Hanya `admin_audit` ditambah log kontainer.** Tidak memenuhi kriteria #305 tentang galat dengan konteks pelacakan dan peringatan. Bagian ini justru dipertahankan sebagai fondasi pada rekomendasi di atas.

## Usulan nasib #305

Pertahankan #305 sebagai tiket induk, tetapi ubah judul dan cakupannya menjadi dua tiket implementasi setelah pemilik menjawab [Grilling] Pilihan alat log (#455):

1. **Pelacakan galat:** pasang GlitchTip mandiri dan SDK, lengkap dengan dokumentasi operasi dan pengujian bahwa tidak ada data pribadi pada galat. Tiket ini bergantung pada akses server di #218.
2. **Log kejadian keamanan:** catat login gagal, penolakan 401/403, perubahan role dan hibah akses, serta ekspor data ke `admin_audit` (atau tabel kejadian terpisah) dengan kebijakan retensi. Tiket ini tidak bergantung pada #218 dan dapat dikerjakan lebih dahulu.

Peringatan atas pola mencurigakan (butir ketiga #305) ditunda sampai ada keputusan apakah Loki dengan Grafana diperlukan. Tiket #305 ditutup oleh PR implementasi (`Closes #305`) setelah kedua tiket selesai, bukan oleh dokumen ini.

## Rujukan (diakses 16 November 2026)

- Sentry, harga: https://sentry.io/pricing/
- Sentry hosting mandiri: https://develop.sentry.dev/self-hosted/
- Sentry, lokasi penyimpanan data: https://docs.sentry.io/organization/data-storage-location/
- Sentry untuk Next.js: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Sentry, integrasi tRPC: https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/integrations/trpc/
- GlitchTip, pemasangan: https://glitchtip.com/documentation/install
- GlitchTip, dokumentasi: https://glitchtip.com/documentation
- GlitchTip, harga: https://glitchtip.com/pricing
- GlitchTip, daftar SDK: https://glitchtip.com/sdkdocs
- GlitchTip, kode sumber (lisensi MIT): https://gitlab.com/glitchtip/glitchtip-backend
- Grafana Loki, ikhtisar: https://grafana.com/docs/loki/latest/get-started/overview/
- Grafana Loki, retensi: https://grafana.com/docs/loki/latest/operations/storage/retention/
- Grafana Loki, peringatan: https://grafana.com/docs/loki/latest/alert/
- Grafana Loki, ukuran: https://grafana.com/docs/loki/latest/setup/size/
- Grafana Loki, lisensi (AGPLv3): https://raw.githubusercontent.com/grafana/loki/main/LICENSE
- Grafana Alerting: https://grafana.com/docs/grafana/latest/alerting/
- Elasticsearch, konfigurasi sistem: https://www.elastic.co/guide/en/elasticsearch/reference/current/system-config.html
- Elasticsearch, pengaturan penting: https://www.elastic.co/guide/en/elasticsearch/reference/current/important-settings.html
- Elastic, langganan: https://www.elastic.co/subscriptions
- Elastic, lisensi: https://www.elastic.co/pricing/faq/licensing
- Docker, driver `json-file`: https://docs.docker.com/engine/logging/drivers/json-file/
