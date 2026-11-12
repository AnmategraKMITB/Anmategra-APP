import { TRPCError } from '@trpc/server';
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import {
  type Decision,
  deriveChoiceStage,
  planAutofill,
} from '~/lib/oprec/allocation';
import { effectiveStatus } from '~/lib/oprec/scoring';
import { oprecAssessProcedure } from '~/server/api/trpc';
import {
  application,
  applicationChoice,
  choiceStatusOverride,
  mahasiswa,
  organizationPosition,
  organizationUnit,
  placement,
  placementDecision,
  recruitment,
  recruitmentDivision,
  recruitmentLog,
  recruitmentVisibilityOverride,
  recruitmentWave,
  transferRequest,
  users,
  type DecisionTag,
} from '~/server/db/schema';

import {
  type AssessAccess,
  canDecideDivision,
  canSeeSensitive,
} from './assess-access';
import { type Tx } from '../form/services';
import { logAction } from './log';
import { type Queryable, conflict, notFound, pgCode } from './services';

const id = z.string().min(1);

type Status = Parameters<typeof effectiveStatus>[0];

export type PlacementDivision = {
  id: string;
  label: string;
  groupLabel: string | null;
  quota: number;
  positionId: string;
  sortOrder: number;
};

/** Divisi oprec beserta kuota posisinya. 0 = tanpa batas. */
export async function loadPlacementDivisions(
  db: Queryable,
  recruitmentId: string,
): Promise<PlacementDivision[]> {
  const parent = alias(organizationUnit, 'placement_parent_unit');
  const rows = await db
    .select({
      id: recruitmentDivision.id,
      label: organizationUnit.name,
      groupLabel: parent.name,
      quota: organizationPosition.quota,
      positionId: recruitmentDivision.positionId,
      sortOrder: recruitmentDivision.sortOrder,
    })
    .from(recruitmentDivision)
    .innerJoin(
      organizationUnit,
      eq(organizationUnit.id, recruitmentDivision.unitId),
    )
    .leftJoin(parent, eq(parent.id, organizationUnit.parent_id))
    .innerJoin(
      organizationPosition,
      eq(organizationPosition.id, recruitmentDivision.positionId),
    )
    .where(eq(recruitmentDivision.recruitmentId, recruitmentId))
    .orderBy(asc(recruitmentDivision.sortOrder));
  return rows;
}

function assertAdmin(access: AssessAccess) {
  if (!access.isAdmin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Hanya admin oprec yang boleh melakukan tindakan ini.',
    });
  }
}

function assertDecider(access: AssessAccess, divisionId: string) {
  if (!canDecideDivision(access, divisionId)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Kamu tidak memegang keputusan untuk divisi itu.',
    });
  }
}

const NOT_FINAL = 'Penempatan sudah final.';

/** Pilihan beserta status efektif dan keputusannya. */
type ChoiceRow = {
  id: string;
  applicationId: string;
  rank: number | null;
  origin: string;
  divisionId: string;
  divisionLabel: string;
  score: number | null;
  status: Status;
  overridden: boolean;
  overrideReason: string | null;
  decision: Decision | null;
  tag: string | null;
  decisionReason: string | null;
  overQuotaConfirmed: boolean;
};

async function loadChoices(
  db: Queryable,
  applicationIds: string[],
  canSeeSensitive: boolean,
): Promise<Map<string, ChoiceRow[]>> {
  const byApp = new Map<string, ChoiceRow[]>();
  if (applicationIds.length === 0) return byApp;

  const rows = await db
    .select({
      id: applicationChoice.id,
      applicationId: applicationChoice.applicationId,
      rank: applicationChoice.rank,
      origin: applicationChoice.origin,
      divisionId: applicationChoice.divisionId,
      divisionLabel: organizationUnit.name,
      score: applicationChoice.score,
      computedStatus: applicationChoice.computedStatus,
    })
    .from(applicationChoice)
    .innerJoin(
      recruitmentDivision,
      eq(recruitmentDivision.id, applicationChoice.divisionId),
    )
    .innerJoin(
      organizationUnit,
      eq(organizationUnit.id, recruitmentDivision.unitId),
    )
    .where(inArray(applicationChoice.applicationId, applicationIds))
    .orderBy(asc(applicationChoice.rank), asc(organizationUnit.name));

  const choiceIds = rows.map((row) => row.id);
  if (choiceIds.length === 0) return byApp;

  const [overrides, decisions] = await Promise.all([
    db
      .select()
      .from(choiceStatusOverride)
      .where(
        and(
          inArray(choiceStatusOverride.choiceId, choiceIds),
          isNull(choiceStatusOverride.clearedAt),
        ),
      ),
    db
      .select()
      .from(placementDecision)
      .where(inArray(placementDecision.choiceId, choiceIds)),
  ]);
  const overrideOf = new Map(overrides.map((row) => [row.choiceId, row]));
  const decisionOf = new Map(decisions.map((row) => [row.choiceId, row]));

  for (const row of rows) {
    const override = overrideOf.get(row.id) ?? null;
    const score = row.score === null ? null : Number(row.score);
    const decision = decisionOf.get(row.id) ?? null;
    byApp.set(row.applicationId, [
      ...(byApp.get(row.applicationId) ?? []),
      {
        id: row.id,
        applicationId: row.applicationId,
        rank: row.rank,
        origin: row.origin,
        divisionId: row.divisionId,
        divisionLabel: row.divisionLabel,
        score,
        status: effectiveStatus(
          row.computedStatus,
          override
            ? {
                status: override.status,
                computedStatusAtOverride: override.computedStatusAtOverride,
                scoreAtOverride:
                  override.scoreAtOverride === null
                    ? null
                    : Number(override.scoreAtOverride),
              }
            : null,
        ),
        overridden: override !== null,
        overrideReason:
          override && (!override.isSensitive || canSeeSensitive)
            ? override.reason
            : null,
        decision: (decision?.decision as Decision | undefined) ?? null,
        tag: decision?.tag ?? null,
        decisionReason: decision?.reason ?? null,
        overQuotaConfirmed: decision?.overQuotaConfirmed ?? false,
      },
    ]);
  }
  return byApp;
}

function stageMapOf(choices: ChoiceRow[], staged: boolean) {
  return deriveChoiceStage(
    choices.map((choice) => ({
      id: choice.id,
      rank: choice.rank,
      status: choice.status,
      decision: choice.decision,
    })),
    { staged },
  );
}

async function acceptedByDivision(
  db: Queryable,
  recruitmentId: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      divisionId: applicationChoice.divisionId,
      origin: applicationChoice.origin,
      decision: placementDecision.decision,
    })
    .from(placementDecision)
    .innerJoin(
      applicationChoice,
      eq(applicationChoice.id, placementDecision.choiceId),
    )
    .innerJoin(
      recruitmentDivision,
      eq(recruitmentDivision.id, applicationChoice.divisionId),
    )
    .where(
      and(
        eq(recruitmentDivision.recruitmentId, recruitmentId),
        eq(placementDecision.decision, 'terima'),
      ),
    );
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.origin === 'closerec') continue;
    map.set(row.divisionId, (map.get(row.divisionId) ?? 0) + 1);
  }
  return map;
}

const displayName = sql<
  string | null
>`coalesce(${mahasiswa.nama}, ${users.name})`;

async function openTransferRows(db: Queryable, recruitmentId: string) {
  const fromUnit = alias(organizationUnit, 'transfer_from_unit');
  const toUnit = alias(organizationUnit, 'transfer_to_unit');
  const fromDivision = alias(recruitmentDivision, 'transfer_from_division');
  const toDivision = alias(recruitmentDivision, 'transfer_to_division');
  return db
    .select({
      id: transferRequest.id,
      applicationId: transferRequest.applicationId,
      fromDivisionId: transferRequest.fromDivisionId,
      fromLabel: fromUnit.name,
      toDivisionId: transferRequest.toDivisionId,
      toLabel: toUnit.name,
      reason: transferRequest.reason,
      status: transferRequest.status,
      requestedAt: transferRequest.created_at,
      name: displayName,
      nim: mahasiswa.nim,
    })
    .from(transferRequest)
    .innerJoin(application, eq(application.id, transferRequest.applicationId))
    .innerJoin(users, eq(users.id, application.userId))
    .leftJoin(mahasiswa, eq(mahasiswa.userId, users.id))
    .innerJoin(
      fromDivision,
      eq(fromDivision.id, transferRequest.fromDivisionId),
    )
    .innerJoin(fromUnit, eq(fromUnit.id, fromDivision.unitId))
    .innerJoin(toDivision, eq(toDivision.id, transferRequest.toDivisionId))
    .innerJoin(toUnit, eq(toUnit.id, toDivision.unitId))
    .where(
      and(
        eq(transferRequest.recruitmentId, recruitmentId),
        eq(transferRequest.status, 'diminta'),
      ),
    )
    .orderBy(asc(transferRequest.created_at));
}

