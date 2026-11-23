#!/bin/sh
set -e

# Database bisa belum siap saat kontainer naik (mis. database baru dijadwalkan
# ulang oleh Swarm). Keluar seketika membuat orkestrator memulai ulang kontainer
# tiap beberapa detik dan menghabiskan CPU, jadi migrasi dicoba ulang dengan jeda.
MAX_ATTEMPTS="${MIGRATE_MAX_ATTEMPTS:-60}"
RETRY_DELAY="${MIGRATE_RETRY_DELAY:-5}"

attempt=1
echo "Applying database migrations..."
until node_modules/.bin/drizzle-kit migrate; do
  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "Migrations failed after $attempt attempts; giving up." >&2
    exit 1
  fi
  echo "Migration attempt $attempt/$MAX_ATTEMPTS failed; retrying in ${RETRY_DELAY}s..." >&2
  attempt=$((attempt + 1))
  sleep "$RETRY_DELAY"
done

echo "Starting app..."
exec node_modules/.bin/next start
