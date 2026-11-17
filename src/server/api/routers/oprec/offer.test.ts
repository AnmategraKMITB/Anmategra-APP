import { and, asc, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import {
  application,
  applicationChoice,
  divisionPriority,
  notifications,
  organizationPosition,
  placementDecision,
  recruitmentDivision,
  recruitmentLog,
} from '~/server/db/schema';
import { createOprecWorld as baseWorld, placeAt } from '~/test/oprec-fixtures';
import { createTestDb, createUser, resetDb } from '~/test/test-db';

import { oprecRouter } from '.';
import { OFFER_NOTIFICATION_KIND } from './offer';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

const appRouter = createTRPCRouter({ oprec: oprecRouter });

type Actor = { id: string; role: string; lembagaId: string | null };

function callerFor(actor: Actor) {
  return createCallerFactory(appRouter)({
    db,
    session: { user: { ...actor }, expires: '' },
    headers: new Headers(),
  } as never);
}

const asStudent = (userId: string) =>
  callerFor({ id: userId, role: 'mahasiswa', lembagaId: null });

const hours = (n: number) => new Date(Date.now() + n * 3_600_000);

/** Oprec prioritas dengan divisi Logistik, IT, Acara; tiap divisi punya Kadiv. */
async function setup(options: { allowRedirect?: boolean } = {}) {
  const w = await baseWorld(db, ['Logistik', 'IT', 'Acara']);
  const heads: Actor[] = [];
  for (const u of w.units) {
    const head: Actor = {
      id: (await createUser(db)).id,
      role: 'mahasiswa',
      lembagaId: null,
    };
    await placeAt(db, u.headPositionId, head.id);
    heads.push(head);
  }
  const admin = callerFor(w.owner);
  const { recruitmentId } = await admin.oprec.createFromSetup({
    eventId: w.eventId,
    name: 'Oprec Tawaran',
    form: { mode: 'template' as const },
    divisions: w.units.map((u) => ({
      unitId: u.unitId,
      positionId: u.staffPositionId,
    })),
    minChoices: 1,
    maxChoices: 3,
    allowRedirect: options.allowRedirect ?? true,
  });
  const divisions = await db
    .select({
      id: recruitmentDivision.id,
      positionId: recruitmentDivision.positionId,
    })
    .from(recruitmentDivision)
    .where(eq(recruitmentDivision.recruitmentId, recruitmentId))
    .orderBy(asc(recruitmentDivision.sortOrder));
  const [logistik, it_, acara] = divisions as [
    (typeof divisions)[number],
    (typeof divisions)[number],
    (typeof divisions)[number],
  ];
  await admin.oprec.prioritySetMethod({ recruitmentId, method: 'prioritas' });
  return { admin, heads, recruitmentId, logistik, it: it_, acara };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function setQuota(positionId: string, quota: number) {
  await db
    .update(organizationPosition)
    .set({ quota })
    .where(eq(organizationPosition.id, positionId));
}

async function apply(recruitmentId: string, divisionIds: string[]) {
  const user = await createUser(db);
  const [app] = await db
    .insert(application)
    .values({
      recruitmentId,
      userId: user.id,
      source: 'form',
      submittedAt: new Date(),
    })
    .returning();
  await db.insert(applicationChoice).values(
    divisionIds.map((divisionId, i) => ({
      applicationId: app!.id,
      divisionId,
      rank: i + 1,
      origin: 'dipilih' as const,
    })),
  );
  return { id: app!.id, userId: user.id };
}

async function save(s: Setup, divisionId: string, order: string[]) {
  const board = await s.admin.oprec.priorityBoard({
    recruitmentId: s.recruitmentId,
    divisionId,
  });
  await s.admin.oprec.prioritySave({
    recruitmentId: s.recruitmentId,
    divisionId,
    order,
    baseVersion: board.version,
  });
}

/**
 * Logistik (kuota 1) menerima x dan tidak mengurutkan y; IT menerima z.
 * Acara (kuota 2) kosong. Setelah diterapkan, hanya y yang belum dapat divisi.
 */
async function placedWorld(options: { allowRedirect?: boolean } = {}) {
  const s = await setup(options);
  await setQuota(s.logistik.positionId, 1);
  await setQuota(s.it.positionId, 1);
  await setQuota(s.acara.positionId, 2);
  const x = await apply(s.recruitmentId, [s.logistik.id]);
  const y = await apply(s.recruitmentId, [s.logistik.id, s.it.id]);
  const z = await apply(s.recruitmentId, [s.it.id]);
  await save(s, s.logistik.id, [x.id]);
  await save(s, s.it.id, [z.id]);
  await s.admin.oprec.setStatus({ recruitmentId: s.recruitmentId, status: 'open' });
  await s.admin.oprec.setStatus({
    recruitmentId: s.recruitmentId,
    status: 'closed',
  });
  for (const d of [s.logistik, s.it, s.acara]) {
    await s.admin.oprec.priorityLock({
      recruitmentId: s.recruitmentId,
      divisionId: d.id,
      locked: true,
    });
  }
  await s.admin.oprec.matchingApply({ recruitmentId: s.recruitmentId });
  return { s, x, y, z };
}

const offerNotes = (userId: string) =>
  db
    .select({ kind: notifications.kind })
    .from(notifications)
    .where(
      and(
        eq(notifications.user_id, userId),
        eq(notifications.kind, OFFER_NOTIFICATION_KIND),
      ),
    );

describe('tawaran tempat', () => {
  it('hanya admin yang membuka; hanya pendaftar tanpa divisi yang diberi tahu dan melihatnya', async () => {
    const { s, x, y } = await placedWorld();
    const input = {
      recruitmentId: s.recruitmentId,
      divisionId: s.acara.id,
      closesAt: hours(2),
    };

    await expect(
      callerFor(s.heads[2]!).oprec.offerOpen(input),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      s.admin.oprec.offerOpen({ ...input, closesAt: hours(-1) }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      s.admin.oprec.offerOpen({ ...input, closesAt: hours(24 * 40) }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await expect(s.admin.oprec.offerOpen(input)).resolves.toEqual({
      notified: 1,
    });
    expect(await offerNotes(y.userId)).toHaveLength(1);
    expect(await offerNotes(x.userId)).toHaveLength(0);
    // Membuka lagi (perpanjang) tidak menggandakan pemberitahuan.
    await s.admin.oprec.offerOpen({ ...input, closesAt: hours(3) });
    expect(await offerNotes(y.userId)).toHaveLength(1);

    const overview = await s.admin.oprec.offerOverview({
      recruitmentId: s.recruitmentId,
    });
    expect(overview.problem).toBeNull();
    expect(overview.unplaced).toBe(1);
    expect(overview.divisions.find((d) => d.id === s.acara.id)).toMatchObject(
      { offerOpen: true, offerAccepted: 0, filled: 0, quota: 2 },
    );

    const mine = await asStudent(y.userId).oprec.myOffer({
      recruitmentId: s.recruitmentId,
    });
    expect(mine).toMatchObject({
      accepted: null,
      offers: [{ divisionId: s.acara.id, divisionLabel: 'Acara' }],
    });
    await expect(
      asStudent(x.userId).oprec.myOffer({ recruitmentId: s.recruitmentId }),
    ).resolves.toBeNull();

    // Pemberitahuan tawaran tampil di Inbox meski hasil belum dirilis.
    const inbox = await asStudent(y.userId).oprec.myResultNotifications();
    expect(inbox).toHaveLength(1);
    expect(inbox[0]!.links[0]!.href).toMatch(/^\/forms\//);
  });

  it('pendaftar yang bersedia masuk akhir urutan dan ditempatkan saat diterapkan ulang', async () => {
    const { s, x, y } = await placedWorld();
    await s.admin.oprec.offerOpen({
      recruitmentId: s.recruitmentId,
      divisionId: s.acara.id,
      closesAt: hours(2),
    });
    const [before] = await db
      .select({ version: recruitmentDivision.priorityVersion })
      .from(recruitmentDivision)
      .where(eq(recruitmentDivision.id, s.acara.id));

    const accept = { recruitmentId: s.recruitmentId, divisionId: s.acara.id };
    await expect(asStudent(y.userId).oprec.offerAccept(accept)).resolves.toEqual(
      { success: true },
    );
    // Klik kedua tidak mengubah apa pun.
    await expect(asStudent(y.userId).oprec.offerAccept(accept)).resolves.toEqual(
      { success: true },
    );

    const [app] = await db
      .select()
      .from(application)
      .where(eq(application.id, y.id));
    expect(app).toMatchObject({
      willingToMove: true,
      offerDivisionId: s.acara.id,
    });
    expect(app!.offerAcceptedAt).toBeInstanceOf(Date);
    const ranks = await db
      .select({ rank: divisionPriority.rank })
      .from(divisionPriority)
      .where(
        and(
          eq(divisionPriority.divisionId, s.acara.id),
          eq(divisionPriority.applicationId, y.id),
        ),
      );
    expect(ranks).toEqual([{ rank: 1 }]);
    const [after] = await db
      .select({
        version: recruitmentDivision.priorityVersion,
        lockedAt: recruitmentDivision.priorityLockedAt,
      })
      .from(recruitmentDivision)
      .where(eq(recruitmentDivision.id, s.acara.id));
    expect(after!.version).toBe(before!.version + 1);
    expect(after!.lockedAt).not.toBeNull();

    await expect(
      asStudent(y.userId).oprec.myOffer({ recruitmentId: s.recruitmentId }),
    ).resolves.toMatchObject({
      accepted: { divisionLabel: 'Acara' },
      offers: [],
    });
    const logs = await db
      .select({ action: recruitmentLog.action })
      .from(recruitmentLog)
      .where(eq(recruitmentLog.entityId, y.id));
    expect(logs.map((l) => l.action)).toContain('tawaran_diterima');

    // Yang sudah diterima tidak bisa menerima tawaran.
    await expect(
      asStudent(x.userId).oprec.offerAccept(accept),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    const preview = await s.admin.oprec.matchingPreview({
      recruitmentId: s.recruitmentId,
    });
    expect(preview.problems).toEqual([]);
    await expect(
      s.admin.oprec.matchingApply({ recruitmentId: s.recruitmentId }),
    ).resolves.toEqual({ placed: 3, unplaced: 0, redirected: 1 });
    const decisions = await db
      .select({
        divisionId: applicationChoice.divisionId,
        origin: applicationChoice.origin,
        decision: placementDecision.decision,
        tag: placementDecision.tag,
      })
      .from(applicationChoice)
      .innerJoin(
        placementDecision,
        eq(placementDecision.choiceId, applicationChoice.id),
      )
      .where(
        and(
          eq(applicationChoice.applicationId, y.id),
          eq(placementDecision.decision, 'terima'),
        ),
      );
    expect(decisions).toEqual([
      {
        divisionId: s.acara.id,
        origin: 'dialihkan',
        decision: 'terima',
        tag: 'di_luar_pilihan',
      },
    ]);
  });

  it('tawaran yang ditutup atau lewat batas waktu tidak bisa diterima', async () => {
    const { s, y } = await placedWorld();
    const accept = { recruitmentId: s.recruitmentId, divisionId: s.acara.id };
    // Belum pernah dibuka.
    await expect(
      asStudent(y.userId).oprec.offerAccept(accept),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await s.admin.oprec.offerOpen({ ...accept, closesAt: hours(2) });
    await s.admin.oprec.offerClose(accept);
    await expect(
      asStudent(y.userId).oprec.offerAccept(accept),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      asStudent(y.userId).oprec.myOffer({ recruitmentId: s.recruitmentId }),
    ).resolves.toBeNull();

    await s.admin.oprec.offerOpen({ ...accept, closesAt: hours(2) });
    await db
      .update(recruitmentDivision)
      .set({ offerClosesAt: hours(-1) })
      .where(eq(recruitmentDivision.id, s.acara.id));
    await expect(
      asStudent(y.userId).oprec.offerAccept(accept),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('butuh izin pindah divisi dan penempatan yang masih berjalan', async () => {
    const { s } = await placedWorld({ allowRedirect: false });
    const overview = await s.admin.oprec.offerOverview({
      recruitmentId: s.recruitmentId,
    });
    expect(overview.problem).toMatch(/tidak mengizinkan/);
    await expect(
      s.admin.oprec.offerOpen({
        recruitmentId: s.recruitmentId,
        divisionId: s.acara.id,
        closesAt: hours(2),
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