/** Pindahkan penerimaan ke divisi lain, dipakai pindah langsung dan persetujuan. */
async function moveAcceptance(
  tx: Tx,
  args: {
    recruitmentId: string;
    applicationId: string;
    userId: string;
    fromDivisionId: string;
    to: PlacementDivision;
    actorId: string;
    reason: string;
    tag: 'pindahan' | 'di_luar_pilihan';
  },
) {
  const existing = await tx
    .select({
      id: applicationChoice.id,
      divisionId: applicationChoice.divisionId,
    })
    .from(applicationChoice)
    .where(eq(applicationChoice.applicationId, args.applicationId));
  let target = existing.find((row) => row.divisionId === args.to.id);

  if (!target) {
    const [created] = await tx
      .insert(applicationChoice)
      .values({
        applicationId: args.applicationId,
        divisionId: args.to.id,
        rank: null,
        origin: 'dialihkan',
      })
      .returning({ id: applicationChoice.id });
    target = { id: created!.id, divisionId: args.to.id };
  }

  const fromChoice = existing.find(
    (row) => row.divisionId === args.fromDivisionId,
  );
  if (fromChoice) {
    await tx
      .update(placementDecision)
      .set({
        decision: 'tolak',
        tag: null,
        reason: args.reason,
        overQuotaConfirmed: false,
      })
      .where(eq(placementDecision.choiceId, fromChoice.id));
    await tx
      .delete(placement)
      .where(eq(placement.applicationChoiceId, fromChoice.id));
  }

  await tx
    .insert(placementDecision)
    .values({
      choiceId: target.id,
      decision: 'terima',
      decidedBy: args.actorId,
      tag: args.tag,
      reason: args.reason,
    })
    .onConflictDoUpdate({
      target: placementDecision.choiceId,
      set: {
        decision: 'terima',
        decidedBy: args.actorId,
        tag: args.tag,
        reason: args.reason,
        overQuotaConfirmed: false,
      },
    });

  const [existingPlacement] = await tx
    .select({ id: placement.id })
    .from(placement)
    .where(
      and(
        eq(placement.positionId, args.to.positionId),
        eq(placement.userId, args.userId),
      ),
    );
  if (existingPlacement) {
    conflict(
      'Orang ini sudah menempati posisi tujuan di organogram periode ini.',
    );
  }
  await tx.insert(placement).values({
    positionId: args.to.positionId,
    userId: args.userId,
    source: 'oprec',
    applicationChoiceId: target.id,
    createdBy: args.actorId,
    note: args.reason,
  });

  await tx
    .update(transferRequest)
    .set({
      status: 'dibatalkan',
      resolvedBy: args.actorId,
      resolvedAt: new Date(),
      resolutionNote: 'Dipindahkan lewat jalur lain.',
    })
    .where(
      and(
        eq(transferRequest.applicationId, args.applicationId),
        eq(transferRequest.status, 'diminta'),
      ),
    );

  return target.id;
}

const PlacementIdInput = z.object({ recruitmentId: id });

