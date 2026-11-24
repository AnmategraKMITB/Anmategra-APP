import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { supportLifecycle } from '~/lib/lifecycle/support';
import { support } from '~/server/db/schema';
import { createTestDb, resetDb } from '~/test/test-db';

import { transition } from './lifecycle';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

async function report(status: 'Draft' | 'Reported' | 'Resolved') {
  const id = crypto.randomUUID();
  await db
    .insert(support)
    .values({ id, subject: 'Uji', description: 'Uji', status });
  return id;
}

async function statusOf(id: string) {
  const [row] = await db
    .select({ status: support.status })
    .from(support)
    .where(eq(support.id, id));
  return row!.status;
}

async function errorOf(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return { code: e.code, message: e.message };
  }
}

describe('transition', () => {
  it('menulis status baru dan mengembalikan barisnya', async () => {
    const id = await report('Reported');
    const row = await transition(db, supportLifecycle, {
      table: support,
      column: support.status,
      where: eq(support.id, id),
      from: 'Reported',
      to: 'Resolved',
      ctx: undefined,
    });
    expect(row.status).toBe('Resolved');
    expect(await statusOf(id)).toBe('Resolved');
  });

  it('menolak perpindahan tak sah tanpa menulis', async () => {
    const id = await report('Resolved');
    const error = await errorOf(
      transition(db, supportLifecycle, {
        table: support,
        column: support.status,
        where: eq(support.id, id),
        from: 'Resolved',
        to: 'Reported',
        ctx: undefined,
      }),
    );
    expect(error).toEqual({
      code: 'BAD_REQUEST',
      message:
        'Tidak dapat mengubah status laporan mundur dari Resolved ke Reported',
    });
    expect(await statusOf(id)).toBe('Resolved');
  });

  it('menolak dengan CONFLICT bila status sudah berubah sejak dibaca', async () => {
    const id = await report('Draft');
    // Pemanggil membaca Draft, tetapi barisnya sudah maju ke Resolved.
    await db
      .update(support)
      .set({ status: 'Resolved' })
      .where(eq(support.id, id));
    const error = await errorOf(
      transition(db, supportLifecycle, {
        table: support,
        column: support.status,
        where: eq(support.id, id),
        from: 'Draft',
        to: 'Reported',
        ctx: undefined,
      }),
    );
    expect(error?.code).toBe('CONFLICT');
    expect(await statusOf(id)).toBe('Resolved');
  });
});
