import { TRPCError } from '@trpc/server';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { blindCode } from '~/lib/oprec/scoring';
import { oprecAssessProcedure } from '~/server/api/trpc';
import {
  type GateState,
  application,
  applicationChoice,
  assessment,
  choiceStatusOverride,
  criterion,
  mahasiswa,
  organizationUnit,
  recruitmentDivision,
  recruitmentWave,
  users,
} from '~/server/db/schema';

import { RecruitmentIdInputSchema } from '../../types/oprec.type';
import { canAssessScope, canSeeSensitive } from './assess-access';

const displayName = sql<
  string | null
>`coalesce(${mahasiswa.nama}, ${users.name})`;

const GATE_LABEL: Record<GateState, string> = {
  memenuhi: 'Memenuhi',
  ditinjau: 'Ditinjau',
  tidak: 'Tidak memenuhi',
};

/** Gabungan gate beberapa penilai: sama semua dipakai, berbeda jadi "Ditinjau". */
function gateSummary(states: GateState[]): string | null {
  if (states.length === 0) return null;
  const unique = new Set(states);
  return GATE_LABEL[unique.size === 1 ? states[0]! : 'ditinjau'];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export const exportProcedures = {
  /**
   * Data ekspor Nilai: satu lingkup per tab, hanya lingkup yang boleh dinilai
   * pemanggil. Admin mendapat rata-rata semua penilai per kriteria; penilai
   * lain hanya nilainya sendiri. Mode blind menyembunyikan identitas bagi
   * yang bukan admin. Catatan penilai tidak ikut.
   */
  exportAssessment: oprecAssessProcedure
    .input(RecruitmentIdInputSchema)
    .query(async ({ ctx }) => {
      const rec = ctx.recruitment;
      const a = ctx.assess;
      const me = ctx.session.user.id;
      const hideIdentity = rec.blind && !a.isAdmin;

      const divisions = await ctx.db
        .select({ id: recruitmentDivision.id, label: organizationUnit.name })
        .from(recruitmentDivision)
        .innerJoin(
          organizationUnit,
          eq(organizationUnit.id, recruitmentDivision.unitId),
        )
        .where(eq(recruitmentDivision.recruitmentId, rec.id))
        .orderBy(asc(recruitmentDivision.sortOrder));
      const scopes = [
        ...(canAssessScope(a, null)
          ? [{ divisionId: null as string | null, label: 'Umum' }]
          : []),
        ...divisions
          .filter((d) => canAssessScope(a, d.id))
          .map((d) => ({ divisionId: d.id as string | null, label: d.label })),
      ];
      if (scopes.length === 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Kamu tidak punya lingkup penilaian di oprec ini.',
        });
      }

      const [criteria, apps, choices] = await Promise.all([
        ctx.db
          .select({
            id: criterion.id,
            divisionId: criterion.divisionId,
            kind: criterion.kind,
            name: criterion.name,
          })
          .from(criterion)
          .where(eq(criterion.recruitmentId, rec.id))
          .orderBy(asc(criterion.sortOrder), asc(criterion.created_at)),
        ctx.db
          .select({
            id: application.id,
            name: displayName,
            nim: mahasiswa.nim,
            prodi: mahasiswa.jurusan,
            angkatan: mahasiswa.angkatan,
            waveLabel: recruitmentWave.label,
          })
          .from(application)
          .innerJoin(users, eq(users.id, application.userId))
          .leftJoin(mahasiswa, eq(mahasiswa.userId, application.userId))
          .leftJoin(recruitmentWave, eq(recruitmentWave.id, application.waveId))
          .where(eq(application.recruitmentId, rec.id))
          .orderBy(asc(application.submittedAt), asc(application.id)),
        ctx.db
          .select({
            id: applicationChoice.id,
            applicationId: applicationChoice.applicationId,
            divisionId: applicationChoice.divisionId,
            rank: applicationChoice.rank,
            score: applicationChoice.score,
            computedStatus: applicationChoice.computedStatus,
          })
          .from(applicationChoice)
          .innerJoin(
            application,
            eq(application.id, applicationChoice.applicationId),
          )
          .where(eq(application.recruitmentId, rec.id)),
      ]);
      const assessable = criteria.filter((c) => c.kind !== 'gugur_otomatis');

      const rows = assessable.length
        ? await ctx.db
            .select({
              applicationId: assessment.applicationId,
              choiceId: assessment.choiceId,
              criterionId: assessment.criterionId,
              assessorId: assessment.assessorId,
              rating: assessment.rating,
              gateState: assessment.gateState,
            })
            .from(assessment)
            .where(
              inArray(
                assessment.criterionId,
                assessable.map((c) => c.id),
              ),
            )
        : [];
      const overrides = choices.length
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
                  choices.map((c) => c.id),
                ),
                isNull(choiceStatusOverride.clearedAt),
              ),
            )
        : [];
      const overrideOf = new Map(
        overrides.map((o) => [o.choiceId, o.status] as const),
      );
      const appOf = new Map(apps.map((app) => [app.id, app]));
      const byKey = new Map<string, typeof rows>();
      for (const row of rows) {
        const key = `${row.applicationId}|${row.choiceId ?? ''}|${row.criterionId}`;
        const list = byKey.get(key) ?? [];
        list.push(row);
        byKey.set(key, list);
      }
      const minReviewers = Math.max(1, rec.minReviewers);

      return {
        isAdmin: a.isAdmin,
        blind: hideIdentity,
        ratingMin: rec.ratingMin,
        ratingMax: rec.ratingMax,
        scopes: scopes.map((scope) => {
          const list = assessable.filter(
            (c) => c.divisionId === scope.divisionId,
          );
          type Member = {
            app: (typeof apps)[number];
            choice: (typeof choices)[number] | null;
          };
          const members: Member[] =
            scope.divisionId === null
              ? apps.map((app) => ({ app, choice: null }))
              : choices
                  .filter((c) => c.divisionId === scope.divisionId)
                  .flatMap((choice) => {
                    const app = appOf.get(choice.applicationId);
                    return app ? [{ app, choice }] : [];
                  });
          return {
            label: scope.label,
            isDivision: scope.divisionId !== null,
            criteria: list.map((c) => ({
              id: c.id,
              name: c.name,
              kind: c.kind,
            })),
            rows: members.map(({ app, choice }) => {
              let done = 0;
              const values: Record<string, number | string | null> = {};
              const reviewers: Record<string, number> = {};
              for (const c of list) {
                const filled = (
                  byKey.get(`${app.id}|${choice?.id ?? ''}|${c.id}`) ?? []
                ).filter((r) => r.rating !== null || r.gateState !== null);
                reviewers[c.id] = filled.length;
                if (filled.length >= minReviewers) done++;
                const pool = a.isAdmin
                  ? filled
                  : filled.filter((r) => r.assessorId === me);
                if (c.kind === 'skor') {
                  const ratings = pool.flatMap((r) =>
                    r.rating === null ? [] : [r.rating],
                  );
                  values[c.id] = ratings.length
                    ? round2(
                        ratings.reduce((n, v) => n + v, 0) / ratings.length,
                      )
                    : null;
                } else {
                  values[c.id] = gateSummary(
                    pool.flatMap((r) => (r.gateState ? [r.gateState] : [])),
                  );
                }
              }
              return {
                code: blindCode(app.id),
                name: hideIdentity ? null : app.name,
                nim: hideIdentity ? null : app.nim,
                prodi: hideIdentity ? null : app.prodi,
                angkatan: hideIdentity ? null : app.angkatan,
                waveLabel: app.waveLabel,
                rank: choice?.rank ?? null,
                score:
                  choice?.score === null || choice?.score === undefined
                    ? null
                    : round2(Number(choice.score)),
                status: choice
                  ? (overrideOf.get(choice.id) ?? choice.computedStatus)
                  : null,
                overridden: choice ? overrideOf.has(choice.id) : false,
                done,
                total: list.length,
                values,
                reviewers,
              };
            }),
          };
        }),
      };
    }),

  /**
   * Data diri pendaftar untuk ekspor (email, WhatsApp, LINE, NIM TPB). Admin
   * oprec melihat semuanya, sama seperti pengelola kegiatan di profil;
   * pengurus divisi hanya kontak yang dibuka mahasiswa ke publik. Penilai
   * biasa ditolak supaya mode blind tetap utuh.
   */
  exportContacts: oprecAssessProcedure
    .input(RecruitmentIdInputSchema)
    .query(async ({ ctx }) => {
      const a = ctx.assess;
      if (!canSeeSensitive(a)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Data diri pendaftar hanya untuk admin dan pengurus divisi.',
        });
      }
      const rows = await ctx.db
        .select({
          applicationId: application.id,
          email: users.email,
          whatsapp: mahasiswa.whatsapp,
          line: mahasiswa.lineId,
          nimTpb: mahasiswa.nimTpb,
          showEmail: mahasiswa.showEmail,
          showWhatsapp: mahasiswa.showWhatsapp,
          showLine: mahasiswa.showLine,
        })
        .from(application)
        .innerJoin(users, eq(users.id, application.userId))
        .leftJoin(mahasiswa, eq(mahasiswa.userId, application.userId))
        .where(eq(application.recruitmentId, ctx.recruitment.id));
      const all = a.isAdmin;
      return rows.map((row) => ({
        applicationId: row.applicationId,
        email: all || row.showEmail ? row.email : null,
        whatsapp: all || row.showWhatsapp ? row.whatsapp : null,
        line: all || row.showLine ? row.line : null,
        nimTpb: row.nimTpb,
      }));
    }),
};
