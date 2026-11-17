ALTER TABLE "anmategra_notification" ADD COLUMN "recruitment_id" varchar(255);--> statement-breakpoint
ALTER TABLE "anmategra_notification" ADD COLUMN "kind" varchar(32);--> statement-breakpoint
ALTER TABLE "anmategra_notification" ADD COLUMN "links" jsonb;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD COLUMN "results_publish_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anmategra_notification" ADD CONSTRAINT "anmategra_notification_recruitment_id_anmategra_recruitment_id_fk" FOREIGN KEY ("recruitment_id") REFERENCES "public"."anmategra_recruitment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_user_recruitment_kind_unique" ON "anmategra_notification" USING btree ("user_id","recruitment_id","kind") WHERE "anmategra_notification"."recruitment_id" IS NOT NULL;