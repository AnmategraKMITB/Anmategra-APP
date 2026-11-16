-- Atur syarat angkatan kuliah untuk satu oprec yang sudah ada, termasuk yang
-- sedang dibuka.
--
-- Pakai (dari mesin yang bisa menjangkau database; tidak perlu SSH ke server):
--   psql "$DATABASE_URL" -v oprec_id=<id-oprec> -v dari=2024 -v sampai=2025 \
--        -f scripts/oprec/set-angkatan.sql
--
-- Cari id oprec dulu:
--   psql "$DATABASE_URL" -c "select id, name, status from anmategra_recruitment order by created_at desc"
--
-- Yang dilakukan: mengganti syarat `angkatan_kuliah` (rentang dari-sampai,
-- keduanya termasuk) pada oprec itu. Syarat lain tidak disentuh. Semuanya dalam
-- satu transaksi; galat apa pun membatalkan seluruhnya.
-- Berlaku seketika: server membaca syarat setiap kali form dibuka dan dikirim.
-- Pendaftar yang sudah masuk tidak terpengaruh.
-- Uji coba tanpa menyimpan: tambahkan `-v selesai=ROLLBACK` (bawaan COMMIT).

\set ON_ERROR_STOP on
\if :{?selesai}
\else
  \set selesai COMMIT
\endif

BEGIN;

SELECT set_config('oprec.id', :'oprec_id', true);
SELECT set_config('oprec.dari', :'dari', true);
SELECT set_config('oprec.sampai', :'sampai', true);

DO $$
DECLARE
  rid text := current_setting('oprec.id');
  d int := current_setting('oprec.dari')::int;
  s int := current_setting('oprec.sampai')::int;
BEGIN
  IF d > s OR d < 1990 OR s > 2100 THEN
    RAISE EXCEPTION 'Rentang angkatan tidak sah: % sampai %', d, s;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM anmategra_recruitment WHERE id = rid) THEN
    RAISE EXCEPTION 'Oprec dengan id % tidak ditemukan', rid;
  END IF;
END $$;

\echo '== Oprec'
SELECT id, name, status, eligibility_match FROM anmategra_recruitment
 WHERE id = :'oprec_id';

\echo '== Syarat sebelum'
SELECT attribute, op, value FROM anmategra_recruitment_eligibility_rule
 WHERE recruitment_id = :'oprec_id';

DELETE FROM anmategra_recruitment_eligibility_rule
 WHERE recruitment_id = :'oprec_id' AND attribute = 'angkatan_kuliah';

INSERT INTO anmategra_recruitment_eligibility_rule (id, recruitment_id, attribute, op, value)
VALUES (gen_random_uuid()::text, :'oprec_id', 'angkatan_kuliah', 'between',
        jsonb_build_array(:dari::int, :sampai::int));

\echo '== Syarat sesudah'
SELECT attribute, op, value FROM anmategra_recruitment_eligibility_rule
 WHERE recruitment_id = :'oprec_id';

:selesai;
