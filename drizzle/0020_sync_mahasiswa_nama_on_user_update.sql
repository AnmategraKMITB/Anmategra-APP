-- Custom SQL migration file, put you code below! --

-- Backfill any mahasiswa.nama rows that already drifted from users.name
-- before this trigger existed.
UPDATE anmategra_mahasiswa m
SET nama = u.name
FROM anmategra_user u
WHERE m.user_id = u.id
  AND u.name IS NOT NULL
  AND m.nama IS DISTINCT FROM u.name;

CREATE OR REPLACE FUNCTION sync_mahasiswa_nama_on_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE anmategra_mahasiswa
  SET nama = NEW.name
  WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_after_update_sync_mahasiswa_nama
AFTER UPDATE ON anmategra_user
FOR EACH ROW
WHEN (NEW.name IS DISTINCT FROM OLD.name)
EXECUTE FUNCTION sync_mahasiswa_nama_on_user_update();
