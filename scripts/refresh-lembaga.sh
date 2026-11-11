#!/usr/bin/env bash
# Refresh lembaga-official.csv from a (new) KM ITB database export.
# Deterministic: rebuilds the description baseline from the committed raw
# JSON, then re-applies the xlsx merge. Safe to re-run.
#
# Usage: npm run db:refresh-lembaga -- <path-to-xlsx>
set -euo pipefail
cd "$(dirname "$0")/.."

XLSX="${1:?usage: npm run db:refresh-lembaga -- <path-to-xlsx>}"
[ -f "$XLSX" ] || { echo "file not found: $XLSX" >&2; exit 1; }

echo "== 1/3 rebuild description baseline (no emails) =="
python3 scripts/build-lembaga-csv.py

echo "== 2/3 match baseline against xlsx =="
node scripts/merge-lembaga-xlsx.cjs "$XLSX"

echo "== 3/3 apply: emails, dates, members, additions =="
node scripts/apply-merge.cjs "$XLSX"

echo
echo "Done. Review docs/plans/stage3-merge-qa.md (new orgs appear as"
echo "'unmatched theirs' — add them to ADDITIONS in scripts/apply-merge.cjs"
echo "and re-run this command). Then load with:"
echo "  npm run db:seed-lembaga -- --dry-run   # review plan"
echo "  npm run db:seed-lembaga                # load for real"
