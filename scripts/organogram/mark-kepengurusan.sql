-- Tandai periode yang merupakan kepengurusan lembaganya sendiri (bukan kegiatan).
-- Jalankan SESUDAH migrasi 0034 (lihat README.md di folder ini). Satu transaksi, idempoten, menolak lanjut bila jumlah baris tak terduga.
-- Uji kering: ganti COMMIT di bawah dengan ROLLBACK.
-- Dasar: production-migration-notes.md bagian 3 (3 event menjadi periode lembaga sendiri).
BEGIN;

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM anmategra_lembaga_period
  WHERE name IN ('Anmategra 2024/2025', 'Anmategra 2025/2026', 'Kepengurusan BP UKJ 2025/2026');
  IF n <> 3 THEN
    RAISE EXCEPTION 'Diharapkan 3 periode kepengurusan, ditemukan %', n;
  END IF;
END $$;

UPDATE anmategra_lembaga_period
SET kind = 'kepengurusan'
WHERE name IN ('Anmategra 2024/2025', 'Anmategra 2025/2026', 'Kepengurusan BP UKJ 2025/2026')
  AND kind <> 'kepengurusan';

-- Hasil: tepat tiga baris bertanda kepengurusan (kecuali sudah ada yang dibuat impor).
SELECT kind, count(*) FROM anmategra_lembaga_period GROUP BY kind ORDER BY kind;

COMMIT;
