import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCallerFactory } from '~/server/api/trpc';
import { form, formSubmission, recruitment } from '~/server/db/schema';
import {
  createEvent,
  createLembaga,
  createMahasiswa,
  createTestDb,
  createUser,
  resetDb,
} from '~/test/test-db';

import { formRouter } from './index';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

function callerFor(userId: string) {
  return createCallerFactory(formRouter)({
    db,
    session: { user: { id: userId, role: 'mahasiswa' }, expires: '' },
    headers: new Headers(),
  } as never);
}

async function setup({ bindOprec }: { bindOprec: boolean }) {
  const owner = await createUser(db, { role: 'lembaga' });
  const lembaga = await createLembaga(db, owner.id);
  const student = await createUser(db, { role: 'mahasiswa' });
  await createMahasiswa(db, student.id, { status: 'aktif' });

  const [f] = await db
    .insert(form)
    .values({
      lembagaId: lembaga.id,
      title: 'Form Uji',
      status: 'Published',
      // Dipaksa true langsung di DB, melewati validasi router.
      allowEditAfterSubmit: true,
      allowMultipleSubmissions: false,
    })
    .returning();
  await db.insert(formSubmission).values({ formId: f!.id, userId: student.id });

  if (bindOprec) {
    const period = await createEvent(db, lembaga.id);
    await db
      .insert(recruitment)
      .values({ periodId: period.id, formId: f!.id, name: 'Oprec Uji' });
  }
  return { formId: f!.id, studentId: student.id };
}

async function messageOf(promise: Promise<unknown>) {
  try {
    await promise;
    return { code: 'OK', message: '' };
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return { code: e.code ?? 'ERROR', message: e.message ?? '' };
  }
}

describe('submission update', () => {
  it('menolak form terikat oprec walau allowEditAfterSubmit true', async () => {
    const { formId, studentId } = await setup({ bindOprec: true });
    const [row] = await db.select().from(form).where(eq(form.id, formId));
    expect(row!.allowEditAfterSubmit).toBe(true);

    const result = await messageOf(
      callerFor(studentId).updateSubmission({ formId, answers: [] }),
    );
    expect(result.code).toBe('FORBIDDEN');
    expect(result.message).toContain('open recruitment');
  });

  it('form biasa tidak terpengaruh (regresi)', async () => {
    const { formId, studentId } = await setup({ bindOprec: false });
    const result = await messageOf(
      callerFor(studentId).updateSubmission({ formId, answers: [] }),
    );
    expect(result.message).not.toContain('open recruitment');
    expect(result.code).toBe('OK');
  });
});
