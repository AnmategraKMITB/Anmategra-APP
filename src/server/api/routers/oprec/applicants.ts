import { TRPCError } from '@trpc/server';
import {
  type SQL,
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  or,
  sql,
} from 'drizzle-orm';
import { oprecScopedProcedure } from '~/server/api/trpc';
import {
  application,
  applicationChoice,
  formSubmission,
  mahasiswa,
  organizationUnit,
  recruitmentDivision,
  recruitmentWave,
  users,
} from '~/server/db/schema';

import {
  ApplicantDetailInputSchema,
  ApplicantsListInputSchema,
  RecruitmentIdInputSchema,
} from '../../types/oprec.type';
import {
  attachAnswers,
  loadResponseFields,
  submissionQuery,
  toColumns,
  toRespondent,
} from '../form/responses';
import { type Queryable, loadRecruitmentDetail } from './services';

type ApplicantsFilter = {
  search?: string;
  waveId?: string;
  divisionId?: string;
  angkatan?: number;
  prodi?: string;
};

/** Nama tampil: nama di data mahasiswa, lalu nama akun. */
const displayName = sql<
  string | null
>`coalesce(${mahasiswa.nama}, ${users.name})`;

function whereOf(recruitmentId: string, f: ApplicantsFilter): SQL {
  const parts: (SQL | undefined)[] = [
    eq(application.recruitmentId, recruitmentId),
  ];
  if (f.search) {
    const like = `%${f.search.replace(/[\\%_]/g, '\\$&')}%`;
    parts.push(
      or(
        ilike(mahasiswa.nama, like),
        ilike(users.name, like),
        sql`${mahasiswa.nim}::text like ${like}`,
      ),
    );
  }
  if (f.waveId) parts.push(eq(application.waveId, f.waveId));
  if (f.angkatan !== undefined) parts.push(eq(mahasiswa.angkatan, f.angkatan));
  if (f.prodi) parts.push(eq(mahasiswa.jurusan, f.prodi));
  if (f.divisionId) {
    parts.push(
      exists(
        sql`(select 1 from ${applicationChoice} where ${applicationChoice.applicationId} = ${application.id} and ${applicationChoice.divisionId} = ${f.divisionId})`,
      ),
    );
  }
  return and(...parts)!;
}

/** Nama tujuan pilihan ke-1, untuk mengelompokkan dan mengurutkan. */
const firstChoiceLabel = sql<string | null>`(
  select ${organizationUnit.name}
  from ${applicationChoice}
  join ${recruitmentDivision} on ${recruitmentDivision.id} = ${applicationChoice.divisionId}
  join ${organizationUnit} on ${organizationUnit.id} = ${recruitmentDivision.unitId}
  where ${applicationChoice.applicationId} = ${application.id} and ${applicationChoice.rank} = 1
)`;

function groupKeyOf(groupBy: string) {
  switch (groupBy) {
    case 'gelombang':
      return sql<string | null>`${recruitmentWave.label}`;
    case 'pilihan1':
      return firstChoiceLabel;
    case 'angkatan':
      return sql<string | null>`${mahasiswa.angkatan}::text`;
    case 'prodi':
      return sql<string | null>`${mahasiswa.jurusan}`;
    default:
      return sql<string | null>`null`;
  }
}

