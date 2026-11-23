/**
 * Metode penempatan `prioritas`: tiap divisi menyusun daftar prioritas
 * pendaftarnya (beserta keterangan opsional), lalu admin menjalankan
 * penempatan otomatis (deferred acceptance, src/lib/oprec/matching.ts) yang
 * menulis keputusan terima/tolak dan penempatan organogram.
 *
 * Mode gabungan: penilaian dan status lulus/tidak tetap berjalan. Pilihan yang
 * berstatus efektif `tidak_lolos` tidak bisa diprioritaskan, dan nilai tampil
 * di papan sebagai acuan.
 *
 * Urutan kunci: baris oprec dulu, lalu baris divisi. Penerapan memegang baris
 * oprec FOR UPDATE, jadi simpan/kunci daftar (FOR SHARE) menunggu sampai selesai.
 */
import { TRPCError } from '@trpc/server';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { fakultasOfNim } from '~/lib/itb/fakultas';
import { type MatchingStep, runPriorityMatching } from '~/lib/oprec/matching';
import {
  type IgnoredPriority,
  type PoolApplication,
  type PoolChoice,
  buildMatchingInput,
  candidacy,
  ownChoices,
  planWrites,
} from '~/lib/oprec/priority';
import { registrationEnded } from '~/lib/oprec/registration';
import { blindCode, effectiveStatus } from '~/lib/oprec/scoring';
import { oprecAssessProcedure } from '~/server/api/trpc';
import {
  application,
  applicationChoice,
  choiceStatusOverride,
  divisionPriority,
  form,
  mahasiswa,
  placement,
  placementDecision,
  recruitment,
  recruitmentDivision,
  recruitmentWave,
  users,
} from '~/server/db/schema';

import { type Tx } from '../form/services';
import { loadApplicantAnswers } from './applicant-answers';
import { type AssessAccess, canRankDivision } from './assess-access';
import { logAction } from './log';
import { type PlacementDivision, loadPlacementDivisions } from './placement';
import { recomputeDivisions } from './recompute';
import { type Queryable, conflict, notFound, pgCode } from './services';

const id = z.string().min(1).max(255);
const OK = { success: true } as const;
/** Batas baris per pernyataan saat menulis massal. */
const CHUNK = 500;
/** Batas panjang daftar prioritas satu divisi. */
const MAX_PRIORITY_LIST = 5000;

type Recruitment = typeof recruitment.$inferSelect;

const forbidden = (message: string): never => {
  throw new TRPCError({ code: 'FORBIDDEN', message });
};

function assertAdmin(access: AssessAccess) {
  if (!access.isAdmin) {
    forbidden('Hanya admin oprec yang boleh melakukan tindakan ini.');
  }
}

function assertRanker(access: AssessAccess, divisionId: string) {
  if (!canRankDivision(access, divisionId)) {
    forbidden('Kamu tidak menyusun daftar prioritas divisi itu.');
  }
}

/** Daftar hanya bisa diubah pada metode prioritas selama penempatan berjalan. */
export function assertEditable(
  rec: Pick<Recruitment, 'placementMethod' | 'placementState'>,
) {
  if (rec.placementMethod !== 'prioritas') {
    conflict('Oprec ini tidak memakai penempatan prioritas.');
  }
  if (rec.placementState !== 'berjalan') {
    conflict('Daftar prioritas hanya bisa diubah selama penempatan berjalan.');
  }
}

export function chunks<T>(rows: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    out.push(rows.slice(i, i + CHUNK));
  }
  return out;
}

const displayName = sql<
  string | null
>`coalesce(${mahasiswa.nama}, ${users.name})`;

// ---------------------------------------------------------------------------
// Pemuatan data
// ---------------------------------------------------------------------------

export type PoolApp = Omit<PoolApplication, 'choices'> & {
  userId: string;
  name: string | null;
  nim: number | null;
  prodi: string | null;
  angkatan: number | null;
  /** Waktu kirim formulir; closerec/data lama memakai waktu dibuat. */
  submittedAt: Date;
  choices: (PoolChoice & { score: number | null })[];
};

type PriorityRow = {
  divisionId: string;
  applicationId: string;
  rank: number | null;
  note: string | null;
  updatedAt: Date;
  updatedByName: string | null;
};

type DivisionState = PlacementDivision & {
  priorityVersion: number;
  lockedAt: Date | null;
  lockedByName: string | null;
};

type Pool = {
  divisions: DivisionState[];
  apps: PoolApp[];
  priorities: PriorityRow[];
};

