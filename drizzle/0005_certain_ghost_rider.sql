DO $$ BEGIN
 CREATE TYPE "public"."support_urgent" AS ENUM('Low', 'Medium', 'High');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "support_status" ADD VALUE IF NOT EXISTS 'Draft';--> statement-breakpoint
ALTER TYPE "support_status" ADD VALUE IF NOT EXISTS 'Backlog';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_association_request_lembaga" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"lembaga_id" varchar(255),
	"user_id" varchar(255),
	"position" varchar(255) NOT NULL,
	"division" varchar(255) NOT NULL,
	"status" "association_request_status" DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_best_staff_kegiatan" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"mahasiswa_id" varchar(255) NOT NULL,
	"division" varchar(255) NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_best_staff_lembaga" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"lembaga_id" varchar(255) NOT NULL,
	"mahasiswa_id" varchar(255) NOT NULL,
	"division" varchar(255) NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_nilai_profil_kegiatan" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"profil_id" varchar(255) NOT NULL,
	"mahasiswa_id" varchar(255) NOT NULL,
	"nilai" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_nilai_profil_lembaga" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"profil_id" varchar(255) NOT NULL,
	"mahasiswa_id" varchar(255) NOT NULL,
	"nilai" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_pemetaan_profil_kegiatan" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"profil_kegiatan_id" varchar(255) NOT NULL,
	"profil_km_id" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_pemetaan_profil_lembaga" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"profil_lembaga_id" varchar(255) NOT NULL,
	"profil_km_id" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_profil_km" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_profil_kegiatan" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anmategra_profil_lembaga" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"lembaga_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_association_request" DROP CONSTRAINT "anmategra_association_request_event_id_anmategra_event_id_fk";
--> statement-breakpoint
ALTER TABLE "anmategra_association_request" DROP CONSTRAINT "anmategra_association_request_user_id_anmategra_user_id_fk";
--> statement-breakpoint
ALTER TABLE "anmategra_association_request" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anmategra_association_request" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "anmategra_event" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anmategra_event" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "anmategra_event" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anmategra_event" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "anmategra_notification" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anmategra_notification" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "anmategra_support" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anmategra_support" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "anmategra_support" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anmategra_support" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "anmategra_support_reply" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anmategra_support_reply" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "anmategra_support_reply" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anmategra_support_reply" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "anmategra_association_request" ADD COLUMN "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_notification" ADD COLUMN "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_support" ADD COLUMN "urgent" "support_urgent" DEFAULT 'Low' NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_support" ADD COLUMN "attachment" varchar(255);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_association_request_lembaga" ADD CONSTRAINT "anmategra_association_request_lembaga_lembaga_id_anmategra_lembaga_id_fk" FOREIGN KEY ("lembaga_id") REFERENCES "public"."anmategra_lembaga"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_association_request_lembaga" ADD CONSTRAINT "anmategra_association_request_lembaga_user_id_anmategra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_best_staff_kegiatan" ADD CONSTRAINT "anmategra_best_staff_kegiatan_event_id_anmategra_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."anmategra_event"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_best_staff_kegiatan" ADD CONSTRAINT "anmategra_best_staff_kegiatan_mahasiswa_id_anmategra_mahasiswa_user_id_fk" FOREIGN KEY ("mahasiswa_id") REFERENCES "public"."anmategra_mahasiswa"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_best_staff_lembaga" ADD CONSTRAINT "anmategra_best_staff_lembaga_lembaga_id_anmategra_lembaga_id_fk" FOREIGN KEY ("lembaga_id") REFERENCES "public"."anmategra_lembaga"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_best_staff_lembaga" ADD CONSTRAINT "anmategra_best_staff_lembaga_mahasiswa_id_anmategra_mahasiswa_user_id_fk" FOREIGN KEY ("mahasiswa_id") REFERENCES "public"."anmategra_mahasiswa"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_nilai_profil_kegiatan" ADD CONSTRAINT "anmategra_nilai_profil_kegiatan_profil_id_anmategra_profil_kegiatan_id_fk" FOREIGN KEY ("profil_id") REFERENCES "public"."anmategra_profil_kegiatan"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_nilai_profil_kegiatan" ADD CONSTRAINT "anmategra_nilai_profil_kegiatan_mahasiswa_id_anmategra_mahasiswa_user_id_fk" FOREIGN KEY ("mahasiswa_id") REFERENCES "public"."anmategra_mahasiswa"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_nilai_profil_lembaga" ADD CONSTRAINT "anmategra_nilai_profil_lembaga_profil_id_anmategra_profil_lembaga_id_fk" FOREIGN KEY ("profil_id") REFERENCES "public"."anmategra_profil_lembaga"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_nilai_profil_lembaga" ADD CONSTRAINT "anmategra_nilai_profil_lembaga_mahasiswa_id_anmategra_mahasiswa_user_id_fk" FOREIGN KEY ("mahasiswa_id") REFERENCES "public"."anmategra_mahasiswa"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_pemetaan_profil_kegiatan" ADD CONSTRAINT "anmategra_pemetaan_profil_kegiatan_profil_kegiatan_id_anmategra_profil_kegiatan_id_fk" FOREIGN KEY ("profil_kegiatan_id") REFERENCES "public"."anmategra_profil_kegiatan"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_pemetaan_profil_kegiatan" ADD CONSTRAINT "anmategra_pemetaan_profil_kegiatan_profil_km_id_anmategra_profil_km_id_fk" FOREIGN KEY ("profil_km_id") REFERENCES "public"."anmategra_profil_km"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_pemetaan_profil_lembaga" ADD CONSTRAINT "anmategra_pemetaan_profil_lembaga_profil_lembaga_id_anmategra_profil_lembaga_id_fk" FOREIGN KEY ("profil_lembaga_id") REFERENCES "public"."anmategra_profil_lembaga"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_pemetaan_profil_lembaga" ADD CONSTRAINT "anmategra_pemetaan_profil_lembaga_profil_km_id_anmategra_profil_km_id_fk" FOREIGN KEY ("profil_km_id") REFERENCES "public"."anmategra_profil_km"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_profil_kegiatan" ADD CONSTRAINT "anmategra_profil_kegiatan_event_id_anmategra_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."anmategra_event"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_profil_lembaga" ADD CONSTRAINT "anmategra_profil_lembaga_lembaga_id_anmategra_lembaga_id_fk" FOREIGN KEY ("lembaga_id") REFERENCES "public"."anmategra_lembaga"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "nilai_profil_kegiatan_unique" ON "anmategra_nilai_profil_kegiatan" USING btree ("profil_id","mahasiswa_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "nilai_profil_lembaga_unique" ON "anmategra_nilai_profil_lembaga" USING btree ("profil_id","mahasiswa_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_association_request" ADD CONSTRAINT "anmategra_association_request_event_id_anmategra_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."anmategra_event"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_association_request" ADD CONSTRAINT "anmategra_association_request_user_id_anmategra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."anmategra_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "anmategra_support" DROP COLUMN IF EXISTS "topic";