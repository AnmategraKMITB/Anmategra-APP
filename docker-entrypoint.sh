#!/bin/sh
set -e

echo "Applying database migrations..."
npm run db:migrate

echo "Starting app..."
exec node_modules/.bin/next start
