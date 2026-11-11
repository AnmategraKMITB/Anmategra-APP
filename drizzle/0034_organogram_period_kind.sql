-- Rilis 2D-1: pembeda periode kepengurusan dan kegiatan.
-- ALTER dari generator; CHECK ditulis tangan. Baris yang sudah ada tetap "kegiatan";
-- periode kepengurusan ditandai oleh skrip data (cleanup/phase2d-kind.sql) dan oleh impor 2D.

ALTER TABLE "anmategra_lembaga_period" ADD COLUMN "kind" varchar(32) DEFAULT 'kegiatan' NOT NULL;--> statement-breakpoint
ALTER TABLE "anmategra_lembaga_period" ADD CONSTRAINT "lembaga_period_kind_check" CHECK ("kind" IN ('kegiatan', 'kepengurusan'));
