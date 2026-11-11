CREATE TABLE "anmategra_admin_audit" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"actor_id" varchar(255) NOT NULL,
	"action" varchar(64) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" varchar(255),
	"summary" text NOT NULL,
	"metadata" jsonb,
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_user" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_user" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anmategra_admin_audit" ADD CONSTRAINT "anmategra_admin_audit_actor_id_anmategra_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."anmategra_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_actor_idx" ON "anmategra_admin_audit" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "admin_audit_created_idx" ON "anmategra_admin_audit" USING btree ("created_at");