export const placementProcedures = {
  placementOverview: oprecAssessProcedure
    .input(PlacementIdInput)
    .query(async ({ ctx }) => {
      const access = ctx.assess;
      if (!access.isAdmin && access.deciderDivisionIds.size === 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Hanya pengambil keputusan yang boleh membuka penempatan.',
        });
      }
      const divisions = await loadPlacementDivisions(
        ctx.db,
        ctx.recruitment.id,
      );
      const allowed = access.isAdmin
        ? divisions
        : divisions.filter((division) =>
            access.deciderDivisionIds.has(division.id),
          );
      const [acceptedMap, choiceRows] = await Promise.all([
        acceptedByDivision(ctx.db, ctx.recruitment.id),
        ctx.db
          .select({
            id: applicationChoice.id,
            applicationId: applicationChoice.applicationId,
            divisionId: applicationChoice.divisionId,
            rank: applicationChoice.rank,
            origin: applicationChoice.origin,
            status: applicationChoice.computedStatus,
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
          .where(eq(recruitmentDivision.recruitmentId, ctx.recruitment.id)),
      ]);

      const byApplication = new Map<string, typeof choiceRows>();
      for (const row of choiceRows) {
        byApplication.set(row.applicationId, [
          ...(byApplication.get(row.applicationId) ?? []),
          row,
        ]);
      }
      const waiting = new Map<string, number>();
      const pending = new Map<string, number>();
      const rankStats = new Map<
        string,
        Map<number, { total: number; pending: number; done: number }>
      >();
      for (const rows of byApplication.values()) {
        const stages = deriveChoiceStage(
          rows.map((row) => ({
            id: row.id,
            rank: row.rank,
            status: effectiveStatus(
              row.status as Status,
              row.overrideStatus === null
                ? null
                : {
                    status: row.overrideStatus,
                    computedStatusAtOverride: null,
                    scoreAtOverride: null,
                  },
            ),
            decision: (row.decision as Decision | null) ?? null,
          })),
          { staged: ctx.recruitment.stagedPlacement },
        );
        for (const row of rows) {
          const stage = stages.get(row.id)?.stage;
          if (stage === 'menunggu') {
            waiting.set(row.divisionId, (waiting.get(row.divisionId) ?? 0) + 1);
          }
          if (stage === 'aktif' && row.decision === null) {
            pending.set(row.divisionId, (pending.get(row.divisionId) ?? 0) + 1);
          }
          if (row.rank !== null) {
            const perRank =
              rankStats.get(row.divisionId) ??
              new Map<number, { total: number; pending: number; done: number }>();
            const stat = perRank.get(row.rank) ?? {
              total: 0,
              pending: 0,
              done: 0,
            };
            stat.total += 1;
            if (stage === 'aktif' && row.decision === null) stat.pending += 1;
            else if (row.decision !== null || stage === 'tertutup') {
              stat.done += 1;
            }
            perRank.set(row.rank, stat);
            rankStats.set(row.divisionId, perRank);
          }
        }
      }

      const blockers = await openTransferRows(ctx.db, ctx.recruitment.id);
      const state = ctx.recruitment.placementState;

      return {
        name: ctx.recruitment.name,
        maxChoices: ctx.recruitment.maxChoices,
        isAdmin: access.isAdmin,
        state,
        canFinalize:
          access.isAdmin && state === 'masa_banding' && blockers.length === 0,
        blockers: access.isAdmin
          ? blockers.map((row) => ({
              id: row.id,
              name: row.name,
              fromLabel: row.fromLabel,
              toLabel: row.toLabel,
            }))
          : [],
        divisions: allowed.map((division) => {
          const accepted = acceptedMap.get(division.id) ?? 0;
          const perRank =
            rankStats.get(division.id) ??
            new Map<number, { total: number; pending: number; done: number }>();
          return {
            id: division.id,
            label: division.label,
            groupLabel: division.groupLabel,
            quota: division.quota,
            accepted,
            remaining:
              division.quota === 0 ? null : division.quota - accepted,
            overQuota: division.quota > 0 && accepted > division.quota,
            waiting: waiting.get(division.id) ?? 0,
            pending: pending.get(division.id) ?? 0,
            canDecide: canDecideDivision(access, division.id),
            ranks: [...perRank.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([rank, stat]) => ({ rank, ...stat })),
          };
        }),
        divisionOptions: divisions.map((division) => ({
          id: division.id,
          label: division.label,
          groupLabel: division.groupLabel,
        })),
        visibility: access.isAdmin
          ? null
          : {
              visibleTargetIds: await visibleTargetIds(
                ctx.db,
                ctx.recruitment.id,
                ctx.recruitment.visibilityDefault,
                [...access.deciderDivisionIds],
              ),
            },
      };
    }),

  placementRows: oprecAssessProcedure
    .input(
      z.object({
        recruitmentId: id,
        divisionId: id,
        rank: z.number().int().min(1).optional(),
        search: z.string().trim().max(120).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      assertDecider(ctx.assess, input.divisionId);
      const divisions = await loadPlacementDivisions(
        ctx.db,
        ctx.recruitment.id,
      );
      const division = divisions.find((row) => row.id === input.divisionId);
      if (!division) notFound('Divisi itu bukan milik oprec ini.');

      const parts = [
        eq(application.recruitmentId, ctx.recruitment.id),
        exists(
          sql`(select 1 from ${applicationChoice} where ${applicationChoice.applicationId} = ${application.id} and ${applicationChoice.divisionId} = ${input.divisionId}${input.rank === undefined ? sql`` : sql` and ${applicationChoice.rank} = ${input.rank}`})`,
        ),
      ];
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
      const where = and(...parts);

      const [{ total } = { total: 0 }] = await ctx.db
        .select({ total: count() })
        .from(application)
        .innerJoin(users, eq(users.id, application.userId))
        .leftJoin(mahasiswa, eq(mahasiswa.userId, users.id))
        .where(where);

      const pageRows = await ctx.db
        .select({
          id: application.id,
          userId: application.userId,
          name: displayName,
          nim: mahasiswa.nim,
          prodi: mahasiswa.jurusan,
          angkatan: mahasiswa.angkatan,
          source: application.source,
          willingToMove: application.willingToMove,
          submittedAt: application.submittedAt,
          waveLabel: recruitmentWave.label,
        })
        .from(application)
        .innerJoin(users, eq(users.id, application.userId))
        .leftJoin(mahasiswa, eq(mahasiswa.userId, users.id))
        .leftJoin(recruitmentWave, eq(recruitmentWave.id, application.waveId))
        .where(where)
        .orderBy(asc(displayName), asc(application.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      const choicesByApp = await loadChoices(
        ctx.db,
        pageRows.map((row) => row.id),
        canSeeSensitive(ctx.assess),
      );

      return {
        total,
        page: input.page,
        pageSize: input.pageSize,
        division: {
          id: division.id,
          label: division.label,
          quota: division.quota,
        },
        rows: pageRows.map((row) => {
          const choices = choicesByApp.get(row.id) ?? [];
          const stages = stageMapOf(choices, ctx.recruitment.stagedPlacement);
          const accepted = choices.find((choice) => choice.decision === 'terima');
          return {
            id: row.id,
            name: row.name,
            nim: row.nim,
            prodi: row.prodi,
            angkatan: row.angkatan,
            source: row.source,
            willingToMove: row.willingToMove,
            submittedAt: row.submittedAt,
            waveLabel: row.waveLabel,
            acceptedElsewhere:
              accepted !== undefined && accepted.divisionId !== input.divisionId,
            choices: choices.map((choice) => {
              const stage = stages.get(choice.id);
              return {
                id: choice.id,
                rank: choice.rank,
                origin: choice.origin,
                divisionId: choice.divisionId,
                label: choice.divisionLabel,
                score: choice.score,
                status: choice.status,
                overridden: choice.overridden,
                overrideReason: choice.overrideReason,
                stage: stage?.stage ?? 'tertutup',
                stageReason: stage?.reason ?? 'tidak_lolos',
                decision: choice.decision,
                tag: choice.tag,
                reason: choice.decisionReason,
                overQuotaConfirmed: choice.overQuotaConfirmed,
              };
            }),
          };
        }),
      };
    }),

  decide: oprecAssessProcedure
    .input(
      z.object({
        recruitmentId: id,
        choiceId: id,
        decision: z.enum(['terima', 'tolak']),
        reason: z.string().trim().max(2000).optional(),
        confirmOverQuota: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.recruitment.placementState === 'final') {
        throw new TRPCError({ code: 'FORBIDDEN', message: NOT_FINAL });
      }
      return ctx.db.transaction(async (tx) => {
        const [locked] = await tx
          .select({ id: recruitment.id })
          .from(recruitment)
          .where(eq(recruitment.id, ctx.recruitment.id))
          .for('update');
        if (!locked) notFound('Oprec tidak ditemukan.');

        const loaded = await loadChoiceForDecision(tx, ctx.recruitment.id, input.choiceId);
        assertDecider(ctx.assess, loaded.division.id);
        const stages = deriveChoiceStage(
          loaded.siblings.map((choice) => ({
            id: choice.id,
            rank: choice.rank,
            status: choice.status,
            decision: choice.decision,
          })),
          { staged: ctx.recruitment.stagedPlacement },
        );
        const stage = stages.get(input.choiceId)?.stage ?? 'tertutup';
        if (stage === 'tertutup') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'Pilihan ini sudah tertutup: sebelumnya sudah ada keputusan terima atau pilihan ini sudah ditolak.',
          });
        }
        if (stage !== 'aktif') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'Pilihan ini masih menunggu pilihan sebelumnya diputuskan.',
          });
        }

        const existingAccepted =
          loaded.decision?.decision === 'terima' &&
          loaded.decision.choiceId === input.choiceId;
        let overQuotaConfirmed = false;
        if (input.decision === 'terima' && !existingAccepted) {
          const accepted = await countAcceptedForDivision(
            tx,
            ctx.recruitment.id,
            loaded.division.id,
            input.choiceId,
          );
          if (
            loaded.division.quota > 0 &&
            accepted >= loaded.division.quota &&
            !input.confirmOverQuota
          ) {
            return {
              success: false,
              needsQuotaConfirm: true,
              accepted,
              quota: loaded.division.quota,
            } as const;
          }
          overQuotaConfirmed =
            loaded.division.quota > 0 && accepted >= loaded.division.quota;
        }

        if (input.decision === 'terima') {
          await tx
            .delete(placement)
            .where(
              inArray(
                placement.applicationChoiceId,
                loaded.siblings.map((choice) => choice.id),
              ),
            );
          try {
            await tx.insert(placement).values({
              positionId: loaded.division.positionId,
              userId: loaded.userId,
              source: 'oprec',
              applicationChoiceId: input.choiceId,
              createdBy: ctx.session.user.id,
              note: input.reason ?? null,
            });
          } catch (error) {
            if (pgCode(error) === '23505') {
              conflict(
                'Orang ini sudah menempati posisi tersebut di organogram periode ini.',
              );
            }
            throw error;
          }
        } else {
          await tx
            .delete(placement)
            .where(eq(placement.applicationChoiceId, input.choiceId));
        }

        await tx
          .insert(placementDecision)
          .values({
            choiceId: input.choiceId,
            decision: input.decision,
            decidedBy: ctx.session.user.id,
            reason: input.reason ?? null,
            overQuotaConfirmed,
          })
          .onConflictDoUpdate({
            target: placementDecision.choiceId,
            set: {
              decision: input.decision,
              decidedBy: ctx.session.user.id,
              reason: input.reason ?? null,
              tag: null,
              overQuotaConfirmed,
            },
          });

        await logAction(tx, {
          recruitmentId: ctx.recruitment.id,
          actorId: ctx.session.user.id,
          action: 'keputusan_penempatan',
          entityType: 'application',
          entityId: loaded.applicationId,
          detail: {
            choiceId: input.choiceId,
            divisionId: loaded.division.id,
            decision: input.decision,
            overQuota: overQuotaConfirmed,
          },
        });

        return {
          success: true,
          needsQuotaConfirm: false,
          accepted: 0,
          quota: loaded.division.quota,
        } as const;
      });
    }),

  autofillPreview: oprecAssessProcedure
    .input(PlacementIdInput)
    .query(async ({ ctx }) => {
      const [tolakPlan, masukPlan] = await Promise.all([
        buildAutofillPlan(
          ctx.db,
          ctx.recruitment.id,
          'tolak',
          ctx.recruitment.stagedPlacement,
        ),
        buildAutofillPlan(
          ctx.db,
          ctx.recruitment.id,
          'masukkan',
          ctx.recruitment.stagedPlacement,
        ),
      ]);
      const allowed = allowedDivisions(ctx.assess, await loadPlacementDivisions(ctx.db, ctx.recruitment.id));
      const masukCount = new Map(
        masukPlan.perDivision.map((row) => [row.divisionId, row.terima]),
      );
      const divisions = tolakPlan.perDivision
        .filter((row) => allowed.has(row.divisionId))
        .map((row) => {
          const extra = Math.max(0, (masukCount.get(row.divisionId) ?? 0) - row.terima);
          return {
            divisionId: row.divisionId,
            label: tolakPlan.labelOf(row.divisionId),
            quota: tolakPlan.quotaOf(row.divisionId),
            remaining: row.remaining,
            terima: row.terima,
            tolak: row.tolak,
            dilewati: row.dilewati,
            over: extra,
          };
        });
      return {
        divisions,
        totals: {
          terima: divisions.reduce((sum, row) => sum + row.terima, 0),
          tolak: divisions.reduce((sum, row) => sum + row.tolak, 0),
          dilewati: divisions.reduce((sum, row) => sum + row.dilewati, 0),
          over: divisions.reduce((sum, row) => sum + row.over, 0),
        },
      };
    }),

  autofillCommit: oprecAssessProcedure
    .input(
      z.object({
        recruitmentId: id,
        overQuota: z.enum(['masukkan', 'tolak']).default('tolak'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.recruitment.placementState === 'final') {
        throw new TRPCError({ code: 'FORBIDDEN', message: NOT_FINAL });
      }
      return ctx.db.transaction(async (tx) => {
        const [locked] = await tx
          .select({ id: recruitment.id })
          .from(recruitment)
          .where(eq(recruitment.id, ctx.recruitment.id))
          .for('update');
        if (!locked) notFound('Oprec tidak ditemukan.');

        const divisions = await loadPlacementDivisions(tx, ctx.recruitment.id);
        const allowed = allowedDivisions(ctx.assess, divisions);
        const plan = await buildAutofillPlan(
          tx,
          ctx.recruitment.id,
          input.overQuota,
          ctx.recruitment.stagedPlacement,
        );
        const targets = [...plan.terima, ...plan.tolak].filter((choiceId) =>
          allowed.has(plan.divisionOf(choiceId)),
        );
        if (targets.length === 0) return { applied: 0, overQuotaApplied: 0 };

        const rows = await tx
          .select({
            id: applicationChoice.id,
            applicationId: applicationChoice.applicationId,
            divisionId: applicationChoice.divisionId,
            userId: application.userId,
          })
          .from(applicationChoice)
          .innerJoin(
            application,
            eq(application.id, applicationChoice.applicationId),
          )
          .where(inArray(applicationChoice.id, targets));
        const applicationIds = [...new Set(rows.map((row) => row.applicationId))];
        const allChoices = await tx
          .select({ id: applicationChoice.id, applicationId: applicationChoice.applicationId })
          .from(applicationChoice)
          .where(inArray(applicationChoice.applicationId, applicationIds));
        const siblingsOf = new Map<string, string[]>();
        for (const choice of allChoices) {
          siblingsOf.set(choice.applicationId, [
            ...(siblingsOf.get(choice.applicationId) ?? []),
            choice.id,
          ]);
        }
        const divisionOf = new Map(divisions.map((row) => [row.id, row]));
        const acceptedMap = await acceptedByDivision(tx, ctx.recruitment.id);
        const terimaSet = new Set(plan.terima);

        for (const row of rows) {
          const division = divisionOf.get(row.divisionId);
          if (!division) continue;
          const decision: Decision = terimaSet.has(row.id) ? 'terima' : 'tolak';
          const accepted = acceptedMap.get(division.id) ?? 0;
          const over =
            decision === 'terima' && division.quota > 0 && accepted >= division.quota;
          await writeDecision(tx, {
            choiceId: row.id,
            applicationId: row.applicationId,
            userId: row.userId,
            division,
            decision,
            actorId: ctx.session.user.id,
            overQuotaConfirmed: over,
            siblingChoiceIds: siblingsOf.get(row.applicationId) ?? [row.id],
          });
          if (decision === 'terima') {
            acceptedMap.set(division.id, accepted + 1);
          }
        }

        await logAction(tx, {
          recruitmentId: ctx.recruitment.id,
          actorId: ctx.session.user.id,
          action: 'penempatan_autofill',
          entityType: 'recruitment',
          entityId: ctx.recruitment.id,
          detail: {
            terima: plan.terima.length,
            tolak: plan.tolak.length,
            overQuota: input.overQuota,
            overQuotaApplied: plan.overQuotaApplied,
          },
        });

        return {
          applied: rows.length,
          overQuotaApplied: plan.overQuotaApplied,
        };
      });
    }),

  setPlacementState: oprecAssessProcedure
    .input(
      z.object({
        recruitmentId: id,
        state: z.enum(['berjalan', 'masa_banding', 'final']),
        resolution: z.enum(['batalkan_semua', 'setujui_semua']).optional(),
        confirmOverQuota: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.assess);
      return ctx.db.transaction(async (tx) => {
        const [rec] = await tx
          .select()
          .from(recruitment)
          .where(eq(recruitment.id, ctx.recruitment.id))
          .for('update');
        if (!rec) notFound('Oprec tidak ditemukan.');
        const current = rec.placementState;
        if (current === input.state) {
          return { success: true, state: current } as const;
        }
        const transitions: Record<typeof current, string[]> = {
          berjalan: ['masa_banding'],
          masa_banding: ['berjalan', 'final'],
          final: ['masa_banding'],
        };
        if (!transitions[current].includes(input.state)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              input.state === 'final'
                ? 'Menuju final harus lewat masa banding.'
                : 'Perpindahan keadaan penempatan itu tidak diizinkan.',
          });
        }

        const open = await openTransferRows(tx, ctx.recruitment.id);
        if (input.state === 'final' && open.length > 0) {
          if (!input.resolution) {
            return {
              success: false,
              needsResolution: true,
              blockers: open.map((row) => ({
                id: row.id,
                name: row.name,
                fromLabel: row.fromLabel,
                toLabel: row.toLabel,
              })),
            } as const;
          }
          if (input.resolution === 'batalkan_semua') {
            await tx
              .update(transferRequest)
              .set({
                status: 'dibatalkan',
                resolvedBy: ctx.session.user.id,
                resolvedAt: new Date(),
                resolutionNote: 'Dibatalkan saat menetapkan final.',
              })
              .where(
                and(
                  eq(transferRequest.recruitmentId, ctx.recruitment.id),
                  eq(transferRequest.status, 'diminta'),
                ),
              );
          } else {
            const divisions = await loadPlacementDivisions(tx, ctx.recruitment.id);
            const divisionOf = new Map(divisions.map((row) => [row.id, row]));
            const acceptedMap = await acceptedByDivision(tx, ctx.recruitment.id);
            const over: {
              requestId: string;
              divisionId: string;
              label: string;
              accepted: number;
              quota: number;
            }[] = [];
            const planned = new Map<string, number>();
            for (const request of open) {
              const target = divisionOf.get(request.toDivisionId);
              if (!target || target.quota === 0) continue;
              const used =
                (acceptedMap.get(target.id) ?? 0) +
                (planned.get(target.id) ?? 0);
              if (used >= target.quota) {
                over.push({
                  requestId: request.id,
                  divisionId: target.id,
                  label: target.label,
                  accepted: used + 1,
                  quota: target.quota,
                });
              }
              planned.set(target.id, (planned.get(target.id) ?? 0) + 1);
            }
            if (over.length > 0 && !input.confirmOverQuota) {
              return {
                success: false,
                needsQuotaConfirm: true,
                overQuota: over,
              } as const;
            }
            for (const request of open) {
              const target = divisionOf.get(request.toDivisionId);
              const [app] = await tx
                .select({ userId: application.userId })
                .from(application)
                .where(eq(application.id, request.applicationId));
              if (!target || !app) continue;
              await moveAcceptance(tx, {
                recruitmentId: ctx.recruitment.id,
                applicationId: request.applicationId,
                userId: app.userId,
                fromDivisionId: request.fromDivisionId,
                to: target,
                actorId: ctx.session.user.id,
                reason: request.reason,
                tag: 'pindahan',
              });
              await tx
                .update(transferRequest)
                .set({
                  status: 'disetujui',
                  resolvedBy: ctx.session.user.id,
                  resolvedAt: new Date(),
                  resolutionNote: 'Disetujui saat menetapkan final.',
                })
                .where(eq(transferRequest.id, request.id));
            }
          }
        }

        if (input.state !== 'masa_banding') {
          await tx
            .update(transferRequest)
            .set({
              status: 'dibatalkan',
              resolvedBy: ctx.session.user.id,
              resolvedAt: new Date(),
              resolutionNote: 'Dibatalkan karena penempatan keluar dari masa banding.',
            })
            .where(
              and(
                eq(transferRequest.recruitmentId, ctx.recruitment.id),
                eq(transferRequest.status, 'diminta'),
              ),
            );
        }

        await tx
          .update(recruitment)
          .set({ placementState: input.state })
          .where(eq(recruitment.id, ctx.recruitment.id));

        await logAction(tx, {
          recruitmentId: ctx.recruitment.id,
          actorId: ctx.session.user.id,
          action: 'tahap_penempatan',
          entityType: 'recruitment',
          entityId: ctx.recruitment.id,
          detail: {
            from: current,
            to: input.state,
            resolution: input.resolution ?? null,
          },
        });

        return { success: true, state: input.state } as const;
      });
    }),

  appealAccept: oprecAssessProcedure
    .input(
      z.object({
        recruitmentId: id,
        choiceId: id,
        reason: z.string().trim().min(1).max(2000),
        confirmOverQuota: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.recruitment.placementState !== 'masa_banding') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Banding hanya dibuka selama masa banding.',
        });
      }
      return ctx.db.transaction(async (tx) => {
        const loaded = await loadChoiceForDecision(
          tx,
          ctx.recruitment.id,
          input.choiceId,
        );
        assertDecider(ctx.assess, loaded.division.id);
        if (
          loaded.decision?.decision !== 'tolak' &&
          loaded.status !== 'tidak_lolos'
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'Hanya pilihan yang sudah ditolak yang bisa diterima lewat banding.',
          });
        }
        const accepted = await countAcceptedForDivision(
          tx,
          ctx.recruitment.id,
          loaded.division.id,
          input.choiceId,
        );
        const over =
          loaded.division.quota > 0 && accepted >= loaded.division.quota;
        if (over && !input.confirmOverQuota) {
          return {
            success: false,
            needsQuotaConfirm: true,
            accepted,
            quota: loaded.division.quota,
          } as const;
        }
        await writeDecision(tx, {
          choiceId: input.choiceId,
          applicationId: loaded.applicationId,
          userId: loaded.userId,
          division: loaded.division,
          decision: 'terima',
          actorId: ctx.session.user.id,
          reason: input.reason,
          tag: 'lewat_banding',
          overQuotaConfirmed: over,
          siblingChoiceIds: loaded.siblings.map((row) => row.id),
        });
        await logAction(tx, {
          recruitmentId: ctx.recruitment.id,
          actorId: ctx.session.user.id,
          action: 'banding_diterima',
          entityType: 'application',
          entityId: loaded.applicationId,
          detail: {
            choiceId: input.choiceId,
            divisionId: loaded.division.id,
            reason: input.reason,
            sensitive: true,
          },
        });
        return { success: true, needsQuotaConfirm: false } as const;
      });
    }),

  directMove: oprecAssessProcedure
    .input(
      z.object({
        recruitmentId: id,
        applicationId: id,
        toDivisionId: id,
        reason: z.string().trim().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.assess);
      if (ctx.recruitment.placementState === 'final') {
        throw new TRPCError({ code: 'FORBIDDEN', message: NOT_FINAL });
      }
      return ctx.db.transaction(async (tx) => {
        const [app] = await tx
          .select({
            userId: application.userId,
            willingToMove: application.willingToMove,
          })
          .from(application)
          .where(
            and(
              eq(application.id, input.applicationId),
              eq(application.recruitmentId, ctx.recruitment.id),
            ),
          )
          .for('update');
        if (!app) notFound('Pendaftar itu bukan milik oprec ini.');
        const choices = (await loadChoices(tx, [input.applicationId], true)).get(
          input.applicationId,
        ) ?? [];
        const accepted = choices.find((choice) => choice.decision === 'terima');
        if (!accepted) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Pendaftar ini belum diterima di divisi mana pun.',
          });
        }
        const divisions = await loadPlacementDivisions(tx, ctx.recruitment.id);
        const target = divisions.find((row) => row.id === input.toDivisionId);
        if (!target) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Divisi tujuan itu bukan milik oprec ini.',
          });
        }
        if (target.id === accepted.divisionId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Pendaftar sudah diterima di divisi itu.',
          });
        }
        const outsideChoices = !choices.some(
          (choice) => choice.divisionId === target.id,
        );
        await moveAcceptance(tx, {
          recruitmentId: ctx.recruitment.id,
          applicationId: input.applicationId,
          userId: app.userId,
          fromDivisionId: accepted.divisionId,
          to: target,
          actorId: ctx.session.user.id,
          reason: input.reason,
          tag: outsideChoices ? 'di_luar_pilihan' : 'pindahan',
        });
        await logAction(tx, {
          recruitmentId: ctx.recruitment.id,
          actorId: ctx.session.user.id,
          action: 'pindah_langsung',
          entityType: 'application',
          entityId: input.applicationId,
          detail: {
            fromDivisionId: accepted.divisionId,
            toDivisionId: target.id,
            outsideChoices,
            reason: input.reason,
            sensitive: true,
          },
        });
        return { success: true } as const;
      });
    }),

  transferRequest: oprecAssessProcedure
    .input(
      z.object({
        recruitmentId: id,
        applicationId: id,
        toDivisionId: id,
        reason: z.string().trim().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.recruitment.placementState !== 'masa_banding') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Permintaan pindah hanya dibuka selama masa banding.',
        });
      }
      return ctx.db.transaction(async (tx) => {
        const choices = (await loadChoices(tx, [input.applicationId], true)).get(
          input.applicationId,
        ) ?? [];
        const accepted = choices.find((choice) => choice.decision === 'terima');
        if (!accepted) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Pendaftar ini belum diterima di divisi mana pun.',
          });
        }
        assertDecider(ctx.assess, accepted.divisionId);
        const divisions = await loadPlacementDivisions(tx, ctx.recruitment.id);
        const target = divisions.find((row) => row.id === input.toDivisionId);
        if (!target) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Divisi tujuan itu bukan milik oprec ini.',
          });
        }
        if (target.id === accepted.divisionId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Divisi tujuan sama dengan divisi asal.',
          });
        }
        const [duplicate] = await tx
          .select({ id: transferRequest.id })
          .from(transferRequest)
          .where(
            and(
              eq(transferRequest.applicationId, input.applicationId),
              eq(transferRequest.status, 'diminta'),
            ),
          );
        if (duplicate) conflict('Sudah ada permintaan pindah yang terbuka.');
        const [row] = await tx
          .insert(transferRequest)
          .values({
            recruitmentId: ctx.recruitment.id,
            applicationId: input.applicationId,
            fromDivisionId: accepted.divisionId,
            toDivisionId: target.id,
            reason: input.reason,
            requestedBy: ctx.session.user.id,
          })
          .returning({ id: transferRequest.id });
        await logAction(tx, {
          recruitmentId: ctx.recruitment.id,
          actorId: ctx.session.user.id,
          action: 'pindah_diminta',
          entityType: 'application',
          entityId: input.applicationId,
          detail: {
            requestId: row!.id,
            fromDivisionId: accepted.divisionId,
            toDivisionId: target.id,
            reason: input.reason,
            sensitive: true,
          },
        });
        return { id: row!.id };
      });
    }),

  transferResolve: oprecAssessProcedure
    .input(
      z.object({
        recruitmentId: id,
        requestId: id,
        resolution: z.enum(['setuju', 'tolak']),
        note: z.string().trim().max(2000).optional(),
        confirmOverQuota: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [request] = await tx
          .select()
          .from(transferRequest)
          .where(
            and(
              eq(transferRequest.id, input.requestId),
              eq(transferRequest.recruitmentId, ctx.recruitment.id),
            ),
          )
          .for('update');
        if (!request) notFound('Permintaan pindah itu tidak ditemukan.');
        if (request.status !== 'diminta') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Permintaan ini sudah diputuskan.',
          });
        }
        assertDecider(ctx.assess, request.toDivisionId);
        if (input.resolution === 'tolak') {
          await tx
            .update(transferRequest)
            .set({
              status: 'ditolak',
              resolvedBy: ctx.session.user.id,
              resolvedAt: new Date(),
              resolutionNote: input.note ?? null,
            })
            .where(eq(transferRequest.id, request.id));
          await logAction(tx, {
            recruitmentId: ctx.recruitment.id,
            actorId: ctx.session.user.id,
            action: 'pindah_diputuskan',
            entityType: 'application',
            entityId: request.applicationId,
            detail: { requestId: request.id, resolution: 'tolak' },
          });
          return { success: true, needsQuotaConfirm: false } as const;
        }

        const divisions = await loadPlacementDivisions(tx, ctx.recruitment.id);
        const target = divisions.find(
          (row) => row.id === request.toDivisionId,
        );
        if (!target) notFound('Divisi tujuan permintaan tidak ditemukan.');
        const [app] = await tx
          .select({ userId: application.userId })
          .from(application)
          .where(eq(application.id, request.applicationId));
        if (!app) notFound('Pendaftar permintaan itu tidak ditemukan.');
        const accepted = await countAcceptedForDivision(
          tx,
          ctx.recruitment.id,
          target.id,
        );
        const over = target.quota > 0 && accepted >= target.quota;
        if (over && !input.confirmOverQuota) {
          return {
            success: false,
            needsQuotaConfirm: true,
            accepted,
            quota: target.quota,
          } as const;
        }

        await moveAcceptance(tx, {
          recruitmentId: ctx.recruitment.id,
          applicationId: request.applicationId,
          userId: app.userId,
          fromDivisionId: request.fromDivisionId,
          to: target,
          actorId: ctx.session.user.id,
          reason: request.reason,
          tag: 'pindahan',
        });
        await tx
          .update(transferRequest)
          .set({
            status: 'disetujui',
            resolvedBy: ctx.session.user.id,
            resolvedAt: new Date(),
            resolutionNote: input.note ?? null,
          })
          .where(eq(transferRequest.id, request.id));
        await logAction(tx, {
          recruitmentId: ctx.recruitment.id,
          actorId: ctx.session.user.id,
          action: 'pindah_diputuskan',
          entityType: 'application',
          entityId: request.applicationId,
          detail: {
            requestId: request.id,
            resolution: 'setuju',
            toDivisionId: target.id,
            overQuota: over,
          },
        });
        return { success: true, needsQuotaConfirm: false } as const;
      });
    }),

  transferCancel: oprecAssessProcedure
    .input(z.object({ recruitmentId: id, requestId: id }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [request] = await tx
          .select()
          .from(transferRequest)
          .where(
            and(
              eq(transferRequest.id, input.requestId),
              eq(transferRequest.recruitmentId, ctx.recruitment.id),
            ),
          );
        if (!request) notFound('Permintaan pindah itu tidak ditemukan.');
        if (request.status !== 'diminta') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Permintaan ini sudah diputuskan.',
          });
        }
        if (
          !ctx.assess.isAdmin &&
          request.requestedBy !== ctx.session.user.id
        ) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await tx
          .update(transferRequest)
          .set({
            status: 'dibatalkan',
            resolvedBy: ctx.session.user.id,
            resolvedAt: new Date(),
          })
          .where(eq(transferRequest.id, request.id));
        await logAction(tx, {
          recruitmentId: ctx.recruitment.id,
          actorId: ctx.session.user.id,
          action: 'pindah_dibatalkan',
          entityType: 'application',
          entityId: request.applicationId,
          detail: { requestId: request.id },
        });
        return { success: true } as const;
      });
    }),

  transferInbox: oprecAssessProcedure
    .input(PlacementIdInput)
    .query(async ({ ctx }) => {
      const rows = await openTransferRows(ctx.db, ctx.recruitment.id);
      return rows
        .filter(
          (row) =>
            ctx.assess.isAdmin ||
            ctx.assess.deciderDivisionIds.has(row.toDivisionId),
        )
        .map((row) => ({
          ...row,
          canResolve:
            ctx.assess.isAdmin ||
            ctx.assess.deciderDivisionIds.has(row.toDivisionId),
          canCancel: ctx.assess.isAdmin,
        }));
    }),

  visibilitySettings: oprecAssessProcedure
    .input(PlacementIdInput)
    .query(async ({ ctx }) => {
      assertAdmin(ctx.assess);
      const divisions = await loadPlacementDivisions(
        ctx.db,
        ctx.recruitment.id,
      );
      const overrides = await ctx.db
        .select({
          viewerDivisionId: recruitmentVisibilityOverride.viewerDivisionId,
          targetDivisionId: recruitmentVisibilityOverride.targetDivisionId,
          allowed: recruitmentVisibilityOverride.allowed,
        })
        .from(recruitmentVisibilityOverride)
        .where(
          eq(recruitmentVisibilityOverride.recruitmentId, ctx.recruitment.id),
        );
      return {
        default: ctx.recruitment.visibilityDefault,
        divisions: divisions.map((division) => ({
          id: division.id,
          label: division.label,
          groupLabel: division.groupLabel,
        })),
        overrides,
      };
    }),

  visibilitySave: oprecAssessProcedure
    .input(
      z.object({
        recruitmentId: id,
        default: z.boolean().optional(),
        overrides: z
          .array(
            z.object({
              viewerDivisionId: id,
              targetDivisionId: id,
              allowed: z.boolean(),
            }),
          )
          .max(400)
          .default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.assess);
      const divisions = await loadPlacementDivisions(ctx.db, ctx.recruitment.id);
      const known = new Set(divisions.map((row) => row.id));
      for (const row of input.overrides) {
        if (
          !known.has(row.viewerDivisionId) ||
          !known.has(row.targetDivisionId)
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ada divisi yang bukan milik oprec ini.',
          });
        }
        if (row.viewerDivisionId === row.targetDivisionId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Pengecualian visibilitas harus antar divisi yang berbeda.',
          });
        }
      }
      return ctx.db.transaction(async (tx) => {
        if (input.default !== undefined) {
          await tx
            .update(recruitment)
            .set({ visibilityDefault: input.default })
            .where(eq(recruitment.id, ctx.recruitment.id));
        }
        await tx
          .delete(recruitmentVisibilityOverride)
          .where(
            eq(
              recruitmentVisibilityOverride.recruitmentId,
              ctx.recruitment.id,
            ),
          );
        if (input.overrides.length > 0) {
          await tx.insert(recruitmentVisibilityOverride).values(
            input.overrides.map((row) => ({
              recruitmentId: ctx.recruitment.id,
              viewerDivisionId: row.viewerDivisionId,
              targetDivisionId: row.targetDivisionId,
              allowed: row.allowed,
            })),
          );
        }
        await logAction(tx, {
          recruitmentId: ctx.recruitment.id,
          actorId: ctx.session.user.id,
          action: 'visibilitas_disimpan',
          entityType: 'recruitment',
          entityId: ctx.recruitment.id,
          detail: {
            default: input.default ?? null,
            overrides: input.overrides.length,
          },
        });
        return { success: true } as const;
      });
    }),

  placementAccepted: oprecAssessProcedure
    .input(z.object({ recruitmentId: id, divisionId: id }))
    .query(async ({ ctx, input }) => {
      const divisions = await loadPlacementDivisions(
        ctx.db,
        ctx.recruitment.id,
      );
      const division = divisions.find((row) => row.id === input.divisionId);
      if (!division) notFound('Divisi itu bukan milik oprec ini.');
      const visible = ctx.assess.isAdmin
        ? true
        : ctx.assess.deciderDivisionIds.has(division.id) ||
          (
            await visibleTargetIds(
              ctx.db,
              ctx.recruitment.id,
              ctx.recruitment.visibilityDefault,
              [...ctx.assess.deciderDivisionIds],
            )
          ).includes(division.id);
      if (!visible) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Divisi itu tidak boleh kamu lihat.',
        });
      }
      const rows = await ctx.db
        .select({
          applicationId: application.id,
          choiceId: applicationChoice.id,
          origin: applicationChoice.origin,
          name: displayName,
          nim: mahasiswa.nim,
          prodi: mahasiswa.jurusan,
          angkatan: mahasiswa.angkatan,
          decidedAt: placementDecision.decidedAt,
          tag: placementDecision.tag,
        })
        .from(placementDecision)
        .innerJoin(
          applicationChoice,
          eq(applicationChoice.id, placementDecision.choiceId),
        )
        .innerJoin(
          application,
          eq(application.id, applicationChoice.applicationId),
        )
        .innerJoin(users, eq(users.id, application.userId))
        .leftJoin(mahasiswa, eq(mahasiswa.userId, users.id))
        .where(
          and(
            eq(applicationChoice.divisionId, division.id),
            eq(placementDecision.decision, 'terima'),
          ),
        )
        .orderBy(asc(displayName), asc(application.id));
      return {
        division: {
          id: division.id,
          label: division.label,
          groupLabel: division.groupLabel,
          quota: division.quota,
        },
        rows,
      };
    }),

  closerecList: oprecAssessProcedure
    .input(PlacementIdInput)
    .query(async ({ ctx }) => {
      assertAdmin(ctx.assess);
      const rows = await ctx.db
        .select({
          choiceId: applicationChoice.id,
          applicationId: application.id,
          userId: application.userId,
          name: displayName,
          nim: mahasiswa.nim,
          divisionId: applicationChoice.divisionId,
          divisionLabel: organizationUnit.name,
          note: placementDecision.reason,
          decidedAt: placementDecision.decidedAt,
        })
        .from(applicationChoice)
        .innerJoin(
          recruitmentDivision,
          eq(recruitmentDivision.id, applicationChoice.divisionId),
        )
        .innerJoin(
          organizationUnit,
          eq(organizationUnit.id, recruitmentDivision.unitId),
        )
        .innerJoin(
          application,
          eq(application.id, applicationChoice.applicationId),
        )
        .innerJoin(users, eq(users.id, application.userId))
        .leftJoin(mahasiswa, eq(mahasiswa.userId, users.id))
        .leftJoin(
          placementDecision,
          eq(placementDecision.choiceId, applicationChoice.id),
        )
        .where(
          and(
            eq(recruitmentDivision.recruitmentId, ctx.recruitment.id),
            eq(applicationChoice.origin, 'closerec'),
          ),
        )
        .orderBy(asc(displayName), asc(application.id));
      return rows;
    }),

  closerecAdd: oprecAssessProcedure
    .input(
      z.object({
        recruitmentId: id,
        identifier: z.string().trim().min(1),
        divisionId: id,
        note: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.assess);
      if (!ctx.recruitment.closerecEnabled) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Jalur closerec tidak dibuka untuk oprec ini.',
        });
      }
      if (ctx.recruitment.placementState === 'final') {
        throw new TRPCError({ code: 'FORBIDDEN', message: NOT_FINAL });
      }
      const user = await findUserByIdentifier(ctx.db, input.identifier);
      const divisions = await loadPlacementDivisions(
        ctx.db,
        ctx.recruitment.id,
      );
      const division = divisions.find((row) => row.id === input.divisionId);
      if (!division) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Divisi itu bukan milik oprec ini.',
        });
      }
      return ctx.db.transaction(async (tx) => {
        let [app] = await tx
          .select({ id: application.id })
          .from(application)
          .where(
            and(
              eq(application.recruitmentId, ctx.recruitment.id),
              eq(application.userId, user.id),
            ),
          )
          .for('update');
        if (!app) {
          const [created] = await tx
            .insert(application)
            .values({
              recruitmentId: ctx.recruitment.id,
              userId: user.id,
              source: 'closerec',
            })
            .returning({ id: application.id });
          app = created;
        }
        const [duplicate] = await tx
          .select({ id: applicationChoice.id })
          .from(applicationChoice)
          .where(
            and(
              eq(applicationChoice.applicationId, app!.id),
              eq(applicationChoice.divisionId, division.id),
            ),
          );
        if (duplicate) {
          conflict('Orang ini sudah punya pilihan di divisi tersebut.');
        }
        const [choice] = await tx
          .insert(applicationChoice)
          .values({
            applicationId: app!.id,
            divisionId: division.id,
            rank: null,
            origin: 'closerec',
          })
          .returning({ id: applicationChoice.id });
        await writeDecision(tx, {
          choiceId: choice!.id,
          applicationId: app!.id,
          userId: user.id,
          division,
          decision: 'terima',
          actorId: ctx.session.user.id,
          reason: input.note ?? null,
          source: 'closerec',
          siblingChoiceIds: [choice!.id],
        });
        await logAction(tx, {
          recruitmentId: ctx.recruitment.id,
          actorId: ctx.session.user.id,
          action: 'closerec_ditambah',
          entityType: 'application',
          entityId: app!.id,
          detail: {
            choiceId: choice!.id,
            divisionId: division.id,
            userId: user.id,
          },
        });
        return { id: choice!.id };
      });
    }),

  closerecRemove: oprecAssessProcedure
    .input(z.object({ recruitmentId: id, choiceId: id }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.assess);
      if (ctx.recruitment.placementState === 'final') {
        throw new TRPCError({ code: 'FORBIDDEN', message: NOT_FINAL });
      }
      return ctx.db.transaction(async (tx) => {
        const [choice] = await tx
          .select({
            id: applicationChoice.id,
            applicationId: applicationChoice.applicationId,
            origin: applicationChoice.origin,
            source: application.source,
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
          .where(
            and(
              eq(applicationChoice.id, input.choiceId),
              eq(recruitmentDivision.recruitmentId, ctx.recruitment.id),
            ),
          );
        if (!choice) notFound('Pilihan closerec itu tidak ditemukan.');
        if (choice.origin !== 'closerec') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Pilihan itu bukan penempatan closerec.',
          });
        }
        await tx
          .delete(placement)
          .where(eq(placement.applicationChoiceId, choice.id));
        await tx
          .delete(applicationChoice)
          .where(eq(applicationChoice.id, choice.id));
        const [remaining] = await tx
          .select({ n: count() })
          .from(applicationChoice)
          .where(eq(applicationChoice.applicationId, choice.applicationId));
        if (choice.source === 'closerec' && (remaining?.n ?? 0) === 0) {
          await tx
            .delete(application)
            .where(eq(application.id, choice.applicationId));
        }
        await logAction(tx, {
          recruitmentId: ctx.recruitment.id,
          actorId: ctx.session.user.id,
          action: 'closerec_dicabut',
          entityType: 'application',
          entityId: choice.applicationId,
          detail: { choiceId: choice.id },
        });
        return { success: true } as const;
      });
    }),

  placementHistory: oprecAssessProcedure
    .input(z.object({ recruitmentId: id, applicationId: id }))
    .query(async ({ ctx, input }) => {
      const [app] = await ctx.db
        .select({ id: application.id })
        .from(application)
        .where(
          and(
            eq(application.id, input.applicationId),
            eq(application.recruitmentId, ctx.recruitment.id),
          ),
        );
      if (!app) notFound('Pendaftar itu bukan milik oprec ini.');
      const choices =
        (await loadChoices(ctx.db, [input.applicationId], true)).get(
          input.applicationId,
        ) ?? [];
      if (
        !ctx.assess.isAdmin &&
        !choices.some((choice) =>
          ctx.assess.deciderDivisionIds.has(choice.divisionId),
        )
      ) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      const rows = await ctx.db
        .select({
          id: recruitmentLog.id,
          action: recruitmentLog.action,
          detail: recruitmentLog.detail,
          createdAt: recruitmentLog.created_at,
          actorName: users.name,
        })
        .from(recruitmentLog)
        .leftJoin(users, eq(users.id, recruitmentLog.actorId))
        .where(
          and(
            eq(recruitmentLog.recruitmentId, ctx.recruitment.id),
            eq(recruitmentLog.entityType, 'application'),
            eq(recruitmentLog.entityId, input.applicationId),
          ),
        )
        .orderBy(desc(recruitmentLog.created_at))
        .limit(200);
      return rows.map((row) => {
        const detail = { ...(row.detail ?? {}) };
        if (detail.sensitive === true) {
          delete detail.reason;
          delete detail.note;
          delete detail.sensitive;
        }
        return {
          id: row.id,
          action: row.action,
          detail,
          createdAt: row.createdAt,
          actorName: row.actorName,
        };
      });
    }),
};

