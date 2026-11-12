-- Menyelaraskan status oprec dengan status formulirnya. Sebelum ini keduanya
-- bisa berselisih (H-01); mulai sekarang selalu diubah bersama.
-- 1. Formulir sudah ditutup: oprec yang masih dibuka ikut ditutup.
UPDATE "anmategra_recruitment" r SET "status" = 'closed'
FROM "anmategra_form" f
WHERE f."id" = r."form_id" AND r."status" = 'open' AND f."status" = 'Closed';--> statement-breakpoint
-- 2. Oprec sudah ditutup: formulir yang masih terbit ikut ditutup.
UPDATE "anmategra_form" f SET "status" = 'Closed'
FROM "anmategra_recruitment" r
WHERE r."form_id" = f."id" AND r."status" = 'closed' AND f."status" = 'Published';--> statement-breakpoint
-- 3. Oprec masih draf: formulir tanpa jawaban kembali draf (pendaftaran memang belum dibuka).
UPDATE "anmategra_form" f SET "status" = 'Draft'
FROM "anmategra_recruitment" r
WHERE r."form_id" = f."id" AND r."status" = 'draft' AND f."status" <> 'Draft'
  AND NOT EXISTS (SELECT 1 FROM "anmategra_form_submission" s WHERE s."form_id" = f."id");--> statement-breakpoint
-- 4. Oprec dibuka tetapi formulirnya draf dan belum ada pendaftar: oprec kembali draf.
UPDATE "anmategra_recruitment" r SET "status" = 'draft'
FROM "anmategra_form" f
WHERE f."id" = r."form_id" AND r."status" = 'open' AND f."status" = 'Draft'
  AND NOT EXISTS (SELECT 1 FROM "anmategra_application" a WHERE a."recruitment_id" = r."id");--> statement-breakpoint
-- 5. Oprec draf tanpa pendaftar yang penempatannya sudah dimajukan (H-06): kembali berjalan.
UPDATE "anmategra_recruitment" r SET "placement_state" = 'berjalan'
WHERE r."status" = 'draft' AND r."placement_state" <> 'berjalan'
  AND NOT EXISTS (SELECT 1 FROM "anmategra_application" a WHERE a."recruitment_id" = r."id");
