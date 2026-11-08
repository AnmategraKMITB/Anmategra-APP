CREATE TABLE "anmategra_placement_decision" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"choice_id" varchar(255) NOT NULL,
	"decision" varchar(16) NOT NULL,
	"decided_by" varchar(255) NOT NULL,
	"decided_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tag" varchar(24),
	"reason" text,
	"over_quota_confirmed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anmategra_recruitment_visibility_override" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"recruitment_id" varchar(255) NOT NULL,
	"viewer_division_id" varchar(255) NOT NULL,
	"target_division_id" varchar(255) NOT NULL,
	"allowed" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anmategra_transfer_request" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"recruitment_id" varchar(255) NOT NULL,
	"application_id" varchar(255) NOT NULL,
	"from_division_id" varchar(255) NOT NULL,
	"to_division_id" varchar(255) NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(16) DEFAULT 'diminta' NOT NULL,
	"requested_by" varchar(255) NOT NULL,
	"resolved_by" varchar(255),
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_placement_decision" ADD CONSTRAINT "anmategra_placement_decision_choice_id_anmategra_application_choice_id_fk" FOREIGN KEY ("choice_id") REFERENCES "public"."anmategra_application_choice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_placement_decision" ADD CONSTRAINT "anmategra_placement_decision_decided_by_anmategra_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_visibility_override" ADD CONSTRAINT "anmategra_recruitment_visibility_override_recruitment_id_anmategra_recruitment_id_fk" FOREIGN KEY ("recruitment_id") REFERENCES "public"."anmategra_recruitment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_visibility_override" ADD CONSTRAINT "anmategra_recruitment_visibility_override_viewer_division_id_anmategra_recruitment_division_id_fk" FOREIGN KEY ("viewer_division_id") REFERENCES "public"."anmategra_recruitment_division"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_visibility_override" ADD CONSTRAINT "anmategra_recruitment_visibility_override_target_division_id_anmategra_recruitment_division_id_fk" FOREIGN KEY ("target_division_id") REFERENCES "public"."anmategra_recruitment_division"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_transfer_request" ADD CONSTRAINT "anmategra_transfer_request_recruitment_id_anmategra_recruitment_id_fk" FOREIGN KEY ("recruitment_id") REFERENCES "public"."anmategra_recruitment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_transfer_request" ADD CONSTRAINT "anmategra_transfer_request_application_id_anmategra_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."anmategra_application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_transfer_request" ADD CONSTRAINT "anmategra_transfer_request_from_division_id_anmategra_recruitment_division_id_fk" FOREIGN KEY ("from_division_id") REFERENCES "public"."anmategra_recruitment_division"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_transfer_request" ADD CONSTRAINT "anmategra_transfer_request_to_division_id_anmategra_recruitment_division_id_fk" FOREIGN KEY ("to_division_id") REFERENCES "public"."anmategra_recruitment_division"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_transfer_request" ADD CONSTRAINT "anmategra_transfer_request_requested_by_anmategra_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_transfer_request" ADD CONSTRAINT "anmategra_transfer_request_resolved_by_anmategra_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."anmategra_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "placement_decision_choice_unique" ON "anmategra_placement_decision" USING btree ("choice_id");--> statement-breakpoint
CREATE INDEX "placement_decision_decided_by_idx" ON "anmategra_placement_decision" USING btree ("decided_by");--> statement-breakpoint
CREATE UNIQUE INDEX "recruitment_visibility_override_unique" ON "anmategra_recruitment_visibility_override" USING btree ("recruitment_id","viewer_division_id","target_division_id");--> statement-breakpoint
CREATE INDEX "transfer_request_recruitment_idx" ON "anmategra_transfer_request" USING btree ("recruitment_id");--> statement-breakpoint
CREATE INDEX "transfer_request_application_idx" ON "anmategra_transfer_request" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_request_open_unique" ON "anmategra_transfer_request" USING btree ("application_id") WHERE "anmategra_transfer_request"."status" = 'diminta';--> statement-breakpoint
ALTER TABLE "anmategra_placement" ADD CONSTRAINT "anmategra_placement_application_choice_id_anmategra_application_choice_id_fk" FOREIGN KEY ("application_choice_id") REFERENCES "public"."anmategra_application_choice"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "anmategra_placement_decision" ADD CONSTRAINT "placement_decision_decision_check" CHECK ("decision" IN ('terima','tolak'));--> statement-breakpoint
ALTER TABLE "anmategra_placement_decision" ADD CONSTRAINT "placement_decision_tag_check" CHECK ("tag" IS NULL OR "tag" IN ('pindahan','lewat_banding','di_luar_pilihan'));--> statement-breakpoint
ALTER TABLE "anmategra_transfer_request" ADD CONSTRAINT "transfer_request_status_check" CHECK ("status" IN ('diminta','disetujui','ditolak','dibatalkan'));--> statement-breakpoint
ALTER TABLE "anmategra_transfer_request" ADD CONSTRAINT "transfer_request_reason_check" CHECK (length(btrim("reason")) > 0);--> statement-breakpoint
ALTER TABLE "anmategra_transfer_request" ADD CONSTRAINT "transfer_request_self_check" CHECK ("from_division_id" <> "to_division_id");