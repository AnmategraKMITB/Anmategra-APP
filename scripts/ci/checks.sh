#!/usr/bin/env bash
# Semua pengecekan kecil dalam satu job: tiap pengecekan tetap dijalankan walau
# yang sebelumnya gagal, lalu semua kegagalan dicetak sekaligus di akhir.
#
# Butuh DATABASE_URL ke database kosong untuk pengecekan migrasi.
# Dipakai job "Checks" di CI dan hook pre-push (hk.pkl), jadi hasilnya sama.
set -uo pipefail

failed=()
timings=()

run() {
  local name=$1
  shift
  local start=$EPOCHREALTIME
  echo "::group::$name"
  if "$@"; then
    echo "::endgroup::"
  else
    echo "::endgroup::"
    echo "::error title=$name::$name gagal"
    failed+=("$name")
  fi
  timings+=("$(printf '%6.2fs  %s' "$(echo "$EPOCHREALTIME - $start" | bc)" "$name")")
}

run "Lint" bun run lint
run "Format" bun fmt --check
run "Typecheck" bun run check
# Docs di docs/api/ di-generate dari router tRPC dan schema Drizzle.
# Perbaikannya: jalankan `bun run docs` lalu commit hasilnya.
run "Docs up to date" bun run docs:check
if [[ -n "${DATABASE_URL:-}" ]]; then
  # Semua migrasi harus bisa dijalankan dari database kosong.
  run "Migrations apply" bun run db:migrate
  # Snapshot terakhir di drizzle/meta harus sama dengan src/server/db/schema.ts.
  run "Schema has migrations" bash -c '
    bunx drizzle-kit generate >/dev/null
    if [ -n "$(git status --porcelain drizzle)" ]; then
      echo "schema.ts berubah tanpa migrasi. Jalankan \"bun run db:generate\" lalu commit hasilnya."
      git status --porcelain drizzle
      exit 1
    fi'
fi

printf '%s\n' "${timings[@]}"
if ((${#failed[@]})); then
  echo
  echo "Gagal (${#failed[@]}): ${failed[*]}"
  exit 1
fi
