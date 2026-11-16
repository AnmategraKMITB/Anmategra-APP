CREATE TABLE "anmategra_alt_login_claim" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"nim" integer NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"secret_hash" varchar(64) NOT NULL,
	"ktm" jsonb,
	"ip" varchar(64),
	"disputed" boolean DEFAULT false NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" varchar(255),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar(64),
	"revoked_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_alt_login_claim" ADD CONSTRAINT "anmategra_alt_login_claim_user_id_anmategra_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."anmategra_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_alt_login_claim" ADD CONSTRAINT "anmategra_alt_login_claim_approved_by_anmategra_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."anmategra_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anmategra_alt_login_claim" ADD CONSTRAINT "anmategra_alt_login_claim_revoked_by_anmategra_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."anmategra_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alt_login_claim_contact_email_idx" ON "anmategra_alt_login_claim" USING btree ("contact_email");--> statement-breakpoint
CREATE INDEX "alt_login_claim_user_idx" ON "anmategra_alt_login_claim" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "alt_login_claim_nim_idx" ON "anmategra_alt_login_claim" USING btree ("nim");