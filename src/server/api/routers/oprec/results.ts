import { TRPCError } from '@trpc/server';
import {
  and,
  asc,
  count,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { deriveChoiceStage } from '~/lib/oprec/allocation';
import { fallbackReason, finalStatus, resultsMode } from '~/lib/oprec/results';
import { aggregateCriterion, effectiveStatus } from '~/lib/oprec/scoring';
import {
  oprecAssessProcedure,
  protectedProcedure,
} from '~/server/api/trpc';
import {
  application,
  applicationChoice,
  assessment,
  choiceStatusOverride,
  criterion,
  mahasiswa,
  organizationUnit,
  placementDecision,
  recruitment,
  recruitmentDivision,
  recruitmentWave,
  users,
} from '~/server/db/schema';

import {
  RecruitmentIdInputSchema,
  ResultsListInputSchema,
  ResultsLogExportInputSchema,
  ResultsWithdrawInputSchema,
} from '../../types/oprec.type';
import { type AssessAccess, canSeeSensitive } from './assess-access';
import { logAction } from './log';
import { loadPlacementDivisions } from './placement';
import { type Queryable, conflict, notFound } from './services';

type ResultsMode = 'admin' | 'admin_ketua' | 'semua';
type Status = Parameters<typeof effectiveStatus>[0];
type Decision = 'terima' | 'tolak';

/** Nama tampil: nama di data mahasiswa, lalu nama akun. */
const displayName = sql<
  string | null
>`coalesce(${mahasiswa.nama}, ${users.name})`;

function assertResultsAccess(access: AssessAccess, mode: ResultsMode) {
  if (access.isAdmin) return;
  if (mode === 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Menu Hasil hanya bisa dibuka admin oprec.',
    });
  }
  if (mode === 'admin_ketua') {
    if (access.deciderDivisionIds.size === 0) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Menu Hasil hanya bisa dibuka admin dan Kadiv.',
      });
    }
    return;
  }
  if (access.divisionIds.size === 0) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Menu Hasil hanya bisa dibuka pengelola oprec.',
    });
  }
}

type ChoiceRow = {
  id: string;
  applicationId: string;
  divisionId: string;
  label: string;
  rank: number | null;
  origin: string;
  computedStatus: Status | null;
  overrideStatus: 'lolos' | 'tidak_lolos' | null;
  overrideReason: string | null;
  overrideSensitive: boolean | null;
  decision: Decision | null;
  tag: string | null;
  decidedAt: Date | null;
};

async function loadChoiceRows(
  db: Queryable,
  recruitmentId: string,
  applicationIds?: string[],
): Promise<ChoiceRow[]> {
  const parts = [eq(application.recruitmentId, recruitmentId)];
  if (applicationIds) {
    if (applicationIds.length === 0) return [];
    parts.push(inArray(application.id, applicationIds));
  }
  return db
    .select({
      id: applicationChoice.id,
      applicationId: applicationChoice.applicationId,
      divisionId: applicationChoice.divisionId,
      label: organizationUnit.name,
      rank: applicationChoice.rank,
      origin: applicationChoice.origin,
      computedStatus: applicationChoice.computedStatus,
      overrideStatus: choiceStatusOverride.status,
      overrideReason: choiceStatusOverride.reason,
      overrideSensitive: choiceStatusOverride.isSensitive,
      decision: placementDecision.decision,
      tag: placementDecision.tag,
      decidedAt: placementDecision.decidedAt,
    })
    .from(applicationChoice)
    .innerJoin(
      application,
      eq(application.id, applicationChoice.applicationId),
    )
    .innerJoin(
      recruitmentDivision,
      eq(recruitmentDivision.id, applicationChoice.divisionId),
    )
    .innerJoin(
      organizationUnit,
      eq(organizationUnit.id, recruitmentDivision.unitId),
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
    .where(and(...parts))
    .orderBy(asc(applicationChoice.rank), asc(organizationUnit.name));
}

function statusOf(row: ChoiceRow) {
  return effectiveStatus(
    row.computedStatus,
    row.overrideStatus === null
      ? null
      : {
          status: row.overrideStatus,
          computedStatusAtOverride: null,
          scoreAtOverride: null,
        },
  );
}

/** Nama kriteria gate yang gugur/ditinjau per pilihan, untuk alasan hasil. */
async function gateReasonsFor(
  db: Queryable,
  rec: {
    id: string;
    minReviewers: number;
    ratingMin: number;
    ratingMax: number;
  },
  choices: ChoiceRow[],
): Promise<Map<string, string>> {
  const reasons = new Map<string, string>();
  if (choices.length === 0) return reasons;

  const gates = await db
    .select({
      id: criterion.id,
      name: criterion.name,
      divisionId: criterion.divisionId,
    })
    .from(criterion)
    .where(
      and(
        eq(criterion.recruitmentId, rec.id),
        inArray(criterion.kind, ['gugur_otomatis', 'gugur_manual']),
      ),
    );
  if (gates.length === 0) return reasons;

  const rows = await db
    .select({
      applicationId: assessment.applicationId,
      criterionId: assessment.criterionId,
      choiceId: assessment.choiceId,
      assessorId: assessment.assessorId,
      rating: assessment.rating,
      gateState: assessment.gateState,
    })
    .from(assessment)
    .where(
      and(
        inArray(
          assessment.applicationId,
          [...new Set(choices.map((choice) => choice.applicationId))],
        ),
        inArray(
          assessment.criterionId,
          gates.map((gate) => gate.id),
        ),
      ),
    );
  const keyOf = (applicationId: string, choiceId: string | null) =>
    `${applicationId}:${choiceId ?? 'umum'}`;
  const byScope = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = keyOf(row.applicationId, row.choiceId);
    byScope.set(key, [...(byScope.get(key) ?? []), row]);
  }

  const settings = {
    ratingMin: rec.ratingMin,
    ratingMax: rec.ratingMax,
    minReviewers: rec.minReviewers,
  };
  for (const choice of choices) {
    const failed: string[] = [];
    let reviewed = false;
    const general = gates.filter((gate) => gate.divisionId === null);
    const own = gates.filter((gate) => gate.divisionId === choice.divisionId);
    for (const [scope, gateList] of [
      [keyOf(choice.applicationId, null), general],
      [keyOf(choice.applicationId, choice.id), own],
    ] as const) {
      for (const gate of gateList) {
        const result = aggregateCriterion(
          (byScope.get(scope) ?? []).filter(
            (row) => row.criterionId === gate.id,
          ),
          settings,
        );
        if (result.gate === 'tidak') failed.push(gate.name);
        if (result.gate === 'ditinjau') reviewed = true;
      }
    }
    if (failed.length > 0) {
      reasons.set(choice.id, `Gugur: ${failed.join(', ')}`);
    } else if (reviewed) {
      reasons.set(choice.id, 'Perlu ditinjau');
    }
  }
  return reasons;
}

