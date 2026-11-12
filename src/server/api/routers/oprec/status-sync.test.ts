import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { formRouter } from '~/server/api/routers/form';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import { form, formField, formSection, recruitment } from '~/server/db/schema';
import { createOprecWorld } from '~/test/oprec-fixtures';
import { createTestDb, resetDb } from '~/test/test-db';

import { oprecRouter } from '.';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

const appRouter = createTRPCRouter({ oprec: oprecRouter, form: formRouter });

type World = Awaited<ReturnType<typeof createOprecWorld>>;

function callerFor(actor: World['owner']) {
  return createCallerFactory(appRouter)({
    db,
    session: { user: { ...actor }, expires: '' },
    headers: new Headers(),
  } as never);
}

async function setup(w: World) {
  const { recruitmentId, formId } = await callerFor(
    w.owner,
  ).oprec.createFromSetup({
    eventId: w.eventId,
    name: 'Oprec Uji',
    form: { mode: 'template' as const },
    divisions: w.units.map((u) => ({
      unitId: u.unitId,
      positionId: u.staffPositionId,
    })),
    minChoices: 1,
    maxChoices: 2,
  });
  return { recruitmentId, formId };
}

const statusOf = async (recruitmentId: string, formId: string) => ({
  oprec: (
    await db
      .select({ s: recruitment.status })
      .from(recruitment)
      .where(eq(recruitment.id, recruitmentId))
  )[0]!.s,
  form: (
    await db.select({ s: form.status }).from(form).where(eq(form.id, formId))
  )[0]!.s,
});

describe('sinkron status oprec dan form (#380)', () => {
  it('menerbitkan form terikat membuka oprec dalam satu langkah', async () => {
    const w = await createOprecWorld(db);
    const { recruitmentId, formId } = await setup(w);
    expect(await statusOf(recruitmentId, formId)).toEqual({
      oprec: 'draft',
      form: 'Draft',
    });

    await callerFor(w.owner).form.setStatus({ formId, status: 'Published' });
    expect(await statusOf(recruitmentId, formId)).toEqual({
      oprec: 'open',
      form: 'Published',
    });
  });

  it('membuka oprec menerbitkan form', async () => {
    const w = await createOprecWorld(db);
    const { recruitmentId, formId } = await setup(w);
    await callerFor(w.owner).oprec.setStatus({ recruitmentId, status: 'open' });
    expect(await statusOf(recruitmentId, formId)).toEqual({
      oprec: 'open',
      form: 'Published',
    });
  });

  it('menutup salah satunya menutup keduanya', async () => {
    const w = await createOprecWorld(db);
    const { recruitmentId, formId } = await setup(w);
    const caller = callerFor(w.owner);
    await caller.oprec.setStatus({ recruitmentId, status: 'open' });
    await caller.form.setStatus({ formId, status: 'Closed' });
    expect(await statusOf(recruitmentId, formId)).toEqual({
      oprec: 'closed',
      form: 'Closed',
    });
  });

  it('menolak terbit dengan pesan yang menyebut syarat kurang, tanpa mengubah apa pun', async () => {
    const w = await createOprecWorld(db);
    const { recruitmentId, formId } = await setup(w);
    await db
      .update(formField)
      .set({ archivedAt: new Date() })
      .where(
        and(eq(formField.formId, formId), eq(formField.type, 'unit_choice')),
      );

    await expect(
      callerFor(w.owner).form.setStatus({ formId, status: 'Published' }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Pilihan tujuan') as string,
    });
    expect(await statusOf(recruitmentId, formId)).toEqual({
      oprec: 'draft',
      form: 'Draft',
    });
    expect(
      await db
        .select()
        .from(formField)
        .where(and(eq(formField.formId, formId), isNull(formField.archivedAt))),
    ).not.toHaveLength(0);
  });

  it('form biasa (tanpa oprec) tidak terpengaruh', async () => {
    const w = await createOprecWorld(db);
    const caller = callerFor(w.owner);
    const created = await caller.form.createForEvent({
      eventId: w.eventId,
      title: 'Form biasa',
    } as never);
    const [section] = await db
      .insert(formSection)
      .values({ formId: created.id, title: 'Bagian', sortOrder: 0 })
      .returning();
    await db.insert(formField).values({
      formId: created.id,
      sectionId: section!.id,
      type: 'short_text',
      label: 'Nama',
      sortOrder: 0,
    });
    await caller.form.setStatus({ formId: created.id, status: 'Published' });
    const [row] = await db
      .select({ s: form.status })
      .from(form)
      .where(eq(form.id, created.id));
    expect(row!.s).toBe('Published');
  });
});
