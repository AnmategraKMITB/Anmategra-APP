-- Rilis 1A: event -> lembaga_period, pohon lembaga (parent_id), tipe lembaga wajib.
-- Ditulis tangan (bukan hasil `drizzle-kit generate`) karena generator akan DROP tabel event
-- dan kehilangan data; di sini semuanya RENAME. Snapshot 0029 tetap dari generator.
-- Nama simbol TypeScript (events, eventId) sengaja tidak diubah di rilis ini.

-- 1. Enum lembaga_type: tambah Badan, Pusat, Organisasi.
-- Dibuat ulang (bukan ADD VALUE) karena Drizzle menjalankan semua migrasi tertunda dalam satu
-- transaksi, dan nilai enum baru tidak boleh dipakai di transaksi yang sama.
ALTER TYPE "public"."lembaga_type" RENAME TO "lembaga_type_old";--> statement-breakpoint
CREATE TYPE "public"."lembaga_type" AS ENUM('Himpunan', 'UKM', 'Kepanitiaan', 'BSO', 'Badan', 'Pusat', 'Organisasi');--> statement-breakpoint
ALTER TABLE "anmategra_lembaga" ALTER COLUMN "type" TYPE "public"."lembaga_type" USING "type"::text::"public"."lembaga_type";--> statement-breakpoint
ALTER TABLE "anmategra_riwayat_organisasi" ALTER COLUMN "lembaga_tipe" TYPE "public"."lembaga_type" USING "lembaga_tipe"::text::"public"."lembaga_type";--> statement-breakpoint
DROP TYPE "public"."lembaga_type_old";--> statement-breakpoint

-- 2. Tipe wajib; lembaga lama tanpa tipe menjadi Organisasi.
UPDATE "anmategra_lembaga" SET "type" = 'Organisasi' WHERE "type" IS NULL;--> statement-breakpoint
ALTER TABLE "anmategra_lembaga" ALTER COLUMN "type" SET DEFAULT 'Organisasi';--> statement-breakpoint
ALTER TABLE "anmategra_lembaga" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint

-- 3. Pohon lembaga: induk dihapus -> anak naik menjadi akar.
ALTER TABLE "anmategra_lembaga" ADD COLUMN "parent_id" varchar(255);--> statement-breakpoint
ALTER TABLE "anmategra_lembaga" ADD CONSTRAINT "anmategra_lembaga_parent_id_anmategra_lembaga_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."anmategra_lembaga"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lembaga_parent_id_idx" ON "anmategra_lembaga" USING btree ("parent_id");--> statement-breakpoint

-- 4. event -> lembaga_period (RENAME: data, kunci asing, dan trigger tetap).
ALTER TABLE "anmategra_event" RENAME TO "anmategra_lembaga_period";--> statement-breakpoint
ALTER TABLE "anmategra_lembaga_period" RENAME COLUMN "org_id" TO "lembaga_id";--> statement-breakpoint
ALTER TABLE "anmategra_lembaga_period" ADD COLUMN "label" varchar(255);--> statement-breakpoint
UPDATE "anmategra_lembaga_period" SET "label" = "name" WHERE "label" IS NULL;--> statement-breakpoint
ALTER TABLE "anmategra_lembaga_period" RENAME CONSTRAINT "anmategra_event_pkey" TO "anmategra_lembaga_period_pkey";--> statement-breakpoint
ALTER TABLE "anmategra_lembaga_period" RENAME CONSTRAINT "anmategra_event_org_id_anmategra_lembaga_id_fk" TO "anmategra_lembaga_period_lembaga_id_anmategra_lembaga_id_fk";--> statement-breakpoint
ALTER INDEX "event_org_highlighted_unique" RENAME TO "lembaga_period_highlighted_unique";--> statement-breakpoint
ALTER INDEX "event_name_trgm_idx" RENAME TO "lembaga_period_name_trgm_idx";--> statement-breakpoint

-- 5. event_id -> period_id pada delapan tabel; nama kunci asing diselaraskan dengan konvensi Drizzle
-- (dipotong 63 karakter seperti yang dilakukan PostgreSQL).
DO $$
DECLARE
  t text;
  old_fk text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'anmategra_association_request', 'anmategra_best_staff_kegiatan', 'anmategra_event_admin',
    'anmategra_form', 'anmategra_keanggotaan', 'anmategra_organization_structure',
    'anmategra_profil_kegiatan', 'anmategra_riwayat_kepanitiaan'
  ] LOOP
    SELECT k.conname INTO old_fk
    FROM pg_constraint k
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
    WHERE k.conrelid = t::regclass AND k.contype = 'f' AND a.attname = 'event_id';
    IF old_fk IS NULL THEN
      RAISE EXCEPTION 'Kunci asing event_id tidak ditemukan pada %', t;
    END IF;
    EXECUTE format('ALTER TABLE %I RENAME COLUMN event_id TO period_id', t);
    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', t, old_fk,
      left(t || '_period_id_anmategra_lembaga_period_id_fk', 63));
  END LOOP;
END $$;--> statement-breakpoint

-- 6. Nama indeks yang menyebut event.
ALTER INDEX "keanggotaan_event_user_unique" RENAME TO "keanggotaan_period_user_unique";--> statement-breakpoint
ALTER INDEX "organization_structure_active_event_unique" RENAME TO "organization_structure_active_period_unique";--> statement-breakpoint
ALTER INDEX "event_admin_event_user_unique" RENAME TO "event_admin_period_user_unique";--> statement-breakpoint
ALTER INDEX "form_event_id_idx" RENAME TO "form_period_id_idx";--> statement-breakpoint

-- 7. Trigger participant_count menyebut tabel dan kolom lama di badan fungsinya; ganti isinya
-- (nama fungsi dan trigger dipertahankan; dibuang saat participant_count diturunkan dari placement di 1B).
CREATE OR REPLACE FUNCTION update_event_participant_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE anmategra_lembaga_period
  SET participant_count = (
    SELECT COUNT(*)
    FROM anmategra_keanggotaan
    WHERE anmategra_keanggotaan.period_id = COALESCE(NEW.period_id, OLD.period_id)
  )
  WHERE id = COALESCE(NEW.period_id, OLD.period_id);

  RETURN NULL;
END;
$$;
