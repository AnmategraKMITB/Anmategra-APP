import { TRPCError } from '@trpc/server';
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lte,
  sql,
} from 'drizzle-orm';
import { createTRPCRouter, formScopedProcedure } from '~/server/api/trpc';
import {
  formAnswer,
  formField,
  formFieldOption,
  formSection,
  formSubmission,
  mahasiswa,
  users,
} from '~/server/db/schema';

import {
  ResponsesGetInputSchema,
  ResponsesGetOutputSchema,
  ResponsesListInputSchema,
  ResponsesListOutputSchema,
  ResponsesSummaryInputSchema,
  ResponsesSummaryOutputSchema,
} from '../../types/form.type';
import { type Queryable, isAnswerable } from './services';
import { type SummaryField, buildSummary } from './summary';

/**
 * Semua pertanyaan yang bisa dijawab, termasuk yang sudah diarsipkan (jawaban
 * lamanya tetap perlu terbaca). Urutan form dulu, yang terarsip di akhir.
 */
export async function loadResponseFields(db: Queryable, formId: string) {
  const joined = await db
    .select({ field: formField })
    .from(formField)
    .leftJoin(formSection, eq(formField.sectionId, formSection.id))
    .where(eq(formField.formId, formId))
    .orderBy(
      sql`${formSection.sortOrder} asc nulls first`,
      asc(formSection.id),
      asc(formField.sortOrder),
      asc(formField.created_at),
    );
  const fields = joined.map((r) => r.field).filter((f) => isAnswerable(f.type));
  return [
    ...fields.filter((f) => !f.archivedAt),
    ...fields.filter((f) => f.archivedAt),
  ];
}

export function toColumns(fields: Awaited<ReturnType<typeof loadResponseFields>>) {
  return fields.map((f) => ({
    fieldId: f.id,
    type: f.type,
    label: f.label,
    archived: !!f.archivedAt,
  }));
}

type ResponseRowOut = {
  id: string;
  submittedAt: Date;
  updatedAt: Date;
  respondent: { name: string | null; nim: number | null; email: string | null };
  answers: Record<string, unknown>;
};

export async function attachAnswers(
  db: Queryable,
  submissions: Omit<ResponseRowOut, 'answers'>[],
): Promise<ResponseRowOut[]> {
  if (submissions.length === 0) return [];
  const answers = await db
    .select({
      submissionId: formAnswer.submissionId,
      fieldId: formAnswer.fieldId,
      value: formAnswer.value,
    })
    .from(formAnswer)
    .where(
      inArray(
        formAnswer.submissionId,
        submissions.map((s) => s.id),
      ),
    );
  const bySubmission = new Map<string, Record<string, unknown>>();
  for (const a of answers) {
    if (!a.fieldId) continue;
    const mine = bySubmission.get(a.submissionId) ?? {};
    mine[a.fieldId] = a.value;
    bySubmission.set(a.submissionId, mine);
  }
  return submissions.map((s) => ({
    ...s,
    answers: bySubmission.get(s.id) ?? {},
  }));
}

export function submissionQuery(db: Queryable) {
  return db
    .select({
      id: formSubmission.id,
      submittedAt: formSubmission.submittedAt,
      updatedAt: formSubmission.updatedAt,
      name: users.name,
      email: users.email,
      nim: mahasiswa.nim,
    })
    .from(formSubmission)
    .innerJoin(users, eq(users.id, formSubmission.userId))
    .leftJoin(mahasiswa, eq(mahasiswa.userId, formSubmission.userId));
}

export function toRespondent(r: {
  id: string;
  submittedAt: Date;
  updatedAt: Date;
  name: string | null;
  email: string | null;
  nim: number | null;
}) {
  return {
    id: r.id,
    submittedAt: r.submittedAt,
    updatedAt: r.updatedAt,
    respondent: { name: r.name, nim: r.nim, email: r.email },
  };
}

