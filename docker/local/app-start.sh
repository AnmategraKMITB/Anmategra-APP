#!/bin/sh
set -e

echo "Menjalankan migrasi database..."
bun run db:migrate

echo "Menjalankan Next.js dev server..."
exec bun run dev --hostname 0.0.0.0 --port 3000
