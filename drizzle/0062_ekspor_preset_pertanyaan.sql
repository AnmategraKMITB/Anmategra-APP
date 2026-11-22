CREATE TABLE "anmategra_form_export_preset" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"form_id" varchar(255) NOT NULL,
	"name" varchar(80) NOT NULL,
	"field_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_form_export_preset" ADD CONSTRAINT "anmategra_form_export_preset_form_id_anmategra_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."anmategra_form"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_form_export_preset" ADD CONSTRAINT "anmategra_form_export_preset_created_by_anmategra_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."anmategra_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "form_export_preset_form_name_unique" ON "anmategra_form_export_preset" USING btree ("form_id","name");