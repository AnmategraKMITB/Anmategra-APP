ALTER TYPE "lembaga_type" ADD VALUE 'BSO';--> statement-breakpoint
ALTER TABLE "anmategra_lembaga" ALTER COLUMN "founding_date" DROP NOT NULL;