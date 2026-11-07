-- Pembersihan data sebelum migrasi Fase 1 (keputusan 6 November 2026, lihat production-migration-notes.md).
-- Berjalan pada skema level migrasi 0016/0017 (produksi saat ini) dan pada skema yang lebih baru.
-- Satu transaksi, bisa dijalankan ulang (idempoten), menolak lanjut bila ada acuan tak terduga.
--   Uji kering : sed 's/^COMMIT;/ROLLBACK;/' phase0-cleanup.sql | psql -v ON_ERROR_STOP=1 ...
--   Jalankan   : psql -v ON_ERROR_STOP=1 -f phase0-cleanup.sql ...
-- Catatan: nilai enum `Organisasi`/`Pusat` belum ada di skema ini; tipe Organisasi diisi oleh migrasi Fase 1.

BEGIN;

-- Pembantu sementara (hilang saat sesi berakhir).
CREATE FUNCTION pg_temp.refs(target regclass, val text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE r record; n int; total int := 0;
BEGIN
  FOR r IN SELECT k.conrelid::regclass AS t, a.attname AS c
           FROM pg_constraint k JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
           WHERE k.confrelid = target AND k.contype = 'f' LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.t, r.c) INTO n USING val;
    total := total + n;
  END LOOP;
  RETURN total;
END $$;

CREATE FUNCTION pg_temp.repoint(target regclass, from_id text, to_id text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT k.conrelid::regclass AS t, a.attname AS c
           FROM pg_constraint k JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
           WHERE k.confrelid = target AND k.contype = 'f' LOOP
    EXECUTE format('UPDATE %s SET %I = $2 WHERE %I = $1', r.t, r.c, r.c) USING from_id, to_id;
  END LOOP;
END $$;

CREATE TEMP TABLE _sebelum AS
SELECT
  (SELECT count(*) FROM anmategra_lembaga) AS lembaga,
  (SELECT count(*) FROM anmategra_lembaga WHERE type IS NULL) AS lembaga_tanpa_tipe,
  (SELECT count(*) FROM anmategra_event) AS event,
  (SELECT count(*) FROM anmategra_event WHERE status = 'On going') AS event_on_going;

-- 1. Tipe Kepanitiaan untuk kepanitiaan yang jelas (yang lain diisi Organisasi oleh Fase 1).
UPDATE anmategra_lembaga SET type = 'Kepanitiaan'
WHERE name IN ('Aku Masuk ITB', 'Kaderisasi Awal Terpusat', 'Human Resource KAT ITB 2024') AND type IS NULL;

-- 2. Baris kembar lembaga: pertahankan baris dengan anggota kehimpunan terbanyak, hapus sisanya hanya bila tidak diacu.
DO $$
DECLARE keep_id text; r record;
BEGIN
  SELECT l.id INTO keep_id FROM anmategra_lembaga l
  WHERE l.name = 'HIMA TG "TERRA" ITB'
  ORDER BY (SELECT count(*) FROM anmategra_kehimpunan k WHERE k.lembaga_id = l.id) DESC, l.created_at ASC LIMIT 1;
  IF keep_id IS NULL THEN RETURN; END IF;
  FOR r IN SELECT id FROM anmategra_lembaga WHERE name = 'HIMA TG "TERRA" ITB' AND id <> keep_id LOOP
    IF pg_temp.refs('anmategra_lembaga', r.id) > 0 THEN
      RAISE EXCEPTION 'Baris kembar TERRA % masih diacu; hentikan dan periksa', r.id;
    END IF;
    DELETE FROM anmategra_lembaga WHERE id = r.id;
  END LOOP;
  UPDATE anmategra_lembaga SET type = 'Himpunan' WHERE id = keep_id AND type IS NULL;
END $$;

-- 3. Event uji dan event kosong yang dihapus: harus tanpa acuan (anggota, profil, best staff, permintaan).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT e.id, e.name, l.name AS lembaga FROM anmategra_event e JOIN anmategra_lembaga l ON l.id = e.org_id
           WHERE (e.name = 'tes' AND l.name = 'Kemenkoan PSDM Kabinet KM ITB')
              OR (e.name = 'KSEP WEB' AND l.name = 'KSEP ITB') LOOP
    IF pg_temp.refs('anmategra_event', r.id) > 0 THEN
      RAISE EXCEPTION 'Event % (%) masih diacu; tidak dihapus', r.name, r.lembaga;
    END IF;
    DELETE FROM anmategra_event WHERE id = r.id;
  END LOOP;
END $$;

-- 4. Event kembar "Kelas Bahasa Arab Mustafeed": pertahankan yang mulai paling awal, alihkan acuan, hapus sisanya.
DO $$
DECLARE keep_id text; r record;
BEGIN
  SELECT e.id INTO keep_id FROM anmategra_event e JOIN anmategra_lembaga l ON l.id = e.org_id
  WHERE e.name = 'Kelas Bahasa Arab Mustafeed' AND l.name = 'Keluarga Mahasiswa Islam ITB'
  ORDER BY e.start_date ASC, e.id ASC LIMIT 1;
  IF keep_id IS NULL THEN RETURN; END IF;
  FOR r IN SELECT e.id FROM anmategra_event e JOIN anmategra_lembaga l ON l.id = e.org_id
           WHERE e.name = 'Kelas Bahasa Arab Mustafeed' AND l.name = 'Keluarga Mahasiswa Islam ITB' AND e.id <> keep_id LOOP
    PERFORM pg_temp.repoint('anmategra_event', r.id, keep_id);
    DELETE FROM anmategra_event WHERE id = r.id;
  END LOOP;
END $$;

-- 5. Status basi menjadi Ended.
UPDATE anmategra_event e SET status = 'Ended'
FROM anmategra_lembaga l
WHERE l.id = e.org_id AND e.status <> 'Ended' AND (e.name, l.name) IN (
  ('Anmategra 2024/2025', 'Anmategra KM ITB'),
  ('Workshop Anmategra', 'Anmategra KM ITB'),
  ('Studi Banding HIMAFI ITB X BEM FKKMK UGM', 'HIMAFI ITB'),
  ('Jazz Aula Timur 2026', 'ITBJazz'),
  ('Kelas Bahasa Arab Mustafeed', 'Keluarga Mahasiswa Islam ITB'),
  ('Tim Amandemen RUK KM ITB 2024/2025', 'Kemenkoan PSDM Kabinet KM ITB'),
  ('Tim Formatur KAT ITB 2025', 'Kemenkoan PSDM Kabinet KM ITB')
);

-- 6. Pemeriksaan akhir: paling banyak satu event On going per lembaga (syarat indeks unik Fase 1).
DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad FROM (SELECT org_id FROM anmategra_event WHERE status = 'On going' GROUP BY org_id HAVING count(*) > 1) x;
  IF bad > 0 THEN RAISE EXCEPTION 'Masih ada % lembaga dengan lebih dari satu event On going', bad; END IF;
END $$;

SELECT 'sebelum' AS saat, * FROM _sebelum
UNION ALL SELECT 'sesudah',
  (SELECT count(*) FROM anmategra_lembaga),
  (SELECT count(*) FROM anmategra_lembaga WHERE type IS NULL),
  (SELECT count(*) FROM anmategra_event),
  (SELECT count(*) FROM anmategra_event WHERE status = 'On going');

COMMIT;