async function countAcceptedForDivision(
  db: Queryable,
  recruitmentId: string,
  divisionId: string,
  exceptChoiceId?: string,
) {
  const rows = await db
    .select({
      choiceId: placementDecision.choiceId,
      origin: applicationChoice.origin,
      decision: placementDecision.decision,
    })
    .from(placementDecision)
    .innerJoin(
      applicationChoice,
      eq(applicationChoice.id, placementDecision.choiceId),
    )
    .innerJoin(
      recruitmentDivision,
      eq(recruitmentDivision.id, applicationChoice.divisionId),
    )
    .where(
      and(
        eq(recruitmentDivision.recruitmentId, recruitmentId),
        eq(applicationChoice.divisionId, divisionId),
        eq(placementDecision.decision, 'terima'),
      ),
    );
  return rows.filter(
    (row) => row.origin !== 'closerec' && row.choiceId !== exceptChoiceId,
  ).length;
}

type DecisionChoice = {
  applicationId: string;
  userId: string;
  division: PlacementDivision;
  status: Status;
  decision: { choiceId: string; decision: Decision } | null;
  siblings: {
    id: string;
    rank: number | null;
    status: Status;
    decision: Decision | null;
  }[];
};

async function loadChoiceForDecision(
  db: Queryable,
  recruitmentId: string,
  choiceId: string,
): Promise<DecisionChoice> {
  const divisions = await loadPlacementDivisions(db, recruitmentId);
  const divisionOf = new Map(divisions.map((row) => [row.id, row]));

  const [row] = await db
    .select({
      choiceId: applicationChoice.id,
      applicationId: applicationChoice.applicationId,
      divisionId: applicationChoice.divisionId,
      rank: applicationChoice.rank,
      status: applicationChoice.computedStatus,
      userId: application.userId,
    })
    .from(applicationChoice)
    .innerJoin(application, eq(application.id, applicationChoice.applicationId))
    .innerJoin(
      recruitmentDivision,
      eq(recruitmentDivision.id, applicationChoice.divisionId),
    )
    .where(
      and(
        eq(applicationChoice.id, choiceId),
        eq(recruitmentDivision.recruitmentId, recruitmentId),
      ),
    );
  if (!row) notFound('Pilihan itu bukan milik oprec ini.');
  const division = divisionOf.get(row.divisionId);
  if (!division) notFound('Divisi pilihan itu tidak ditemukan.');

  const siblingRows = await db
    .select({
      id: applicationChoice.id,
      rank: applicationChoice.rank,
      status: applicationChoice.computedStatus,
      overrideStatus: choiceStatusOverride.status,
      decision: placementDecision.decision,
    })
    .from(applicationChoice)
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
    .where(eq(applicationChoice.applicationId, row.applicationId));

  const siblings = siblingRows.map((sibling) => ({
    id: sibling.id,
    rank: sibling.rank,
    status: effectiveStatus(
      sibling.status as Status,
      sibling.overrideStatus === null
        ? null
        : {
            status: sibling.overrideStatus,
            computedStatusAtOverride: null,
            scoreAtOverride: null,
          },
    ),
    decision: (sibling.decision as Decision | null) ?? null,
  }));
  const found = siblings.find((sibling) => sibling.id === choiceId);

  return {
    applicationId: row.applicationId,
    userId: row.userId,
    division,
    status: found?.status ?? null,
    decision: found?.decision
      ? { choiceId, decision: found.decision }
      : null,
    siblings,
  };
}

