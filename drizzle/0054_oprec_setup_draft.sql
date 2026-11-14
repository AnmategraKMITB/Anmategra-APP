CREATE TABLE "anmategra_recruitment_setup_draft" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"period_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"state" jsonb NOT NULL,
	"step" varchar(8) DEFAULT 'S1' NOT NULL,
	"phase" varchar(16) DEFAULT 'steps' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_setup_draft" ADD CONSTRAINT "anmategra_recruitment_setup_draft_period_id_anmategra_lembaga_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."anmategra_lembaga_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_setup_draft" ADD CONSTRAINT "anmategra_recruitment_setup_draft_user_id_anmategra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."anmategra_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recruitment_setup_draft_period_user_unique" ON "anmategra_recruitment_setup_draft" USING btree ("period_id","user_id");