/** Semua pendaftar, pilihan, status efektif, dan daftar prioritas satu oprec. */
export async function loadPool(
  db: Queryable,
  recruitmentId: string,
): Promise<Pool> {
  const [divisions, lockRows, appRows, choiceRows, priorityRows] =
    await Promise.all([
      loadPlacementDivisions(db, recruitmentId),
      db
        .select({
          id: recruitmentDivision.id,
          priorityVersion: recruitmentDivision.priorityVersion,
          lockedAt: recruitmentDivision.priorityLockedAt,
          lockedByName: users.name,
        })
        .from(recruitmentDivision)
        .leftJoin(users, eq(users.id, recruitmentDivision.priorityLockedBy))
        .where(eq(recruitmentDivision.recruitmentId, recruitmentId)),
      db
        .select({
          id: application.id,
          userId: application.userId,
          source: application.source,
          willingToMove: application.willingToMove,
          name: displayName,
          nim: mahasiswa.nim,
          prodi: mahasiswa.jurusan,
          angkatan: mahasiswa.angkatan,
          submittedAt: application.submittedAt,
          createdAt: application.created_at,
        })
        .from(application)
        .innerJoin(users, eq(users.id, application.userId))
        .leftJoin(mahasiswa, eq(mahasiswa.userId, users.id))
        .where(eq(application.recruitmentId, recruitmentId))
        .orderBy(asc(application.id)),
      db
        .select({
          id: applicationChoice.id,
          applicationId: applicationChoice.applicationId,
          divisionId: applicationChoice.divisionId,
          rank: applicationChoice.rank,
          origin: applicationChoice.origin,
          score: applicationChoice.score,
          computedStatus: applicationChoice.computedStatus,
          overrideStatus: choiceStatusOverride.status,
          decision: placementDecision.decision,
        })
        .from(applicationChoice)
        .innerJoin(
          recruitmentDivision,
          eq(recruitmentDivision.id, applicationChoice.divisionId),
        )
        .leftJoin(
          choiceStatusOverride,
          and(
            eq(choiceStatusOverride.choiceId, applicationChoice.id),
            isNull(choiceStatusOverride.clearedAt),
          ),
        )
        .leftJoin(
          placementDecision,
          eq(placementDecision.choiceId, applicationChoice.id),
        )
        .where(eq(recruitmentDivision.recruitmentId, recruitmentId)),
      db
        .select({
          divisionId: divisionPriority.divisionId,
          applicationId: divisionPriority.applicationId,
          rank: divisionPriority.rank,
          note: divisionPriority.note,
          updatedAt: divisionPriority.updatedAt,
          updatedByName: users.name,
        })
        .from(divisionPriority)
        .innerJoin(
          recruitmentDivision,
          eq(recruitmentDivision.id, divisionPriority.divisionId),
        )
        .leftJoin(users, eq(users.id, divisionPriority.updatedBy))
        .where(eq(recruitmentDivision.recruitmentId, recruitmentId)),
    ]);

  const lockOf = new Map(lockRows.map((row) => [row.id, row]));
  const choicesOf = new Map<string, PoolApp['choices']>();
  for (const row of choiceRows) {
    const list = choicesOf.get(row.applicationId) ?? [];
    list.push({
      id: row.id,
      divisionId: row.divisionId,
      rank: row.rank,
      origin: row.origin,
      status: effectiveStatus(
        row.computedStatus,
        row.overrideStatus === null
          ? null
          : {
              status: row.overrideStatus,
              computedStatusAtOverride: null,
              scoreAtOverride: null,
            },
      ),
      decision: row.decision ?? null,
      score: row.score === null ? null : Number(row.score),
    });
    choicesOf.set(row.applicationId, list);
  }

  return {
    divisions: divisions.map((d) => {
      const lock = lockOf.get(d.id);
      return {
        ...d,
        priorityVersion: lock?.priorityVersion ?? 0,
        lockedAt: lock?.lockedAt ?? null,
        lockedByName: lock?.lockedByName ?? null,
      };
    }),
    apps: appRows.map(({ createdAt, ...row }) => ({
      ...row,
      submittedAt: row.submittedAt ?? createdAt,
      choices: choicesOf.get(row.id) ?? [],
    })),
    priorities: priorityRows,
  };
}

