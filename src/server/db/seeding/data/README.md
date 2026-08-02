# Seeding data

## Files

| file | status | purpose |
|---|---|---|
| `lembaga-official.csv` | committed | real institution accounts — consumed by `npm run db:seed-lembaga` |
| `raw/lembaga-<date>.json` | committed | raw capture of the kemahasiswaan.itb.ac.id registry |
| `raw/merge-report.csv` | committed | xlsx ↔ CSV match report (provenance for every patched field) |
| `raw/*.xlsx` | **gitignored** | official KM ITB database — contains officers' personal data (NIM, personal email, WhatsApp); never commit |
| other `*.csv` (via `generate_csv.py`) | committed | dev-only Faker fixtures for `npm run db:seed` |

## `lembaga-official.csv` format

| column | required | notes |
|---|---|---|
| `email` | yes | rows without email are skipped by the seed with a named warning |
| `name` | yes | |
| `description` | no | neutral factual Indonesian, 1–2 sentences |
| `founding_date` | no | ISO date; unknown stays null (column nullable since migration `0017`) |
| `type` | yes | `Himpunan` / `UKM` / `Kepanitiaan` / `BSO` (`BSO` added in migration `0018`) |
| `major` | Himpunan only | official program-studi name from the KM ITB database |
| `field` | UKM only | official Fokus Rumpun: `Agama`, `Pendidikan`, `Kajian`, `Media`, `Olahraga dan Kesehatan`, `Seni`, `Budaya`, `Budaya - Paguyuban` |
| `member_count` | no | integer |

## Common maintenance tasks

**Fill in missing emails.** Rows without an email are skipped (with a named warning) at seed time — currently 15 orgs, e.g. HMM, have everything except the email. To seed them: fill the `email` column for those rows in `lembaga-official.csv`, then

```
npm run db:seed-lembaga -- --dry-run   # confirm which rows will be added
npm run db:seed-lembaga                # adds the new ones, skips existing
```

Emails come from a human source — an updated sheet from the lead, or the org's own Instagram bio. There is no automated collector.

**Add one new lembaga by hand.** Append a row to `lembaga-official.csv` (minimum: `email`, `name`, `type`) and re-run `npm run db:seed-lembaga`. When new orgs arrive as part of a whole new spreadsheet, use the refresh pipeline below instead.

**Change or remove an existing account.** The seed cannot do this (see the add-only limitation below) — edit the database directly.

## How this CSV was built (one-shot pipeline)

1. `scripts/fetch-lembaga.py` → `raw/lembaga-<date>.json` — kemahasiswaan.itb.ac.id registry (names, visi/misi; **no emails**)
2. `scripts/build-lembaga-csv.py` → baseline CSV — descriptions + inferred majors/fields (**no emails**)
3. `scripts/merge-lembaga-xlsx.cjs <xlsx>` → `raw/merge-report.csv` — matches the baseline against the official KM ITB database
4. `scripts/apply-merge.cjs <xlsx>` → patches the baseline (emails, founding dates, member counts, official prodi/rumpun) and appends the team-approved additions (16 new UKMs, 6 Cirebon komisariat, 2 BSO)
5. `npm run db:seed-lembaga [-- --dry-run]` — idempotent loader; `LEMBAGA_CSV=<path>` env var points it at another file (e.g. a synthetic-email copy for testing)

**Next period's spreadsheet?** One command re-runs steps 2–4 deterministically:

```
npm run db:refresh-lembaga -- <path-to-new-xlsx>
```

Changed emails/dates/counts propagate on re-run. Orgs the sheet lists that we don't
have yet show up as `unmatched theirs` in the merge summary — add a one-line entry to
`ADDITIONS` in `scripts/apply-merge.cjs` (with a hand-written description) and re-run.

**Limitation — the seed is add-only:** it never updates or deletes existing accounts.
If an org's email changes, seeding adds a second account and orphans the old one; a
disbanded org stays until removed from the DB by hand.

## Cautions

- **Order matters:** re-running `build-lembaga-csv.py` regenerates the baseline and **wipes emails** — step 2 is baseline-only, never run it after step 4.
- The xlsx stays gitignored because it holds officers' personal data; the CSV holds org-level accounts only.
- **Line endings:** all scripts read/write LF. Python's `csv` module defaults to CRLF, which csv-parse rejects mid-file (it locks the record delimiter on first sight) — `build-lembaga-csv.py` now passes `lineterminator="\n"` and `apply-merge.cjs` splits on `\r?\n` defensively.
- Remaining gaps (tracked locally, not committed): 15 rows without email (seed skips them with a named warning), the 24 added orgs flagged `needs_review`, and one auto-corrected email typo (Pramuka — verify before production).