/** Target divisi yang boleh dilihat seorang Kadiv (baca-saja). */
async function visibleTargetIds(
  db: Queryable,
  recruitmentId: string,
  defaultVisible: boolean,
  viewerDivisionIds: string[],
): Promise<string[]> {
  const divisions = await loadPlacementDivisions(db, recruitmentId);
  const overrides = await db
    .select({
      viewerDivisionId: recruitmentVisibilityOverride.viewerDivisionId,
      targetDivisionId: recruitmentVisibilityOverride.targetDivisionId,
      allowed: recruitmentVisibilityOverride.allowed,
    })
    .from(recruitmentVisibilityOverride)
    .where(eq(recruitmentVisibilityOverride.recruitmentId, recruitmentId));
  const overrideOf = new Map(
    overrides.map((row) => [
      `${row.viewerDivisionId}:${row.targetDivisionId}`,
      row.allowed,
    ]),
  );
  const visible = new Set<string>();
  for (const division of divisions) {
    for (const viewer of viewerDivisionIds) {
      if (viewer === division.id) {
        visible.add(division.id);
        continue;
      }
      const override = overrideOf.get(`${viewer}:${division.id}`);
      if (override ?? defaultVisible) visible.add(division.id);
    }
  }
  return [...visible];
}

function allowedDivisions(
  access: AssessAccess,
  divisions: PlacementDivision[],
): Set<string> {
  return access.isAdmin
    ? new Set(divisions.map((division) => division.id))
    : new Set(
        divisions
          .filter((division) => access.deciderDivisionIds.has(division.id))
          .map((division) => division.id),
      );
}