async function isRegistrationEnded(
  db: Queryable,
  rec: Pick<Recruitment, 'id' | 'formId' | 'status'>,
  now = new Date(),
): Promise<boolean> {
  const [[formRow], waves] = await Promise.all([
    db
      .select({ closesAt: form.closesAt })
      .from(form)
      .where(eq(form.id, rec.formId)),
    db
      .select({ endsAt: recruitmentWave.endsAt })
      .from(recruitmentWave)
      .where(eq(recruitmentWave.recruitmentId, rec.id)),
  ]);
  return registrationEnded({
    status: rec.status,
    formClosesAt: formRow?.closesAt ?? null,
    waveEndsAt: waves.map((w) => w.endsAt),
    now,
  });
}

/** Identitas pendaftar; pada mode blind hanya kode bagi yang bukan admin. */
export function identity(hide: boolean, app: PoolApp) {
  return {
    code: blindCode(app.id),
    name: hide ? null : app.name,
    nim: hide ? null : app.nim,
    prodi: hide ? null : app.prodi,
    angkatan: hide ? null : app.angkatan,
  };
}

// ---------------------------------------------------------------------------
// Penempatan otomatis
// ---------------------------------------------------------------------------

export type PreviewOutcome = MatchingStep['outcome'] | 'tidak_lolos';

/** Hitung penempatan dari data tersimpan, tanpa menulis apa pun. */
async function computeMatching(db: Queryable, rec: Recruitment) {
  const pool = await loadPool(db, rec.id);
  const { matching, ignored } = buildMatchingInput({
    applications: pool.apps,
    divisions: pool.divisions,
    priorities: pool.priorities,
    allowRedirect: rec.allowRedirect,
  });
  const result = runPriorityMatching(matching);
  const inScope = new Set(matching.applicants.map((a) => a.id));
  const appById = new Map(pool.apps.map((a) => [a.id, a]));
  const divisionById = new Map(pool.divisions.map((d) => [d.id, d]));

  // Bentrok organogram: orang sudah menempati posisi tujuan bukan lewat
  // pilihan oprec ini (mis. ditambahkan manual). Penerapan akan gagal.
  const assigned = [...result.assignment].flatMap(([appId, divisionId]) =>
    divisionId
      ? [{ app: appById.get(appId)!, division: divisionById.get(divisionId)! }]
      : [],
  );
  const conflicts: {
    applicationId: string;
    name: string | null;
    label: string;
  }[] = [];
  if (assigned.length > 0) {
    const positionIds = [
      ...new Set(assigned.map((p) => p.division.positionId)),
    ];
    const existing: {
      positionId: string;
      userId: string;
      applicationChoiceId: string | null;
    }[] = [];
    for (const part of chunks([
      ...new Set(assigned.map((p) => p.app.userId)),
    ])) {
      existing.push(
        ...(await db
          .select({
            positionId: placement.positionId,
            userId: placement.userId,
            applicationChoiceId: placement.applicationChoiceId,
          })
          .from(placement)
          .where(
            and(
              inArray(placement.positionId, positionIds),
              inArray(placement.userId, part),
            ),
          )),
      );
    }
    for (const { app, division } of assigned) {
      const own = new Set(
        app.choices.filter((c) => c.origin !== 'closerec').map((c) => c.id),
      );
      const clash = existing.some(
        (row) =>
          row.positionId === division.positionId &&
          row.userId === app.userId &&
          (row.applicationChoiceId === null ||
            !own.has(row.applicationChoiceId)),
      );
      if (clash) {
        conflicts.push({
          applicationId: app.id,
          name: app.name,
          label: division.label,
        });
      }
    }
  }

  return { pool, matching, result, ignored, inScope, conflicts };
}

type Computed = Awaited<ReturnType<typeof computeMatching>>;

/** Divisi tempat pendaftar diterima saat ini (keputusan non-closerec). */
function currentAcceptance(app: PoolApp): string | null {
  return (
    app.choices.find((c) => c.origin !== 'closerec' && c.decision === 'terima')
      ?.divisionId ?? null
  );
}

function readinessProblems(
  rec: Recruitment,
  ended: boolean,
  computed: Computed,
): string[] {
  const problems: string[] = [];
  if (rec.placementMethod !== 'prioritas') {
    problems.push('Oprec ini tidak memakai penempatan prioritas.');
  }
  if (rec.placementState !== 'berjalan') {
    problems.push(
      'Penempatan otomatis hanya bisa dijalankan selama penempatan berjalan.',
    );
  }
  if (!ended) {
    problems.push(
      'Pendaftaran belum berakhir. Tutup pendaftaran atau tunggu tenggatnya lewat.',
    );
  }
  const unlocked = computed.pool.divisions.filter((d) => d.lockedAt === null);
  if (unlocked.length > 0) {
    problems.push(
      `Daftar prioritas belum dikunci: ${unlocked.map((d) => d.label).join(', ')}.`,
    );
  }
  for (const c of computed.conflicts) {
    problems.push(
      `${c.name ?? 'Seorang pendaftar'} sudah menempati posisi ${c.label} di organogram di luar oprec ini.`,
    );
  }
  return problems;
}

