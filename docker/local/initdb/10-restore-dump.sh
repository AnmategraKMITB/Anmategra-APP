#!/bin/sh
# Dijalankan otomatis oleh image postgres hanya saat volume datanya masih kosong
# (pertama kali `up`, atau setelah `down -v`).
#
# Kalau dump ada, isinya dipulihkan. Skema yang belum lengkap disusulkan oleh
# `npm run db:migrate` saat container app start. Kalau dump tidak ada, database
# dibiarkan kosong dan seluruh skema dibuat oleh migrasi.
set -e

DUMP="/seed/${DB_DUMP_FILE:-anmategra.dump}"

if [ -f "$DUMP" ]; then
  echo "Memulihkan $DUMP ke database $POSTGRES_DB..."
  pg_restore --no-owner --no-privileges --exit-on-error \
    --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" "$DUMP"
  echo "Dump selesai dipulihkan."
else
  echo "Dump $DUMP tidak ditemukan; database dibiarkan kosong (skema dibuat oleh migrasi)."
fi
