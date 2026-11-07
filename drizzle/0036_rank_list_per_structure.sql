-- Rilis editor: rank bisa disusun per organogram (mis. menambah Sekretaris dan Bendahara).
-- ADD COLUMN dari generator; pemindahan data dan CHECK ditulis tangan.

ALTER TABLE "anmategra_organization_structure" ADD COLUMN "ranks" jsonb;--> statement-breakpoint

-- Struktur yang pernah mengganti label rank memindahkannya ke daftar berurutan (empat rank bawaan).
UPDATE "anmategra_organization_structure"
SET "ranks" = (
  SELECT jsonb_agg(
    jsonb_build_object('id', d.id, 'label', coalesce(nullif(trim("rank_labels" ->> d.id), ''), d.label))
    ORDER BY d.ord
  )
  FROM (VALUES (1, 'head', 'Kepala'), (2, 'vice', 'Wakil'), (3, 'coordinator', 'Koordinator'), (4, 'staff', 'Staf')) AS d(ord, id, label)
)
WHERE "rank_labels" IS NOT NULL;--> statement-breakpoint

-- Rank tidak lagi dibatasi empat nilai; yang dijaga hanya bentuk id-nya.
ALTER TABLE "anmategra_organization_position" DROP CONSTRAINT IF EXISTS "organization_position_rank_check";--> statement-breakpoint
ALTER TABLE "anmategra_organization_position" ADD CONSTRAINT "organization_position_rank_format_check" CHECK ("rank" ~ '^[a-z0-9][a-z0-9_-]{0,31}$');
