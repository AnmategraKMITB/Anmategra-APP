#!/bin/sh
set -e

echo "Menjalankan migrasi database..."
npm run db:migrate

echo "Menjalankan Next.js dev server..."
exec npm run dev -- --hostname 0.0.0.0 --port 3000
