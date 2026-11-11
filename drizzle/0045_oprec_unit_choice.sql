ALTER TABLE "anmategra_form_field" DROP CONSTRAINT "form_field_type_check";--> statement-breakpoint
ALTER TABLE "anmategra_form_field" ADD CONSTRAINT "form_field_type_check" CHECK ("type" IN ('short_text', 'long_text', 'number', 'date', 'single_choice', 'multiple_choice', 'checkbox', 'text_block', 'link', 'matrix', 'scale', 'file', 'unit_choice'));--> statement-breakpoint
CREATE UNIQUE INDEX "form_field_unit_choice_unique" ON "anmategra_form_field" USING btree ("form_id") WHERE "anmategra_form_field"."type" = 'unit_choice' AND "anmategra_form_field"."archived_at" IS NULL;
