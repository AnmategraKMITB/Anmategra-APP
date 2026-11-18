-- Akar organogram = kedalaman 0: akar adalah lembaga atau kepanitiaan itu sendiri
-- (tempat Ketua), Bidang di kedalaman 1, Divisi di kedalaman 2. Sebelumnya akar = 1
-- dan level_labels[0] menamai akar, sehingga wizard oprec menyebut "ketua bidang"
-- untuk divisi.
--
-- Id unit dan posisi tidak berubah, jadi oprec (recruitment_division), placement,
-- dan hak akses yang diturunkan dari organogram tidak tersentuh.

ALTER TABLE "anmategra_organization_unit" DROP CONSTRAINT IF EXISTS "organization_unit_level_min_check";--> statement-breakpoint
ALTER TABLE "anmategra_organization_unit" DROP CONSTRAINT IF EXISTS "organization_unit_root_parent_check";--> statement-breakpoint

-- 1. Struktur satu akar: akar turun dari 1 ke 0, jadi nama level bergeser satu
--    (nama untuk akar lama dibuang; akar memakai type_label-nya) dan tier manual
--    berupa angka ikut turun satu supaya susunan pita di bagan tetap sama.
WITH single AS (
  SELECT structure_id
  FROM "anmategra_organization_unit"
  WHERE parent_id IS NULL
  GROUP BY structure_id
  HAVING count(*) = 1
)
UPDATE "anmategra_organization_structure" s
SET level_labels = CASE
    WHEN jsonb_array_length(s.level_labels) <= 1 THEN NULL
    ELSE s.level_labels - 0
  END
FROM single
WHERE s.id = single.structure_id
  AND jsonb_typeof(s.level_labels) = 'array';--> statement-breakpoint

WITH single AS (
  SELECT structure_id
  FROM "anmategra_organization_unit"
  WHERE parent_id IS NULL
  GROUP BY structure_id
  HAVING count(*) = 1
)
UPDATE "anmategra_organization_unit" u
SET layout = CASE
    WHEN (u.layout->>'tier')::int - 1 >= 1
      THEN jsonb_set(u.layout, '{tier}', to_jsonb((u.layout->>'tier')::int - 1))
    ELSE u.layout - 'tier'
  END
FROM single
WHERE u.structure_id = single.structure_id
  AND jsonb_typeof(u.layout->'tier') = 'number'
  AND (u.layout->>'tier') ~ '^[0-9]+$';--> statement-breakpoint

-- 2. Struktur dengan banyak akar (data lama yang datar) dibungkus satu akar baru
--    bernama periodenya. Akar lama menjadi kedalaman 1, jadi nama level dan tiernya
--    tetap berlaku tanpa digeser.
WITH multi AS (
  SELECT structure_id
  FROM "anmategra_organization_unit"
  WHERE parent_id IS NULL
  GROUP BY structure_id
  HAVING count(*) > 1
), created AS (
  INSERT INTO "anmategra_organization_unit"
    (id, structure_id, parent_id, name, level, sort_order, type_label)
  SELECT
    gen_random_uuid()::text,
    s.id,
    NULL,
    coalesce(p.name, s.name),
    0,
    0,
    CASE WHEN p.kind = 'kegiatan' THEN 'Kepanitiaan' ELSE l.type::text END
  FROM multi m
  JOIN "anmategra_organization_structure" s ON s.id = m.structure_id
  LEFT JOIN "anmategra_lembaga_period" p ON p.id = s.period_id
  LEFT JOIN "anmategra_lembaga" l ON l.id = coalesce(p.lembaga_id, s.lembaga_id)
  RETURNING id, structure_id
)
-- Pernyataan utama melihat data sebelum INSERT di atas, jadi hanya akar lama yang dipindah.
UPDATE "anmategra_organization_unit" u
SET parent_id = c.id
FROM created c
WHERE u.structure_id = c.structure_id
  AND u.parent_id IS NULL;--> statement-breakpoint

-- 3. Hitung ulang kedalaman dari akar = 0.
WITH RECURSIVE t AS (
  SELECT id, 0 AS depth
  FROM "anmategra_organization_unit"
  WHERE parent_id IS NULL
  UNION ALL
  SELECT u.id, t.depth + 1
  FROM "anmategra_organization_unit" u
  JOIN t ON u.parent_id = t.id
  WHERE t.depth < 64
)
UPDATE "anmategra_organization_unit" u
SET level = t.depth
FROM t
WHERE u.id = t.id
  AND u.level <> t.depth;--> statement-breakpoint

-- 4. Akar tanpa sebutan: kegiatan menjadi "Kepanitiaan", kepengurusan memakai jenis lembaganya.
UPDATE "anmategra_organization_unit" u
SET type_label = CASE WHEN p.kind = 'kegiatan' THEN 'Kepanitiaan' ELSE l.type::text END
FROM "anmategra_organization_structure" s
LEFT JOIN "anmategra_lembaga_period" p ON p.id = s.period_id
LEFT JOIN "anmategra_lembaga" l ON l.id = coalesce(p.lembaga_id, s.lembaga_id)
WHERE u.structure_id = s.id
  AND u.parent_id IS NULL
  AND (u.type_label IS NULL OR btrim(u.type_label) = '');--> statement-breakpoint

-- 5. Editor yang sedang terbuka memegang pohon versi lama; naikkan versi supaya
--    penyimpanannya ditolak sebagai bentrok, bukan menimpa hasil migrasi ini.
UPDATE "anmategra_organization_structure"
SET version = version + 1
WHERE id IN (SELECT DISTINCT structure_id FROM "anmategra_organization_unit");--> statement-breakpoint

ALTER TABLE "anmategra_organization_unit" ADD CONSTRAINT "organization_unit_level_min_check" CHECK ("level" >= 0);--> statement-breakpoint
ALTER TABLE "anmategra_organization_unit" ADD CONSTRAINT "organization_unit_root_parent_check" CHECK (("level" = 0 AND "parent_id" IS NULL) OR ("level" > 0 AND "parent_id" IS NOT NULL));
