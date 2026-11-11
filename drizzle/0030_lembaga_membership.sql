-- Rilis 1B-1: keanggotaan lembaga jangka panjang (lembaga_membership).
-- CREATE TYPE/TABLE/INDEX dari generator; pengisian awal dan trigger ditulis tangan.

CREATE TYPE "public"."membership_source" AS ENUM('import', 'manual', 'kaderisasi');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('aktif', 'keluar');--> statement-breakpoint
CREATE TABLE "anmategra_lembaga_membership" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"lembaga_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"cohort_year" integer,
	"cohort_label" varchar(255),
	"status" "membership_status" DEFAULT 'aktif' NOT NULL,
	"source" "membership_source" NOT NULL,
	"joined_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_lembaga_membership" ADD CONSTRAINT "anmategra_lembaga_membership_lembaga_id_anmategra_lembaga_id_fk" FOREIGN KEY ("lembaga_id") REFERENCES "public"."anmategra_lembaga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_lembaga_membership" ADD CONSTRAINT "anmategra_lembaga_membership_user_id_anmategra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."anmategra_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lembaga_membership_lembaga_idx" ON "anmategra_lembaga_membership" USING btree ("lembaga_id");--> statement-breakpoint
CREATE INDEX "lembaga_membership_user_idx" ON "anmategra_lembaga_membership" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lembaga_membership_active_unique" ON "anmategra_lembaga_membership" USING btree ("lembaga_id","user_id") WHERE "anmategra_lembaga_membership"."status" = 'aktif';--> statement-breakpoint

-- Pengisian awal: setiap baris kehimpunan menjadi keanggotaan aktif (sumber import).
INSERT INTO "anmategra_lembaga_membership" ("id", "lembaga_id", "user_id", "status", "source", "joined_at")
SELECT gen_random_uuid()::text, k."lembaga_id", k."user_id", 'aktif', 'import', k."created_at"
FROM "anmategra_kehimpunan" k;--> statement-breakpoint

-- Jembatan sementara: aplikasi masih menulis kehimpunan, jadi basis data menjaga lembaga_membership
-- tetap searah. Dibuang saat kehimpunan digantikan oleh placement (Fase 2).
CREATE OR REPLACE FUNCTION sync_lembaga_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE'
     OR (TG_OP = 'UPDATE' AND (OLD.lembaga_id, OLD.user_id) IS DISTINCT FROM (NEW.lembaga_id, NEW.user_id)) THEN
    UPDATE anmategra_lembaga_membership
    SET status = 'keluar', ended_at = now(), updated_at = now()
    WHERE lembaga_id = OLD.lembaga_id AND user_id = OLD.user_id AND status = 'aktif';
  END IF;

  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND (OLD.lembaga_id, OLD.user_id) IS DISTINCT FROM (NEW.lembaga_id, NEW.user_id)) THEN
    INSERT INTO anmategra_lembaga_membership (id, lembaga_id, user_id, status, source, joined_at)
    VALUES (gen_random_uuid()::text, NEW.lembaga_id, NEW.user_id, 'aktif', 'manual', now())
    ON CONFLICT (lembaga_id, user_id) WHERE status = 'aktif' DO NOTHING;
  END IF;

  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE TRIGGER trg_sync_lembaga_membership
AFTER INSERT OR UPDATE OF lembaga_id, user_id OR DELETE ON anmategra_kehimpunan
FOR EACH ROW EXECUTE FUNCTION sync_lembaga_membership();
