import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '~/server/db/schema';
import {
  applyToOprec,
  callerFor,
  choicesOf,
  codeOf,
  createOprecFixture,
} from '~/test/oprec-fixture';
import { createTestDb, createUser, grantAccess, resetDb } from '~/test/test-db';

import {
  lockRegistrationByRecruitment,
  setRegistrationStatus,
} from './registration';

const { db, close } = createTestDb();
// Klien kedua untuk tes konkurensi: setiap klien hanya punya satu koneksi.
const second = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
  await second.close();
});

const statusOf = async (fx: { recruitmentId: string; formId: string }) => {
  const [rec] = await db
    .select({ status: schema.recruitment.status })
    .from(schema.recruitment)
    .where(eq(schema.recruitment.id, fx.recruitmentId));
  const [form] = await db
    .select({
      status: schema.form.status,
      publishedAt: schema.form.publishedAt,
    })
    .from(schema.form)
    .where(eq(schema.form.id, fx.formId));
  return {
    oprec: rec!.status,
    form: form!.status,
    publishedAt: form!.publishedAt,
  };
};

const DAY = 24 * 60 * 60 * 1000;

describe('status pendaftaran dari halaman oprec', () => {
  it('membuka oprec ikut menerbitkan formulirnya dan dicatat', async () => {
    const fx = await createOprecFixture(db, { open: false });
    await callerFor(db, fx.owner).oprec.setStatus({
      recruitmentId: fx.recruitmentId,
      status: 'open',
    });

    const s = await statusOf(fx);
    expect(s).toMatchObject({ oprec: 'open', form: 'Published' });
    expect(s.publishedAt).not.toBeNull();
    const logs = await db
      .select()
      .from(schema.recruitmentLog)
      .where(
        and(
          eq(schema.recruitmentLog.recruitmentId, fx.recruitmentId),
          eq(schema.recruitmentLog.action, 'status_pendaftaran'),
        ),
      );
    expect(logs[0]?.detail).toEqual({
      from: 'draft',
      to: 'open',
      via: 'oprec',
    });
  });

  it('pembukaan yang gagal tidak menerbitkan formulir', async () => {
    const fx = await createOprecFixture(db, { open: false });
    await db
      .update(schema.formField)
      .set({ archivedAt: new Date() })
      .where(eq(schema.formField.id, fx.unitChoiceFieldId));

    const code = await codeOf(
      callerFor(db, fx.owner).oprec.setStatus({
        recruitmentId: fx.recruitmentId,
        status: 'open',
      }),
    );
    expect(code).toBe('CONFLICT');
    expect(await statusOf(fx)).toMatchObject({ oprec: 'draft', form: 'Draft' });
  });

  it('menutup oprec ikut menutup formulir', async () => {
    const fx = await createOprecFixture(db);
    await callerFor(db, fx.owner).oprec.setStatus({
      recruitmentId: fx.recruitmentId,
      status: 'closed',
    });
    expect(await statusOf(fx)).toMatchObject({
      oprec: 'closed',
      form: 'Closed',
    });
  });

  it('oprec draf tidak bisa langsung ditutup', async () => {
    const fx = await createOprecFixture(db, { open: false });
    const code = await codeOf(
      callerFor(db, fx.owner).oprec.setStatus({
        recruitmentId: fx.recruitmentId,
        status: 'closed',
      }),
    );
    expect(code).toBe('BAD_REQUEST');
  });

  it('kembali ke draf ditolak setelah ada pendaftar', async () => {
    const fx = await createOprecFixture(db);
    await applyToOprec(db, fx, ['Acara']);
    const code = await codeOf(
      callerFor(db, fx.owner).oprec.setStatus({
        recruitmentId: fx.recruitmentId,
        status: 'draft',
      }),
    );
    expect(code).toBe('CONFLICT');
  });
});

