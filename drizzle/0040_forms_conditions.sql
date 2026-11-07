CREATE TABLE "anmategra_form_ending" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"form_id" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"sort_order" integer NOT NULL,
	"condition" jsonb,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_form_field" ADD COLUMN "condition" jsonb;--> statement-breakpoint
ALTER TABLE "anmategra_form_section" ADD COLUMN "condition" jsonb;--> statement-breakpoint
ALTER TABLE "anmategra_form_submission" ADD COLUMN "ending_id" varchar(255);--> statement-breakpoint
ALTER TABLE "anmategra_form_ending" ADD CONSTRAINT "anmategra_form_ending_form_id_anmategra_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."anmategra_form"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_ending_form_order_idx" ON "anmategra_form_ending" USING btree ("form_id","sort_order");--> statement-breakpoint
ALTER TABLE "anmategra_form_submission" ADD CONSTRAINT "anmategra_form_submission_ending_id_anmategra_form_ending_id_fk" FOREIGN KEY ("ending_id") REFERENCES "public"."anmategra_form_ending"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- CHECK constraints are hand-written, as in 0028 and 0039: schema.ts does not declare them.
ALTER TABLE "anmategra_form_ending" ADD CONSTRAINT "form_ending_sort_order_check" CHECK ("sort_order" >= 0);