type AutofillData = ReturnType<typeof planAutofill> & {
  divisionOf: (choiceId: string) => string;
  labelOf: (divisionId: string) => string;
  quotaOf: (divisionId: string) => number;
};

/** Rencana autofill untuk seluruh pendaftar oprec (semua divisi). */
async function buildAutofillPlan(
  db: Queryable,
  recruitmentId: string,
  overQuota: 'masukkan' | 'tolak',
  staged: boolean,
): Promise<AutofillData> {
  const divisions = await loadPlacementDivisions(db, recruitmentId);
  const rows = await db
    .select({
      id: applicationChoice.id,
      applicationId: applicationChoice.applicationId,
      divisionId: applicationChoice.divisionId,
      rank: applicationChoice.rank,
      origin: applicationChoice.origin,
      computedStatus: applicationChoice.computedStatus,
      score: applicationChoice.score,
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
    .where(eq(recruitmentDivision.recruitmentId, recruitmentId))
    .orderBy(asc(applicationChoice.rank));

  const choices = rows.map((row) => ({
    id: row.id,
    applicationId: row.applicationId,
    divisionId: row.divisionId,
    rank: row.rank,
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
    score: row.score === null ? null : Number(row.score),
    decision: (row.decision as Decision | null) ?? null,
  }));
  const existing = new Map<string, Decision>();
  for (const row of rows) {
    if (row.decision) existing.set(row.id, row.decision as Decision);
  }
  const quotaByDivision = new Map(
    divisions.map((division) => [division.id, division.quota]),
  );
  const accepted = await acceptedByDivision(db, recruitmentId);
  const plan = planAutofill({
    choices,
    quotaByDivision,
    acceptedByDivision: accepted,
    existing,
    overQuota,
    staged,
  });
  const divisionOfChoice = new Map(
    choices.map((choice) => [choice.id, choice.divisionId]),
  );
  return {
    ...plan,
    divisionOf: (choiceId) => divisionOfChoice.get(choiceId) ?? '',
    labelOf: (divisionId) =>
      divisions.find((division) => division.id === divisionId)?.label ?? '',
    quotaOf: (divisionId) =>
      divisions.find((division) => division.id === divisionId)?.quota ?? 0,
  };
}

/** Tulis keputusan + placement yang mengikutinya. */
async function writeDecision(
  tx: Tx,
  args: {
    choiceId: string;
    applicationId: string;
    userId: string;
    division: PlacementDivision;
    decision: Decision;
    actorId: string;
    reason?: string | null;
    tag?: DecisionTag | null;
    overQuotaConfirmed?: boolean;
    siblingChoiceIds: string[];
    source?: 'oprec' | 'closerec';
  },
) {
  if (args.decision === 'terima') {
    await tx
      .delete(placement)
      .where(inArray(placement.applicationChoiceId, args.siblingChoiceIds));
    try {
      await tx.insert(placement).values({
        positionId: args.division.positionId,
        userId: args.userId,
        source: args.source ?? 'oprec',
        applicationChoiceId: args.choiceId,
        createdBy: args.actorId,
        note: args.reason ?? null,
      });
    } catch (error) {
      if (pgCode(error) === '23505') {
        conflict(
          'Orang ini sudah menempati posisi tersebut di organogram periode ini.',
        );
      }
      throw error;
    }
  } else {
    await tx
      .delete(placement)
      .where(eq(placement.applicationChoiceId, args.choiceId));
  }

  await tx
    .insert(placementDecision)
    .values({
      choiceId: args.choiceId,
      decision: args.decision,
      decidedBy: args.actorId,
      reason: args.reason ?? null,
      tag: args.tag ?? null,
      overQuotaConfirmed: args.overQuotaConfirmed ?? false,
    })
    .onConflictDoUpdate({
      target: placementDecision.choiceId,
      set: {
        decision: args.decision,
        decidedBy: args.actorId,
        reason: args.reason ?? null,
        tag: args.tag ?? null,
        overQuotaConfirmed: args.overQuotaConfirmed ?? false,
      },
    });
}

async function findUserByIdentifier(db: Queryable, identifier: string) {
  const trimmed = identifier.trim();
  if (/^\d+$/.test(trimmed)) {
    const [row] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(mahasiswa)
      .innerJoin(users, eq(users.id, mahasiswa.userId))
      .where(eq(mahasiswa.nim, Number(trimmed)));
    if (row) return row;
  } else {
    const [row] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(sql`lower(${users.email}) = ${trimmed.toLowerCase()}`);
    if (row) return row;
  }
  notFound('Akun dengan email/NIM tersebut belum terdaftar di sistem.');
}
