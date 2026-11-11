-- Cleanup pre-existing multi-highlighted-event rows before the unique
-- partial index below, or it will fail to create. Keep the most recently
-- updated highlighted event per org, un-highlight the rest.
UPDATE anmategra_event e
SET is_highlighted = false
WHERE e.is_highlighted = true
  AND e.updated_at < (
    SELECT MAX(e2.updated_at)
    FROM anmategra_event e2
    WHERE e2.org_id = e.org_id
      AND e2.is_highlighted = true
  );

CREATE UNIQUE INDEX IF NOT EXISTS "event_org_highlighted_unique" ON "anmategra_event" USING btree ("org_id") WHERE "anmategra_event"."is_highlighted" = true;