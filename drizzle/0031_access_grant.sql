-- Rilis 1C: access_grant menggantikan lembaga_admin dan event_admin.
-- CREATE TABLE, kunci asing, dan indeks dari generator. Urutan diubah tangan: hibah lama disalin
-- lebih dulu (fitur 'admin', propagate false = makna yang sama seperti sebelumnya), baru tabel
-- lama dibuang. CHECK scope ditulis tangan karena drizzle-kit tidak bisa membuatnya.

CREATE TABLE "anmategra_access_grant" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"lembaga_id" varchar(255),
	"period_id" varchar(255),
	"propagate" boolean DEFAULT false NOT NULL,
	"features" text[] DEFAULT ARRAY['admin']::text[] NOT NULL,
	"can_grant" boolean DEFAULT false NOT NULL,
	"parent_grant_id" varchar(255),
	"cascade_revoke" boolean DEFAULT false NOT NULL,
	"status" "admin_grant_status" DEFAULT 'active' NOT NULL,
	"granted_by" varchar(255),
	"revoked_at" timestamp with time zone,
	"revoked_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
ALTER TABLE "anmategra_access_grant" ADD CONSTRAINT "anmategra_access_grant_user_id_anmategra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."anmategra_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_access_grant" ADD CONSTRAINT "anmategra_access_grant_lembaga_id_anmategra_lembaga_id_fk" FOREIGN KEY ("lembaga_id") REFERENCES "public"."anmategra_lembaga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_access_grant" ADD CONSTRAINT "anmategra_access_grant_period_id_anmategra_lembaga_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."anmategra_lembaga_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_access_grant" ADD CONSTRAINT "anmategra_access_grant_parent_grant_id_anmategra_access_grant_id_fk" FOREIGN KEY ("parent_grant_id") REFERENCES "public"."anmategra_access_grant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_access_grant" ADD CONSTRAINT "anmategra_access_grant_granted_by_anmategra_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_access_grant" ADD CONSTRAINT "anmategra_access_grant_revoked_by_anmategra_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_grant_user_idx" ON "anmategra_access_grant" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "access_grant_lembaga_idx" ON "anmategra_access_grant" USING btree ("lembaga_id");--> statement-breakpoint
CREATE INDEX "access_grant_period_idx" ON "anmategra_access_grant" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "access_grant_parent_idx" ON "anmategra_access_grant" USING btree ("parent_grant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "access_grant_lembaga_user_unique" ON "anmategra_access_grant" USING btree ("lembaga_id","user_id") WHERE "anmategra_access_grant"."lembaga_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "access_grant_period_user_unique" ON "anmategra_access_grant" USING btree ("period_id","user_id") WHERE "anmategra_access_grant"."period_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_access_grant" ADD CONSTRAINT "access_grant_scope_xor" CHECK (num_nonnulls("lembaga_id", "period_id") = 1);--> statement-breakpoint
INSERT INTO "anmategra_access_grant" ("id", "user_id", "lembaga_id", "features", "status", "granted_by", "revoked_at", "revoked_by", "created_at", "updated_at")
SELECT "id", "user_id", "lembaga_id", ARRAY['admin']::text[], "status", "granted_by", "revoked_at", "revoked_by", "created_at", "updated_at"
FROM "anmategra_lembaga_admin";--> statement-breakpoint
INSERT INTO "anmategra_access_grant" ("id", "user_id", "period_id", "features", "status", "granted_by", "revoked_at", "revoked_by", "created_at", "updated_at")
SELECT "id", "user_id", "period_id", ARRAY['admin']::text[], "status", "granted_by", "revoked_at", "revoked_by", "created_at", "updated_at"
FROM "anmategra_event_admin";--> statement-breakpoint
DROP TABLE "anmategra_event_admin" CASCADE;--> statement-breakpoint
DROP TABLE "anmategra_lembaga_admin" CASCADE;
