#!/usr/bin/env bash
# Gagal kalau docs/api/ hasil generate beda dari yang di-commit.
#
# Dipakai di CI supaya dokumentasi tidak diam-diam basi ketika ada procedure
# tRPC atau tabel Drizzle baru. Perbaikannya: `bun run docs`, lalu commit.
set -euo pipefail

bun run docs

changed=$(git status --porcelain -- docs/api/)

if [[ -n "$changed" ]]; then
  echo ""
  echo "Dokumentasi di docs/api/ sudah tidak sinkron dengan kode:"
  echo "$changed"
  echo ""
  echo "Jalankan 'bun run docs' lalu commit hasilnya."
  git --no-pager diff -- docs/api/ | head -100
  exit 1
fi

echo "docs/api/ sudah sinkron."
