import { TRPCError } from '@trpc/server';
import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import {
  assessmentOpen,
  autoGateTriggered,
  blindCode,
  effectiveStatus,
  overrideNeedsReview,
} from '~/lib/oprec/scoring';
import { oprecAssessProcedure } from '~/server/api/trpc';
import {
  application,
  applicationChoice,
  assessment,
  choiceStatusOverride,
  criterion,
  criterionField,
  formSubmission,
  mahasiswa,
  organizationUnit,
  recruitmentDivision,
  recruitmentSectionBinding,
  recruitmentWave,
  users,
} from '~/server/db/schema';

import {
  AssessGetInputSchema,
  AssessQueueInputSchema,
  AssessSaveInputSchema,
  AssessStatusesSchema,
  OkOutputSchema,
  OverrideClearInputSchema,
  OverrideHistoryInputSchema,
  OverrideSetInputSchema,
  RecruitmentIdInputSchema,
} from '../../types/oprec.type';
import { loadResponseFields } from '../form/responses';
import {
  attachAnswers,
  submissionQuery,
  toRespondent,
} from '../form/responses';
import {
  type AssessAccess,
  canAssessScope,
  canDecideDivision,
  canSeeSensitive,
} from './assess-access';
import { loadGateAnswers } from './gate-answers';
import { logAction } from './log';
import { recomputeDivisions } from './recompute';
import { loadRegistrationWindow } from './registration';
import { conflict, notFound } from './services';

const OK = { success: true };

const forbidden = (message: string): never => {
  throw new TRPCError({ code: 'FORBIDDEN', message });
};

/** `umum` atau id divisi → id divisi (null = umum); menolak lingkup di luar peran. */
function resolveScope(access: AssessAccess, scope: string): string | null {
  const divisionId = scope === 'umum' ? null : scope;
  if (!canAssessScope(access, divisionId)) {
    forbidden('Kamu tidak punya akses ke lingkup penilaian ini.');
  }
  return divisionId;
}

const displayName = sql<
  string | null
>`coalesce(${mahasiswa.nama}, ${users.name})`;

/** Identitas pendaftar; pada mode blind hanya kode bagi yang bukan admin. */
function identity(
  blind: boolean,
  access: AssessAccess,
  row: {
    id: string;
    name: string | null;
    nim: number | null;
    prodi: string | null;
    angkatan: number | null;
  },
) {
  if (blind && !access.isAdmin) {
    return {
      code: blindCode(row.id),
      name: null,
      nim: null,
      prodi: null,
      angkatan: null,
    };
  }
  return {
    code: blindCode(row.id),
    name: row.name,
    nim: row.nim,
    prodi: row.prodi,
    angkatan: row.angkatan,
  };
}

