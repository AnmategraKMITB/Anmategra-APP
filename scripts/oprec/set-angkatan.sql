-- Atur syarat angkatan kuliah untuk satu oprec yang sudah ada.
--
-- Pakai (dari mesin yang bisa menjangkau database; tidak perlu SSH ke server):
--   psql "$DATABASE_URL" -v oprec_id="'<id-oprec>'" -v dari=2024 -v sampai=2026 \
--        -f scripts/oprec/set-angkatan.sql
--
-- Cari id oprec dulu:
--   psql "$DATABASE_URL" -c "select id, name, status from anmategra_recruitment order by created_at desc"
--
-- Skrip ini hanya menyentuh syarat `angkatan_kuliah` oprec itu: syarat lain
-- dibiarkan. Berjalan dalam satu transaksi dan menampilkan syarat sebelum
-- dan sesudah. Ganti COMMIT dengan ROLLBACK untuk uji coba.
-- Nilai disimpan sebagai rentang (op `between`) yang berlaku di server saat
-- formulir dibuka dan saat dikirim; mengubahnya tidak memengaruhi pendaftar lama.

\set ON_ERROR_STOP on
BEGIN;

\echo '== Sebelum'
SELECT attribute, op, value FROM anmategra_recruitment_eligibility_rule
 WHERE recruitment_id = :oprec_id;

DELETE FROM anmategra_recruitment_eligibility_rule
 WHERE recruitment_id = :oprec_id AND attribute = 'angkatan_kuliah';

INSERT INTO anmategra_recruitment_eligibility_rule (id, recruitment_id, attribute, op, value)
VALUES (gen_random_uuid()::text, :oprec_id, 'angkatan_kuliah', 'between',
        jsonb_build_array(:dari::int, :sampai::int));

\echo '== Sesudah'
SELECT attribute, op, value FROM anmategra_recruitment_eligibility_rule
 WHERE recruitment_id = :oprec_id;

COMMIT;
