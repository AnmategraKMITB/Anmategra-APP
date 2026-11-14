ALTER TABLE "anmategra_recruitment" ADD COLUMN "assessor_mode" varchar(16) DEFAULT 'keduanya' NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD COLUMN "general_assessor_unit_id" varchar(255);--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD COLUMN "has_gugur" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD COLUMN "head_decides" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD COLUMN "staged_placement" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD COLUMN "results_access" varchar(16) DEFAULT 'admin_ketua' NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD COLUMN "closerec_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD CONSTRAINT "anmategra_recruitment_general_assessor_unit_id_anmategra_organization_unit_id_fk" FOREIGN KEY ("general_assessor_unit_id") REFERENCES "public"."anmategra_organization_unit"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "anmategra_recruitment" SET "results_access" = "setup_answers"->>'resultsAccess' WHERE "setup_answers"->>'resultsAccess' IN ('admin', 'admin_ketua', 'semua');--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD CONSTRAINT "recruitment_assessor_mode_check" CHECK ("assessor_mode" IN ('ketua', 'umum', 'keduanya'));--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD CONSTRAINT "recruitment_results_access_check" CHECK ("results_access" IN ('admin', 'admin_ketua', 'semua'));