export const formResponsesRouter = createTRPCRouter({
  /** Tabel respons, terbaru dulu. Nama dan NIM hanya terlihat oleh pengelola form. */
  list: formScopedProcedure
    .input(ResponsesListInputSchema)
    .output(ResponsesListOutputSchema)
    .query(async ({ ctx, input }) => {
      const scope = and(
        eq(formSubmission.formId, ctx.form.id),
        input.until ? lte(formSubmission.submittedAt, input.until) : undefined,
      );
      const [fields, [totalRow], page] = await Promise.all([
        loadResponseFields(ctx.db, ctx.form.id),
        ctx.db.select({ total: count() }).from(formSubmission).where(scope),
        submissionQuery(ctx.db)
          .where(scope)
          .orderBy(desc(formSubmission.submittedAt), desc(formSubmission.id))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
      ]);
      return {
        columns: toColumns(fields),
        rows: await attachAnswers(ctx.db, page.map(toRespondent)),
        total: totalRow?.total ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  get: formScopedProcedure
    .input(ResponsesGetInputSchema)
    .output(ResponsesGetOutputSchema)
    .query(async ({ ctx, input }) => {
      const [found] = await submissionQuery(ctx.db).where(
        and(
          eq(formSubmission.id, input.submissionId),
          eq(formSubmission.formId, ctx.form.id),
        ),
      );
      if (!found) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Respons tidak ditemukan.',
        });
      }
      const [fields, [row]] = await Promise.all([
        loadResponseFields(ctx.db, ctx.form.id),
        attachAnswers(ctx.db, [toRespondent(found)]),
      ]);
      return { columns: toColumns(fields), row: row! };
    }),

  /**
   * Dihitung di server dari seluruh jawaban form ini. Cukup untuk skala
   * sekarang (ratusan respons); untuk puluhan ribu perlu diagregasi di SQL.
   */
  summary: formScopedProcedure
    .input(ResponsesSummaryInputSchema)
    .output(ResponsesSummaryOutputSchema)
    .query(async ({ ctx }) => {
      const [fields, [totalRow], answers] = await Promise.all([
        loadResponseFields(ctx.db, ctx.form.id),
        ctx.db
          .select({ total: count() })
          .from(formSubmission)
          .where(eq(formSubmission.formId, ctx.form.id)),
        ctx.db
          .select({
            fieldId: formAnswer.fieldId,
            value: formAnswer.value,
            submittedAt: formSubmission.submittedAt,
          })
          .from(formAnswer)
          .innerJoin(
            formSubmission,
            eq(formSubmission.id, formAnswer.submissionId),
          )
          .where(eq(formSubmission.formId, ctx.form.id)),
      ]);

      const options = fields.length
        ? await ctx.db
            .select({
              id: formFieldOption.id,
              fieldId: formFieldOption.fieldId,
              label: formFieldOption.label,
            })
            .from(formFieldOption)
            .where(
              and(
                inArray(
                  formFieldOption.fieldId,
                  fields.map((f) => f.id),
                ),
                isNull(formFieldOption.archivedAt),
              ),
            )
            .orderBy(
              asc(formFieldOption.sortOrder),
              asc(formFieldOption.created_at),
            )
        : [];

      const summaryFields: SummaryField[] = fields.map((f) => ({
        id: f.id,
        type: f.type,
        label: f.label,
        archived: !!f.archivedAt,
        options: options
          .filter((o) => o.fieldId === f.id)
          .map((o) => ({ id: o.id, label: o.label })),
        config:
          f.config && typeof f.config === 'object' && !Array.isArray(f.config)
            ? f.config
            : {},
      }));

      return buildSummary(
        summaryFields,
        answers.flatMap((a) =>
          a.fieldId
            ? [
                {
                  fieldId: a.fieldId,
                  value: a.value,
                  submittedAt: a.submittedAt,
                },
              ]
            : [],
        ),
        totalRow?.total ?? 0,
      );
    }),
});