/** Tulis keputusan dan penempatan organogram dari hasil penempatan. */
async function writeMatching(
  tx: Tx,
  rec: Recruitment,
  computed: Computed,
  actorId: string,
) {
  const divisionById = new Map(computed.pool.divisions.map((d) => [d.id, d]));
  const apps = computed.pool.apps.filter((a) => computed.inScope.has(a.id));

  const touched: string[] = [];
  const drop: string[] = [];
  const newRedirects: { applicationId: string; divisionId: string }[] = [];
  const decisions: {
    choiceId: string;
    decision: 'terima' | 'tolak';
    tag: 'di_luar_pilihan' | null;
  }[] = [];
  const accepted: {
    app: PoolApp;
    choiceId: string | null;
    divisionId: string;
  }[] = [];
  let redirected = 0;

  for (const app of apps) {
    for (const c of app.choices) {
      if (c.origin !== 'closerec') touched.push(c.id);
    }
    const plan = planWrites(
      app,
      computed.result.assignment.get(app.id) ?? null,
    );
    drop.push(...plan.drop);
    for (const choiceId of plan.tolak) {
      decisions.push({ choiceId, decision: 'tolak', tag: null });
    }
    if (!plan.terima) continue;
    if (plan.terima.redirected) redirected += 1;
    accepted.push({
      app,
      choiceId: plan.terima.choiceId,
      divisionId: plan.terima.divisionId,
    });
    if (plan.terima.choiceId) {
      decisions.push({
        choiceId: plan.terima.choiceId,
        decision: 'terima',
        tag: plan.terima.redirected ? 'di_luar_pilihan' : null,
      });
    } else {
      newRedirects.push({
        applicationId: app.id,
        divisionId: plan.terima.divisionId,
      });
    }
  }

  // Bersihkan hasil sebelumnya: keputusan dan penempatan organogram semua
  // pilihan yang ikut, lalu pilihan dialihkan yang tidak dipakai lagi.
  for (const part of chunks(touched)) {
    await tx
      .delete(placement)
      .where(inArray(placement.applicationChoiceId, part));
    await tx
      .delete(placementDecision)
      .where(inArray(placementDecision.choiceId, part));
  }
  for (const part of chunks(drop)) {
    await tx
      .delete(applicationChoice)
      .where(inArray(applicationChoice.id, part));
  }

  const createdOf = new Map<string, string>();
  for (const part of chunks(newRedirects)) {
    const created = await tx
      .insert(applicationChoice)
      .values(
        part.map((row) => ({
          applicationId: row.applicationId,
          divisionId: row.divisionId,
          rank: null,
          origin: 'dialihkan' as const,
        })),
      )
      .returning({
        id: applicationChoice.id,
        applicationId: applicationChoice.applicationId,
      });
    for (const row of created) createdOf.set(row.applicationId, row.id);
  }
  for (const row of newRedirects) {
    decisions.push({
      choiceId: createdOf.get(row.applicationId)!,
      decision: 'terima',
      tag: 'di_luar_pilihan',
    });
  }

  for (const part of chunks(decisions)) {
    await tx.insert(placementDecision).values(
      part.map((row) => ({
        choiceId: row.choiceId,
        decision: row.decision,
        decidedBy: actorId,
        tag: row.tag,
      })),
    );
  }

  const placementRows = accepted.map((row) => ({
    positionId: divisionById.get(row.divisionId)!.positionId,
    userId: row.app.userId,
    source: 'oprec' as const,
    applicationChoiceId: row.choiceId ?? createdOf.get(row.app.id)!,
    createdBy: actorId,
  }));
  try {
    for (const part of chunks(placementRows)) {
      await tx.insert(placement).values(part);
    }
  } catch (error) {
    if (pgCode(error) === '23505') {
      conflict(
        'Ada pendaftar yang sudah menempati posisi tujuannya di organogram. Muat ulang pratinjau.',
      );
    }
    throw error;
  }

  const summary = {
    placed: accepted.length,
    unplaced: apps.length - accepted.length,
    redirected,
  };
  await logAction(tx, {
    recruitmentId: rec.id,
    actorId,
    action: 'penempatan_prioritas',
    entityType: 'recruitment',
    entityId: rec.id,
    detail: { ...summary, batas: Object.fromEntries(computed.result.cutoff) },
  });
  return summary;
}

