-- Setiap formulir harus punya minimal satu bagian.
INSERT INTO "anmategra_form_section" ("id", "form_id", "title", "sort_order")
SELECT gen_random_uuid()::text, f."id", 'Bagian 1', 0
FROM "anmategra_form" f
WHERE NOT EXISTS (
  SELECT 1 FROM "anmategra_form_section" s WHERE s."form_id" = f."id"
);
--> statement-breakpoint
-- Pertanyaan yatim dipindahkan ke bagian pertama formulirnya.
UPDATE "anmategra_form_field" f
SET "section_id" = s."id"
FROM (
  SELECT DISTINCT ON ("form_id") "form_id", "id"
  FROM "anmategra_form_section"
  ORDER BY "form_id", "sort_order", "id"
) s
WHERE f."form_id" = s."form_id" AND f."section_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "anmategra_form_field" DROP CONSTRAINT "anmategra_form_field_section_id_anmategra_form_section_id_fk";
--> statement-breakpoint
ALTER TABLE "anmategra_form_field" ALTER COLUMN "section_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_form" ADD COLUMN "slug" varchar(80);--> statement-breakpoint
ALTER TABLE "anmategra_form_field" ADD CONSTRAINT "anmategra_form_field_section_id_anmategra_form_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."anmategra_form_section"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "form_slug_unique" ON "anmategra_form" USING btree ("slug");