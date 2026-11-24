#!/usr/bin/env bash
# Semua pengecekan kecil dalam satu job. Pengecekan berjalan bersamaan; tiap
# pengecekan tetap dijalankan walau yang lain gagal, lalu semua kegagalan
# dicetak sekaligus di akhir.
#
# Butuh DATABASE_URL ke database kosong untuk pengecekan migrasi (dilewati bila
# tidak ada). Dipakai job "Checks" di CI dan hook pre-push (hk.pkl), jadi
# hasilnya sama.
set -uo pipefail

logs=$(mktemp -d)
trap 'rm -rf "$logs"' EXIT
names=()

start() {
  local name=$1
  shift
  names+=("$name")
  (
    t0=$EPOCHREALTIME
    "$@" > "$logs/$name.log" 2>&1
    echo $? > "$logs/$name.status"
    echo "$EPOCHREALTIME - $t0" | bc > "$logs/$name.time"
  ) &
}

start "Lint" bun run lint
start "Format" bun fmt --check
start "Typecheck" bun run check
# Docs di docs/api/ di-generate dari router tRPC dan schema Drizzle.
# Perbaikannya: jalankan `bun run docs` lalu commit hasilnya.
start "Docs up to date" bun run docs:check
if [[ -n "${DATABASE_URL:-}" ]]; then
  # Semua migrasi harus bisa dijalankan dari database kosong, dan snapshot
  # terakhir di drizzle/meta harus sama dengan src/server/db/schema.ts.
  start "Migrations" bash -c '
    bun run db:migrate || exit 1
    bunx drizzle-kit generate >/dev/null
    if [ -n "$(git status --porcelain drizzle)" ]; then
      echo "schema.ts berubah tanpa migrasi. Jalankan \"bun run db:generate\" lalu commit hasilnya."
      git status --porcelain drizzle
      exit 1
    fi'
fi
wait

failed=()
for name in "${names[@]}"; do
  status=$(cat "$logs/$name.status")
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then echo "::group::$name"; fi
  cat "$logs/$name.log"
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then echo "::endgroup::"; fi
  if [[ "$status" != 0 ]]; then
    failed+=("$name")
    if [[ -n "${GITHUB_ACTIONS:-}" ]]; then echo "::error title=$name::$name gagal"; fi
  fi
done

echo
for name in "${names[@]}"; do
  printf '%6.2fs  %s  %s\n' "$(cat "$logs/$name.time")" \
    "$([[ $(cat "$logs/$name.status") == 0 ]] && echo ok || echo GAGAL)" "$name"
done
if ((${#failed[@]})); then
  echo
  echo "Gagal (${#failed[@]}): ${failed[*]}"
  exit 1
fi