// ---------------------------------------------------------------------------
// Prosedur
// ---------------------------------------------------------------------------

const DivisionInput = z.object({ recruitmentId: id, divisionId: id });

/** Kunci baris oprec (bersama) lalu baris divisi; ditolak bila bukan milik oprec. */
export async function lockDivision(
  tx: Tx,
  recruitmentId: string,
  divisionId: string,
) {
  const [rec] = await tx
    .select()
    .from(recruitment)
    .where(eq(recruitment.id, recruitmentId))
    .for('share');
  if (!rec) notFound('Oprec tidak ditemukan.');
  const [division] = await tx
    .select({
      id: recruitmentDivision.id,
      version: recruitmentDivision.priorityVersion,
      lockedAt: recruitmentDivision.priorityLockedAt,
    })
    .from(recruitmentDivision)
    .where(
      and(
        eq(recruitmentDivision.id, divisionId),
        eq(recruitmentDivision.recruitmentId, recruitmentId),
      ),
    )
    .for('update');
  if (!division) notFound('Divisi itu bukan milik oprec ini.');
  return { rec, division };
}

export const priorityProcedures = {
  /** Ringkasan mode prioritas: divisi yang boleh disusun pemanggil. */
  priorityOverview: oprecAssessProcedure
    .input(z.object({ recruitmentId: id }))
    .query(async ({ ctx }) => {
      const rec = ctx.recruitment;
      const a = ctx.assess;
      const [pool, ended] = await Promise.all([
        loadPool(ctx.db, rec.id),
        isRegistrationEnded(ctx.db, rec),
      ]);
      const ranked = new Map<string, number>();
      for (const p of pool.priorities) {
        if (p.rank !== null) {
          ranked.set(p.divisionId, (ranked.get(p.divisionId) ?? 0) + 1);
        }
      }
      return {
        name: rec.name,
        method: rec.placementMethod,
        state: rec.placementState,
        status: rec.status,
        isAdmin: a.isAdmin,
        registrationEnded: ended,
        allowRedirect: rec.allowRedirect,
        divisions: pool.divisions
          .filter((d) => canRankDivision(a, d.id))
          .map((d) => {
            let candidates = 0;
            let rankable = 0;
            for (const app of pool.apps) {
              const c = candidacy(app, d.id, rec.allowRedirect);
              if (!c) continue;
              candidates += 1;
              if (!c.blocked) rankable += 1;
            }
            return {
              id: d.id,
              label: d.label,
              groupLabel: d.groupLabel,
              quota: d.quota,
              candidates,
              rankable,
              ranked: ranked.get(d.id) ?? 0,
              lockedAt: d.lockedAt,
              lockedByName: d.lockedByName,
            };
          }),
      };
    }),

  /** Papan prioritas satu divisi: kandidat, urutan, dan keterangan tersimpan. */
  priorityBoard: oprecAssessProcedure
    .input(DivisionInput)
    .query(async ({ ctx, input }) => {
      assertRanker(ctx.assess, input.divisionId);
      const rec = ctx.recruitment;
      const pool = await loadPool(ctx.db, rec.id);
      const division = pool.divisions.find((d) => d.id === input.divisionId);
      if (!division) notFound('Divisi itu bukan milik oprec ini.');
      const labelOf = new Map(pool.divisions.map((d) => [d.id, d.label]));
      const saved = new Map(
        pool.priorities
          .filter((p) => p.divisionId === division.id)
          .map((p) => [p.applicationId, p]),
      );
      const hide = rec.blind && !ctx.assess.isAdmin;

      const rows = pool.apps.flatMap((app) => {
        const c = candidacy(app, division.id, rec.allowRedirect);
        if (!c) return [];
        const p = saved.get(app.id);
        const own = ownChoices(app);
        const here = app.choices.find(
          (x) => x.origin === 'dipilih' && x.divisionId === division.id,
        );
        return [
          {
            applicationId: app.id,
            ...identity(hide, app),
            kind: c.kind,
            choiceRank: c.kind === 'pilihan' ? c.choiceRank : null,
            blocked: c.blocked,
            willingToMove: app.willingToMove,
            submittedAt: app.submittedAt,
            status: here?.status ?? null,
            score: here?.score ?? null,
            choices: own.map((x) => ({
              divisionId: x.divisionId,
              label: labelOf.get(x.divisionId) ?? '',
              rank: x.rank,
              status: x.status,
            })),
            rank: c.blocked ? null : (p?.rank ?? null),
            note: p?.note ?? null,
            noteUpdatedAt: p?.note ? p.updatedAt : null,
            noteUpdatedBy: p?.note ? p.updatedByName : null,
          },
        ];
      });

      const group = (r: (typeof rows)[number]) =>
        r.blocked ? 2 : r.rank !== null ? 0 : 1;
      rows.sort(
        (x, y) =>
          group(x) - group(y) ||
          (x.rank ?? 0) - (y.rank ?? 0) ||
          (x.choiceRank ?? 99) - (y.choiceRank ?? 99) ||
          (x.name ?? x.code).localeCompare(y.name ?? y.code),
      );

      return {
        division: {
          id: division.id,
          label: division.label,
          groupLabel: division.groupLabel,
          quota: division.quota,
        },
        method: rec.placementMethod,
        state: rec.placementState,
        blind: hide,
        version: division.priorityVersion,
        lockedAt: division.lockedAt,
        lockedByName: division.lockedByName,
        canEdit:
          rec.placementMethod === 'prioritas' &&
          rec.placementState === 'berjalan' &&
          division.lockedAt === null,
        rows,
      };
    }),

  /** Simpan seluruh urutan prioritas satu divisi (indeks 0 = urutan 1). */
  /**
   * Jawaban satu pendaftar untuk papan prioritas: pertanyaan bagian divisi ini
   * plus pertanyaan umum. Aksesnya sama dengan papan divisi itu.
   */
  priorityAnswers: oprecAssessProcedure
    .input(DivisionInput.extend({ applicationId: id }))
    .query(async ({ ctx, input }) => {
      assertRanker(ctx.assess, input.divisionId);
      const [app] = await ctx.db
        .select({ formSubmissionId: application.formSubmissionId })
        .from(application)
        .where(
          and(
            eq(application.id, input.applicationId),
            eq(application.recruitmentId, ctx.recruitment.id),
          ),
        );
      if (!app) notFound('Pendaftar tidak ditemukan.');
      return loadApplicantAnswers(
        ctx.db,
        ctx.recruitment,
        app.formSubmissionId,
        input.divisionId,
      );
    }),

  prioritySave: oprecAssessProcedure
    .input(
      DivisionInput.extend({
        order: z.array(id).max(MAX_PRIORITY_LIST),
        baseVersion: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertRanker(ctx.assess, input.divisionId);
      if (new Set(input.order).size !== input.order.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Satu pendaftar hanya boleh muncul sekali di daftar.',
        });
      }
      return ctx.db.transaction(async (tx) => {
        const { rec, division } = await lockDivision(
          tx,
          input.recruitmentId,
          input.divisionId,
        );
        assertEditable(rec);
        if (division.lockedAt) {
          conflict('Daftar divisi ini sudah dikunci. Buka kunci dulu.');
        }
        if (division.version !== input.baseVersion) {
          conflict(
            'Daftar ini baru saja diubah orang lain. Muat ulang untuk melihat urutan terbaru.',
          );
        }
        const pool = await loadPool(tx, rec.id);
        const appById = new Map(pool.apps.map((a) => [a.id, a]));
        const invalid = input.order.filter((applicationId) => {
          const app = appById.get(applicationId);
          const c = app ? candidacy(app, division.id, rec.allowRedirect) : null;
          // Bukan kandidat (undefined) atau diblokir: keduanya tidak sah.
          return c?.blocked !== null;
        });
        if (invalid.length > 0) {
          conflict(
            `${invalid.length} orang di daftar tidak bisa diurutkan lagi (tidak lolos, sudah closerec, atau bukan kandidat). Muat ulang daftar.`,
          );
        }

        // Kosongkan urutan lama tanpa melanggar CHECK (urutan atau keterangan
        // harus ada): baris tanpa keterangan dihapus, sisanya dibuat tanpa
        // urutan. Lalu urutan baru ditulis ulang.
        const actorId = ctx.session.user.id;
        await tx
          .delete(divisionPriority)
          .where(
            and(
              eq(divisionPriority.divisionId, division.id),
              isNull(divisionPriority.note),
            ),
          );
        await tx
          .update(divisionPriority)
          .set({ rank: null })
          .where(eq(divisionPriority.divisionId, division.id));
        const rows = input.order.map((applicationId, index) => ({
          divisionId: division.id,
          applicationId,
          rank: index + 1,
          updatedBy: actorId,
        }));
        for (const part of chunks(rows)) {
          await tx
            .insert(divisionPriority)
            .values(part)
            .onConflictDoUpdate({
              target: [
                divisionPriority.divisionId,
                divisionPriority.applicationId,
              ],
              set: {
                rank: sql`excluded.rank`,
                updatedBy: actorId,
                updatedAt: new Date(),
              },
            });
        }
        const version = division.version + 1;
        await tx
          .update(recruitmentDivision)
          .set({ priorityVersion: version })
          .where(eq(recruitmentDivision.id, division.id));
        return { version };
      });
    }),

  /** Keterangan bebas penyusun untuk satu kandidat; kosong = hapus. */
  priorityNote: oprecAssessProcedure
    .input(
      DivisionInput.extend({
        applicationId: id,
        note: z.string().max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertRanker(ctx.assess, input.divisionId);
      const note = input.note.trim() || null;
      return ctx.db.transaction(async (tx) => {
        const { rec, division } = await lockDivision(
          tx,
          input.recruitmentId,
          input.divisionId,
        );
        if (rec.placementMethod !== 'prioritas') {
          conflict('Oprec ini tidak memakai penempatan prioritas.');
        }
        if (rec.placementState === 'final') {
          conflict('Penempatan sudah final.');
        }
        const pool = await loadPool(tx, rec.id);
        const app = pool.apps.find((a) => a.id === input.applicationId);
        if (!app || !candidacy(app, division.id, rec.allowRedirect)) {
          notFound('Pendaftar itu bukan kandidat divisi ini.');
        }
        const actorId = ctx.session.user.id;
        const where = and(
          eq(divisionPriority.divisionId, division.id),
          eq(divisionPriority.applicationId, app.id),
        );
        if (note) {
          await tx
            .insert(divisionPriority)
            .values({
              divisionId: division.id,
              applicationId: app.id,
              note,
              updatedBy: actorId,
            })
            .onConflictDoUpdate({
              target: [
                divisionPriority.divisionId,
                divisionPriority.applicationId,
              ],
              set: { note, updatedBy: actorId, updatedAt: new Date() },
            });
        } else {
          await tx
            .delete(divisionPriority)
            .where(and(where, isNull(divisionPriority.rank)));
          await tx
            .update(divisionPriority)
            .set({ note: null, updatedBy: actorId })
            .where(where);
        }
        return OK;
      });
    }),

  /** Kunci atau buka kunci daftar satu divisi. */
  priorityLock: oprecAssessProcedure
    .input(DivisionInput.extend({ locked: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertRanker(ctx.assess, input.divisionId);
      return ctx.db.transaction(async (tx) => {
        const { rec, division } = await lockDivision(
          tx,
          input.recruitmentId,
          input.divisionId,
        );
        assertEditable(rec);
        if (input.locked === (division.lockedAt !== null)) return OK;
        if (input.locked && !(await isRegistrationEnded(tx, rec))) {
          conflict(
            'Daftar baru bisa dikunci setelah pendaftaran berakhir, supaya tidak ada pendaftar baru yang terlewat.',
          );
        }
        const actorId = ctx.session.user.id;
        await tx
          .update(recruitmentDivision)
          .set({
            priorityLockedAt: input.locked ? new Date() : null,
            priorityLockedBy: input.locked ? actorId : null,
          })
          .where(eq(recruitmentDivision.id, division.id));
        await logAction(tx, {
          recruitmentId: rec.id,
          actorId,
          action: input.locked ? 'prioritas_dikunci' : 'prioritas_dibuka',
          entityType: 'recruitment_division',
          entityId: division.id,
        });
        return OK;
      });
    }),

  /** Ganti metode penempatan (admin, selama penempatan berjalan). */
  prioritySetMethod: oprecAssessProcedure
    .input(
      z.object({
        recruitmentId: id,
        method: z.enum(['manual', 'prioritas']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.assess);
      return ctx.db.transaction(async (tx) => {
        const [rec] = await tx
          .select()
          .from(recruitment)
          .where(eq(recruitment.id, input.recruitmentId))
          .for('update');
        if (!rec) notFound('Oprec tidak ditemukan.');
        if (rec.placementMethod === input.method) return OK;
        if (rec.placementState !== 'berjalan') {
          conflict(
            'Metode penempatan hanya bisa diganti selama penempatan berjalan.',
          );
        }
        await tx
          .update(recruitment)
          .set({ placementMethod: input.method })
          .where(eq(recruitment.id, rec.id));
        // Status lulus/tidak bergantung pada metode (pemotongan kuota).
        await recomputeDivisions(tx, rec.id, 'all');
        await logAction(tx, {
          recruitmentId: rec.id,
          actorId: ctx.session.user.id,
          action: 'metode_penempatan',
          entityType: 'recruitment',
          entityId: rec.id,
          detail: { from: rec.placementMethod, to: input.method },
        });
        return OK;
      });
    }),

  /** Pratinjau penempatan otomatis dari daftar tersimpan (admin). */
  matchingPreview: oprecAssessProcedure
    .input(z.object({ recruitmentId: id }))
    .query(async ({ ctx }) => {
      assertAdmin(ctx.assess);
      const rec = ctx.recruitment;
      const [computed, ended] = await Promise.all([
        computeMatching(ctx.db, rec),
        isRegistrationEnded(ctx.db, rec),
      ]);
      const { pool, result, ignored, inScope } = computed;
      const labelOf = new Map(pool.divisions.map((d) => [d.id, d.label]));

      const rows = pool.apps
        .filter((a) => inScope.has(a.id))
        .map((app) => {
          const before = currentAcceptance(app);
          const after = result.assignment.get(app.id) ?? null;
          const statusOf = new Map(
            ownChoices(app).map((c) => [c.divisionId, c.status]),
          );
          const steps = (result.trace.get(app.id) ?? []).map((s) => ({
            divisionId: s.divisionId,
            label: labelOf.get(s.divisionId) ?? '',
            choiceRank: s.choiceRank,
            priorityRank: s.priorityRank,
            outcome: (s.outcome === 'tidak_diprioritaskan' &&
            statusOf.get(s.divisionId) === 'tidak_lolos'
              ? 'tidak_lolos'
              : s.outcome) as PreviewOutcome,
          }));
          const accepted = steps.find((s) => s.outcome === 'diterima');
          return {
            applicationId: app.id,
            name: app.name,
            nim: app.nim,
            fakultas: fakultasOfNim(app.nim),
            before: before
              ? { divisionId: before, label: labelOf.get(before) ?? '' }
              : null,
            after: after
              ? {
                  divisionId: after,
                  label: labelOf.get(after) ?? '',
                  choiceRank: accepted?.choiceRank ?? null,
                }
              : null,
            changed: before !== after,
            steps,
          };
        })
        .sort(
          (x, y) =>
            (x.after?.label ?? '￿').localeCompare(y.after?.label ?? '￿') ||
            (x.name ?? '').localeCompare(y.name ?? ''),
        );

      const replacedDecisions = pool.apps
        .filter((a) => inScope.has(a.id))
        .reduce(
          (n, a) =>
            n +
            a.choices.filter(
              (c) => c.origin !== 'closerec' && c.decision !== null,
            ).length,
          0,
        );
      const ignoredCount = (reason: IgnoredPriority['reason']) =>
        ignored.filter((row) => row.reason === reason).length;

      return {
        problems: readinessProblems(rec, ended, computed),
        divisions: pool.divisions.map((d) => ({
          id: d.id,
          label: d.label,
          groupLabel: d.groupLabel,
          quota: d.quota,
          accepted: result.accepted.get(d.id)?.length ?? 0,
          cutoff: result.cutoff.get(d.id) ?? null,
          ranked:
            computed.matching.divisions.find((x) => x.id === d.id)?.priority
              .size ?? 0,
          lockedAt: d.lockedAt,
          lockedByName: d.lockedByName,
        })),
        rows,
        totals: {
          applicants: rows.length,
          placed: rows.filter((r) => r.after !== null).length,
          redirected: rows.filter(
            (r) => r.after !== null && r.after.choiceRank === null,
          ).length,
          changed: rows.filter((r) => r.changed).length,
          replacedDecisions,
          ignoredTidakLolos: ignoredCount('tidak_lolos'),
          ignoredCloserec: ignoredCount('closerec'),
          ignoredOther: ignoredCount('bukan_kandidat'),
          excluded: pool.apps.length - inScope.size,
        },
      };
    }),

  /** Terapkan penempatan otomatis: tulis keputusan dan organogram (admin). */
  matchingApply: oprecAssessProcedure
    .input(z.object({ recruitmentId: id }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.assess);
      return ctx.db.transaction(async (tx) => {
        const [rec] = await tx
          .select()
          .from(recruitment)
          .where(eq(recruitment.id, input.recruitmentId))
          .for('update');
        if (!rec) notFound('Oprec tidak ditemukan.');
        const computed = await computeMatching(tx, rec);
        const [problem] = readinessProblems(
          rec,
          await isRegistrationEnded(tx, rec),
          computed,
        );
        if (problem) conflict(problem);
        return writeMatching(tx, rec, computed, ctx.session.user.id);
      });
    }),
};
