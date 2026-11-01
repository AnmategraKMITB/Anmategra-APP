CREATE TABLE IF NOT EXISTS "anmategra_form" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"lembaga_id" varchar(255),
	"event_id" varchar(255),
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(16) DEFAULT 'Draft' NOT NULL,
	"closes_at" timestamp with time zone,
	"allow_multiple_submissions" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_form_answer" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"submission_id" varchar(255) NOT NULL,
	"field_id" varchar(255),
	"field_label" varchar(500) NOT NULL,
	"field_type" varchar(32) NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_form_field" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"form_id" varchar(255) NOT NULL,
	"type" varchar(32) NOT NULL,
	"label" varchar(500) NOT NULL,
	"description" text,
	"required" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_form_field_option" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"field_id" varchar(255) NOT NULL,
	"label" varchar(255) NOT NULL,
	"sort_order" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_form_submission" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"form_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_form" ADD CONSTRAINT "anmategra_form_lembaga_id_anmategra_lembaga_id_fk" FOREIGN KEY ("lembaga_id") REFERENCES "public"."anmategra_lembaga"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_form" ADD CONSTRAINT "anmategra_form_event_id_anmategra_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."anmategra_event"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_form" ADD CONSTRAINT "anmategra_form_created_by_anmategra_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."anmategra_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_form_answer" ADD CONSTRAINT "anmategra_form_answer_submission_id_anmategra_form_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."anmategra_form_submission"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_form_answer" ADD CONSTRAINT "anmategra_form_answer_field_id_anmategra_form_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."anmategra_form_field"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_form_field" ADD CONSTRAINT "anmategra_form_field_form_id_anmategra_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."anmategra_form"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_form_field_option" ADD CONSTRAINT "anmategra_form_field_option_field_id_anmategra_form_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."anmategra_form_field"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_form_submission" ADD CONSTRAINT "anmategra_form_submission_form_id_anmategra_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."anmategra_form"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_form_submission" ADD CONSTRAINT "anmategra_form_submission_user_id_anmategra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."anmategra_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_lembaga_id_idx" ON "anmategra_form" USING btree ("lembaga_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_event_id_idx" ON "anmategra_form" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "form_answer_submission_field_unique" ON "anmategra_form_answer" USING btree ("submission_id","field_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_answer_field_id_idx" ON "anmategra_form_answer" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_field_form_order_idx" ON "anmategra_form_field" USING btree ("form_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_field_option_field_order_idx" ON "anmategra_form_field_option" USING btree ("field_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_submission_form_user_idx" ON "anmategra_form_submission" USING btree ("form_id","user_id");--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- Hand-written below this line.
--
-- drizzle-kit 0.24.2 does not serialize CHECK constraints (drizzle-orm exports
-- check(), but the kit silently emits nothing), so these live only here. Do NOT
-- run `npm run db:push` against a database that has them: push diffs the live
-- DB against schema.ts and may propose dropping them. Use `npm run db:migrate`.
--
-- `status` / `type` / `field_type` are varchar + CHECK instead of pgEnum on
-- purpose: a new pgEnum value cannot be used in the same migration batch that
-- adds it, which breaks fresh installs (see 0005/0006). Adding a field type
-- later only needs this CHECK replaced.
--
-- All tables are new, so existing data cannot violate these.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
 ALTER TABLE "anmategra_form"
   ADD CONSTRAINT "form_owner_xor"
   CHECK (num_nonnulls("lembaga_id", "event_id") = 1);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_form"
   ADD CONSTRAINT "form_status_check"
   CHECK ("status" IN ('Draft', 'Published', 'Closed'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_form_field"
   ADD CONSTRAINT "form_field_type_check"
   CHECK ("type" IN ('short_text', 'long_text', 'number', 'date', 'single_choice', 'multiple_choice', 'checkbox'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_form_field"
   ADD CONSTRAINT "form_field_sort_order_check"
   CHECK ("sort_order" >= 0);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_form_field_option"
   ADD CONSTRAINT "form_field_option_sort_order_check"
   CHECK ("sort_order" >= 0);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
-- No CHECK on form_answer.field_type: it is a snapshot and must keep accepting
-- whatever type the field had when it was answered, even if that type is
-- later retired from form_field_type_check.