CREATE TABLE "anmategra_admin_permission" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"permissions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"expires_at" timestamp with time zone,
	"granted_by" varchar(255),
	"revoked_at" timestamp with time zone,
	"revoked_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_admin_permission" ADD CONSTRAINT "anmategra_admin_permission_user_id_anmategra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."anmategra_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_admin_permission" ADD CONSTRAINT "anmategra_admin_permission_granted_by_anmategra_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_admin_permission" ADD CONSTRAINT "anmategra_admin_permission_revoked_by_anmategra_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_permission_user_unique" ON "anmategra_admin_permission" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "admin_permission_active_idx" ON "anmategra_admin_permission" USING btree ("revoked_at","expires_at");