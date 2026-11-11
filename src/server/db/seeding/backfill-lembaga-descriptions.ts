/**
 * Backfill empty lembaga.description from data/lembaga-official.csv.
 *
 * The seed is add-only, so lembaga accounts created before the official CSV
 * existed keep their NULL description. This matches each lembaga to a CSV row
 * by the linked user's email and fills the description only where it is
 * currently empty — hand-written descriptions are never overwritten.
 *
 * Usage:
 *   npm run db:backfill-lembaga-descriptions -- --dry-run
 *   npm run db:backfill-lembaga-descriptions
 */
import { parse } from 'csv-parse/sync';
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

import { db } from '../index.js';
import { lembaga, users } from '../schema.js';

const DRY_RUN = process.argv.includes('--dry-run');

const CSV_PATH =
  process.env.LEMBAGA_CSV ??
  path.join(
    process.cwd(),
    'src',
    'server',
    'db',
    'seeding',
    'data',
    'lembaga-official.csv',
  );

async function main() {
  const rows = parse(fs.readFileSync(CSV_PATH, 'utf-8'), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
  }) as { email: string; description: string }[];

  const descByEmail = new Map(
    rows
      .filter((r) => r.email && r.description)
      .map((r) => [r.email.toLowerCase(), r.description]),
  );

  const orgs = await db
    .select({
      id: lembaga.id,
      name: lembaga.name,
      description: lembaga.description,
      email: users.email,
    })
    .from(lembaga)
    .innerJoin(users, eq(users.id, lembaga.userId));

  const toFill = orgs.filter(
    (o) =>
      !o.description?.trim() &&
      o.email &&
      descByEmail.has(o.email.toLowerCase()),
  );

  console.log(
    `${DRY_RUN ? '[dry-run] ' : ''}lembaga: ${orgs.length}, ` +
      `empty description: ${orgs.filter((o) => !o.description?.trim()).length}, ` +
      `fillable from CSV: ${toFill.length}`,
  );

  for (const o of toFill) {
    console.log(`  fill: ${o.name} (${o.email})`);
    if (!DRY_RUN) {
      await db
        .update(lembaga)
        .set({ description: descByEmail.get(o.email!.toLowerCase())! })
        .where(eq(lembaga.id, o.id));
    }
  }

  console.log(DRY_RUN ? 'Dry run — nothing written.' : 'Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
