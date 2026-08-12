/**
 * Seed official institution (lembaga) accounts from data/lembaga-official.csv.
 *
 * What it does, per CSV row:
 *   1. verified_users  <- email           (lets the Google sign-in gate in auth.ts accept it)
 *   2. users           <- role='lembaga'  (pre-provisioned so the first login links into it,
 *                                           instead of the auto-created placeholder)
 *   3. lembaga         <- profile row      (name, type, founding_date, ...)
 *
 * Idempotent: existing emails/users are detected up front and skipped, so
 * re-running never duplicates. Verified against two consecutive runs.
 *
 * Existing lembaga rows are UPDATED when the CSV disagrees with the database.
 * A blank CSV cell means "unknown", never "clear this" — blanks are normal in
 * this data (no ending_date, no major for UKM), so an empty cell leaves a
 * populated column alone. Only genuinely differing fields are written, and
 * --dry-run prints the exact before/after for each one.
 *
 * Careful: the CSV wins on every run. Once lembaga edit their own profile
 * through the app, re-seeding overwrites those edits for any field the CSV
 * also fills. Use --dry-run first, or --insert-only to add new orgs without
 * touching existing ones.
 *
 * Usage:
 *   npm run db:seed-lembaga                   # insert new + update changed
 *   npm run db:seed-lembaga -- --dry-run      # print the plan, write nothing
 *   npm run db:seed-lembaga -- --insert-only  # insert new, never update
 *
 * CSV format: see data/README.md.
 */
import { parse } from 'csv-parse/sync';
import 'dotenv/config';
import { eq, inArray } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

import { db } from '../index.js';
import { lembaga, users, verifiedUsers } from '../schema.js';

const DRY_RUN = process.argv.includes('--dry-run');
const INSERT_ONLY = process.argv.includes('--insert-only');

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
      console.warn(`line ${line}: invalid type "${rawType}" — leaving null`);
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

/** The lembaga columns this CSV owns — the only ones an update ever touches. */
const UPDATABLE = [
  'name',
  'description',
  'foundingDate',
  'endingDate',
  'type',
  'major',
  'field',
  'memberCount',
] as const;
type UpdatableField = (typeof UPDATABLE)[number];

type ExistingLembaga = Pick<Row, UpdatableField> & {
  id: string;
  userId: string;
};

interface Change {
  field: UpdatableField;
  from: unknown;
  to: unknown;
}

interface PlannedUpdate {
  row: Row;
  lembagaId: string;
  userId: string;
  changes: Change[];
}

/**
 * founding_date / ending_date are calendar dates living in a timestamptz, and
 * the two write paths disagree on the time-of-day: this seed parses "2006-03-08"
 * to UTC midnight, while other paths store WIB midnight (2006-03-07T17:00Z).
 * Both mean 8 March in Bandung, so compare the Jakarta calendar date — instant
 * equality would report a difference that no human would call one.
 */
function jakartaDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date)
    return jakartaDate(a) === jakartaDate(b);
  return a === b;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '(kosong)';
  if (v instanceof Date) return jakartaDate(v);
  const s = String(v);
  return s.length > 60 ? `${s.slice(0, 57)}...` : s;
}

/** Fields where the CSV has a value that differs from what is already stored. */
function diffLembaga(row: Row, existing: ExistingLembaga): Change[] {
  const changes: Change[] = [];
  for (const field of UPDATABLE) {
    const next = row[field];
    if (next === null) continue; // blank CSV cell = unknown, never a clear
    const current = existing[field];
    if (!sameValue(current, next))
      changes.push({ field, from: current, to: next });
  }
  return changes;
}

