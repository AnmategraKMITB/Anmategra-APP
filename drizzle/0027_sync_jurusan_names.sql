-- Custom SQL migration file, put your code below! --
-- Selaraskan anmategra_mahasiswa.jurusan dengan kode-program-studi.json, yang sekarang
-- mengikuti daftar program studi SIX ITB. Hanya baris dengan nama lama/salah yang diubah.

-- Nama lama: Aeronotika dan Astronotika -> Teknik Dirgantara (S1 136, S2 236, S3 336).
UPDATE "anmategra_mahasiswa" SET "jurusan" = 'Teknik Dirgantara'
WHERE left("nim"::text, 3) IN ('136', '236', '336') AND "jurusan" = 'Aeronotika dan Astronotika';
--> statement-breakpoint
-- Nama lama: Manajemen Rekayasa Industri -> Manajemen Rekayasa.
UPDATE "anmategra_mahasiswa" SET "jurusan" = 'Manajemen Rekayasa'
WHERE left("nim"::text, 3) = '144' AND "jurusan" = 'Manajemen Rekayasa Industri';
--> statement-breakpoint
-- Salah jurusan: kode 145 dulu tercatat sama dengan 144 di tabel kode.
UPDATE "anmategra_mahasiswa" SET "jurusan" = 'Teknik Bioenergi dan Kemurgi'
WHERE left("nim"::text, 3) = '145' AND "jurusan" IN ('Manajemen Rekayasa Industri', 'TPB');
--> statement-breakpoint
-- Nama lama: Teknik Panas Bumi -> Teknik Geotermal (S2 226).
UPDATE "anmategra_mahasiswa" SET "jurusan" = 'Teknik Geotermal'
WHERE left("nim"::text, 3) = '226' AND "jurusan" = 'Teknik Panas Bumi';
--> statement-breakpoint
-- Kode yang dulu belum dikenal saat login, sehingga tercatat "TPB".
UPDATE "anmategra_mahasiswa" SET "jurusan" = 'Aktuaria'
WHERE left("nim"::text, 3) = '108' AND "jurusan" = 'TPB';
--> statement-breakpoint
UPDATE "anmategra_mahasiswa" SET "jurusan" = 'Tahap Tahun Pertama SITH-S'
WHERE left("nim"::text, 3) = '161' AND "jurusan" = 'Tahap Tahun Pertama SITH';
