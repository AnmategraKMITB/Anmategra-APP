#!/bin/sh
set -e

echo "Applying database migrations..."
npm run db:migrate

echo "Starting app..."
exec npm run start
