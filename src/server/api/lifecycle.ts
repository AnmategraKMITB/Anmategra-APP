import { TRPCError } from '@trpc/server';
import { type SQL, and, eq, getTableColumns } from 'drizzle-orm';
import type {
  PgColumn,
  PgDatabase,
  PgTable,
  PgUpdateSetSource,
} from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import { type Lifecycle, check } from '~/lib/lifecycle/define';
import type * as schema from '~/server/db/schema';

type Db = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

const STALE =
  'Data ini baru saja diubah orang lain. Muat ulang lalu coba lagi.';

/** Melempar penolakan siklus hidup sebagai TRPCError, apa adanya. */
export function assertMove<S extends string, C>(
  lifecycle: Lifecycle<S, C>,
  from: S,
  to: S,
  ctx: C,
): void {
  const verdict = check(lifecycle, from, to, ctx);
  if (!verdict.ok) {
    throw new TRPCError({ code: verdict.code, message: verdict.message });
  }
}

/**
 * Satu-satunya jalan menulis status: periksa siklus hidup, lalu ubah baris
 * hanya bila statusnya masih `from` (compare-and-set). Bila tidak ada baris
 * yang cocok, status sudah diubah orang lain sejak dibaca, jadi CONFLICT.
 * Pemanggil yang sudah mengunci baris tetap aman; syarat tambahannya gratis.
 */
export async function transition<T extends PgTable, S extends string, C>(
  db: Db,
  lifecycle: Lifecycle<S, C>,
  args: {
    table: T;
    /** Kolom status di `table`. */
    column: PgColumn;
    /** Baris yang dituju, mis. `eq(form.id, id)`. */
    where: SQL;
    from: S;
    to: S;
    ctx: C;
    /** Kolom lain yang ikut ditulis bersama status. */
    set?: PgUpdateSetSource<T>;
  },
): Promise<T['$inferSelect']> {
  assertMove(lifecycle, args.from, args.to, args.ctx);

  const key = Object.entries(getTableColumns(args.table)).find(
    ([, column]) => column === args.column,
  )?.[0];
  if (!key) {
    throw new Error(`Kolom status ${args.column.name} bukan milik tabel ini.`);
  }

  const rows = (await db
    .update(args.table)
    .set({ ...args.set, [key]: args.to } as PgUpdateSetSource<T>)
    .where(and(args.where, eq(args.column, args.from)))
    .returning()) as T['$inferSelect'][];
  const [row] = rows;
  if (!row) throw new TRPCError({ code: 'CONFLICT', message: STALE });
  return row;
}
