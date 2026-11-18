import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCallerFactory } from '~/server/api/trpc';
import { form, formAnswer, formSubmission } from '~/server/db/schema';
import {
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

function callerFor(user: { id: string; role: string; lembagaId?: string }) {
  return createCallerFactory(formRouter)({
    db,
    session: { user, expires: '' },
    headers: new Headers(),
  } as never);
}

async function setup() {
  const owner = await createUser(db, { role: 'lembaga' });
  const lembaga = await createLembaga(db, owner.id);
  const studentA = await createUser(db, { role: 'mahasiswa' });
  const studentB = await createUser(db, { role: 'mahasiswa' });
  await createMahasiswa(db, studentA.id);
  await createMahasiswa(db, studentB.id);

  const [f] = await db
    .insert(form)
    .values({ lembagaId: lembaga.id, title: 'Form Uji', status: 'Published' })
    .returning();
  const [a] = await db
    .insert(formSubmission)
    .values({ formId: f!.id, userId: studentA.id })
    .returning();
  const [b] = await db
    .insert(formSubmission)
    .values({ formId: f!.id, userId: studentB.id })
    .returning();
  await db.insert(formAnswer).values({
    submissionId: a!.id,
    fieldLabel: 'Pertanyaan',
    fieldType: 'short_text',
    value: 'jawaban',
  });

  return {
    owner,
    lembaga,
    formId: f!.id,
    submissionA: a!.id,
    submissionB: b!.id,
  };
}

describe('hapus respons', () => {
  it('menghapus respons terpilih beserta jawabannya', async () => {
    const { owner, lembaga, formId, submissionA, submissionB } = await setup();

    const result = await callerFor({
      id: owner.id,
      role: 'lembaga',
      lembagaId: lembaga.id,
    }).responses.delete({ formId, submissionIds: [submissionA] });

    expect(result.deleted).toBe(1);
    expect(result.success).toBe(true);

    const left = await db
      .select()
      .from(formSubmission)
      .where(eq(formSubmission.formId, formId));
    expect(left.map((row) => row.id)).toEqual([submissionB]);

    const answers = await db
      .select()
      .from(formAnswer)
      .where(eq(formAnswer.submissionId, submissionA));
    expect(answers).toHaveLength(0);
  });

  it('mengabaikan respons milik form lain', async () => {
    const { owner, lembaga, formId, submissionA, submissionB } = await setup();
    const otherOwner = await createUser(db, { role: 'lembaga' });
    const otherLembaga = await createLembaga(db, otherOwner.id, {
      name: 'Lembaga Lain',
    });
    const [otherForm] = await db
      .insert(form)
      .values({
        lembagaId: otherLembaga.id,
        title: 'Form Lain',
        status: 'Published',
      })
      .returning();
    const otherStudent = await createUser(db, { role: 'mahasiswa' });
    const [otherSubmission] = await db
      .insert(formSubmission)
      .values({ formId: otherForm!.id, userId: otherStudent.id })
      .returning();

    const result = await callerFor({
      id: owner.id,
      role: 'lembaga',
      lembagaId: lembaga.id,
    }).responses.delete({
      formId,
      submissionIds: [otherSubmission!.id],
    });

    expect(result.deleted).toBe(0);
    const still = await db
      .select()
      .from(formSubmission)
      .where(eq(formSubmission.id, otherSubmission!.id));
    expect(still).toHaveLength(1);

    const left = await db
      .select()
      .from(formSubmission)
      .where(eq(formSubmission.formId, formId));
    expect(left.map((row) => row.id).sort()).toEqual(
      [submissionA, submissionB].sort(),
    );
  });
});
