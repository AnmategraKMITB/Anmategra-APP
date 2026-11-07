-- Rilis 2D-2: urutan penempatan; participant_count dari placement; member_count dari lembaga_membership.
-- ALTER dari generator; fungsi dan trigger ditulis tangan.

ALTER TABLE "anmategra_placement" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

-- participant_count tidak lagi dihitung dari keanggotaan (tidak ditulis lagi oleh aplikasi).
DROP TRIGGER IF EXISTS trg_update_event_participant_count ON anmategra_keanggotaan;--> statement-breakpoint

-- Jumlah orang berbeda yang punya penempatan di struktur aktif sebuah periode.
CREATE OR REPLACE FUNCTION update_event_participant_count() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  position_ids text[] := ARRAY[]::text[];
  target_period text;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    position_ids := position_ids || OLD.position_id::text;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    position_ids := position_ids || NEW.position_id::text;
  END IF;

  FOR target_period IN
    SELECT DISTINCT s.period_id
    FROM anmategra_organization_position po
    JOIN anmategra_organization_unit un ON un.id = po.unit_id
    JOIN anmategra_organization_structure s ON s.id = un.structure_id
    WHERE po.id = ANY (position_ids) AND s.period_id IS NOT NULL
  LOOP
    UPDATE anmategra_lembaga_period
    SET participant_count = (
      SELECT COUNT(DISTINCT pl.user_id)
      FROM anmategra_placement pl
      JOIN anmategra_organization_position po ON po.id = pl.position_id
      JOIN anmategra_organization_unit un ON un.id = po.unit_id
      JOIN anmategra_organization_structure s ON s.id = un.structure_id
      WHERE s.period_id = target_period AND s.is_active
    )
    WHERE id = target_period;
  END LOOP;

  RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE TRIGGER trg_placement_participant_count
AFTER INSERT OR DELETE OR UPDATE OF position_id, user_id ON anmategra_placement
FOR EACH ROW EXECUTE FUNCTION update_event_participant_count();
--> statement-breakpoint

-- Aplikasi tidak lagi menulis kehimpunan: lembaga_membership ditulis langsung, jadi jembatan
-- sync_lembaga_membership dan penghitung lama di kehimpunan dicabut (tabelnya dibuang di 2D-3).
DROP TRIGGER IF EXISTS trg_sync_lembaga_membership ON anmategra_kehimpunan;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_update_lembaga_member_count ON anmategra_kehimpunan;--> statement-breakpoint

-- member_count = jumlah keanggotaan aktif sebuah lembaga.
CREATE OR REPLACE FUNCTION update_lembaga_member_count() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target text;
BEGIN
  FOR target IN
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.lembaga_id END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.lembaga_id END
    ]) AS x WHERE x IS NOT NULL
  LOOP
    UPDATE anmategra_lembaga
    SET member_count = (
      SELECT COUNT(*)
      FROM anmategra_lembaga_membership
      WHERE lembaga_id = target AND status = 'aktif'
    )
    WHERE id = target;
  END LOOP;

  RETURN NULL;
END;
$$;--> statement-breakpoint

CREATE TRIGGER trg_membership_member_count
AFTER INSERT OR DELETE OR UPDATE OF lembaga_id, status ON anmategra_lembaga_membership
FOR EACH ROW EXECUTE FUNCTION update_lembaga_member_count();
