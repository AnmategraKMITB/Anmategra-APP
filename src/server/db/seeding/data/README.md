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

**Fill in missing emails.** Rows without an email are skipped (with a named warning) at seed time — currently 5 orgs (Unit Aikido, UKSU, Cerberus, Ganesha Pintar, Perisai Diri — not yet registered in Ditmawa) have everything except the email. To seed them: fill the `email` column for those rows in `lembaga-official.csv`, then

```
npm run db:seed-lembaga -- --dry-run   # confirm which rows will be added
npm run db:seed-lembaga                # adds the new ones, skips existing
```

Emails come from a human source — an updated sheet from the lead, or the org's own Instagram bio. There is no automated collector.

**Add one new lembaga by hand.** Append a row to `lembaga-official.csv` (minimum: `email`, `name`, `type`) and re-run `npm run db:seed-lembaga`. When new orgs arrive as part of a whole new spreadsheet, use the refresh pipeline below instead.

**Change an existing account.** Edit the row in `lembaga-official.csv` and re-run the seed — it updates any lembaga whose stored values disagree with the CSV. Always dry-run first: the CSV wins, so an update silently replaces whatever is in the database, including edits a lembaga made through the app.

```
npm run db:seed-lembaga -- --dry-run       # prints every field as "old -> new"
npm run db:seed-lembaga
npm run db:seed-lembaga -- --insert-only   # add new orgs, touch nothing existing
```

A blank CSV cell means "unknown", never "clear this" — an empty cell leaves a populated column alone, so blanking a field still has to be done in the database. Only `name`, `description`, `founding_date`, `ending_date`, `type`, `major`, `field` and `member_count` are ever written; a name change also updates `users.name`, which is what the logged-in sidebar shows. Dates compare on their **Jakarta calendar date**, so a value stored at WIB midnight is not mistaken for a different day.

**Remove an account.** The seed never deletes — do it in the database directly.

## How this CSV was built (one-shot pipeline)

1. `scripts/fetch-lembaga.py` → `raw/lembaga-<date>.json` — kemahasiswaan.itb.ac.id registry (names, visi/misi; **no emails**)
2. `scripts/build-lembaga-csv.py` → baseline CSV — descriptions + inferred majors/fields (**no emails**)
3. `scripts/merge-lembaga-xlsx.cjs <xlsx>` → `raw/merge-report.csv` — matches the baseline against the official KM ITB database
4. `scripts/apply-merge.cjs <xlsx>` → patches the baseline (emails, founding dates, member counts, official prodi/rumpun) and appends the team-approved additions (16 new UKMs, 6 Cirebon komisariat, 2 BSO)
5. `npm run db:seed-lembaga [-- --dry-run]` — idempotent loader; inserts new accounts and updates changed ones. `LEMBAGA_CSV=<path>` env var points it at another file (e.g. a synthetic-email copy for testing)

**Next period's spreadsheet?** One command re-runs steps 2–4 deterministically:

```
npm run db:refresh-lembaga -- <path-to-new-xlsx>
```

Changed emails/dates/counts propagate on re-run. Orgs the sheet lists that we don't
have yet show up as `unmatched theirs` in the merge summary — add a one-line entry to
`ADDITIONS` in `scripts/apply-merge.cjs` (with a hand-written description) and re-run.

**Limitation — email is the join key:** rows are matched to existing accounts by
email, so a *changed* email is not an update, it is a new account — seeding adds a
second one and orphans the old (along with anything the org filled in through the
app). Fix the email in the database first, then seed. Deletions are never
automatic: a disbanded org stays until removed by hand.

## Cautions

- **Order matters:** re-running `build-lembaga-csv.py` regenerates the baseline and **wipes emails** — step 2 is baseline-only, never run it after step 4.
- The xlsx stays gitignored because it holds officers' personal data; the CSV holds org-level accounts only.
- **Line endings:** all scripts read/write LF. Python's `csv` module defaults to CRLF, which csv-parse rejects mid-file (it locks the record delimiter on first sight) — `build-lembaga-csv.py` now passes `lineterminator="\n"` and `apply-merge.cjs` splits on `\r?\n` defensively.
- Remaining gaps (tracked locally, not committed): 5 rows without email (seed skips them with a named warning), the 24 added orgs flagged `needs_review`, and one auto-corrected email typo (Pramuka — verify before production).
