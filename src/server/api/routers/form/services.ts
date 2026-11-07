import { TRPCError } from '@trpc/server';
import type { inferAsyncReturnType } from '@trpc/server';
import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { type createTRPCContext } from '~/server/api/trpc';
import {
  type FormFieldType,
  form,
  formAnswer,
  formField,
  formFieldOption,
  formSubmission,
} from '~/server/db/schema';

import {
  type FieldConfig,
  FieldConfigSchema,
  type FieldOutput,
  type FormOutput,
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

type FieldRow = typeof formField.$inferSelect;
type OptionRow = typeof formFieldOption.$inferSelect;

/**
 * `form_field.config` adalah jsonb, jadi isinya tidak dijamin oleh tipe apa
 * pun — sebelumnya hanya di-cast. Baris yang bentuknya tak dikenal (misalnya
 * ditulis tangan ke database, atau sisa dari versi skema lama) membuat aturan
 * validasinya **dilewati diam-diam** saat jawaban diperiksa: pertanyaan yang
 * seharusnya mewajibkan format tertentu jadi menerima apa saja. Lebih baik
 * gagal terang-terangan daripada memvalidasi setengah-setengah.
 */
function parseFieldConfig(field: FieldRow): FieldConfig {
  const hasil = FieldConfigSchema.safeParse(field.config);
  if (!hasil.success) {
    console.error('config pertanyaan tidak valid', {
      fieldId: field.id,
      issues: hasil.error.issues,
    });
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Konfigurasi pertanyaan "${field.label}" tidak valid. Hubungi pengelola formulir.`,
    });
  }
  return hasil.data;
}

function toFieldOutput(field: FieldRow, options: OptionRow[]): FieldOutput {
  return {
    id: field.id,
    type: field.type,
    label: field.label,
    description: field.description,
    required: field.required,
    config: parseFieldConfig(field),
    sortOrder: field.sortOrder,
    options: options
      .filter((o) => o.fieldId === field.id)
      .map((o) => ({ id: o.id, label: o.label, sortOrder: o.sortOrder })),
  };
}

/** Active options of the given fields, in display order. */
function loadActiveOptions(db: Queryable, fieldIds: string[]) {
  return db
    .select()
    .from(formFieldOption)
    .where(
      and(
        inArray(formFieldOption.fieldId, fieldIds),
        isNull(formFieldOption.archivedAt),
      ),
    )
    .orderBy(asc(formFieldOption.sortOrder), asc(formFieldOption.created_at));
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

  const options = await loadActiveOptions(
    db,
    fields.map((f) => f.id),
  );

  return fields.map((f) => toFieldOutput(f, options));
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

/**
 * Exclusive lock on the form row, for writes by its managers. Serialises
 * managers against each other and against in-flight submits.
 */
export async function lockForm(tx: Tx, formId: string): Promise<FormRow> {
  return selectFormLocked(tx, formId, 'update');
}

/**
 * Shared lock on the form row, for respondents.
 *
 * Submits must not queue behind one another: at an oprec deadline hundreds of
 * students post at the same moment, and an exclusive lock would make them wait
 * in line for the slowest one. `FOR SHARE` does not conflict with itself, so
 * submits run in parallel — but it does conflict with the `FOR UPDATE` taken
 * by `delete`/`setStatus`/field writes, so a form still cannot be closed or
 * deleted in the middle of a submit (its answers would vanish with the
 * cascade).
 */
export async function lockFormShared(tx: Tx, formId: string): Promise<FormRow> {
  return selectFormLocked(tx, formId, 'share');
}

async function selectFormLocked(
  tx: Tx,
  formId: string,
  mode: 'update' | 'share',
): Promise<FormRow> {
  const [row] = await tx
    .select()
    .from(form)
    .where(eq(form.id, formId))
    .for(mode);
  if (!row) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Formulir tidak ditemukan.',
    });
  }
  return row;
}

/**
 * Serialises one respondent's submits to one form, and nobody else's.
 *
 * The duplicate check below reads the submission rows; without this, two
 * concurrent submits from the same student could both find none and both
 * insert. A transaction-scoped advisory lock keyed on (form, user) is released
 * on commit or rollback, and students who are not this student never wait.
 *
 * A UNIQUE index would also stop the race, but `(form_id, user_id)` cannot be
 * unique outright: `allow_multiple_submissions` legitimately permits repeats,
 * and it lives on `form`, which an index predicate on `form_submission` cannot
 * read.
 */
export async function lockSubmitSlot(tx: Tx, formId: string, userId: string) {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${formId}), hashtext(${userId}))`,
  );
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

/**
 * Which of `optionIds` were picked by an answer (single or multiple choice).
 *
 * One query for the whole set: `syncOptions` needs the answer, option by
 * option, and asking per option meant one round-trip each.
 */
export async function optionsWithAnswers(
  db: Queryable,
  fieldId: string,
  optionIds: string[],
): Promise<Set<string>> {
  if (optionIds.length === 0) return new Set();
  const daftar = sql.join(
    optionIds.map((id) => sql`(${id}::varchar)`),
    sql`, `,
  );
  const rows = await db.execute<{ id: string }>(
    sql`select v.id from (values ${daftar}) as v(id)
        where exists (
          select 1
          from ${formAnswer} a
          where a.field_id = ${fieldId}
            and (a.value @> jsonb_build_object('optionId', v.id)
                 or a.value @> jsonb_build_array(jsonb_build_object('optionId', v.id)))
        )`,
  );
  return new Set([...rows].map((r) => r.id));
}

/** Fetches one field in output shape (active options only). */
export async function loadFieldOutput(
  db: Queryable,
  formId: string,
  fieldId: string,
): Promise<FieldOutput> {
  // Scoped by formId inside getActiveField, which also raises NOT_FOUND.
  const field = await getActiveField(db, formId, fieldId);
  const options = await loadActiveOptions(db, [field.id]);
  return toFieldOutput(field, options);
}

/** Re-throws TRPCErrors untouched; anything else becomes a generic 500. */
export function rethrow(error: unknown, message: string): never {
  if (error instanceof TRPCError) throw error;
  console.error(message, error);
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
}
