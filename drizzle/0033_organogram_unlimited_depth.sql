-- Rilis 2B: organogram tanpa batas kedalaman dan tanpa daftar `kind` tetap.
-- ALTER dari generator; pencabutan CHECK lama dan CHECK baru ditulis tangan.
-- `level` tetap disimpan sebagai kedalaman (akar = 1) dan tetap dijaga oleh CHECK akar-tanpa-induk.

ALTER TABLE "anmategra_organization_unit" ALTER COLUMN "kind" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_organization_structure" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

ALTER TABLE "anmategra_organization_unit" DROP CONSTRAINT IF EXISTS "organization_unit_kind_check";--> statement-breakpoint
ALTER TABLE "anmategra_organization_unit" DROP CONSTRAINT IF EXISTS "organization_unit_level_range_check";--> statement-breakpoint
ALTER TABLE "anmategra_organization_unit" ADD CONSTRAINT "organization_unit_level_min_check" CHECK ("level" >= 1);