async function choicesOf(db: Queryable, applicationIds: string[]) {
  if (applicationIds.length === 0) return new Map<string, unknown[]>();
  const rows = await db
    .select({
      applicationId: applicationChoice.applicationId,
      rank: applicationChoice.rank,
      origin: applicationChoice.origin,
      divisionId: applicationChoice.divisionId,
      label: organizationUnit.name,
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
    .orderBy(asc(applicationChoice.rank));
  const byApp = new Map<string, unknown[]>();
  for (const { applicationId, ...choice } of rows) {
    byApp.set(applicationId, [...(byApp.get(applicationId) ?? []), choice]);
  }
  return byApp;
}

export const applicantProcedures = {
  /** Angka untuk kartu ringkasan dan pilihan filter. */
  applicantSummary: oprecScopedProcedure
    .input(RecruitmentIdInputSchema)
    .query(async ({ ctx, input }) => {
      const recruitmentId = input.recruitmentId;
      const detail = await loadRecruitmentDetail(ctx.db, recruitmentId);
      const [byChoice, byWave, people] = await Promise.all([
        ctx.db
          .select({
            rank: applicationChoice.rank,
            divisionId: applicationChoice.divisionId,
            n: count(),
          })
          .from(applicationChoice)
          .innerJoin(
            application,
            eq(application.id, applicationChoice.applicationId),
          )
          .where(eq(application.recruitmentId, recruitmentId))
          .groupBy(applicationChoice.rank, applicationChoice.divisionId),
        ctx.db
          .select({ waveId: application.waveId, n: count() })
          .from(application)
          .where(eq(application.recruitmentId, recruitmentId))
          .groupBy(application.waveId),
        ctx.db
          .select({ angkatan: mahasiswa.angkatan, prodi: mahasiswa.jurusan })
          .from(application)
          .innerJoin(mahasiswa, eq(mahasiswa.userId, application.userId))
          .where(eq(application.recruitmentId, recruitmentId))
          .groupBy(mahasiswa.angkatan, mahasiswa.jurusan),
      ]);
      const labelOf = new Map(detail.divisions.map((d) => [d.id, d.unitName]));
      const waveCount = new Map(byWave.map((w) => [w.waveId, w.n]));
      const total = byWave.reduce((sum, w) => sum + w.n, 0);
      return {
        total,
        maxChoices: detail.maxChoices,
        // Hanya pilihan bernomor; closerec dan pilihan dialihkan tak punya urutan.
        byRank: Array.from({ length: detail.maxChoices }, (_, i) => ({
          rank: i + 1,
          items: byChoice
            .filter((c) => c.rank === i + 1)
            .map((c) => ({
              divisionId: c.divisionId,
              label: labelOf.get(c.divisionId) ?? '',
              count: c.n,
            }))
            .sort(
              (a, b) => b.count - a.count || a.label.localeCompare(b.label),
            ),
        })),
        byWave: [
          ...detail.waves.map((w) => ({
            waveId: w.id as string | null,
            label: w.label,
            count: waveCount.get(w.id) ?? 0,
          })),
          ...(waveCount.get(null)
            ? [
                {
                  waveId: null,
                  label: 'Tanpa gelombang',
                  count: waveCount.get(null)!,
                },
              ]
            : []),
        ],
        divisions: detail.divisions.map((d) => ({
          id: d.id,
          label: d.unitName,
        })),
        angkatan: [...new Set(people.map((p) => p.angkatan))].sort(
          (a, b) => b - a,
        ),
        prodi: [...new Set(people.map((p) => p.prodi))].sort((a, b) =>
          a.localeCompare(b),
        ),
      };
    }),

  applicants: oprecScopedProcedure
    .input(ApplicantsListInputSchema)
    .query(async ({ ctx, input }) => {
      const where = whereOf(input.recruitmentId, input);
      const groupKey = groupKeyOf(input.groupBy);

      const groupOrder: SQL[] =
        input.groupBy === 'gelombang'
          ? [sql`${recruitmentWave.sortOrder} asc nulls last`]
          : input.groupBy === 'angkatan'
            ? [desc(mahasiswa.angkatan)]
            : input.groupBy === 'pilihan1'
              ? [sql`${firstChoiceLabel} asc nulls last`]
              : input.groupBy === 'prodi'
                ? [asc(mahasiswa.jurusan)]
                : [];
      const sortOrder: SQL[] =
        input.sort === 'gelombang'
          ? [sql`${recruitmentWave.sortOrder} asc nulls last`, asc(displayName)]
          : input.sort === 'angkatan'
            ? [desc(mahasiswa.angkatan), asc(displayName)]
            : input.sort === 'prodi'
              ? [asc(mahasiswa.jurusan), asc(displayName)]
              : input.sort === 'waktu'
                ? [desc(application.submittedAt)]
                : [asc(displayName)];

      const base = ctx.db
        .select({
          id: application.id,
          name: displayName,
          nim: mahasiswa.nim,
          prodi: mahasiswa.jurusan,
          angkatan: mahasiswa.angkatan,
          waveId: application.waveId,
          waveLabel: recruitmentWave.label,
          source: application.source,
          willingToMove: application.willingToMove,
          submittedAt: application.submittedAt,
          groupKey,
        })
        .from(application)
        .innerJoin(users, eq(users.id, application.userId))
        .leftJoin(mahasiswa, eq(mahasiswa.userId, application.userId))
        .leftJoin(recruitmentWave, eq(recruitmentWave.id, application.waveId))
        .where(where);

      const [rows, [totalRow]] = await Promise.all([
        base
          .orderBy(...groupOrder, ...sortOrder, asc(application.id))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db
          .select({ n: count() })
          .from(application)
          .innerJoin(users, eq(users.id, application.userId))
          .leftJoin(mahasiswa, eq(mahasiswa.userId, application.userId))
          .where(where),
      ]);
      const choices = await choicesOf(
        ctx.db,
        rows.map((r) => r.id),
      );
      return {
        total: totalRow?.n ?? 0,
        page: input.page,
        pageSize: input.pageSize,
        rows: rows.map((r) => ({
          ...r,
          choices: choices.get(r.id) ?? [],
        })),
      };
    }),

  /** Berkas satu pendaftar: identitas, pilihan, dan jawaban formulir. */
  applicantDetail: oprecScopedProcedure
    .input(ApplicantDetailInputSchema)
    .query(async ({ ctx, input }) => {
      const [app] = await ctx.db
        .select({
          id: application.id,
          source: application.source,
          willingToMove: application.willingToMove,
          submittedAt: application.submittedAt,
          formSubmissionId: application.formSubmissionId,
          waveLabel: recruitmentWave.label,
          name: displayName,
          nim: mahasiswa.nim,
          prodi: mahasiswa.jurusan,
          angkatan: mahasiswa.angkatan,
        })
        .from(application)
        .innerJoin(users, eq(users.id, application.userId))
        .leftJoin(mahasiswa, eq(mahasiswa.userId, application.userId))
        .leftJoin(recruitmentWave, eq(recruitmentWave.id, application.waveId))
        .where(
          and(
            eq(application.id, input.applicationId),
            eq(application.recruitmentId, input.recruitmentId),
          ),
        );
      if (!app) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pendaftar tidak ditemukan.',
        });
      }
      const choices = (await choicesOf(ctx.db, [app.id])).get(app.id) ?? [];
      let columns: ReturnType<typeof toColumns> = [];
      let answers: Record<string, unknown> = {};
      if (app.formSubmissionId) {
        // Dikunci ke form oprec ini lewat recruitment, bukan input klien.
        const [found] = await submissionQuery(ctx.db).where(
          and(
            eq(formSubmission.id, app.formSubmissionId),
            eq(formSubmission.formId, ctx.recruitment.formId),
          ),
        );
        if (found) {
          const [row] = await attachAnswers(ctx.db, [toRespondent(found)]);
          answers = row?.answers ?? {};
          columns = toColumns(
            await loadResponseFields(ctx.db, ctx.recruitment.formId),
          );
        }
      }
      return { ...app, choices, columns, answers };
    }),
};
