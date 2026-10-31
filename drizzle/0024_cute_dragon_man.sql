DO $$ BEGIN
 CREATE TYPE "public"."admin_grant_status" AS ENUM('active', 'revoked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."mahasiswa_status" AS ENUM('aktif', 'alumni');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."riwayat_end_reason" AS ENUM('removed', 'left');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_alumni_pending" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"nim" integer NOT NULL,
	"wisuda_batch" varchar(100),
	"uploaded_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_event_admin" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"granted_by" varchar(255) NOT NULL,
	"status" "admin_grant_status" DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_lembaga_admin" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"lembaga_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"granted_by" varchar(255) NOT NULL,
	"status" "admin_grant_status" DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_riwayat_kepanitiaan" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"event_id" varchar(255),
	"event_nama" varchar(255) NOT NULL,
	"lembaga_id" varchar(255),
	"lembaga_nama" varchar(255),
	"division" varchar(255) NOT NULL,
	"position" varchar(255) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"end_reason" "riwayat_end_reason" NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_riwayat_organisasi" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"lembaga_id" varchar(255),
	"lembaga_nama" varchar(255) NOT NULL,
	"lembaga_tipe" "lembaga_type",
	"division" varchar(255) NOT NULL,
	"position" varchar(255) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"end_reason" "riwayat_end_reason" NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_keanggotaan" ADD COLUMN "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_keanggotaan" ADD COLUMN "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_kehimpunan" ADD COLUMN "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_kehimpunan" ADD COLUMN "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_mahasiswa" ADD COLUMN "status" "mahasiswa_status" DEFAULT 'aktif' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_alumni_pending" ADD CONSTRAINT "anmategra_alumni_pending_uploaded_by_anmategra_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_event_admin" ADD CONSTRAINT "anmategra_event_admin_event_id_anmategra_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."anmategra_event"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_event_admin" ADD CONSTRAINT "anmategra_event_admin_user_id_anmategra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."anmategra_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_event_admin" ADD CONSTRAINT "anmategra_event_admin_granted_by_anmategra_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_event_admin" ADD CONSTRAINT "anmategra_event_admin_revoked_by_anmategra_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_lembaga_admin" ADD CONSTRAINT "anmategra_lembaga_admin_lembaga_id_anmategra_lembaga_id_fk" FOREIGN KEY ("lembaga_id") REFERENCES "public"."anmategra_lembaga"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_lembaga_admin" ADD CONSTRAINT "anmategra_lembaga_admin_user_id_anmategra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."anmategra_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_lembaga_admin" ADD CONSTRAINT "anmategra_lembaga_admin_granted_by_anmategra_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_lembaga_admin" ADD CONSTRAINT "anmategra_lembaga_admin_revoked_by_anmategra_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_riwayat_kepanitiaan" ADD CONSTRAINT "anmategra_riwayat_kepanitiaan_user_id_anmategra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."anmategra_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_riwayat_kepanitiaan" ADD CONSTRAINT "anmategra_riwayat_kepanitiaan_event_id_anmategra_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."anmategra_event"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_riwayat_kepanitiaan" ADD CONSTRAINT "anmategra_riwayat_kepanitiaan_lembaga_id_anmategra_lembaga_id_fk" FOREIGN KEY ("lembaga_id") REFERENCES "public"."anmategra_lembaga"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_riwayat_organisasi" ADD CONSTRAINT "anmategra_riwayat_organisasi_user_id_anmategra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."anmategra_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_riwayat_organisasi" ADD CONSTRAINT "anmategra_riwayat_organisasi_lembaga_id_anmategra_lembaga_id_fk" FOREIGN KEY ("lembaga_id") REFERENCES "public"."anmategra_lembaga"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "alumni_pending_nim_unique" ON "anmategra_alumni_pending" USING btree ("nim");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_admin_event_user_unique" ON "anmategra_event_admin" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_admin_user_id_idx" ON "anmategra_event_admin" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lembaga_admin_lembaga_user_unique" ON "anmategra_lembaga_admin" USING btree ("lembaga_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lembaga_admin_user_id_idx" ON "anmategra_lembaga_admin" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "riwayat_kepanitiaan_user_id_idx" ON "anmategra_riwayat_kepanitiaan" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "riwayat_organisasi_user_id_idx" ON "anmategra_riwayat_organisasi" USING btree ("user_id");