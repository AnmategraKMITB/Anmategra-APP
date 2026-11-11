-- Pemeriksaan sesudah backfill. Semua kolom "harus_nol" harus bernilai 0.
-- psql "$DATABASE_URL" -f scripts/organogram/verify.sql
\echo '== Harus nol'
SELECT
  -- anggota kehimpunan yang tidak punya keanggotaan aktif di lembaga itu
  (SELECT count(*) FROM anmategra_kehimpunan h
    WHERE NOT EXISTS (SELECT 1 FROM anmategra_lembaga_membership m
      WHERE m.lembaga_id = h.lembaga_id AND m.user_id = h.user_id AND m.status = 'aktif')
  ) AS kehimpunan_tanpa_keanggotaan,
  -- panitia (keanggotaan) yang tidak punya penempatan di periodenya
  (SELECT count(*) FROM anmategra_keanggotaan k
    WHERE NOT EXISTS (
      SELECT 1 FROM anmategra_placement pl
      JOIN anmategra_organization_position po ON po.id = pl.position_id
      JOIN anmategra_organization_unit un ON un.id = po.unit_id
      JOIN anmategra_organization_structure s ON s.id = un.structure_id
      WHERE s.period_id = k.period_id AND s.is_active AND pl.user_id = k.user_id)
  ) AS panitia_tanpa_penempatan,
  -- anggota kehimpunan yang punya bagian/jabatan nyata tetapi tidak ditempatkan di periode kepengurusan lembaganya
  (SELECT count(*) FROM anmategra_kehimpunan h
    WHERE NOT (trim(h.division) = '-' AND trim(h.position) = '-')
      AND NOT EXISTS (
        SELECT 1 FROM anmategra_placement pl
        JOIN anmategra_organization_position po ON po.id = pl.position_id
        JOIN anmategra_organization_unit un ON un.id = po.unit_id
        JOIN anmategra_organization_structure s ON s.id = un.structure_id
        JOIN anmategra_lembaga_period e ON e.id = s.period_id
        WHERE e.lembaga_id = h.lembaga_id AND e.kind = 'kepengurusan' AND pl.user_id = h.user_id)
  ) AS kehimpunan_nyata_tanpa_penempatan,
  -- penghitung turunan yang tidak cocok dengan hitungan ulang
  (SELECT count(*) FROM anmategra_lembaga_period p
    WHERE p.participant_count <> (
      SELECT count(DISTINCT pl.user_id) FROM anmategra_placement pl
      JOIN anmategra_organization_position po ON po.id = pl.position_id
      JOIN anmategra_organization_unit un ON un.id = po.unit_id
      JOIN anmategra_organization_structure s ON s.id = un.structure_id
      WHERE s.period_id = p.id AND s.is_active)
  ) AS participant_count_salah,
  (SELECT count(*) FROM anmategra_lembaga l
    WHERE l.member_count <> (SELECT count(*) FROM anmategra_lembaga_membership m
      WHERE m.lembaga_id = l.id AND m.status = 'aktif')
  ) AS member_count_salah;

\echo '== Ringkasan'
SELECT
  (SELECT count(*) FROM anmategra_organization_structure WHERE is_active) AS organogram,
  (SELECT count(*) FROM anmategra_organization_unit) AS bagian,
  (SELECT count(*) FROM anmategra_organization_position) AS jabatan,
  (SELECT count(*) FROM anmategra_placement) AS penempatan;
SELECT kind, count(*) AS periode FROM anmategra_lembaga_period GROUP BY kind ORDER BY kind;