describe('status pendaftaran dari editor Forms', () => {
  it('menerbitkan formulir oprec ikut membuka oprec', async () => {
    const fx = await createOprecFixture(db, { open: false });
    await callerFor(db, fx.owner).form.setStatus({
      formId: fx.formId,
      status: 'Published',
    });
    expect(await statusOf(fx)).toMatchObject({
      oprec: 'open',
      form: 'Published',
    });
  });

  it('menutup formulir oprec ikut menutup oprec', async () => {
    const fx = await createOprecFixture(db);
    await callerFor(db, fx.owner).form.setStatus({
      formId: fx.formId,
      status: 'Closed',
    });
    expect(await statusOf(fx)).toMatchObject({
      oprec: 'closed',
      form: 'Closed',
    });
  });

  it('pengelola yang hanya punya fitur forms ditolak', async () => {
    const fx = await createOprecFixture(db);
    const editor = await createUser(db, { role: 'mahasiswa' });
    await grantAccess(db, {
      userId: editor.id,
      periodId: fx.eventId,
      features: ['forms'],
    });
    const code = await codeOf(
      callerFor(db, { id: editor.id, role: 'mahasiswa' }).form.setStatus({
        formId: fx.formId,
        status: 'Closed',
      }),
    );
    expect(code).toBe('FORBIDDEN');
    expect(await statusOf(fx)).toMatchObject({
      oprec: 'open',
      form: 'Published',
    });
  });
});

describe('membuka pendaftaran lagi', () => {
  const closeAndReopen = async (
    fx: Awaited<ReturnType<typeof createOprecFixture>>,
  ) => {
    const owner = callerFor(db, fx.owner);
    await owner.oprec.setStatus({
      recruitmentId: fx.recruitmentId,
      status: 'closed',
    });
    return codeOf(
      owner.oprec.setStatus({
        recruitmentId: fx.recruitmentId,
        status: 'open',
      }),
    );
  };

  it('berhasil selama belum ada keputusan penempatan', async () => {
    const fx = await createOprecFixture(db);
    await applyToOprec(db, fx, ['Acara']);
    expect(await closeAndReopen(fx)).toBe('OK');
    expect(await statusOf(fx)).toMatchObject({
      oprec: 'open',
      form: 'Published',
    });
  });

  it('ditolak setelah ada keputusan penempatan', async () => {
    const fx = await createOprecFixture(db);
    const a = await applyToOprec(db, fx, ['Acara']);
    const [choice] = await choicesOf(db, a.applicationId);
    await callerFor(db, fx.divisions.Acara!.kadiv).oprec.decide({
      recruitmentId: fx.recruitmentId,
      choiceId: choice!.id,
      decision: 'terima',
    });
    expect(await closeAndReopen(fx)).toBe('CONFLICT');
  });

  it('ditolak bila tenggat formulir sudah lewat', async () => {
    const fx = await createOprecFixture(db);
    await db
      .update(schema.form)
      .set({ closesAt: new Date(Date.now() - DAY) })
      .where(eq(schema.form.id, fx.formId));
    expect(await closeAndReopen(fx)).toBe('BAD_REQUEST');
  });

  it('memundurkan tenggat yang sudah lewat diperlakukan sebagai buka lagi', async () => {
    const fx = await createOprecFixture(db);
    const a = await applyToOprec(db, fx, ['Acara']);
    const [choice] = await choicesOf(db, a.applicationId);
    await db
      .update(schema.form)
      .set({ closesAt: new Date(Date.now() - DAY) })
      .where(eq(schema.form.id, fx.formId));
    await callerFor(db, fx.divisions.Acara!.kadiv).oprec.decide({
      recruitmentId: fx.recruitmentId,
      choiceId: choice!.id,
      decision: 'terima',
    });

    const code = await codeOf(
      callerFor(db, fx.owner).form.update({
        formId: fx.formId,
        closesAt: new Date(Date.now() + DAY),
      }),
    );
    expect(code).toBe('CONFLICT');
  });
});