function stagesOf(rows: ChoiceRow[], staged: boolean) {
  return deriveChoiceStage(
    rows.map((row) => ({
      id: row.id,
      rank: row.rank,
      status: statusOf(row),
      decision: row.decision,
    })),
    { staged },
  );
}

function groupByApplication(rows: ChoiceRow[]) {
  const map = new Map<string, ChoiceRow[]>();
  for (const row of rows) {
    map.set(row.applicationId, [...(map.get(row.applicationId) ?? []), row]);
  }
  return map;
}

async function undecidedCount(
  db: Queryable,
  recruitmentId: string,
  staged: boolean,
) {
  const rows = await loadChoiceRows(db, recruitmentId);
  let total = 0;
  for (const group of groupByApplication(rows).values()) {
    const stages = stagesOf(group, staged);
    total += group.filter(
      (row) =>
        stages.get(row.id)?.stage === 'aktif' && row.decision === null,
    ).length;
  }
  return total;
}

export const resultsProcedures = {
  /** Rekap penempatan per divisi, status rilis, dan peringatan belum diputuskan. */
  resultsOverview: oprecAssessProcedure
    .input(RecruitmentIdInputSchema)
    .query(async ({ ctx }) => {
      assertResultsAccess(ctx.assess, resultsMode(ctx.recruitment));

      const [divisions, rows] = await Promise.all([
        loadPlacementDivisions(ctx.db, ctx.recruitment.id),
        loadChoiceRows(ctx.db, ctx.recruitment.id),
      ]);

      const accepted = new Map<string, number>();
      const extras = new Map<string, number>();
      const pending = new Map<string, number>();
      let undecided = 0;
      for (const group of groupByApplication(rows).values()) {
        const stages = stagesOf(group, ctx.recruitment.stagedPlacement);
        for (const row of group) {
          const stage = stages.get(row.id)?.stage;
          if (row.decision === 'terima') {
            const target = row.origin === 'closerec' ? extras : accepted;
            target.set(row.divisionId, (target.get(row.divisionId) ?? 0) + 1);
          }
          if (stage === 'aktif' && row.decision === null) {
            pending.set(row.divisionId, (pending.get(row.divisionId) ?? 0) + 1);
            undecided++;
          }
        }
      }

      const state = ctx.recruitment.placementState;
      const released = ctx.recruitment.resultsReleasedAt !== null;
      return {
        name: ctx.recruitment.name,
        maxChoices: ctx.recruitment.maxChoices,
        state,
        released,
        releasedAt: ctx.recruitment.resultsReleasedAt,
        visibleToApplicants: ctx.recruitment.resultsVisibleToApplicants,
        canRelease:
          ctx.assess.isAdmin &&
          !released &&
          state === 'final' &&
          ctx.recruitment.resultsVisibleToApplicants,
        canWithdraw: ctx.assess.isAdmin && released,
        divisions: divisions.map((division) => {
          const done = accepted.get(division.id) ?? 0;
          const extra = extras.get(division.id) ?? 0;
          return {
            id: division.id,
            label: division.label,
            groupLabel: division.groupLabel,
            quota: division.quota,
            accepted: done,
            extras: extra,
            pending: pending.get(division.id) ?? 0,
            remaining:
              division.quota === 0 ? null : division.quota - done,
            overQuota: division.quota > 0 && done > division.quota,
          };
        }),
        warnings: {
          undecided,
          perDivision: divisions
            .map((division) => ({
              divisionId: division.id,
              label: division.label,
              pending: pending.get(division.id) ?? 0,
            }))
            .filter((row) => row.pending > 0),
        },
      };
    }),

  /** Daftar hasil per pendaftar: pilihan, status akhir, dan alasan yang boleh dilihat. */
  resultsList: oprecAssessProcedure
    .input(ResultsListInputSchema)
    .query(async ({ ctx, input }) => {
      assertResultsAccess(ctx.assess, resultsMode(ctx.recruitment));

      if (input.divisionId) {
        const divisions = await loadPlacementDivisions(
          ctx.db,
          ctx.recruitment.id,
        );
        if (!divisions.some((division) => division.id === input.divisionId)) {
          notFound('Divisi itu bukan milik oprec ini.');
        }
      }

      const parts = [eq(application.recruitmentId, ctx.recruitment.id)];
      if (input.search) {
        const like = `%${input.search.replace(/[\\%_]/g, '\\$&')}%`;
        parts.push(
          or(
            ilike(mahasiswa.nama, like),
            ilike(users.name, like),
            sql`${mahasiswa.nim}::text like ${like}`,
          )!,
        );
      }
      if (input.divisionId) {
        parts.push(
          exists(
            sql`(select 1 from ${applicationChoice} where ${applicationChoice.applicationId} = ${application.id} and ${applicationChoice.divisionId} = ${input.divisionId})`,
          ),
        );
      }
      const where = and(...parts)!;
      const seeSensitive = canSeeSensitive(ctx.assess);

      const [rows, [totalRow]] = await Promise.all([
        ctx.db
          .select({
            id: application.id,
            name: displayName,
            nim: mahasiswa.nim,
            prodi: mahasiswa.jurusan,
            angkatan: mahasiswa.angkatan,
            waveLabel: recruitmentWave.label,
            source: application.source,
            submittedAt: application.submittedAt,
          })
          .from(application)
          .innerJoin(users, eq(users.id, application.userId))
          .leftJoin(mahasiswa, eq(mahasiswa.userId, application.userId))
          .leftJoin(
            recruitmentWave,
            eq(recruitmentWave.id, application.waveId),
          )
          .where(where)
          .orderBy(asc(displayName), asc(application.id))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db
          .select({ n: count() })
          .from(application)
          .innerJoin(users, eq(users.id, application.userId))
          .leftJoin(mahasiswa, eq(mahasiswa.userId, application.userId))
          .where(where),
      ]);

      const choices = groupByApplication(
        await loadChoiceRows(
          ctx.db,
          ctx.recruitment.id,
          rows.map((row) => row.id),
        ),
      );
      const gateReasons = await gateReasonsFor(
        ctx.db,
        ctx.recruitment,
        [...choices.values()].flat(),
      );

      return {
        total: totalRow?.n ?? 0,
        page: input.page,
        pageSize: input.pageSize,
        rows: rows.map((row) => {
          const own = choices.get(row.id) ?? [];
          const stages = stagesOf(own, ctx.recruitment.stagedPlacement);
          const accepted = own.find((choice) => choice.decision === 'terima');
          const hasPending = own.some(
            (choice) =>
              stages.get(choice.id)?.stage === 'aktif' &&
              choice.decision === null,
          );
          return {
            ...row,
            finalStatus: finalStatus(accepted !== undefined, hasPending),
            acceptedDivisionId: accepted?.divisionId ?? null,
            acceptedLabel: accepted?.label ?? null,
            acceptedAt: accepted?.decidedAt ?? null,
            choices: own.map((choice) => {
              const stage = stages.get(choice.id);
              const visibleOverride =
                choice.overrideReason !== null &&
                (!choice.overrideSensitive || seeSensitive);
              return {
                id: choice.id,
                divisionId: choice.divisionId,
                label: choice.label,
                rank: choice.rank,
                origin: choice.origin,
                status: statusOf(choice),
                decision: choice.decision,
                tag: choice.tag,
                decidedAt: choice.decidedAt,
                stage: stage?.stage ?? null,
                reason: visibleOverride
                  ? choice.overrideReason
                  : (gateReasons.get(choice.id) ??
                    fallbackReason(statusOf(choice))),
              };
            }),
          };
        }),
      };
    }),

  /** Rilis hasil ke pendaftar; hanya admin, hanya setelah final, hanya bila S21 aktif. */
  resultsRelease: oprecAssessProcedure
    .input(RecruitmentIdInputSchema)
    .mutation(async ({ ctx }) => {
      if (!ctx.assess.isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Hanya admin oprec yang boleh merilis hasil.',
        });
      }
      return ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(recruitment)
          .where(eq(recruitment.id, ctx.recruitment.id))
          .for('update');
        if (!row) notFound('Oprec tidak ditemukan.');
        if (row.placementState !== 'final') {
          conflict('Tetapkan penempatan final sebelum merilis hasil.');
        }
        if (!row.resultsVisibleToApplicants) {
          conflict(
            'Pendaftar tidak memilih menerima hasil lewat Anmategra saat pengaturan.',
          );
        }
        if (row.resultsReleasedAt !== null) {
          conflict('Hasil sudah dirilis.');
        }
        const undecided = await undecidedCount(tx, row.id, row.stagedPlacement);
        const releasedAt = new Date();
        await tx
          .update(recruitment)
          .set({ resultsReleasedAt: releasedAt })
          .where(eq(recruitment.id, row.id));
        await logAction(tx, {
          recruitmentId: row.id,
          actorId: ctx.session.user.id,
          action: 'hasil_dirilis',
          entityType: 'recruitment',
          entityId: row.id,
          detail: { undecided },
        });
        return { releasedAt, undecided };
      });
    }),

  /** Tarik rilis hasil; alasan wajib dan dicatat. */
  resultsWithdraw: oprecAssessProcedure
    .input(ResultsWithdrawInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.assess.isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Hanya admin oprec yang boleh menarik rilis hasil.',
        });
      }
      return ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(recruitment)
          .where(eq(recruitment.id, ctx.recruitment.id))
          .for('update');
        if (!row) notFound('Oprec tidak ditemukan.');
        if (row.resultsReleasedAt === null) {
          conflict('Hasil belum dirilis.');
        }
        await tx
          .update(recruitment)
          .set({ resultsReleasedAt: null })
          .where(eq(recruitment.id, row.id));
        await logAction(tx, {
          recruitmentId: row.id,
          actorId: ctx.session.user.id,
          action: 'hasil_ditarik',
          entityType: 'recruitment',
          entityId: row.id,
          detail: { reason: input.reason },
        });
        return { success: true };
      });
    }),

  /** Hasil untuk pendaftar sendiri; tidak pernah memuat nilai, alasan, atau perbandingan. */
  myResult: protectedProcedure
    .input(RecruitmentIdInputSchema)
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          id: recruitment.id,
          visible: recruitment.resultsVisibleToApplicants,
          releasedAt: recruitment.resultsReleasedAt,
        })
        .from(recruitment)
        .where(eq(recruitment.id, input.recruitmentId));
      if (!row) notFound('Oprec tidak ditemukan.');

      const [mine] = await ctx.db
        .select({ id: application.id })
        .from(application)
        .where(
          and(
            eq(application.recruitmentId, row.id),
            eq(application.userId, ctx.session.user.id),
          ),
        );
      if (!mine) notFound('Kamu tidak mendaftar di oprec ini.');

      if (!row.visible || row.releasedAt === null) {
        return { released: false as const };
      }

      const accepted = await ctx.db
        .select({ label: organizationUnit.name })
        .from(placementDecision)
        .innerJoin(
          applicationChoice,
          eq(applicationChoice.id, placementDecision.choiceId),
        )
        .innerJoin(
          recruitmentDivision,
          eq(recruitmentDivision.id, applicationChoice.divisionId),
        )
        .innerJoin(
          organizationUnit,
          eq(organizationUnit.id, recruitmentDivision.unitId),
        )
        .where(
          and(
            eq(applicationChoice.applicationId, mine.id),
            eq(placementDecision.decision, 'terima'),
          ),
        )
        .limit(1);

      return {
        released: true as const,
        accepted: accepted.length > 0,
        divisionLabel: accepted[0]?.label ?? null,
        releasedAt: row.releasedAt,
      };
    }),

  /** Catat ekspor hasil (aksi `hasil_diekspor`) setelah berkas dibentuk. */
  resultsLogExport: oprecAssessProcedure
    .input(ResultsLogExportInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertResultsAccess(ctx.assess, resultsMode(ctx.recruitment));
      await logAction(ctx.db, {
        recruitmentId: ctx.recruitment.id,
        actorId: ctx.session.user.id,
        action: 'hasil_diekspor',
        entityType: 'recruitment',
        entityId: ctx.recruitment.id,
        detail: { format: input.format },
      });
      return { success: true };
    }),
};
