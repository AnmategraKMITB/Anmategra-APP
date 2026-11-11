-- Rilis 2A: model data editor organogram (hanya menambah; tidak ada tabel lama yang dibuang).
-- Tabel, kolom, kunci asing, dan indeks dari generator; CHECK dan pengisian type_label ditulis tangan
-- (drizzle-kit tidak membuat CHECK).

CREATE TYPE "public"."placement_source" AS ENUM('oprec', 'closerec', 'manual', 'import');--> statement-breakpoint
CREATE TABLE "anmategra_organization_position" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"unit_id" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"rank" varchar(32) NOT NULL,
	"kind" varchar(32) DEFAULT 'struktural' NOT NULL,
	"quota" integer DEFAULT 0 NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anmategra_placement" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"position_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"source" "placement_source" NOT NULL,
	"application_choice_id" varchar(255),
	"note" text,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_organization_structure" ADD COLUMN "level_labels" jsonb;--> statement-breakpoint
ALTER TABLE "anmategra_organization_structure" ADD COLUMN "rank_labels" jsonb;--> statement-breakpoint
ALTER TABLE "anmategra_organization_structure" ADD COLUMN "edit_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_organization_structure" ADD COLUMN "locked_by" varchar(255);--> statement-breakpoint
ALTER TABLE "anmategra_organization_structure" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anmategra_organization_unit" ADD COLUMN "type_label" varchar(255);--> statement-breakpoint
ALTER TABLE "anmategra_organization_unit" ADD COLUMN "layout" jsonb;--> statement-breakpoint
ALTER TABLE "anmategra_organization_position" ADD CONSTRAINT "anmategra_organization_position_unit_id_anmategra_organization_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."anmategra_organization_unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_placement" ADD CONSTRAINT "anmategra_placement_position_id_anmategra_organization_position_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."anmategra_organization_position"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_placement" ADD CONSTRAINT "anmategra_placement_user_id_anmategra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."anmategra_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_placement" ADD CONSTRAINT "anmategra_placement_created_by_anmategra_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."anmategra_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_position_unit_idx" ON "anmategra_organization_position" USING btree ("unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "placement_position_user_unique" ON "anmategra_placement" USING btree ("position_id","user_id");--> statement-breakpoint
CREATE INDEX "placement_user_idx" ON "anmategra_placement" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "anmategra_organization_structure" ADD CONSTRAINT "anmategra_organization_structure_locked_by_anmategra_user_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."anmategra_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "anmategra_organization_position" ADD CONSTRAINT "organization_position_quota_check" CHECK ("quota" >= 0);--> statement-breakpoint
ALTER TABLE "anmategra_organization_position" ADD CONSTRAINT "organization_position_rank_check" CHECK ("rank" IN ('head', 'vice', 'coordinator', 'staff'));--> statement-breakpoint
ALTER TABLE "anmategra_organization_position" ADD CONSTRAINT "organization_position_kind_check" CHECK ("kind" IN ('struktural', 'nonstruktural'));--> statement-breakpoint

-- Unit lama: label bebas diambil dari kind (Bidang/Divisi/Subdivisi) supaya editor baru langsung bisa memakainya.
UPDATE "anmategra_organization_unit" SET "type_label" = "kind" WHERE "type_label" IS NULL;