describe('jendela penilaian dan masa banding', () => {
  const withApplicant = async () => {
    const fx = await createOprecFixture(db, {
      criteria: [
        { scope: 'umum', name: 'Motivasi', kind: 'skor', weight: 100 },
      ],
    });
    const a = await applyToOprec(db, fx, ['Acara']);
    const [criterion] = await db
      .select()
      .from(schema.criterion)
      .where(eq(schema.criterion.recruitmentId, fx.recruitmentId));
    const owner = callerFor(db, fx.owner);
    const assess = () =>
      owner.oprec.assessSave({
        recruitmentId: fx.recruitmentId,
        applicationId: a.applicationId,
        criterionId: criterion!.id,
        rating: 4,
      });
    return { fx, owner, assess };
  };

  it('menutup dari editor Forms membuka penilaian', async () => {
    const { fx, owner, assess } = await withApplicant();
    expect(await codeOf(assess())).toBe('CONFLICT');
    await owner.form.setStatus({ formId: fx.formId, status: 'Closed' });
    expect(await codeOf(assess())).toBe('OK');
  });

  it('tenggat formulir yang lewat membuka penilaian tanpa menutup oprec', async () => {
    const { fx, owner, assess } = await withApplicant();
    await db
      .update(schema.form)
      .set({ closesAt: new Date(Date.now() - DAY) })
      .where(eq(schema.form.id, fx.formId));
    expect(await codeOf(assess())).toBe('OK');
    const queue = await owner.oprec.assessQueue({
      recruitmentId: fx.recruitmentId,
      scope: 'umum',
    });
    expect(queue.rows.length).toBeGreaterThan(0);
    expect(queue.rows.every((row) => row.open)).toBe(true);
  });

  it('masa banding ditolak selama pendaftaran dibuka, boleh setelah ditutup', async () => {
    const { fx, owner } = await withApplicant();
    const toBanding = () =>
      owner.oprec.setPlacementState({
        recruitmentId: fx.recruitmentId,
        state: 'masa_banding',
      });
    expect(await codeOf(toBanding())).toBe('CONFLICT');
    await owner.oprec.setStatus({
      recruitmentId: fx.recruitmentId,
      status: 'closed',
    });
    expect(await toBanding()).toMatchObject({ success: true });
  });

  it('masa banding ditolak untuk oprec draf', async () => {
    const fx = await createOprecFixture(db, { open: false });
    const code = await codeOf(
      callerFor(db, fx.owner).oprec.setPlacementState({
        recruitmentId: fx.recruitmentId,
        state: 'masa_banding',
      }),
    );
    expect(code).toBe('CONFLICT');
  });
});

describe('konkurensi', () => {
  it('submit yang datang saat oprec ditutup ditolak tanpa pendaftar baru', async () => {
    const fx = await createOprecFixture(db);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));

    // Transaksi penutupan memegang kunci formulir dan oprec sampai dilepas.
    const closing = db.transaction(async (tx) => {
      const lock = await lockRegistrationByRecruitment(
        tx as never,
        fx.recruitmentId,
      );
      await setRegistrationStatus(tx as never, lock, 'closed', {
        actorId: fx.owner.id,
        via: 'oprec',
      });
      locked();
      await held;
    });
    await lockTaken;

    const submitting = codeOf(applyToOprec(second.db, fx, ['Acara']));
    await new Promise((resolve) => setTimeout(resolve, 300));
    release();
    await closing;

    expect(await submitting).toBe('FORBIDDEN');
    const apps = await db
      .select()
      .from(schema.application)
      .where(eq(schema.application.recruitmentId, fx.recruitmentId));
    expect(apps).toHaveLength(0);
  });

  it('menutup dari halaman oprec dan editor Forms bersamaan tidak deadlock', async () => {
    const fx = await createOprecFixture(db);
    const [a, b] = await Promise.all([
      codeOf(
        callerFor(db, fx.owner).oprec.setStatus({
          recruitmentId: fx.recruitmentId,
          status: 'closed',
        }),
      ),
      codeOf(
        callerFor(second.db, fx.owner).form.setStatus({
          formId: fx.formId,
          status: 'Closed',
        }),
      ),
    ]);
    expect([a, b]).toEqual(['OK', 'OK']);
    expect(await statusOf(fx)).toMatchObject({
      oprec: 'closed',
      form: 'Closed',
    });
  });
});
