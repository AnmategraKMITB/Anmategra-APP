/**
 * Seed official institution (lembaga) accounts from data/lembaga-official.csv.
 *
 * What it does, per CSV row:
 *   1. verified_users  <- email           (lets the Google sign-in gate in auth.ts accept it)
 *   2. users           <- role='lembaga'  (pre-provisioned so the first login links into it,
 *                                           instead of the auto-created placeholder)
 *   3. lembaga         <- profile row      (name, type, founding_date, ...)
 *
 * Idempotent: existing emails/users/lembaga are detected up front and skipped,
 * so re-running never duplicates. Verified against two consecutive runs.
 *
 * Usage:
 *   npm run db:seed-lembaga            # write to DATABASE_URL
 *   npm run db:seed-lembaga -- --dry-run  # print the plan, write nothing
 *
 * CSV format: see data/README.md.
 */
import { parse } from 'csv-parse/sync';
import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

import { db } from '../index.js';
import { lembaga, users, verifiedUsers } from '../schema.js';

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

const LEMBAGA_TYPES = ['Himpunan', 'UKM', 'Kepanitiaan', 'BSO'] as const;
type LembagaType = (typeof LEMBAGA_TYPES)[number];

interface Row {
  email: string;
  name: string;
  description: string | null;
  foundingDate: Date | null;
  endingDate: Date | null;
  type: LembagaType | null;
  major: string | null;
  field: string | null;
  memberCount: number | null;
}

function parseDate(v: string | undefined): Date | null {
  if (!v || v.trim() === '') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function readCsv(): Row[] {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}`);
    process.exit(1);
  }
  const records = parse(fs.readFileSync(CSV_PATH, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string | undefined>[];

  const rows: Row[] = [];
  records.forEach((rec, i) => {
    const line = i + 2; // header + 1-indexed
    const email = (rec.email ?? '').toLowerCase();
    const name = rec.name ?? '';
    const foundingDate = parseDate(rec.founding_date);

    if (!email || !name) {
      console.warn(
        `line ${line}: skipping — need email and name (${name || email || 'empty row'})`,
      );
      return;
    }
    const rawType = rec.type ?? '';
    if (rawType && !LEMBAGA_TYPES.includes(rawType as LembagaType)) {
      console.warn(
        `line ${line}: invalid type "${rawType}" — leaving null`,
      );
    }
    const memberCount = rec.member_count
      ? parseInt(rec.member_count, 10)
      : null;

    rows.push({
      email,
      name,
      description: rec.description || null,
      foundingDate,
      endingDate: parseDate(rec.ending_date),
      type: LEMBAGA_TYPES.includes(rawType as LembagaType)
        ? (rawType as LembagaType)
        : null,
      major: rec.major || null,
      field: rec.field || null,
      memberCount:
        memberCount !== null && !isNaN(memberCount) ? memberCount : null,
    });
  });

  return rows;
}

async function main() {
  console.log('Seeding official lembaga accounts');
  console.log(`CSV: ${CSV_PATH}`);
  if (DRY_RUN) console.log('DRY RUN — nothing will be written\n');

  const rows = readCsv();
  if (rows.length === 0) {
    console.log('No valid rows — nothing to do.');
    return;
  }

  // De-duplicate within the CSV itself (emails column has no DB-level unique).
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    if (seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });
  if (unique.length < rows.length) {
    console.warn(`${rows.length - unique.length} duplicate email(s) in CSV ignored`);
  }

  const emails = unique.map((r) => r.email);

  const existingVerified = new Set(
    (
      await db
        .select({ email: verifiedUsers.email })
        .from(verifiedUsers)
        .where(inArray(verifiedUsers.email, emails))
    ).map((r) => r.email),
  );
  const existingUsers = new Map(
    (
      await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.email, emails))
    ).map((r) => [r.email, r.id] as const),
  );
  const existingLembagaByUser = new Set(
    existingUsers.size > 0
      ? (
          await db
            .select({ userId: lembaga.userId })
            .from(lembaga)
            .where(inArray(lembaga.userId, [...existingUsers.values()]))
        ).map((r) => r.userId)
      : [],
  );

  const newVerified = unique.filter((r) => !existingVerified.has(r.email));
  const newUsers = unique.filter((r) => !existingUsers.has(r.email));
  const newLembaga = unique.filter((r) => {
    const userId = existingUsers.get(r.email);
    // brand-new user -> will get a lembaga; existing user -> only if no lembaga yet
    return userId === undefined || !existingLembagaByUser.has(userId);
  });

  console.log(`rows: ${unique.length}`);
  console.log(
    `   verified_users: ${newVerified.length} new (${unique.length - newVerified.length} exist)`,
  );
  console.log(
    `   users:          ${newUsers.length} new (${unique.length - newUsers.length} exist)`,
  );
  console.log(
    `   lembaga:        ${newLembaga.length} new (${unique.length - newLembaga.length} exist)\n`,
  );

  if (DRY_RUN) {
    for (const r of unique) {
      console.log(
        `   ${r.email} -> verified:${existingVerified.has(r.email) ? 'skip' : 'insert'} user:${existingUsers.has(r.email) ? 'skip' : 'insert'} lembaga:${newLembaga.includes(r) ? 'insert' : 'skip'} — "${r.name}"`,
      );
    }
    return;
  }

  // Map email -> userId for rows that already have a user; new users get ids here.
  const userIdByEmail = new Map<string, string>(existingUsers);
  for (const r of newUsers) userIdByEmail.set(r.email, crypto.randomUUID());

  if (newVerified.length > 0) {
    await db.insert(verifiedUsers).values(
      newVerified.map((r) => ({
        id: crypto.randomUUID(),
        email: r.email,
      })),
    );
    console.log(`verified_users: +${newVerified.length}`);
  }

  if (newUsers.length > 0) {
    await db.insert(users).values(
      newUsers.map((r) => ({
        id: userIdByEmail.get(r.email)!,
        name: r.name,
        email: r.email,
        emailVerified: new Date(),
        role: 'lembaga' as const,
      })),
    );
    console.log(`users: +${newUsers.length} (role=lembaga)`);
  }

  if (newLembaga.length > 0) {
    await db.insert(lembaga).values(
      newLembaga.map((r) => ({
        id: crypto.randomUUID(),
        userId: userIdByEmail.get(r.email)!,
        name: r.name,
        description: r.description,
        foundingDate: r.foundingDate,
        endingDate: r.endingDate,
        type: r.type,
        major: r.major,
        field: r.field,
        memberCount: r.memberCount,
      })),
    );
    console.log(`lembaga: +${newLembaga.length}`);
  }

  console.log('\nDone.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
