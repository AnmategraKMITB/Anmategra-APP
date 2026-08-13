ALTER TABLE "anmategra_organization_unit" DROP CONSTRAINT "anmategra_organization_unit_parent_id_anmategra_organization_unit_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_association_request" ADD CONSTRAINT "anmategra_association_request_org_unit_id_anmategra_organization_unit_id_fk" FOREIGN KEY ("org_unit_id") REFERENCES "public"."anmategra_organization_unit"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_association_request" ADD CONSTRAINT "anmategra_association_request_org_role_id_anmategra_organization_role_id_fk" FOREIGN KEY ("org_role_id") REFERENCES "public"."anmategra_organization_role"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_association_request_lembaga" ADD CONSTRAINT "anmategra_association_request_lembaga_org_unit_id_anmategra_organization_unit_id_fk" FOREIGN KEY ("org_unit_id") REFERENCES "public"."anmategra_organization_unit"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_association_request_lembaga" ADD CONSTRAINT "anmategra_association_request_lembaga_org_role_id_anmategra_organization_role_id_fk" FOREIGN KEY ("org_role_id") REFERENCES "public"."anmategra_organization_role"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_keanggotaan" ADD CONSTRAINT "anmategra_keanggotaan_org_unit_id_anmategra_organization_unit_id_fk" FOREIGN KEY ("org_unit_id") REFERENCES "public"."anmategra_organization_unit"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_keanggotaan" ADD CONSTRAINT "anmategra_keanggotaan_org_role_id_anmategra_organization_role_id_fk" FOREIGN KEY ("org_role_id") REFERENCES "public"."anmategra_organization_role"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_kehimpunan" ADD CONSTRAINT "anmategra_kehimpunan_org_unit_id_anmategra_organization_unit_id_fk" FOREIGN KEY ("org_unit_id") REFERENCES "public"."anmategra_organization_unit"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_kehimpunan" ADD CONSTRAINT "anmategra_kehimpunan_org_role_id_anmategra_organization_role_id_fk" FOREIGN KEY ("org_role_id") REFERENCES "public"."anmategra_organization_role"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_organization_unit" ADD CONSTRAINT "anmategra_organization_unit_parent_id_anmategra_organization_unit_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."anmategra_organization_unit"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "keanggotaan_org_unit_idx" ON "anmategra_keanggotaan" USING btree ("org_unit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "keanggotaan_org_role_idx" ON "anmategra_keanggotaan" USING btree ("org_role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kehimpunan_org_unit_idx" ON "anmategra_kehimpunan" USING btree ("org_unit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kehimpunan_org_role_idx" ON "anmategra_kehimpunan" USING btree ("org_role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_role_structure_idx" ON "anmategra_organization_role" USING btree ("structure_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_structure_active_lembaga_unique" ON "anmategra_organization_structure" USING btree ("lembaga_id") WHERE "anmategra_organization_structure"."is_active" = true AND "anmategra_organization_structure"."lembaga_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_structure_active_event_unique" ON "anmategra_organization_structure" USING btree ("event_id") WHERE "anmategra_organization_structure"."is_active" = true AND "anmategra_organization_structure"."event_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_unit_structure_idx" ON "anmategra_organization_unit" USING btree ("structure_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_unit_parent_idx" ON "anmategra_organization_unit" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_unit_sibling_order_idx" ON "anmategra_organization_unit" USING btree ("structure_id","parent_id","sort_order");--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- Hand-written below this line.
--
-- drizzle-kit 0.24.2 does not serialize CHECK constraints at all (drizzle-orm
-- exports check(), but the kit silently emits nothing for it), so these cannot
-- be expressed in schema.ts. Do NOT run `npm run db:push` on this database:
-- push diffs the live DB against schema.ts, where these do not exist, and can
-- propose dropping them. Use `npm run db:migrate` only.
--
-- Checked against the phase3-5 dump (53 structures / 105 units / 152 roles)
-- before writing: every constraint below is satisfied by that data.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
 ALTER TABLE "anmategra_organization_structure"
   ADD CONSTRAINT "organization_structure_owner_xor"
   CHECK (num_nonnulls("lembaga_id", "event_id") = 1);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_organization_unit"
   ADD CONSTRAINT "organization_unit_kind_check"
   CHECK ("kind" IN ('Bidang', 'Divisi', 'Subdivisi'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
-- `level` is DEPTH in the tree, not a function of `kind`: existing data is flat,
-- with Divisi sitting at level 1 as a root. Ordering rules between kinds are
-- enforced in the router instead.
DO $$ BEGIN
 ALTER TABLE "anmategra_organization_unit"
   ADD CONSTRAINT "organization_unit_level_range_check"
   CHECK ("level" BETWEEN 1 AND 3);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_organization_unit"
   ADD CONSTRAINT "organization_unit_root_parent_check"
   CHECK (
     ("level" = 1 AND "parent_id" IS NULL) OR
     ("level" > 1 AND "parent_id" IS NOT NULL)
   );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
-- Composite FK: a unit's parent must live in the same structure. This is the
-- only guarantee here that survives a script or psql session bypassing the API.
DO $$ BEGIN
 ALTER TABLE "anmategra_organization_unit"
   ADD CONSTRAINT "organization_unit_id_structure_unique"
   UNIQUE ("id", "structure_id");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anmategra_organization_unit"
   ADD CONSTRAINT "organization_unit_parent_same_structure_fk"
   FOREIGN KEY ("parent_id", "structure_id")
   REFERENCES "anmategra_organization_unit"("id", "structure_id")
   ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;