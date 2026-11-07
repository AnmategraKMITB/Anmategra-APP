CREATE TABLE "anmategra_form_section" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"form_id" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DROP INDEX "form_field_form_order_idx";--> statement-breakpoint
ALTER TABLE "anmategra_form" ADD COLUMN "preview_token" varchar(64);--> statement-breakpoint
ALTER TABLE "anmategra_form" ADD COLUMN "preview_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_form" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_form" ADD COLUMN "theme" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_form" ADD COLUMN "welcome" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_form_field" ADD COLUMN "section_id" varchar(255);--> statement-breakpoint
ALTER TABLE "anmategra_form_section" ADD CONSTRAINT "anmategra_form_section_form_id_anmategra_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."anmategra_form"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_section_form_order_idx" ON "anmategra_form_section" USING btree ("form_id","sort_order");--> statement-breakpoint
ALTER TABLE "anmategra_form_field" ADD CONSTRAINT "anmategra_form_field_section_id_anmategra_form_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."anmategra_form_section"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "form_preview_token_unique" ON "anmategra_form" USING btree ("preview_token");--> statement-breakpoint
CREATE INDEX "form_field_form_section_order_idx" ON "anmategra_form_field" USING btree ("form_id","section_id","sort_order");--> statement-breakpoint
-- CHECK constraints are hand-written, as in 0028: schema.ts does not declare them.
ALTER TABLE "anmategra_form_section" ADD CONSTRAINT "form_section_sort_order_check" CHECK ("sort_order" >= 0);--> statement-breakpoint
ALTER TABLE "anmategra_form_field" DROP CONSTRAINT "form_field_type_check";--> statement-breakpoint
ALTER TABLE "anmategra_form_field" ADD CONSTRAINT "form_field_type_check" CHECK ("type" IN ('short_text', 'long_text', 'number', 'date', 'single_choice', 'multiple_choice', 'checkbox', 'text_block', 'link', 'matrix', 'scale'));