async function applyUpdate(update: PlannedUpdate): Promise<void> {
  const { row } = update;
  const changed = new Set<UpdatableField>(update.changes.map((c) => c.field));
  const set: Partial<typeof lembaga.$inferInsert> = {};

  if (changed.has('name')) set.name = row.name;
  if (changed.has('description')) set.description = row.description;
  if (changed.has('foundingDate')) set.foundingDate = row.foundingDate;
  if (changed.has('endingDate')) set.endingDate = row.endingDate;
  if (changed.has('type')) set.type = row.type;
  if (changed.has('major')) set.major = row.major;
  if (changed.has('field')) set.field = row.field;
  if (changed.has('memberCount')) set.memberCount = row.memberCount;

  await db.update(lembaga).set(set).where(eq(lembaga.id, update.lembagaId));

  // users.name is what the logged-in sidebar renders, and the insert path sets
  // it from the same CSV column — keep the two from drifting on rename.
  if (changed.has('name')) {
    await db
      .update(users)
      .set({ name: row.name })
      .where(eq(users.id, update.userId));
  }
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
    console.warn(
      `${rows.length - unique.length} duplicate email(s) in CSV ignored`,
    );
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
  const existingLembagaRows: ExistingLembaga[] =
    existingUsers.size > 0
      ? await db
          .select({
            id: lembaga.id,
            userId: lembaga.userId,
            name: lembaga.name,
            description: lembaga.description,
            foundingDate: lembaga.foundingDate,
            endingDate: lembaga.endingDate,
            type: lembaga.type,
            major: lembaga.major,
            field: lembaga.field,
            memberCount: lembaga.memberCount,
          })
          .from(lembaga)
          .where(inArray(lembaga.userId, [...existingUsers.values()]))
      : [];

  const existingLembagaByUser = new Map<string, ExistingLembaga>();
  for (const r of existingLembagaRows) {
    if (existingLembagaByUser.has(r.userId)) {
      console.warn(
        `user ${r.userId} has more than one lembaga row — updating the first, leaving ${r.id} alone`,
      );
      continue;
    }
    existingLembagaByUser.set(r.userId, r);
  }

  const newVerified = unique.filter((r) => !existingVerified.has(r.email));
  const newUsers = unique.filter((r) => !existingUsers.has(r.email));
  const newLembaga = unique.filter((r) => {
    const userId = existingUsers.get(r.email);
    // brand-new user -> will get a lembaga; existing user -> only if no lembaga yet
    return userId === undefined || !existingLembagaByUser.has(userId);
  });

  const updates: PlannedUpdate[] = [];
  if (!INSERT_ONLY) {
    for (const r of unique) {
      const userId = existingUsers.get(r.email);
      if (userId === undefined) continue;
      const existing = existingLembagaByUser.get(userId);
      if (!existing) continue;
      const changes = diffLembaga(r, existing);
      if (changes.length > 0) {
        updates.push({ row: r, lembagaId: existing.id, userId, changes });
      }
    }
  }

  console.log(`rows: ${unique.length}`);
  console.log(
    `   verified_users: ${newVerified.length} new (${unique.length - newVerified.length} exist)`,
  );
  console.log(
    `   users:          ${newUsers.length} new (${unique.length - newUsers.length} exist)`,
  );
  const unchanged = unique.length - newLembaga.length - updates.length;
  console.log(
    `   lembaga:        ${newLembaga.length} new, ${updates.length} to update, ${unchanged} unchanged` +
      `${INSERT_ONLY ? '  (--insert-only: updates disabled)' : ''}\n`,
  );

  const updateByRow = new Map(updates.map((u) => [u.row, u] as const));

  if (DRY_RUN) {
    for (const r of unique) {
      const update = updateByRow.get(r);
      const lembagaPlan = newLembaga.includes(r)
        ? 'insert'
        : update
          ? `update(${update.changes.length})`
          : 'skip';
      console.log(
        `   ${r.email} -> verified:${existingVerified.has(r.email) ? 'skip' : 'insert'} user:${existingUsers.has(r.email) ? 'skip' : 'insert'} lembaga:${lembagaPlan} — "${r.name}"`,
      );
    }

    if (updates.length > 0) {
      console.log(`\nchanges (${updates.length} lembaga):`);
      for (const u of updates) {
        console.log(`   ${u.row.name} (${u.row.email})`);
        for (const c of u.changes) {
          console.log(`      ${c.field}: ${fmt(c.from)} -> ${fmt(c.to)}`);
        }
      }
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

  if (updates.length > 0) {
    for (const u of updates) {
      await applyUpdate(u);
      console.log(
        `lembaga updated: ${u.row.name} — ${u.changes.map((c) => c.field).join(', ')}`,
      );
    }
    console.log(`lembaga: ~${updates.length} updated`);
  }

  console.log('\nDone.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
