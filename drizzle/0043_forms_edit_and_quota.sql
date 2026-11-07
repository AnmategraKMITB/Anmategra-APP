ALTER TABLE "anmategra_form" ADD COLUMN "allow_edit_after_submit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_form" ADD COLUMN "max_responses" integer;--> statement-breakpoint
ALTER TABLE "anmategra_form_submission" ADD COLUMN "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
-- Baris lama: waktu perubahan awalnya sama dengan waktu kirim.
UPDATE "anmategra_form_submission" SET "updated_at" = "submitted_at";--> statement-breakpoint
ALTER TABLE "anmategra_form" ADD CONSTRAINT "form_edit_requires_single" CHECK (NOT "allow_edit_after_submit" OR NOT "allow_multiple_submissions");--> statement-breakpoint
ALTER TABLE "anmategra_form" ADD CONSTRAINT "form_max_responses_check" CHECK ("max_responses" IS NULL OR "max_responses" > 0);