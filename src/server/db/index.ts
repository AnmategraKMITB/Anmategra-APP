import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "~/env";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

// Batas koneksi dan timeout eksplisit supaya lonjakan trafik mengantre di sisi
// app, bukan menghabiskan max_connections Postgres. Atur lewat DATABASE_POOL_MAX.
const conn =
  globalForDb.conn ??
  postgres(env.DATABASE_URL, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 20),
    idle_timeout: 30,
    connect_timeout: 10,
  });
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
