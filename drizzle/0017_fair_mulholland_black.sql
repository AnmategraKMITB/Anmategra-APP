CREATE TABLE IF NOT EXISTS "anmategra_organization_role" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"structure_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"ring_level" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_organization_structure" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"lembaga_id" varchar(255),
	"event_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_organization_unit" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"structure_id" varchar(255) NOT NULL,
	"parent_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"kind" varchar(255) NOT NULL,
	"level" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_association_request" ADD COLUMN "org_unit_id" varchar(255);--> statement-breakpoint
ALTER TABLE "anmategra_association_request" ADD COLUMN "org_role_id" varchar(255);--> statement-breakpoint
ALTER TABLE "anmategra_association_request_lembaga" ADD COLUMN "org_unit_id" varchar(255);--> statement-breakpoint
ALTER TABLE "anmategra_association_request_lembaga" ADD COLUMN "org_role_id" varchar(255);--> statement-breakpoint
ALTER TABLE "anmategra_keanggotaan" ADD COLUMN "org_unit_id" varchar(255);--> statement-breakpoint
ALTER TABLE "anmategra_keanggotaan" ADD COLUMN "org_role_id" varchar(255);--> statement-breakpoint
ALTER TABLE "anmategra_kehimpunan" ADD COLUMN "org_unit_id" varchar(255);--> statement-breakpoint
ALTER TABLE "anmategra_kehimpunan" ADD COLUMN "org_role_id" varchar(255);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_organization_role" ADD CONSTRAINT "anmategra_organization_role_structure_id_anmategra_organization_structure_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."anmategra_organization_structure"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_organization_structure" ADD CONSTRAINT "anmategra_organization_structure_lembaga_id_anmategra_lembaga_id_fk" FOREIGN KEY ("lembaga_id") REFERENCES "public"."anmategra_lembaga"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_organization_structure" ADD CONSTRAINT "anmategra_organization_structure_event_id_anmategra_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."anmategra_event"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_organization_unit" ADD CONSTRAINT "anmategra_organization_unit_structure_id_anmategra_organization_structure_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."anmategra_organization_structure"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_organization_unit" ADD CONSTRAINT "anmategra_organization_unit_parent_id_anmategra_organization_unit_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."anmategra_organization_unit"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
