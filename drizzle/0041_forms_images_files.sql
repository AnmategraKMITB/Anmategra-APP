ALTER TABLE "anmategra_form_field" ADD COLUMN "image" jsonb;--> statement-breakpoint
-- CHECK constraints are hand-written, as in 0028, 0039 and 0040: schema.ts does not declare them.
ALTER TABLE "anmategra_form_field" DROP CONSTRAINT "form_field_type_check";--> statement-breakpoint
ALTER TABLE "anmategra_form_field" ADD CONSTRAINT "form_field_type_check" CHECK ("type" IN ('short_text', 'long_text', 'number', 'date', 'single_choice', 'multiple_choice', 'checkbox', 'text_block', 'link', 'matrix', 'scale', 'file'));
