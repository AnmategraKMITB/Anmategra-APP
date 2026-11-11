CREATE TABLE "anmategra_application" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"recruitment_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"wave_id" varchar(255),
	"form_submission_id" varchar(255),
	"source" varchar(16) NOT NULL,
	"willing_to_move" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anmategra_application_choice" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"application_id" varchar(255) NOT NULL,
	"division_id" varchar(255) NOT NULL,
	"rank" integer,
	"origin" varchar(16) NOT NULL,
	"score" numeric,
	"computed_status" varchar(16),
	"scored_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "anmategra_recruitment" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"period_id" varchar(255) NOT NULL,
	"form_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"placement_state" varchar(16) DEFAULT 'berjalan' NOT NULL,
	"results_released_at" timestamp with time zone,
	"results_visible_to_applicants" boolean DEFAULT false NOT NULL,
	"setup_completed_at" timestamp with time zone,
	"setup_answers" jsonb,
	"min_choices" integer DEFAULT 1 NOT NULL,
	"max_choices" integer DEFAULT 3 NOT NULL,
	"allow_redirect" boolean DEFAULT false NOT NULL,
	"scoring_mode" varchar(24) DEFAULT 'skor' NOT NULL,
	"status_method" varchar(32) DEFAULT 'peringkat_kuota_minimum' NOT NULL,
	"status_min_score" integer DEFAULT 60 NOT NULL,
	"score_source" varchar(16) DEFAULT 'gabungan' NOT NULL,
	"weight_umum" integer DEFAULT 50 NOT NULL,
	"rating_min" integer DEFAULT 1 NOT NULL,
	"rating_max" integer DEFAULT 5 NOT NULL,
	"min_reviewers" integer DEFAULT 1 NOT NULL,
	"blind" boolean DEFAULT false NOT NULL,
	"allow_early_assessment" boolean DEFAULT false NOT NULL,
	"visibility_default" boolean DEFAULT false NOT NULL,
	"eligibility_match" varchar(8) DEFAULT 'all' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anmategra_recruitment_division" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"recruitment_id" varchar(255) NOT NULL,
	"unit_id" varchar(255) NOT NULL,
	"position_id" varchar(255) NOT NULL,
	"code" varchar(50),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anmategra_recruitment_eligibility_rule" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"recruitment_id" varchar(255) NOT NULL,
	"attribute" varchar(32) NOT NULL,
	"op" varchar(16) NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anmategra_recruitment_section_binding" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"recruitment_id" varchar(255) NOT NULL,
	"form_section_id" varchar(255) NOT NULL,
	"division_id" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anmategra_recruitment_wave" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"recruitment_id" varchar(255) NOT NULL,
	"label" varchar(255) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_application" ADD CONSTRAINT "anmategra_application_recruitment_id_anmategra_recruitment_id_fk" FOREIGN KEY ("recruitment_id") REFERENCES "public"."anmategra_recruitment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_application" ADD CONSTRAINT "anmategra_application_user_id_anmategra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."anmategra_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_application" ADD CONSTRAINT "anmategra_application_wave_id_anmategra_recruitment_wave_id_fk" FOREIGN KEY ("wave_id") REFERENCES "public"."anmategra_recruitment_wave"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_application" ADD CONSTRAINT "anmategra_application_form_submission_id_anmategra_form_submission_id_fk" FOREIGN KEY ("form_submission_id") REFERENCES "public"."anmategra_form_submission"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_application_choice" ADD CONSTRAINT "anmategra_application_choice_application_id_anmategra_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."anmategra_application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_application_choice" ADD CONSTRAINT "anmategra_application_choice_division_id_anmategra_recruitment_division_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."anmategra_recruitment_division"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD CONSTRAINT "anmategra_recruitment_period_id_anmategra_lembaga_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."anmategra_lembaga_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD CONSTRAINT "anmategra_recruitment_form_id_anmategra_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."anmategra_form"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_division" ADD CONSTRAINT "anmategra_recruitment_division_recruitment_id_anmategra_recruitment_id_fk" FOREIGN KEY ("recruitment_id") REFERENCES "public"."anmategra_recruitment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_division" ADD CONSTRAINT "anmategra_recruitment_division_unit_id_anmategra_organization_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."anmategra_organization_unit"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_division" ADD CONSTRAINT "anmategra_recruitment_division_position_id_anmategra_organization_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."anmategra_organization_position"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_eligibility_rule" ADD CONSTRAINT "anmategra_recruitment_eligibility_rule_recruitment_id_anmategra_recruitment_id_fk" FOREIGN KEY ("recruitment_id") REFERENCES "public"."anmategra_recruitment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_section_binding" ADD CONSTRAINT "anmategra_recruitment_section_binding_recruitment_id_anmategra_recruitment_id_fk" FOREIGN KEY ("recruitment_id") REFERENCES "public"."anmategra_recruitment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_section_binding" ADD CONSTRAINT "anmategra_recruitment_section_binding_form_section_id_anmategra_form_section_id_fk" FOREIGN KEY ("form_section_id") REFERENCES "public"."anmategra_form_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_section_binding" ADD CONSTRAINT "anmategra_recruitment_section_binding_division_id_anmategra_recruitment_division_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."anmategra_recruitment_division"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_wave" ADD CONSTRAINT "anmategra_recruitment_wave_recruitment_id_anmategra_recruitment_id_fk" FOREIGN KEY ("recruitment_id") REFERENCES "public"."anmategra_recruitment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_user_idx" ON "anmategra_application" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "application_wave_idx" ON "anmategra_application" USING btree ("wave_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_recruitment_user_unique" ON "anmategra_application" USING btree ("recruitment_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_form_submission_unique" ON "anmategra_application" USING btree ("form_submission_id") WHERE "anmategra_application"."form_submission_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "application_choice_division_idx" ON "anmategra_application_choice" USING btree ("division_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_choice_application_division_unique" ON "anmategra_application_choice" USING btree ("application_id","division_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_choice_application_rank_unique" ON "anmategra_application_choice" USING btree ("application_id","rank") WHERE "anmategra_application_choice"."rank" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "recruitment_period_idx" ON "anmategra_recruitment" USING btree ("period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recruitment_form_unique" ON "anmategra_recruitment" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "recruitment_division_unit_idx" ON "anmategra_recruitment_division" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "recruitment_division_position_idx" ON "anmategra_recruitment_division" USING btree ("position_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recruitment_division_recruitment_unit_unique" ON "anmategra_recruitment_division" USING btree ("recruitment_id","unit_id");--> statement-breakpoint
CREATE INDEX "recruitment_eligibility_rule_recruitment_idx" ON "anmategra_recruitment_eligibility_rule" USING btree ("recruitment_id");--> statement-breakpoint
CREATE INDEX "recruitment_section_binding_division_idx" ON "anmategra_recruitment_section_binding" USING btree ("division_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recruitment_section_binding_unique" ON "anmategra_recruitment_section_binding" USING btree ("recruitment_id","form_section_id","division_id");--> statement-breakpoint
CREATE INDEX "recruitment_wave_recruitment_idx" ON "anmategra_recruitment_wave" USING btree ("recruitment_id");--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD CONSTRAINT "recruitment_status_check" CHECK ("status" IN ('draft','open','closed'));--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD CONSTRAINT "recruitment_placement_state_check" CHECK ("placement_state" IN ('berjalan','masa_banding','final'));--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD CONSTRAINT "recruitment_scoring_mode_check" CHECK ("scoring_mode" IN ('skor','keputusan_langsung'));--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD CONSTRAINT "recruitment_status_method_check" CHECK ("status_method" IN ('ambang','peringkat_kuota','peringkat_kuota_minimum'));--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD CONSTRAINT "recruitment_score_source_check" CHECK ("score_source" IN ('umum','divisi','gabungan'));--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD CONSTRAINT "recruitment_eligibility_match_check" CHECK ("eligibility_match" IN ('all','any'));--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD CONSTRAINT "recruitment_choices_check" CHECK ("min_choices" >= 1 AND "min_choices" <= "max_choices");--> statement-breakpoint
ALTER TABLE "anmategra_recruitment" ADD CONSTRAINT "recruitment_scoring_numbers_check" CHECK ("status_min_score" BETWEEN 0 AND 100 AND "weight_umum" BETWEEN 0 AND 100 AND "rating_min" < "rating_max" AND "min_reviewers" >= 1);--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_wave" ADD CONSTRAINT "recruitment_wave_range_check" CHECK ("ends_at" > "starts_at");--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_eligibility_rule" ADD CONSTRAINT "recruitment_eligibility_attribute_check" CHECK ("attribute" IN ('angkatan_kuliah','fakultas','prodi','status_mahasiswa','keanggotaan_lembaga','angkatan_lembaga'));--> statement-breakpoint
ALTER TABLE "anmategra_recruitment_eligibility_rule" ADD CONSTRAINT "recruitment_eligibility_op_check" CHECK ("op" IN ('eq','neq','in','not_in','gt','gte','lt','lte','between','contains'));--> statement-breakpoint
ALTER TABLE "anmategra_application" ADD CONSTRAINT "application_source_check" CHECK ("source" IN ('form','closerec'));--> statement-breakpoint
ALTER TABLE "anmategra_application" ADD CONSTRAINT "application_source_submission_check" CHECK ("source" = 'form' OR "form_submission_id" IS NULL);--> statement-breakpoint
ALTER TABLE "anmategra_application_choice" ADD CONSTRAINT "application_choice_origin_check" CHECK ("origin" IN ('dipilih','dialihkan','closerec'));--> statement-breakpoint
ALTER TABLE "anmategra_application_choice" ADD CONSTRAINT "application_choice_computed_status_check" CHECK ("computed_status" IS NULL OR "computed_status" IN ('belum_lengkap','perlu_ditinjau','lolos','tidak_lolos'));--> statement-breakpoint
ALTER TABLE "anmategra_application_choice" ADD CONSTRAINT "application_choice_rank_check" CHECK ("rank" IS NULL OR "rank" >= 1);--> statement-breakpoint
ALTER TABLE "anmategra_application_choice" ADD CONSTRAINT "application_choice_rank_origin_check" CHECK (("origin" = 'dipilih') = ("rank" IS NOT NULL));
