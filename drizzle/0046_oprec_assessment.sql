CREATE TABLE "anmategra_application_flag" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"application_id" varchar(255) NOT NULL,
	"label_id" varchar(255) NOT NULL,
	"applied_by" varchar(255) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anmategra_assessment" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"application_id" varchar(255) NOT NULL,
	"choice_id" varchar(255),
	"criterion_id" varchar(255) NOT NULL,
	"assessor_id" varchar(255) NOT NULL,
	"rating" integer,
	"gate_state" varchar(16),
	"note" text,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anmategra_choice_status_override" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"choice_id" varchar(255) NOT NULL,
	"status" varchar(16) NOT NULL,
	"reason" text NOT NULL,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"set_by" varchar(255) NOT NULL,
	"set_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"cleared_at" timestamp with time zone,
	"computed_status_at_override" varchar(16),
	"score_at_override" numeric
);
--> statement-breakpoint
CREATE TABLE "anmategra_criterion" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"recruitment_id" varchar(255) NOT NULL,
	"division_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"kind" varchar(24) NOT NULL,
	"weight" integer,
	"expectation" text,
	"gate_rule" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anmategra_criterion_field" (
	"criterion_id" varchar(255) NOT NULL,
	"form_field_id" varchar(255) NOT NULL,
	CONSTRAINT "anmategra_criterion_field_criterion_id_form_field_id_pk" PRIMARY KEY("criterion_id","form_field_id")
);
--> statement-breakpoint
CREATE TABLE "anmategra_flag_label" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"recruitment_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" varchar(16) NOT NULL,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"created_by" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anmategra_recruitment_assessor" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"recruitment_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"division_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "anmategra_recruitment_log" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"recruitment_id" varchar(255) NOT NULL,
	"actor_id" varchar(255),
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(255),
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_application_flag" ADD CONSTRAINT "anmategra_application_flag_application_id_anmategra_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."anmategra_application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_application_flag" ADD CONSTRAINT "anmategra_application_flag_label_id_anmategra_flag_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."anmategra_flag_label"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_application_flag" ADD CONSTRAINT "anmategra_application_flag_applied_by_anmategra_user_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_assessment" ADD CONSTRAINT "anmategra_assessment_application_id_anmategra_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."anmategra_application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_assessment" ADD CONSTRAINT "anmategra_assessment_choice_id_anmategra_application_choice_id_fk" FOREIGN KEY ("choice_id") REFERENCES "public"."anmategra_application_choice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_assessment" ADD CONSTRAINT "anmategra_assessment_criterion_id_anmategra_criterion_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."anmategra_criterion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_assessment" ADD CONSTRAINT "anmategra_assessment_assessor_id_anmategra_user_id_fk" FOREIGN KEY ("assessor_id") REFERENCES "public"."anmategra_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_choice_status_override" ADD CONSTRAINT "anmategra_choice_status_override_choice_id_anmategra_application_choice_id_fk" FOREIGN KEY ("choice_id") REFERENCES "public"."anmategra_application_choice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_choice_status_override" ADD CONSTRAINT "anmategra_choice_status_override_set_by_anmategra_user_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_criterion" ADD CONSTRAINT "anmategra_criterion_recruitment_id_anmategra_recruitment_id_fk" FOREIGN KEY ("recruitment_id") REFERENCES "public"."anmategra_recruitment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_criterion" ADD CONSTRAINT "anmategra_criterion_division_id_anmategra_recruitment_division_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."anmategra_recruitment_division"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_criterion_field" ADD CONSTRAINT "anmategra_criterion_field_criterion_id_anmategra_criterion_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."anmategra_criterion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_criterion_field" ADD CONSTRAINT "anmategra_criterion_field_form_field_id_anmategra_form_field_id_fk" FOREIGN KEY ("form_field_id") REFERENCES "public"."anmategra_form_field"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_flag_label" ADD CONSTRAINT "anmategra_flag_label_recruitment_id_anmategra_recruitment_id_fk" FOREIGN KEY ("recruitment_id") REFERENCES "public"."anmategra_recruitment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_flag_label" ADD CONSTRAINT "anmategra_flag_label_created_by_anmategra_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_assessor" ADD CONSTRAINT "anmategra_recruitment_assessor_recruitment_id_anmategra_recruitment_id_fk" FOREIGN KEY ("recruitment_id") REFERENCES "public"."anmategra_recruitment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_assessor" ADD CONSTRAINT "anmategra_recruitment_assessor_user_id_anmategra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."anmategra_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_assessor" ADD CONSTRAINT "anmategra_recruitment_assessor_division_id_anmategra_recruitment_division_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."anmategra_recruitment_division"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_log" ADD CONSTRAINT "anmategra_recruitment_log_recruitment_id_anmategra_recruitment_id_fk" FOREIGN KEY ("recruitment_id") REFERENCES "public"."anmategra_recruitment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_log" ADD CONSTRAINT "anmategra_recruitment_log_actor_id_anmategra_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."anmategra_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_flag_label_idx" ON "anmategra_application_flag" USING btree ("label_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_flag_unique" ON "anmategra_application_flag" USING btree ("application_id","label_id");--> statement-breakpoint
CREATE INDEX "assessment_application_idx" ON "anmategra_assessment" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "assessment_choice_idx" ON "anmategra_assessment" USING btree ("choice_id");--> statement-breakpoint
CREATE INDEX "assessment_criterion_idx" ON "anmategra_assessment" USING btree ("criterion_id");--> statement-breakpoint
CREATE INDEX "assessment_assessor_idx" ON "anmategra_assessment" USING btree ("assessor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_unique" ON "anmategra_assessment" USING btree ("application_id","choice_id","criterion_id","assessor_id") NULLS NOT DISTINCT;--> statement-breakpoint
CREATE INDEX "choice_status_override_choice_idx" ON "anmategra_choice_status_override" USING btree ("choice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "choice_status_override_active_unique" ON "anmategra_choice_status_override" USING btree ("choice_id") WHERE "anmategra_choice_status_override"."cleared_at" IS NULL;--> statement-breakpoint
CREATE INDEX "criterion_recruitment_idx" ON "anmategra_criterion" USING btree ("recruitment_id");--> statement-breakpoint
CREATE INDEX "criterion_division_idx" ON "anmategra_criterion" USING btree ("division_id");--> statement-breakpoint
CREATE INDEX "criterion_field_form_field_idx" ON "anmategra_criterion_field" USING btree ("form_field_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flag_label_recruitment_name_unique" ON "anmategra_flag_label" USING btree ("recruitment_id","name");--> statement-breakpoint
CREATE INDEX "recruitment_assessor_user_idx" ON "anmategra_recruitment_assessor" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recruitment_assessor_unique" ON "anmategra_recruitment_assessor" USING btree ("recruitment_id","user_id","division_id") NULLS NOT DISTINCT;--> statement-breakpoint
CREATE INDEX "recruitment_log_recruitment_time_idx" ON "anmategra_recruitment_log" USING btree ("recruitment_id","created_at");--> statement-breakpoint
CREATE INDEX "recruitment_log_actor_idx" ON "anmategra_recruitment_log" USING btree ("actor_id");
--> statement-breakpoint
ALTER TABLE "anmategra_criterion" ADD CONSTRAINT "criterion_kind_check" CHECK ("kind" IN ('skor','gugur_otomatis','gugur_manual'));--> statement-breakpoint
ALTER TABLE "anmategra_criterion" ADD CONSTRAINT "criterion_weight_check" CHECK (("kind" = 'skor' AND ("weight" IS NULL OR "weight" BETWEEN 0 AND 100)) OR ("kind" <> 'skor' AND "weight" IS NULL));--> statement-breakpoint
ALTER TABLE "anmategra_criterion" ADD CONSTRAINT "criterion_gate_rule_check" CHECK ("gate_rule" IS NULL OR "kind" = 'gugur_otomatis');--> statement-breakpoint
ALTER TABLE "anmategra_assessment" ADD CONSTRAINT "assessment_gate_state_check" CHECK ("gate_state" IS NULL OR "gate_state" IN ('memenuhi','ditinjau','tidak'));--> statement-breakpoint
ALTER TABLE "anmategra_assessment" ADD CONSTRAINT "assessment_rating_check" CHECK ("rating" IS NULL OR "rating" >= 0);--> statement-breakpoint
ALTER TABLE "anmategra_choice_status_override" ADD CONSTRAINT "choice_status_override_status_check" CHECK ("status" IN ('lolos','tidak_lolos'));--> statement-breakpoint
ALTER TABLE "anmategra_choice_status_override" ADD CONSTRAINT "choice_status_override_reason_check" CHECK (length(btrim("reason")) > 0);--> statement-breakpoint
ALTER TABLE "anmategra_choice_status_override" ADD CONSTRAINT "choice_status_override_snapshot_check" CHECK ("computed_status_at_override" IS NULL OR "computed_status_at_override" IN ('belum_lengkap','perlu_ditinjau','lolos','tidak_lolos'));--> statement-breakpoint
ALTER TABLE "anmategra_flag_label" ADD CONSTRAINT "flag_label_color_check" CHECK ("color" IN ('teal','amber','blue','red'));--> statement-breakpoint
ALTER TABLE "anmategra_flag_label" ADD CONSTRAINT "flag_label_name_check" CHECK (length(btrim("name")) > 0);
