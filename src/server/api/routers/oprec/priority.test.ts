import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import {
  application,
  applicationChoice,
  assessment,
  choiceStatusOverride,
  criterion,
  divisionPriority,
  organizationPosition,
  placement,
  placementDecision,
  recruitment,
  recruitmentAssessor,
  recruitmentDivision,
} from '~/server/db/schema';
import { createOprecWorld as baseWorld, placeAt } from '~/test/oprec-fixtures';
import { createTestDb, createUser, resetDb } from '~/test/test-db';

import { oprecRouter } from '.';
import { recomputeDivisions } from './recompute';

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

const student = async (): Promise<Actor> => ({
  id: (await createUser(db)).id,
  role: 'mahasiswa',
  lembagaId: null,
});

/** Oprec dengan divisi Logistik, IT, Acara; tiap divisi punya Kadiv. */
async function setup(options: { allowRedirect?: boolean } = {}) {
  const w = await baseWorld(db, ['Logistik', 'IT', 'Acara']);
  const heads: Actor[] = [];
  for (const u of w.units) {
    const head = await student();
    await placeAt(db, u.headPositionId, head.id);
    heads.push(head);
  }
  const admin = callerFor(w.owner);
  const { recruitmentId } = await admin.oprec.createFromSetup({
    eventId: w.eventId,
    name: 'Oprec Prioritas',
    form: { mode: 'template' as const },
    divisions: w.units.map((u) => ({
      unitId: u.unitId,
      positionId: u.staffPositionId,
    })),
    minChoices: 1,
    maxChoices: 3,
    allowRedirect: options.allowRedirect ?? false,
  });
  const divisions = await db
    .select({
      id: recruitmentDivision.id,
      positionId: recruitmentDivision.positionId,
    })
    .from(recruitmentDivision)
    .where(eq(recruitmentDivision.recruitmentId, recruitmentId))
    .orderBy(asc(recruitmentDivision.sortOrder));
  expect(divisions).toHaveLength(3);
  const [logistik, it_, acara] = divisions as [
    (typeof divisions)[number],
    (typeof divisions)[number],
    (typeof divisions)[number],
  ];
  return { w, admin, heads, recruitmentId, logistik, it: it_, acara };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function setQuota(positionId: string, quota: number) {
  await db
    .update(organizationPosition)
    .set({ quota })
    .where(eq(organizationPosition.id, positionId));
}

/** Pendaftar lewat form dengan pilihan berurutan. */
async function apply(
  recruitmentId: string,
  divisionIds: string[],
  willingToMove = false,
) {
  const user = await createUser(db);
  const [app] = await db
    .insert(application)
    .values({
      recruitmentId,
      userId: user.id,
      source: 'form',
      willingToMove,
      submittedAt: new Date(),
    })
    .returning();
  const choices = await db
    .insert(applicationChoice)
    .values(
      divisionIds.map((divisionId, i) => ({
        applicationId: app!.id,
        divisionId,
        rank: i + 1,
        origin: 'dipilih' as const,
      })),
    )
    .returning();
  return { id: app!.id, userId: user.id, choices };
}

async function usePriority(s: Setup) {
  await s.admin.oprec.prioritySetMethod({
    recruitmentId: s.recruitmentId,
    method: 'prioritas',
  });
}

async function closeRegistration(s: Setup) {
  await s.admin.oprec.setStatus({
    recruitmentId: s.recruitmentId,
    status: 'open',
  });
  await s.admin.oprec.setStatus({
    recruitmentId: s.recruitmentId,
    status: 'closed',
  });
}

async function save(s: Setup, divisionId: string, order: string[]) {
  const board = await s.admin.oprec.priorityBoard({
    recruitmentId: s.recruitmentId,
    divisionId,
  });
  return s.admin.oprec.prioritySave({
    recruitmentId: s.recruitmentId,
    divisionId,
    order,
    baseVersion: board.version,
  });
}

async function setLock(s: Setup, divisionId: string, locked: boolean) {
  await s.admin.oprec.priorityLock({
    recruitmentId: s.recruitmentId,
    divisionId,
    locked,
  });
}

async function lockAll(s: Setup) {
  for (const d of [s.logistik, s.it, s.acara]) await setLock(s, d.id, true);
}

const decisionsOf = async (applicationId: string) =>
  db
    .select({
      divisionId: applicationChoice.divisionId,
      origin: applicationChoice.origin,
      decision: placementDecision.decision,
      tag: placementDecision.tag,
    })
    .from(applicationChoice)
    .leftJoin(
      placementDecision,
      eq(placementDecision.choiceId, applicationChoice.id),
    )
    .where(eq(applicationChoice.applicationId, applicationId))
    .orderBy(asc(applicationChoice.rank));

const placementsOf = async (userId: string) =>
  db
    .select({ positionId: placement.positionId })
    .from(placement)
    .where(eq(placement.userId, userId));

describe('prioritas: hak menyusun daftar', () => {
  it('penilai divisi hanya divisinya; penilai umum dan Kadiv sesuai perannya', async () => {
    const s = await setup();
    await usePriority(s);
    const x = await apply(s.recruitmentId, [s.logistik.id, s.it.id]);

    const divisionAssessor = await student();
    const generalAssessor = await student();
    await db.insert(recruitmentAssessor).values([
      {
        recruitmentId: s.recruitmentId,
        userId: divisionAssessor.id,
        divisionId: s.logistik.id,
      },
      {
        recruitmentId: s.recruitmentId,
        userId: generalAssessor.id,
        divisionId: null,
      },
    ]);
    const saveAs = async (actor: Actor, divisionId: string) => {
      const caller = callerFor(actor);
      const board = await caller.oprec.priorityBoard({
        recruitmentId: s.recruitmentId,
        divisionId,
      });
      return caller.oprec.prioritySave({
        recruitmentId: s.recruitmentId,
        divisionId,
        order: [x.id],
        baseVersion: board.version,
      });
    };

    await expect(saveAs(divisionAssessor, s.logistik.id)).resolves.toEqual({
      version: 1,
    });
    await expect(saveAs(divisionAssessor, s.it.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(saveAs(generalAssessor, s.it.id)).resolves.toEqual({
      version: 1,
    });
    // Kadiv IT (veto aktif bawaan) menyusun IT, bukan Logistik.
    await expect(saveAs(s.heads[1]!, s.it.id)).resolves.toEqual({
      version: 2,
    });
    await expect(
      callerFor(s.heads[1]!).oprec.priorityBoard({
        recruitmentId: s.recruitmentId,
        divisionId: s.logistik.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('hanya admin yang mengganti metode, dan daftar hanya tersimpan pada metode prioritas', async () => {
    const s = await setup();
    const x = await apply(s.recruitmentId, [s.logistik.id]);
    await expect(save(s, s.logistik.id, [x.id])).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(
      callerFor(s.heads[0]!).oprec.prioritySetMethod({
        recruitmentId: s.recruitmentId,
        method: 'prioritas',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await usePriority(s);
    await expect(save(s, s.logistik.id, [x.id])).resolves.toEqual({
      version: 1,
    });
  });
});

describe('prioritas: menyimpan daftar dan keterangan', () => {
  it('versi basi ditolak supaya tidak menimpa suntingan orang lain', async () => {
    const s = await setup();
    await usePriority(s);
    const x = await apply(s.recruitmentId, [s.logistik.id]);
    const y = await apply(s.recruitmentId, [s.logistik.id]);
    await save(s, s.logistik.id, [x.id, y.id]);
    await expect(
      s.admin.oprec.prioritySave({
        recruitmentId: s.recruitmentId,
        divisionId: s.logistik.id,
        order: [y.id],
        baseVersion: 0,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('urutan baru menggantikan yang lama; keterangan bertahan walau orangnya dikeluarkan', async () => {
    const s = await setup();
    await usePriority(s);
    const x = await apply(s.recruitmentId, [s.logistik.id]);
    const y = await apply(s.recruitmentId, [s.logistik.id]);
    await save(s, s.logistik.id, [x.id, y.id]);
    await s.admin.oprec.priorityNote({
      recruitmentId: s.recruitmentId,
      divisionId: s.logistik.id,
      applicationId: x.id,
      note: 'Wawancara kurang, tapi portofolio kuat',
    });
    await save(s, s.logistik.id, [y.id]);

    const board = await s.admin.oprec.priorityBoard({
      recruitmentId: s.recruitmentId,
      divisionId: s.logistik.id,
    });
    expect(
      board.rows.map((r) => ({
        id: r.applicationId,
        rank: r.rank,
        note: r.note,
      })),
    ).toEqual([
      { id: y.id, rank: 1, note: null },
      { id: x.id, rank: null, note: 'Wawancara kurang, tapi portofolio kuat' },
    ]);

    // Mengosongkan keterangan orang tanpa urutan menghapus barisnya.
    await s.admin.oprec.priorityNote({
      recruitmentId: s.recruitmentId,
      divisionId: s.logistik.id,
      applicationId: x.id,
      note: '  ',
    });
    const rows = await db
      .select()
      .from(divisionPriority)
      .where(eq(divisionPriority.divisionId, s.logistik.id));
    expect(rows.map((r) => [r.applicationId, r.rank, r.note])).toEqual([
      [y.id, 1, null],
    ]);
  });

  it('mode gabungan: status tidak dipotong kuota dan nilai minimum tidak berlaku', async () => {
    const s = await setup();
    await setQuota(s.logistik.positionId, 1);
    await db
      .delete(criterion)
      .where(eq(criterion.recruitmentId, s.recruitmentId));
    const [interview] = await db
      .insert(criterion)
      .values({
        recruitmentId: s.recruitmentId,
        divisionId: null,
        name: 'Wawancara',
        kind: 'skor',
        weight: 100,
      })
      .returning();
    // Skala 1-5: 5 → 100, 4 → 75, 1 → 0. Nilai minimum bawaan 60.
    const people = [
      { app: await apply(s.recruitmentId, [s.logistik.id]), rating: 5 },
      { app: await apply(s.recruitmentId, [s.logistik.id]), rating: 4 },
      { app: await apply(s.recruitmentId, [s.logistik.id]), rating: 1 },
    ];
    await db.insert(assessment).values(
      people.map(({ app, rating }) => ({
        applicationId: app.id,
        choiceId: null,
        criterionId: interview!.id,
        assessorId: s.w.owner.id,
        rating,
      })),
    );
    const statuses = async () =>
      Promise.all(
        people.map(async ({ app }) => {
          const [row] = await db
            .select({ status: applicationChoice.computedStatus })
            .from(applicationChoice)
            .where(eq(applicationChoice.id, app.choices[0]!.id));
          return row!.status;
        }),
      );

    // Manual: peringkat menurut kuota (1 kursi) memotong yang bernilai 75.
    await recomputeDivisions(db as never, s.recruitmentId, 'all');
    expect(await statuses()).toEqual(['lolos', 'tidak_lolos', 'tidak_lolos']);

    // Prioritas: urutan diserahkan ke daftar divisi; nilai (juga < 60) tidak
    // lagi menggugurkan, karena tab Nilai tidak tersedia untuk memperbaikinya.
    await usePriority(s);
    expect(await statuses()).toEqual(['lolos', 'lolos', 'lolos']);
  });

  it('mode gabungan: pilihan tidak lolos tampil terblokir dan tidak bisa diurutkan', async () => {
    const s = await setup();
    await usePriority(s);
    const x = await apply(s.recruitmentId, [s.logistik.id]);
    await db.insert(choiceStatusOverride).values({
      choiceId: x.choices[0]!.id,
      status: 'tidak_lolos',
      reason: 'Gugur berkas',
      setBy: s.w.owner.id,
    });
    const board = await s.admin.oprec.priorityBoard({
      recruitmentId: s.recruitmentId,
      divisionId: s.logistik.id,
    });
    expect(board.rows[0]).toMatchObject({
      applicationId: x.id,
      blocked: 'tidak_lolos',
      status: 'tidak_lolos',
    });
    await expect(save(s, s.logistik.id, [x.id])).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
});

describe('prioritas: kunci dan penerapan', () => {
  it('kunci butuh pendaftaran berakhir; daftar terkunci tidak bisa diubah', async () => {
    const s = await setup();
    await usePriority(s);
    const x = await apply(s.recruitmentId, [s.logistik.id]);
    await s.admin.oprec.setStatus({
      recruitmentId: s.recruitmentId,
      status: 'open',
    });
    await expect(setLock(s, s.logistik.id, true)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await s.admin.oprec.setStatus({
      recruitmentId: s.recruitmentId,
      status: 'closed',
    });
    await setLock(s, s.logistik.id, true);
    await expect(save(s, s.logistik.id, [x.id])).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('menerapkan hasil algoritma: keputusan, organogram, pindah ke luar pilihan, dan jalankan ulang', async () => {
    const s = await setup({ allowRedirect: true });
    await usePriority(s);
    await setQuota(s.logistik.positionId, 1);
    await setQuota(s.it.positionId, 1);
    await setQuota(s.acara.positionId, 1);

    // x: Logistik > IT. y: Logistik. z: Logistik saja, bersedia dipindahkan.
    const x = await apply(s.recruitmentId, [s.logistik.id, s.it.id]);
    const y = await apply(s.recruitmentId, [s.logistik.id]);
    const z = await apply(s.recruitmentId, [s.logistik.id], true);
    await save(s, s.logistik.id, [y.id, x.id, z.id]);
    await save(s, s.it.id, [x.id]);
    await save(s, s.acara.id, [z.id]);
    await closeRegistration(s);

    await expect(
      s.admin.oprec.matchingApply({ recruitmentId: s.recruitmentId }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: expect.stringContaining('belum dikunci') as string,
    });
    await lockAll(s);

    const preview = await s.admin.oprec.matchingPreview({
      recruitmentId: s.recruitmentId,
    });
    expect(preview.problems).toEqual([]);
    expect(preview.totals).toMatchObject({
      applicants: 3,
      placed: 3,
      redirected: 1,
    });

    await expect(
      s.admin.oprec.matchingApply({ recruitmentId: s.recruitmentId }),
    ).resolves.toEqual({ placed: 3, unplaced: 0, redirected: 1 });

    expect(await decisionsOf(x.id)).toEqual([
      {
        divisionId: s.logistik.id,
        origin: 'dipilih',
        decision: 'tolak',
        tag: null,
      },
      { divisionId: s.it.id, origin: 'dipilih', decision: 'terima', tag: null },
    ]);
    expect(await decisionsOf(y.id)).toEqual([
      {
        divisionId: s.logistik.id,
        origin: 'dipilih',
        decision: 'terima',
        tag: null,
      },
    ]);
    expect(await decisionsOf(z.id)).toEqual([
      {
        divisionId: s.logistik.id,
        origin: 'dipilih',
        decision: 'tolak',
        tag: null,
      },
      {
        divisionId: s.acara.id,
        origin: 'dialihkan',
        decision: 'terima',
        tag: 'di_luar_pilihan',
      },
    ]);
    expect(await placementsOf(x.userId)).toEqual([
      { positionId: s.it.positionId },
    ]);
    expect(await placementsOf(z.userId)).toEqual([
      { positionId: s.acara.positionId },
    ]);

    // Jalankan ulang setelah Acara mengeluarkan z: hasil lama diganti.
    await setLock(s, s.acara.id, false);
    await save(s, s.acara.id, []);
    await setLock(s, s.acara.id, true);
    await expect(
      s.admin.oprec.matchingApply({ recruitmentId: s.recruitmentId }),
    ).resolves.toEqual({ placed: 2, unplaced: 1, redirected: 0 });
    expect(await decisionsOf(z.id)).toEqual([
      {
        divisionId: s.logistik.id,
        origin: 'dipilih',
        decision: 'tolak',
        tag: null,
      },
    ]);
    expect(await placementsOf(z.userId)).toEqual([]);
  });

  it('keputusan manual ditolak selama penempatan prioritas berjalan', async () => {
    const s = await setup();
    await usePriority(s);
    const x = await apply(s.recruitmentId, [s.logistik.id]);
    await expect(
      s.admin.oprec.decide({
        recruitmentId: s.recruitmentId,
        choiceId: x.choices[0]!.id,
        decision: 'terima',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      s.admin.oprec.autofillCommit({ recruitmentId: s.recruitmentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    // Kembali ke metode manual: keputusan manual berjalan seperti biasa.
    await s.admin.oprec.prioritySetMethod({
      recruitmentId: s.recruitmentId,
      method: 'manual',
    });
    await expect(
      s.admin.oprec.decide({
        recruitmentId: s.recruitmentId,
        choiceId: x.choices[0]!.id,
        decision: 'terima',
      }),
    ).resolves.toMatchObject({ success: true });
  });

  it('metode tidak bisa diganti setelah masuk masa banding', async () => {
    const s = await setup();
    await closeRegistration(s);
    await s.admin.oprec.setPlacementState({
      recruitmentId: s.recruitmentId,
      state: 'masa_banding',
    });
    await expect(usePriority(s)).rejects.toMatchObject({ code: 'CONFLICT' });
    const [rec] = await db
      .select({ method: recruitment.placementMethod })
      .from(recruitment)
      .where(eq(recruitment.id, s.recruitmentId));
    expect(rec!.method).toBe('manual');
  });
});
