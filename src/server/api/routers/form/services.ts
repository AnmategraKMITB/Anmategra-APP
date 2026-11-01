import { TRPCError } from '@trpc/server';
import type { inferAsyncReturnType } from '@trpc/server';
import { and, asc, count, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { type createTRPCContext } from '~/server/api/trpc';
import {
  type FormFieldType,
  form,
  formAnswer,
  formField,
  formFieldOption,
  formSubmission,
} from '~/server/db/schema';

import type {
  FieldConfig,
  FieldOutput,
  FormOutput,
} from '../../types/form.type';

type TRPCContext = inferAsyncReturnType<typeof createTRPCContext>;
export type Db = TRPCContext['db'];
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Anything that can run a query: the root db or an open transaction. */
export type Queryable = Db | Tx;

export type FormRow = typeof form.$inferSelect;

export const CHOICE_TYPES: readonly FormFieldType[] = [
  'single_choice',
  'multiple_choice',
];

export function isChoiceType(type: FormFieldType): boolean {
  return CHOICE_TYPES.includes(type);
}

export function toFormOutput(row: FormRow): FormOutput {
  return {
    id: row.id,
    lembagaId: row.lembagaId,
    eventId: row.eventId,
    title: row.title,
    description: row.description,
    status: row.status,
    closesAt: row.closesAt,
    allowMultipleSubmissions: row.allowMultipleSubmissions,
    publishedAt: row.publishedAt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Published and not past its deadline. */
export function isAcceptingResponses(row: FormRow, now = new Date()): boolean {
  return (
    row.status === 'Published' &&
    (row.closesAt === null || row.closesAt.getTime() > now.getTime())
  );
}

export async function countSubmissions(
  db: Queryable,
  formIds: string[],
): Promise<Map<string, number>> {
  if (formIds.length === 0) return new Map();
  const rows = await db
    .select({ formId: formSubmission.formId, n: count() })
    .from(formSubmission)
    .where(inArray(formSubmission.formId, formIds))
    .groupBy(formSubmission.formId);
  return new Map(rows.map((r) => [r.formId, r.n]));
}

/** Active (non-archived) fields with their active options, in display order. */
export async function loadActiveFields(
  db: Queryable,
  formId: string,
): Promise<FieldOutput[]> {
  const fields = await db
    .select()
    .from(formField)
    .where(and(eq(formField.formId, formId), isNull(formField.archivedAt)))
    .orderBy(asc(formField.sortOrder), asc(formField.created_at));
  if (fields.length === 0) return [];

  const options = await db
    .select()
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
    .orderBy(asc(formFieldOption.sortOrder), asc(formFieldOption.created_at));

  return fields.map((f) => ({
    id: f.id,
    type: f.type,
    label: f.label,
    description: f.description,
    required: f.required,
    config: f.config as FieldConfig,
    sortOrder: f.sortOrder,
    options: options
      .filter((o) => o.fieldId === f.id)
      .map((o) => ({ id: o.id, label: o.label, sortOrder: o.sortOrder })),
  }));
}

/**
 * A form may only be published (or reopened) when someone can actually fill
 * it in: at least one question, every choice question has options, the
 * selection limits still fit, and the deadline is not already behind us.
 */
export function assertPublishable(row: FormRow, fields: FieldOutput[]) {
  const fail = (message: string) => {
    throw new TRPCError({ code: 'BAD_REQUEST', message });
  };

  if (fields.length === 0) {
    fail('Formulir belum memiliki pertanyaan.');
  }
  if (row.closesAt && row.closesAt.getTime() <= Date.now()) {
    fail('Tenggat penutupan sudah lewat. Perbarui tenggat terlebih dahulu.');
  }
  for (const field of fields) {
    if (isChoiceType(field.type) && field.options.length === 0) {
      fail(`Pertanyaan "${field.label}" belum memiliki pilihan.`);
    }
    if (field.type === 'multiple_choice') {
      const { minSelections, maxSelections } = field.config;
      const n = field.options.length;
      if (
        (minSelections !== undefined && minSelections > n) ||
        (maxSelections !== undefined && maxSelections > n)
      ) {
        fail(
          `Batas jumlah pilihan pada "${field.label}" melebihi banyaknya pilihan.`,
        );
      }
    }
  }
}

/** Locks the form row for the rest of the transaction. */
export async function lockForm(tx: Tx, formId: string): Promise<FormRow> {
  const [row] = await tx
    .select()
    .from(form)
    .where(eq(form.id, formId))
    .for('update');
  if (!row) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Formulir tidak ditemukan.',
    });
  }
  return row;
}

/** Active field that belongs to `formId`, or NOT_FOUND. */
export async function getActiveField(
  db: Queryable,
  formId: string,
  fieldId: string,
) {
  const [row] = await db
    .select()
    .from(formField)
    .where(
      and(
        eq(formField.id, fieldId),
        // Scoping by formId is the cross-tenant guard: formScopedProcedure
        // only proved access to the form, not to an arbitrary fieldId.
        eq(formField.formId, formId),
        isNull(formField.archivedAt),
      ),
    );
  if (!row) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Pertanyaan tidak ditemukan pada formulir ini.',
    });
  }
  return row;
}

export async function fieldHasAnswers(db: Queryable, fieldId: string) {
  const [row] = await db
    .select({ id: formAnswer.id })
    .from(formAnswer)
    .where(eq(formAnswer.fieldId, fieldId))
    .limit(1);
  return !!row;
}

/** Whether any answer picked this option (single or multiple choice). */
export async function optionHasAnswers(
  db: Queryable,
  fieldId: string,
  optionId: string,
) {
  const single = JSON.stringify({ optionId });
  const multiple = JSON.stringify([{ optionId }]);
  const [row] = await db
    .select({ id: formAnswer.id })
    .from(formAnswer)
    .where(
      and(
        eq(formAnswer.fieldId, fieldId),
        or(
          sql`${formAnswer.value} @> ${single}::jsonb`,
          sql`${formAnswer.value} @> ${multiple}::jsonb`,
        ),
      ),
    )
    .limit(1);
  return !!row;
}

/** Fetches one field in output shape (active options only). */
export async function loadFieldOutput(
  db: Queryable,
  formId: string,
  fieldId: string,
): Promise<FieldOutput> {
  const fields = await loadActiveFields(db, formId);
  const found = fields.find((f) => f.id === fieldId);
  if (!found) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Pertanyaan tidak ditemukan pada formulir ini.',
    });
  }
  return found;
}

/** Re-throws TRPCErrors untouched; anything else becomes a generic 500. */
export function rethrow(error: unknown, message: string): never {
  if (error instanceof TRPCError) throw error;
  console.error(message, error);
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
}
