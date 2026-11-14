CREATE TABLE "anmategra_division_priority" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"division_id" varchar(255) NOT NULL,
	"application_id" varchar(255) NOT NULL,
	"rank" integer,
	"note" text,
	"updated_by" varchar(255),
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD COLUMN "placement_method" varchar(16) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_division" ADD COLUMN "priority_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_division" ADD COLUMN "priority_locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_division" ADD COLUMN "priority_locked_by" varchar(255);--> statement-breakpoint
ALTER TABLE "anmategra_division_priority" ADD CONSTRAINT "anmategra_division_priority_division_id_anmategra_recruitment_division_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."anmategra_recruitment_division"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_division_priority" ADD CONSTRAINT "anmategra_division_priority_application_id_anmategra_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."anmategra_application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_division_priority" ADD CONSTRAINT "anmategra_division_priority_updated_by_anmategra_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."anmategra_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "division_priority_application_idx" ON "anmategra_division_priority" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "division_priority_division_application_unique" ON "anmategra_division_priority" USING btree ("division_id","application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "division_priority_division_rank_unique" ON "anmategra_division_priority" USING btree ("division_id","rank") WHERE "anmategra_division_priority"."rank" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_division" ADD CONSTRAINT "anmategra_recruitment_division_priority_locked_by_anmategra_user_id_fk" FOREIGN KEY ("priority_locked_by") REFERENCES "public"."anmategra_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD CONSTRAINT "recruitment_placement_method_check" CHECK ("placement_method" IN ('manual', 'prioritas'));--> statement-breakpoint
ALTER TABLE "anmategra_division_priority" ADD CONSTRAINT "division_priority_rank_check" CHECK ("rank" IS NULL OR "rank" >= 1);--> statement-breakpoint
ALTER TABLE "anmategra_division_priority" ADD CONSTRAINT "division_priority_content_check" CHECK ("rank" IS NOT NULL OR "note" IS NOT NULL);