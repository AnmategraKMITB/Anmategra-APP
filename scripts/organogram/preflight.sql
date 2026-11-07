-- Pemeriksaan sebelum deploy organogram (hanya membaca, aman dijalankan kapan saja).
-- psql "$DATABASE_URL" -f scripts/organogram/preflight.sql
\echo '== 1. Tingkat migrasi (develop terbaru: 39 berkas, 0000 sampai 0038)'
SELECT count(*) AS migrasi_terpasang, max(created_at) AS terakhir FROM drizzle.__drizzle_migrations;

\echo '== 2. Tabel kunci yang sudah ada (anmategra_event ada = skema lama sebelum 0029; anmategra_lembaga_period ada = sudah melewati 0029)'
SELECT t AS tabel, to_regclass('public.' || t) IS NOT NULL AS ada
FROM unnest(ARRAY[
  'anmategra_event', 'anmategra_lembaga_period', 'anmategra_lembaga_membership', 'anmategra_access_grant',
  'anmategra_organization_structure', 'anmategra_organization_unit',
  'anmategra_organization_position', 'anmategra_placement',
  'anmategra_keanggotaan', 'anmategra_kehimpunan'
]) AS t;

\echo '== 3. Ukuran data'
SELECT
  (SELECT count(*) FROM anmategra_lembaga) AS lembaga,
  (SELECT count(*) FROM anmategra_keanggotaan) AS keanggotaan,
  (SELECT count(*) FROM anmategra_kehimpunan) AS kehimpunan;

\echo '== 4. Tanda pembersihan produksi (phase0-cleanup.sql) sudah jalan?'
-- Hanya relevan bila skema masih lama (anmategra_event ada). Tanpa pembersihan: lembaga ganda bernama sama atau banyak lembaga tanpa tipe.
SELECT name, count(*) AS baris FROM anmategra_lembaga GROUP BY name HAVING count(*) > 1 ORDER BY name;
SELECT count(*) FILTER (WHERE type IS NULL) AS lembaga_tanpa_tipe FROM anmategra_lembaga;

\echo '== 5. Hanya jika migrasi 0034 ke atas sudah terpasang: sebaran jenis periode dan organogram'
SELECT kind, count(*) FROM anmategra_lembaga_period GROUP BY kind ORDER BY kind;
SELECT count(*) AS struktur_aktif FROM anmategra_organization_structure WHERE is_active;
