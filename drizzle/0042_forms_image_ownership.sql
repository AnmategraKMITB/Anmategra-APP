CREATE TABLE "anmategra_form_image" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"form_id" varchar(255) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anmategra_form_image" ADD CONSTRAINT "anmategra_form_image_form_id_anmategra_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."anmategra_form"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_image_form_id_idx" ON "anmategra_form_image" USING btree ("form_id");--> statement-breakpoint
-- Catat kepemilikan gambar lama (diunggah sebelum tabel ini ada) supaya
-- "Urungkan" dan penggantian gambar tetap bekerja. Hanya URL UploadThing yang
-- di-backfill: URL asing tidak boleh menghasilkan kunci yang bisa dihapus.
INSERT INTO "anmategra_form_image" ("key", "form_id", "url")
SELECT substring(f."image"->>'url' from '[^/]+$'), f."form_id", f."image"->>'url'
FROM "anmategra_form_field" f
WHERE f."image"->>'url' IS NOT NULL
  AND f."image"->>'url' <> ''
  AND substring(f."image"->>'url' from '[^/]+$') <> ''
  AND (f."image"->>'url' LIKE 'https://utfs.io/%'
    OR f."image"->>'url' LIKE 'https://%.ufs.sh/%')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "anmategra_form_image" ("key", "form_id", "url")
SELECT substring(t."url" from '[^/]+$'), t."form_id", t."url"
FROM (
  SELECT "id" AS "form_id", "theme"->>'banner' AS "url" FROM "anmategra_form"
  UNION ALL
  SELECT "id" AS "form_id", "theme"->>'logo' AS "url" FROM "anmategra_form"
) t
WHERE t."url" IS NOT NULL
  AND t."url" <> ''
  AND substring(t."url" from '[^/]+$') <> ''
  AND (t."url" LIKE 'https://utfs.io/%'
    OR t."url" LIKE 'https://%.ufs.sh/%')
ON CONFLICT ("key") DO NOTHING;