export const assessProcedures = {
  /** Lingkup yang boleh dibuka pemanggil beserta peran dan pengaturan penilaian. */
  assessScopes: oprecAssessProcedure
    .input(RecruitmentIdInputSchema)
    .query(async ({ ctx }) => {
      const a = ctx.assess;
      const divisions = await ctx.db
        .select({
          id: recruitmentDivision.id,
          label: organizationUnit.name,
          sortOrder: recruitmentDivision.sortOrder,
        })
        .from(recruitmentDivision)
        .innerJoin(
          organizationUnit,
          eq(organizationUnit.id, recruitmentDivision.unitId),
        )
        .where(eq(recruitmentDivision.recruitmentId, ctx.recruitment.id))
        .orderBy(asc(recruitmentDivision.sortOrder));
      return {
        name: ctx.recruitment.name,
        blind: ctx.recruitment.blind && !a.isAdmin,
        ratingMin: ctx.recruitment.ratingMin,
        ratingMax: ctx.recruitment.ratingMax,
        isAdmin: a.isAdmin,
        scopes: [
          ...(canAssessScope(a, null)
            ? [{ scope: 'umum', label: 'Umum', canDecide: a.isAdmin }]
            : []),
          ...divisions
            .filter((d) => canAssessScope(a, d.id))
            .map((d) => ({
              scope: d.id,
              label: d.label,
              canDecide: canDecideDivision(a, d.id),
            })),
        ],
      };
    }),

  /** Antrean pendaftar untuk satu lingkup, dengan kemajuan penilaian. */
  assessQueue: oprecAssessProcedure
    .input(AssessQueueInputSchema)
    .query(async ({ ctx, input }) => {
      const divisionId = resolveScope(ctx.assess, input.scope);
      const rec = ctx.recruitment;

      const scopeCriteria = await ctx.db
        .select({
          id: criterion.id,
          kind: criterion.kind,
          name: criterion.name,
        })
        .from(criterion)
        .where(
          and(
            eq(criterion.recruitmentId, rec.id),
            divisionId === null
              ? isNull(criterion.divisionId)
              : eq(criterion.divisionId, divisionId),
          ),
        )
        .orderBy(asc(criterion.sortOrder), asc(criterion.created_at));
      const assessable = scopeCriteria.filter(
        (c) => c.kind !== 'gugur_otomatis',
      );

      const conds = [eq(application.recruitmentId, rec.id)];
      if (divisionId !== null) {
        conds.push(
          sql`exists (select 1 from ${applicationChoice} where ${applicationChoice.applicationId} = ${application.id} and ${applicationChoice.divisionId} = ${divisionId})`,
        );
      }
      if (input.search) {
        const like = `%${input.search.replace(/[\\%_]/g, '\\$&')}%`;
        // Pada mode blind, pencarian identitas hanya untuk admin.
        if (!rec.blind || ctx.assess.isAdmin) {
          conds.push(
            or(
              ilike(mahasiswa.nama, like),
              ilike(users.name, like),
              sql`${mahasiswa.nim}::text like ${like}`,
            )!,
          );
        }
      }
      const where = and(...conds)!;

      const base = ctx.db
        .select({
          id: application.id,
          name: displayName,
          nim: mahasiswa.nim,
          prodi: mahasiswa.jurusan,
          angkatan: mahasiswa.angkatan,
          waveLabel: recruitmentWave.label,
          waveId: application.waveId,
          submittedAt: application.submittedAt,
        })
        .from(application)
        .innerJoin(users, eq(users.id, application.userId))
        .leftJoin(mahasiswa, eq(mahasiswa.userId, application.userId))
        .leftJoin(recruitmentWave, eq(recruitmentWave.id, application.waveId))
        .where(where);

      const [rows, [totalRow]] = await Promise.all([
        base
          .orderBy(asc(application.submittedAt), asc(application.id))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db
          .select({ n: count() })
          .from(application)
          .innerJoin(users, eq(users.id, application.userId))
          .leftJoin(mahasiswa, eq(mahasiswa.userId, application.userId))
          .where(where),
      ]);

      const ids = rows.map((r) => r.id);
      const [mine, choices, registration] = await Promise.all([
        ids.length && assessable.length
          ? ctx.db
              .select({
                applicationId: assessment.applicationId,
                choiceId: assessment.choiceId,
                criterionId: assessment.criterionId,
                assessorId: assessment.assessorId,
                rating: assessment.rating,
                gateState: assessment.gateState,
                note: assessment.note,
              })
              .from(assessment)
              .where(
                and(
                  inArray(assessment.applicationId, ids),
                  inArray(
                    assessment.criterionId,
                    assessable.map((c) => c.id),
                  ),
                ),
              )
          : Promise.resolve([]),
        ids.length
          ? ctx.db
              .select({
                id: applicationChoice.id,
                applicationId: applicationChoice.applicationId,
                divisionId: applicationChoice.divisionId,
                rank: applicationChoice.rank,
                label: organizationUnit.name,
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
              .where(inArray(applicationChoice.applicationId, ids))
              .orderBy(asc(applicationChoice.rank))
          : Promise.resolve([]),
        loadRegistrationWindow(ctx.db, rec.id, new Date()),
      ]);

      // Antrean menampilkan status efektif: override aktif menggantikan hitungan.
      const activeOverrides = choices.length
        ? await ctx.db
            .select({
              choiceId: choiceStatusOverride.choiceId,
              status: choiceStatusOverride.status,
            })
            .from(choiceStatusOverride)
            .where(
              and(
                inArray(
                  choiceStatusOverride.choiceId,
                  choices.map((c: { id: string }) => c.id),
                ),
                isNull(choiceStatusOverride.clearedAt),
              ),
            )
        : [];
      const overrideOf = new Map(
        activeOverrides.map((o) => [o.choiceId, o.status]),
      );
      const minReviewers = Math.max(1, rec.minReviewers);
      const items = rows.map((r) => {
        const myChoices = choices.filter(
          (c) =>
            c.applicationId === r.id &&
            (divisionId === null || c.divisionId === divisionId),
        );
        const rowAssess = mine.filter(
          (a) =>
            a.applicationId === r.id &&
            (divisionId === null
              ? a.choiceId === null
              : myChoices.some((c) => c.id === a.choiceId)),
        );
        const done = assessable.filter((c) => {
          const n = rowAssess.filter(
            (a) =>
              a.criterionId === c.id &&
              (a.rating !== null || a.gateState !== null),
          ).length;
          return n >= minReviewers;
        }).length;
        const values = input.withValues
          ? Object.fromEntries(
              assessable.map((c) => {
                const own = rowAssess.find(
                  (a) =>
                    a.criterionId === c.id &&
                    a.assessorId === ctx.session.user.id,
                );
                return [
                  c.id,
                  own
                    ? {
                        rating: own.rating,
                        gateState: own.gateState,
                        note: own.note,
                      }
                    : null,
                ];
              }),
            )
          : undefined;
        return {
          id: r.id,
          ...identity(rec.blind, ctx.assess, r),
          waveLabel: r.waveLabel,
          open: assessmentOpen({
            now: new Date(),
            allowEarly: rec.allowEarlyAssessment,
            registrationEnded: registration.registrationEnded,
            waveEndsAt: r.waveId
              ? (registration.waves.get(r.waveId) ?? null)
              : null,
            hasWaves: registration.waves.size > 0,
          }),
          progress: { done, total: assessable.length },
          choices: myChoices.map((c) => ({
            id: c.id,
            rank: c.rank,
            label: c.label,
            score: c.score === null ? null : Number(c.score),
            status: overrideOf.get(c.id) ?? c.computedStatus,
            overridden: overrideOf.has(c.id),
          })),
          values,
        };
      });
      const filtered = input.onlyIncomplete
        ? items.filter((i) => i.progress.done < i.progress.total)
        : items;
      return {
        total: totalRow?.n ?? 0,
        page: input.page,
        pageSize: input.pageSize,
        criteria: assessable,
        rows: filtered,
      };
    }),

  /** Berkas penilaian satu pendaftar untuk satu lingkup. */
  assessGet: oprecAssessProcedure
    .input(AssessGetInputSchema)
    .query(async ({ ctx, input }) => {
      const divisionId = resolveScope(ctx.assess, input.scope);
      const rec = ctx.recruitment;
      const [app] = await ctx.db
        .select({
          id: application.id,
          name: displayName,
          nim: mahasiswa.nim,
          prodi: mahasiswa.jurusan,
          angkatan: mahasiswa.angkatan,
          waveId: application.waveId,
          waveLabel: recruitmentWave.label,
          formSubmissionId: application.formSubmissionId,
          willingToMove: application.willingToMove,
        })
        .from(application)
        .innerJoin(users, eq(users.id, application.userId))
        .leftJoin(mahasiswa, eq(mahasiswa.userId, application.userId))
        .leftJoin(recruitmentWave, eq(recruitmentWave.id, application.waveId))
        .where(
          and(
            eq(application.id, input.applicationId),
            eq(application.recruitmentId, rec.id),
          ),
        );
      if (!app) notFound('Pendaftar tidak ditemukan.');

      const choices = await ctx.db
        .select({
          id: applicationChoice.id,
          divisionId: applicationChoice.divisionId,
          rank: applicationChoice.rank,
          label: organizationUnit.name,
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
        .where(eq(applicationChoice.applicationId, app.id))
        .orderBy(asc(applicationChoice.rank));
      const scopeChoice =
        divisionId === null
          ? null
          : choices.find((c) => c.divisionId === divisionId);
      if (divisionId !== null && !scopeChoice) {
        forbidden('Pendaftar ini tidak memilih divisi tersebut.');
      }
      const visibleChoices =
        divisionId === null
          ? choices
          : choices.filter((c) => c.divisionId === divisionId);

      const criteria = await ctx.db
        .select()
        .from(criterion)
        .where(
          and(
            eq(criterion.recruitmentId, rec.id),
            divisionId === null
              ? isNull(criterion.divisionId)
              : eq(criterion.divisionId, divisionId),
          ),
        )
        .orderBy(asc(criterion.sortOrder), asc(criterion.created_at));
      const links = criteria.length
        ? await ctx.db
            .select()
            .from(criterionField)
            .where(
              inArray(
                criterionField.criterionId,
                criteria.map((c) => c.id),
              ),
            )
        : [];
      const rows = criteria.length
        ? await ctx.db
            .select()
            .from(assessment)
            .where(
              and(
                eq(assessment.applicationId, app.id),
                inArray(
                  assessment.criterionId,
                  criteria.map((c) => c.id),
                ),
              ),
            )
        : [];
      const me = ctx.session.user.id;

      // Jawaban yang relevan dengan lingkup: bagian tanpa ikatan, plus bagian terikat ke divisi ini.
      const bindings = await ctx.db
        .select()
        .from(recruitmentSectionBinding)
        .where(eq(recruitmentSectionBinding.recruitmentId, rec.id));
      const boundTo = new Map<string, Set<string>>();
      for (const b of bindings) {
        boundTo.set(
          b.formSectionId,
          new Set([...(boundTo.get(b.formSectionId) ?? []), b.divisionId]),
        );
      }
      let columns: {
        fieldId: string;
        type: string;
        label: string;
        sectionId: string | null;
      }[] = [];
      let answers: Record<string, unknown> = {};
      if (app.formSubmissionId) {
        const fields = await loadResponseFields(ctx.db, rec.formId);
        columns = fields
          .filter((f) => {
            const sec = f.sectionId ? boundTo.get(f.sectionId) : undefined;
            if (!sec) return true;
            return divisionId !== null && sec.has(divisionId);
          })
          .filter((f) => f.type !== 'unit_choice')
          .map((f) => ({
            fieldId: f.id,
            type: f.type,
            label: f.label,
            sectionId: f.sectionId,
          }));
        const [found] = await submissionQuery(ctx.db).where(
          eq(formSubmission.id, app.formSubmissionId),
        );
        if (found) {
          const [row] = await attachAnswers(ctx.db, [toRespondent(found)]);
          answers = row?.answers ?? {};
        }
      }

      const gate = await loadGateAnswers(
        ctx.db,
        rec,
        criteria.map((c) => ({
          id: c.id,
          divisionId: c.divisionId,
          kind: c.kind,
          weight: c.weight,
          gateRule: c.gateRule,
        })),
        app.formSubmissionId ? [app.formSubmissionId] : [],
      );
      const gateAnswers = app.formSubmissionId
        ? (gate.answersBySubmission.get(app.formSubmissionId) ?? {})
        : {};

      const { waves, registrationEnded } = await loadRegistrationWindow(
        ctx.db,
        rec.id,
        new Date(),
      );
      const overrides =
        scopeChoice || divisionId === null
          ? await ctx.db
              .select()
              .from(choiceStatusOverride)
              .where(
                and(
                  inArray(
                    choiceStatusOverride.choiceId,
                    visibleChoices.map((c) => c.id),
                  ),
                  isNull(choiceStatusOverride.clearedAt),
                ),
              )
          : [];
      const seeSensitive = canSeeSensitive(ctx.assess);

      return {
        application: {
          id: app.id,
          ...identity(rec.blind, ctx.assess, app),
          waveLabel: app.waveLabel,
          willingToMove: app.willingToMove,
        },
        blind: rec.blind && !ctx.assess.isAdmin,
        open: assessmentOpen({
          now: new Date(),
          allowEarly: rec.allowEarlyAssessment,
          registrationEnded,
          waveEndsAt: app.waveId ? (waves.get(app.waveId) ?? null) : null,
          hasWaves: waves.size > 0,
        }),
        scoring: {
          ratingMin: rec.ratingMin,
          ratingMax: rec.ratingMax,
          minReviewers: rec.minReviewers,
        },
        choices: visibleChoices.map((c) => {
          const score = c.score === null ? null : Number(c.score);
          const ov = overrides.find((o) => o.choiceId === c.id) ?? null;
          const active = ov
            ? {
                status: ov.status,
                computedStatusAtOverride: ov.computedStatusAtOverride,
                scoreAtOverride:
                  ov.scoreAtOverride === null
                    ? null
                    : Number(ov.scoreAtOverride),
              }
            : null;
          const hideReason = ov?.isSensitive && !seeSensitive;
          return {
            id: c.id,
            divisionId: c.divisionId,
            rank: c.rank,
            label: c.label,
            score,
            computedStatus: c.computedStatus,
            effectiveStatus: effectiveStatus(c.computedStatus, active),
            override: ov
              ? {
                  status: ov.status,
                  reason: hideReason ? null : ov.reason,
                  isSensitive: ov.isSensitive,
                  needsReview: overrideNeedsReview(
                    active,
                    c.computedStatus,
                    score,
                  ),
                }
              : null,
            canDecide: canDecideDivision(ctx.assess, c.divisionId),
          };
        }),
        criteria: criteria.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
          weight: c.weight,
          expectation: c.expectation,
          fieldIds: links
            .filter((l) => l.criterionId === c.id)
            .map((l) => l.formFieldId),
          // Aturan gugur otomatis hanya dijelaskan; hasilnya dihitung server.
          gateRule: c.gateRule,
          // Null bila pendaftar tak punya jawaban formulir (mis. closerec).
          autoTriggered:
            c.kind === 'gugur_otomatis' && c.gateRule && app.formSubmissionId
              ? autoGateTriggered(c.gateRule, gateAnswers, gate.fieldTypes)
              : null,
          choiceId: c.divisionId === null ? null : (scopeChoice?.id ?? null),
          mine: (() => {
            const own = rows.find(
              (r) => r.criterionId === c.id && r.assessorId === me,
            );
            return own
              ? { rating: own.rating, gateState: own.gateState, note: own.note }
              : null;
          })(),
          reviewers: rows.filter(
            (r) =>
              r.criterionId === c.id &&
              (r.rating !== null || r.gateState !== null),
          ).length,
        })),
        columns,
        answers,
      };
    }),

  /** Menyimpan (atau mengosongkan) penilaian pemanggil untuk satu kriteria. */
  assessSave: oprecAssessProcedure
    .input(AssessSaveInputSchema)
    .output(
      OkOutputSchema.extend({
        statuses: AssessStatusesSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rec = ctx.recruitment;
      const me = ctx.session.user.id;
      const statuses = await ctx.db.transaction(async (tx) => {
        const [crit] = await tx
          .select()
          .from(criterion)
          .where(
            and(
              eq(criterion.id, input.criterionId),
              eq(criterion.recruitmentId, rec.id),
            ),
          );
        if (!crit) notFound('Kriteria tidak ditemukan.');
        if (!canAssessScope(ctx.assess, crit.divisionId)) {
          forbidden('Kamu tidak boleh menilai kriteria ini.');
        }
        if (crit.kind === 'gugur_otomatis') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'Kriteria gugur otomatis dihitung dari jawaban, tidak dinilai.',
          });
        }
        // Kunci pendaftar supaya penyimpanan serentak tidak berebut baris.
        const [app] = await tx
          .select({ id: application.id, waveId: application.waveId })
          .from(application)
          .where(
            and(
              eq(application.id, input.applicationId),
              eq(application.recruitmentId, rec.id),
            ),
          )
          .for('update');
        if (!app) notFound('Pendaftar tidak ditemukan.');

        let choiceId: string | null = null;
        if (crit.divisionId !== null) {
          if (!input.choiceId) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Kriteria divisi harus menyebut pilihannya.',
            });
          }
          const [ch] = await tx
            .select({ id: applicationChoice.id })
            .from(applicationChoice)
            .where(
              and(
                eq(applicationChoice.id, input.choiceId),
                eq(applicationChoice.applicationId, app.id),
                eq(applicationChoice.divisionId, crit.divisionId),
              ),
            );
          if (!ch) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Pilihan itu bukan milik pendaftar dan divisi kriteria.',
            });
          }
          choiceId = ch.id;
        } else if (input.choiceId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Kriteria umum tidak terkait satu pilihan.',
          });
        }

        if (crit.kind === 'skor' && input.gateState != null) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Kriteria skor dinilai dengan angka.',
          });
        }
        if (crit.kind === 'gugur_manual' && input.rating != null) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'Kriteria gugur dinilai dengan memenuhi, perlu ditinjau, atau tidak.',
          });
        }
        if (
          input.rating != null &&
          (input.rating < rec.ratingMin || input.rating > rec.ratingMax)
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Skor harus antara ${rec.ratingMin} dan ${rec.ratingMax}.`,
          });
        }

        // Dibaca di dalam transaksi agar status pendaftaran segar.
        const { waves, registrationEnded } = await loadRegistrationWindow(
          tx,
          rec.id,
          new Date(),
        );
        if (
          !assessmentOpen({
            now: new Date(),
            allowEarly: rec.allowEarlyAssessment,
            registrationEnded,
            waveEndsAt: app.waveId ? (waves.get(app.waveId) ?? null) : null,
            hasWaves: waves.size > 0,
          })
        ) {
          conflict('Penilaian pendaftar ini belum dibuka.');
        }

        const where = and(
          eq(assessment.applicationId, app.id),
          eq(assessment.criterionId, crit.id),
          eq(assessment.assessorId, me),
          choiceId === null
            ? isNull(assessment.choiceId)
            : eq(assessment.choiceId, choiceId),
        );
        const [existing] = await tx
          .select({ id: assessment.id })
          .from(assessment)
          .where(where);
        const empty =
          input.rating == null && input.gateState == null && !input.note;
        if (empty) {
          if (existing)
            await tx.delete(assessment).where(eq(assessment.id, existing.id));
        } else if (existing) {
          await tx
            .update(assessment)
            .set({
              rating: input.rating ?? null,
              gateState: input.gateState ?? null,
              note: input.note ?? null,
            })
            .where(eq(assessment.id, existing.id));
        } else {
          await tx.insert(assessment).values({
            applicationId: app.id,
            choiceId,
            criterionId: crit.id,
            assessorId: me,
            rating: input.rating ?? null,
            gateState: input.gateState ?? null,
            note: input.note ?? null,
          });
        }
        await logAction(tx, {
          recruitmentId: rec.id,
          actorId: me,
          action: empty ? 'nilai_dihapus' : 'nilai_disimpan',
          entityType: 'assessment',
          entityId: app.id,
          detail: {
            criterionId: crit.id,
            choiceId,
            rating: input.rating ?? null,
            gateState: input.gateState ?? null,
          },
        });

        // Nilai umum memengaruhi semua divisi pendaftar; nilai divisi hanya divisinya.
        const divisionIds =
          crit.divisionId === null
            ? (
                await tx
                  .select({ d: applicationChoice.divisionId })
                  .from(applicationChoice)
                  .where(eq(applicationChoice.applicationId, app.id))
              ).map((r) => r.d)
            : [crit.divisionId];
        const results = await recomputeDivisions(tx, rec.id, divisionIds);
        return results
          .filter((r) => r.applicationId === app.id)
          .map((r) => ({
            choiceId: r.choiceId,
            score: r.score,
            status: r.status,
          }));
      });
      return { ...OK, statuses };
    }),

  /** Mengganti status pilihan secara manual; alasan wajib, hanya pengambil keputusan. */
  overrideSet: oprecAssessProcedure
    .input(OverrideSetInputSchema)
    .output(OkOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const me = ctx.session.user.id;
      await ctx.db.transaction(async (tx) => {
        const [ch] = await tx
          .select({
            id: applicationChoice.id,
            divisionId: applicationChoice.divisionId,
            score: applicationChoice.score,
            computedStatus: applicationChoice.computedStatus,
          })
          .from(applicationChoice)
          .innerJoin(
            application,
            eq(application.id, applicationChoice.applicationId),
          )
          .where(
            and(
              eq(applicationChoice.id, input.choiceId),
              eq(application.recruitmentId, ctx.recruitment.id),
            ),
          )
          .for('update');
        if (!ch) notFound('Pilihan tidak ditemukan.');
        if (!canDecideDivision(ctx.assess, ch.divisionId)) {
          forbidden(
            'Hanya Kadiv divisi ini dan admin oprec yang boleh mengubah status.',
          );
        }
        await tx
          .update(choiceStatusOverride)
          .set({ clearedAt: new Date() })
          .where(
            and(
              eq(choiceStatusOverride.choiceId, ch.id),
              isNull(choiceStatusOverride.clearedAt),
            ),
          );
        await tx.insert(choiceStatusOverride).values({
          choiceId: ch.id,
          status: input.status,
          reason: input.reason,
          isSensitive: input.isSensitive,
          setBy: me,
          computedStatusAtOverride: ch.computedStatus,
          scoreAtOverride: ch.score,
        });
        await logAction(tx, {
          recruitmentId: ctx.recruitment.id,
          actorId: me,
          action: 'status_diubah',
          entityType: 'application_choice',
          entityId: ch.id,
          detail: {
            status: input.status,
            sensitive: input.isSensitive,
            computed: ch.computedStatus,
          },
        });
      });
      return OK;
    }),

  overrideClear: oprecAssessProcedure
    .input(OverrideClearInputSchema)
    .output(OkOutputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        const [ch] = await tx
          .select({
            id: applicationChoice.id,
            divisionId: applicationChoice.divisionId,
          })
          .from(applicationChoice)
          .innerJoin(
            application,
            eq(application.id, applicationChoice.applicationId),
          )
          .where(
            and(
              eq(applicationChoice.id, input.choiceId),
              eq(application.recruitmentId, ctx.recruitment.id),
            ),
          );
        if (!ch) notFound('Pilihan tidak ditemukan.');
        if (!canDecideDivision(ctx.assess, ch.divisionId)) {
          forbidden(
            'Hanya Kadiv divisi ini dan admin oprec yang boleh mengubah status.',
          );
        }
        await tx
          .update(choiceStatusOverride)
          .set({ clearedAt: new Date() })
          .where(
            and(
              eq(choiceStatusOverride.choiceId, ch.id),
              isNull(choiceStatusOverride.clearedAt),
            ),
          );
        await logAction(tx, {
          recruitmentId: ctx.recruitment.id,
          actorId: ctx.session.user.id,
          action: 'status_dikembalikan',
          entityType: 'application_choice',
          entityId: ch.id,
        });
      });
      return OK;
    }),

  /** Riwayat override satu pilihan; alasan sensitif hanya bagi pengambil keputusan. */
  overrideHistory: oprecAssessProcedure
    .input(OverrideHistoryInputSchema)
    .query(async ({ ctx, input }) => {
      const [ch] = await ctx.db
        .select({
          id: applicationChoice.id,
          divisionId: applicationChoice.divisionId,
        })
        .from(applicationChoice)
        .innerJoin(
          application,
          eq(application.id, applicationChoice.applicationId),
        )
        .where(
          and(
            eq(applicationChoice.id, input.choiceId),
            eq(application.recruitmentId, ctx.recruitment.id),
          ),
        );
      if (!ch) notFound('Pilihan tidak ditemukan.');
      if (!canAssessScope(ctx.assess, ch.divisionId))
        forbidden('Tidak ada akses.');
      const rows = await ctx.db
        .select()
        .from(choiceStatusOverride)
        .where(eq(choiceStatusOverride.choiceId, ch.id))
        .orderBy(asc(choiceStatusOverride.setAt));
      const see = canSeeSensitive(ctx.assess);
      return rows.map((r) => ({
        id: r.id,
        status: r.status,
        reason: r.isSensitive && !see ? null : r.reason,
        isSensitive: r.isSensitive,
        setAt: r.setAt,
        clearedAt: r.clearedAt,
      }));
    }),

  /** Kemajuan penilaian per lingkup (umum dan tiap divisi), untuk kartu ringkasan. */
  assessProgress: oprecAssessProcedure
    .input(RecruitmentIdInputSchema)
    .query(async ({ ctx }) => {
      if (!ctx.assess.isAdmin) forbidden('Hanya admin oprec.');
      const rec = ctx.recruitment;
      const minReviewers = Math.max(1, rec.minReviewers);
      const apps = await ctx.db
        .select({ id: application.id })
        .from(application)
        .where(eq(application.recruitmentId, rec.id));
      const divisions = await ctx.db
        .select({ id: recruitmentDivision.id, label: organizationUnit.name })
        .from(recruitmentDivision)
        .innerJoin(
          organizationUnit,
          eq(organizationUnit.id, recruitmentDivision.unitId),
        )
        .where(eq(recruitmentDivision.recruitmentId, rec.id))
        .orderBy(asc(recruitmentDivision.sortOrder));
      const criteria = await ctx.db
        .select({
          id: criterion.id,
          divisionId: criterion.divisionId,
          kind: criterion.kind,
        })
        .from(criterion)
        .where(eq(criterion.recruitmentId, rec.id));
      const assessable = criteria.filter((c) => c.kind !== 'gugur_otomatis');
      const choices = await ctx.db
        .select({
          id: applicationChoice.id,
          applicationId: applicationChoice.applicationId,
          divisionId: applicationChoice.divisionId,
        })
        .from(applicationChoice)
        .innerJoin(
          application,
          eq(application.id, applicationChoice.applicationId),
        )
        .where(eq(application.recruitmentId, rec.id));
      const statusCounts = await ctx.db
        .select({
          divisionId: applicationChoice.divisionId,
          status: applicationChoice.computedStatus,
          n: count(),
        })
        .from(applicationChoice)
        .innerJoin(
          application,
          eq(application.id, applicationChoice.applicationId),
        )
        .where(eq(application.recruitmentId, rec.id))
        .groupBy(
          applicationChoice.divisionId,
          applicationChoice.computedStatus,
        );

      // Jumlah penilai yang sudah mengisi, per (pendaftar, pilihan, kriteria).
      const reviewers = new Map<string, number>();
      if (assessable.length > 0) {
        const rows = await ctx.db
          .select({
            applicationId: assessment.applicationId,
            choiceId: assessment.choiceId,
            criterionId: assessment.criterionId,
            rating: assessment.rating,
            gateState: assessment.gateState,
          })
          .from(assessment)
          .innerJoin(application, eq(application.id, assessment.applicationId))
          .where(eq(application.recruitmentId, rec.id));
        for (const r of rows) {
          if (r.rating === null && r.gateState === null) continue;
          const key = `${r.applicationId}|${r.choiceId ?? ''}|${r.criterionId}`;
          reviewers.set(key, (reviewers.get(key) ?? 0) + 1);
        }
      }
      const done = (
        applicationId: string,
        choiceId: string | null,
        list: { id: string }[],
      ) =>
        list.length > 0 &&
        list.every(
          (c) =>
            (reviewers.get(`${applicationId}|${choiceId ?? ''}|${c.id}`) ??
              0) >= minReviewers,
        );

      const umum = assessable.filter((c) => c.divisionId === null);
      return {
        applications: apps.length,
        scopes: [
          {
            scope: 'umum',
            label: 'Umum',
            assessable: umum.length,
            completed: apps.filter((a) => done(a.id, null, umum)).length,
            total: apps.length,
          },
          ...divisions.map((d) => {
            const list = assessable.filter((c) => c.divisionId === d.id);
            const mine = choices.filter((c) => c.divisionId === d.id);
            return {
              scope: d.id,
              label: d.label,
              assessable: list.length,
              completed: mine.filter((c) => done(c.applicationId, c.id, list))
                .length,
              total: mine.length,
            };
          }),
        ],
        statusCounts,
      };
    }),
};
