import { TRPCError } from '@trpc/server';
import type { inferAsyncReturnType } from '@trpc/server';
import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNull,
  notInArray,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { randomBytes } from 'node:crypto';
import { richTextToPlain } from '~/app/_components/forms/rich-text';
import {
  type CondField,
  type ConditionIssue,
  readCondition,
  validateConditions,
} from '~/lib/forms/conditions';
import { type createTRPCContext } from '~/server/api/trpc';
import {
  type FormFieldType,
  events,
  form,
  formAnswer,
  formEnding,
  formField,
  formFieldOption,
  formImage,
  formSection,
  formSubmission,
  lembaga,
  organizationUnit,
  recruitment,
  recruitmentDivision,
} from '~/server/db/schema';
import { keyFromUploadUrl } from '~/server/uploads';

import {
  type ConditionInput,
  type FieldConfig,
  FieldConfigSchema,
  type FieldImage,
  FieldImageSchema,
  type FieldOutput,
  type FormEndingOutput,
  type FormOutput,
  type FormSectionOutput,
  FormSettingsSchema,
  FormWelcomeSchema,
  type GetPublicFormOutput,
  StoredFormThemeSchema,
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

/** Question types that carry no answer (shown to the respondent, never saved). */
const NON_ANSWERABLE_TYPES: readonly FormFieldType[] = ['text_block'];

export function isAnswerable(type: FormFieldType): boolean {
  return !NON_ANSWERABLE_TYPES.includes(type);
}

/**
 * The JSON columns hold whatever was last written, so a row from a newer or
 * hand-edited version may not parse. Reading must not break the whole form
 * over a display preference: fall back to the defaults and say so in the log.
 */
function readFormSettings(row: FormRow) {
  const parsed = FormSettingsSchema.safeParse(row.settings);
  if (parsed.success) return parsed.data;
  console.error('settings formulir tidak valid', { formId: row.id });
  return FormSettingsSchema.parse({});
}

function readFormTheme(row: FormRow) {
  const parsed = StoredFormThemeSchema.safeParse(row.theme);
  if (parsed.success) return parsed.data;
  console.error('theme formulir tidak valid', { formId: row.id });
  return {};
}

function readFormWelcome(row: FormRow) {
  const parsed = FormWelcomeSchema.safeParse(row.welcome);
  if (parsed.success) return parsed.data;
  console.error('welcome formulir tidak valid', { formId: row.id });
  return {};
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
    allowEditAfterSubmit: row.allowEditAfterSubmit,
    maxResponses: row.maxResponses,
    publishedAt: row.publishedAt,
    previewEnabled: row.previewEnabled,
    previewToken: row.previewToken,
    settings: readFormSettings(row),
    theme: readFormTheme(row),
    welcome: readFormWelcome(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Published and not past its deadline. Quota is checked separately. */
export function isAcceptingResponses(row: FormRow, now = new Date()): boolean {
  return (
    row.status === 'Published' &&
    (row.closesAt === null || row.closesAt.getTime() > now.getTime())
  );
}

/** Kuota respons sudah terpakai habis. */
export function hasReachedQuota(row: FormRow, count: number): boolean {
  return row.maxResponses !== null && count >= row.maxResponses;
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

/** `condition` kolom jsonb → bentuk keluaran (nilai rusak = tanpa kondisi). */
function conditionOut(value: unknown): ConditionInput | null {
  return readCondition(value) as ConditionInput | null;
}

/** Gambar tersimpan di jsonb; nilai rusak = tanpa gambar. */
export function imageOut(value: unknown): FieldImage | null {
  const parsed = FieldImageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Hanya kunci yang benar-benar diunggah untuk form ini yang boleh dihapus.
 * Klien memilih `key` sendiri, jadi tanpa pemeriksaan ini satu pengelola form
 * bisa menghapus berkas milik gambar profil, lampiran, atau form lain hanya
 * dengan menebak kuncinya.
 */
export async function ownedImageKeys(
  db: Queryable,
  formId: string,
  keys: string[],
): Promise<string[]> {
  const wanted = [...new Set(keys.filter(Boolean))];
  if (wanted.length === 0) return [];
  const rows = await db
    .select({ key: formImage.key })
    .from(formImage)
    .where(and(eq(formImage.formId, formId), inArray(formImage.key, wanted)));
  return rows.map((r) => r.key);
}

/**
 * Kunci milik form ini yang sudah tidak dipakai lagi oleh gambar pertanyaan
 * mana pun atau banner/logo. Satu kunci bisa dipakai di dua tempat (misalnya
 * banner sekaligus ilustrasi), jadi menghapus satu tempat tidak boleh
 * menghapus berkas yang masih tampil di tempat lain.
 */
export async function unreferencedImageKeys(
  db: Queryable,
  formId: string,
  keys: string[],
): Promise<string[]> {
  const owned = await ownedImageKeys(db, formId, keys);
  if (owned.length === 0) return [];

  const [fieldRows, formRows] = await Promise.all([
    db
      .select({ image: formField.image })
      .from(formField)
      .where(eq(formField.formId, formId)),
    db.select({ theme: form.theme }).from(form).where(eq(form.id, formId)),
  ]);
  const used = new Set<string>();
  for (const row of fieldRows) {
    const image = imageOut(row.image);
    if (image) used.add(image.key);
  }
  const theme = formRows[0]?.theme;
  if (theme && typeof theme === 'object') {
    for (const name of ['banner', 'logo'] as const) {
      const value = theme[name];
      if (typeof value === 'string') {
        const key = keyFromUploadUrl(value);
        if (key) used.add(key);
      }
    }
  }
  return owned.filter((key) => !used.has(key));
}

/** URL gambar harus berasal dari unggahan form ini, bukan hanya host yang sah. */
export async function assertOwnedImageUrl(
  db: Queryable,
  formId: string,
  url: string,
) {
  const key = keyFromUploadUrl(url);
  const owned = key
    ? await ownedImageKeys(db, formId, [key])
    : ([] as string[]);
  if (owned.length === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Gambar harus diunggah untuk formulir ini.',
    });
  }
}

/** Kunci dan URL gambar harus cocok dan berasal dari unggahan form ini. */
export async function assertOwnedImage(
  db: Queryable,
  formId: string,
  image: FieldImage,
) {
  if (keyFromUploadUrl(image.url) !== image.key) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Gambar tidak valid. Unggah ulang gambarnya.',
    });
  }
  await assertOwnedImageUrl(db, formId, image.url);
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

type OptionOut = OptionRow & { group?: string | null };

function toFieldOutput(field: FieldRow, options: OptionOut[]): FieldOutput {
  return {
    id: field.id,
    type: field.type,
    label: field.label,
    description: field.description,
    required: field.required,
    config: parseFieldConfig(field),
    sectionId: field.sectionId,
    sortOrder: field.sortOrder,
    condition: conditionOut(field.condition),
    image: imageOut(field.image),
    options: options
      .filter((o) => o.fieldId === field.id)
      .map((o) => ({
        id: o.id,
        label: o.label,
        sortOrder: o.sortOrder,
        ...(o.group === undefined ? {} : { group: o.group }),
      })),
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

type SectionRow = typeof formSection.$inferSelect;

function toSectionOutput(row: SectionRow): FormSectionOutput {
  return {
    id: row.id,
    formId: row.formId,
    title: row.title,
    description: row.description,
    sortOrder: row.sortOrder,
    condition: conditionOut(row.condition),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Sections of a form in display order. */
export async function loadSections(
  db: Queryable,
  formId: string,
): Promise<FormSectionOutput[]> {
  const rows = await db
    .select()
    .from(formSection)
    .where(eq(formSection.formId, formId))
    .orderBy(asc(formSection.sortOrder), asc(formSection.created_at));
  return rows.map(toSectionOutput);
}

/** Section that belongs to `formId`, or NOT_FOUND (same guard as fields). */
export async function getSectionForForm(
  db: Queryable,
  formId: string,
  sectionId: string,
): Promise<SectionRow> {
  const [row] = await db
    .select()
    .from(formSection)
    .where(and(eq(formSection.id, sectionId), eq(formSection.formId, formId)));
  if (!row) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Bagian tidak ditemukan.',
    });
  }
  return row;
}

/**
 * Active (non-archived) fields with their active options, in display order:
 * fields outside any section first, then section by section.
 */
export async function loadActiveFields(
  db: Queryable,
  formId: string,
): Promise<FieldOutput[]> {
  const joined = await db
    .select({ field: formField })
    .from(formField)
    .leftJoin(formSection, eq(formField.sectionId, formSection.id))
    .where(and(eq(formField.formId, formId), isNull(formField.archivedAt)))
    .orderBy(
      sql`${formSection.sortOrder} asc nulls first`,
      asc(formSection.id),
      asc(formField.sortOrder),
      asc(formField.created_at),
    );
  const fields = joined.map((r) => r.field);
  if (fields.length === 0) return [];

  const options: OptionOut[] = await loadActiveOptions(
    db,
    fields.map((f) => f.id),
  );
  // Blok Pilihan tujuan tidak punya opsi sendiri: opsinya adalah tujuan yang
  // dibuka oleh oprec yang terikat pada form ini.
  for (const f of fields.filter((x) => x.type === 'unit_choice')) {
    for (const d of await loadDivisionOptions(db, formId)) {
      options.push({
        id: d.id,
        fieldId: f.id,
        label: d.label,
        sortOrder: d.sortOrder,
        group: d.group,
      } as OptionOut);
    }
  }

  const binding = fields.some((x) => x.type === 'unit_choice')
    ? await loadOprecBinding(db, formId)
    : null;
  return fields.map((f) => {
    const out = toFieldOutput(f, options);
    return f.type === 'unit_choice' && binding
      ? {
          ...out,
          config: {
            ...out.config,
            minChoices: binding.minChoices,
            maxChoices: binding.maxChoices,
          },
        }
      : out;
  });
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

  if (!fields.some((f) => isAnswerable(f.type))) {
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

/** Active fields that can be answered (everything but `text_block`). */
export async function countAnswerableFields(
  db: Queryable,
  formId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(formField)
    .where(
      and(
        eq(formField.formId, formId),
        isNull(formField.archivedAt),
        notInArray(formField.type, [...NON_ANSWERABLE_TYPES]),
      ),
    );
  return row?.n ?? 0;
}

/** 43-character URL-safe token for the public preview link. */
export function generatePreviewToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function ownerOf(db: Queryable, row: FormRow) {
  if (row.lembagaId) {
    const [owner] = await db
      .select({ id: lembaga.id, name: lembaga.name })
      .from(lembaga)
      .where(eq(lembaga.id, row.lembagaId));
    return {
      type: 'lembaga' as const,
      id: row.lembagaId,
      name: owner?.name ?? '',
    };
  }
  const [owner] = await db
    .select({ id: events.id, name: events.name })
    .from(events)
    .where(eq(events.id, row.eventId!));
  return { type: 'event' as const, id: row.eventId!, name: owner?.name ?? '' };
}

export async function hasSubmitted(
  db: Queryable,
  formId: string,
  userId: string,
) {
  const [row] = await db
    .select({ id: formSubmission.id })
    .from(formSubmission)
    .where(
      and(eq(formSubmission.formId, formId), eq(formSubmission.userId, userId)),
    )
    .limit(1);
  return !!row;
}

/**
 * What a respondent (or a preview visitor) sees. `preview` never accepts
 * answers and never reports whether anyone submitted; the preview token is
 * deliberately absent from this shape.
 */
export async function buildPublicForm(
  db: Queryable,
  row: FormRow,
  mode: 'form' | 'preview',
  userId: string | null = null,
): Promise<GetPublicFormOutput> {
  const [fields, sections, owner, submitted, counts] = await Promise.all([
    loadActiveFields(db, row.id),
    loadSections(db, row.id),
    ownerOf(db, row),
    mode === 'form' && userId
      ? hasSubmitted(db, row.id, userId)
      : Promise.resolve(null),
    countSubmissions(db, [row.id]),
  ]);
  const responseCount = counts.get(row.id) ?? 0;
  const full = mode === 'form' && hasReachedQuota(row, responseCount);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    closesAt: row.closesAt,
    allowMultipleSubmissions: row.allowMultipleSubmissions,
    allowEditAfterSubmit: row.allowEditAfterSubmit,
    maxResponses: row.maxResponses,
    isOpen: isAcceptingResponses(row),
    isFull: full,
    owner,
    isAcceptingResponses: mode === 'form' && isAcceptingResponses(row) && !full,
    hasSubmitted: submitted,
    mode,
    settings: readFormSettings(row),
    theme: readFormTheme(row),
    welcome: readFormWelcome(row),
    sections: sections.map(({ sortOrder: _sortOrder, ...section }) => section),
    fields: fields.map(({ sortOrder: _sortOrder, ...field }) => field),
  };
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
  if (field.type === 'unit_choice') {
    // Opsi dan batas pilihannya berasal dari oprec; hanya `loadActiveFields` yang menyusunnya.
    const found = (await loadActiveFields(db, formId)).find(
      (f) => f.id === field.id,
    );
    if (found) return found;
  }
  const options = await loadActiveOptions(db, [field.id]);
  return toFieldOutput(field, options);
}

/** Re-throws TRPCErrors untouched; anything else becomes a generic 500. */
export function rethrow(error: unknown, message: string): never {
  if (error instanceof TRPCError) throw error;
  console.error(message, error);
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message });
}

type EndingRow = typeof formEnding.$inferSelect;

function toEndingOutput(row: EndingRow): FormEndingOutput {
  return {
    id: row.id,
    formId: row.formId,
    title: row.title,
    description: row.description,
    sortOrder: row.sortOrder,
    condition: conditionOut(row.condition),
  };
}

/** Endings of a form in evaluation order. */
export async function loadEndings(
  db: Queryable,
  formId: string,
): Promise<FormEndingOutput[]> {
  const rows = await db
    .select()
    .from(formEnding)
    .where(eq(formEnding.formId, formId))
    .orderBy(asc(formEnding.sortOrder), asc(formEnding.created_at));
  return rows.map(toEndingOutput);
}

export function toCondFields(fields: FieldOutput[]): CondField[] {
  return fields.map((f) => ({
    id: f.id,
    type: f.type,
    sectionId: f.sectionId,
    condition: f.condition,
  }));
}

/**
 * Called at the end of every transaction that can change what a condition
 * points at (question or option removed/archived/moved, a condition edited).
 *
 * - A problem in something the caller just edited: BAD_REQUEST with the reason.
 * - A condition broken as a side effect: CONFLICT listing what is affected, or,
 *   with `clearDependents`, those conditions are cleared and the change stands.
 */
/** Ringkasan oprec yang terikat pada form untuk builder; null bila form biasa. */
export async function loadOprecBinding(db: Queryable, formId: string) {
  const [rec] = await db
    .select({
      recruitmentId: recruitment.id,
      minChoices: recruitment.minChoices,
      maxChoices: recruitment.maxChoices,
      allowRedirect: recruitment.allowRedirect,
    })
    .from(recruitment)
    .where(eq(recruitment.formId, formId));
  return rec ?? null;
}

/** Tujuan oprec yang terikat pada form ini, berurutan, untuk opsi blok Pilihan. */
export async function loadDivisionOptions(db: Queryable, formId: string) {
  const parent = alias(organizationUnit, 'parent_unit');
  const rows = await db
    .select({
      id: recruitmentDivision.id,
      label: organizationUnit.name,
      group: parent.name,
      sortOrder: recruitmentDivision.sortOrder,
    })
    .from(recruitment)
    .innerJoin(
      recruitmentDivision,
      eq(recruitmentDivision.recruitmentId, recruitment.id),
    )
    .innerJoin(
      organizationUnit,
      eq(organizationUnit.id, recruitmentDivision.unitId),
    )
    .leftJoin(parent, eq(parent.id, organizationUnit.parent_id))
    .where(eq(recruitment.formId, formId))
    .orderBy(asc(recruitmentDivision.sortOrder));
  return rows;
}

/** Id divisi dan batas pilihan oprec yang terikat pada form; null bila form biasa. */
export async function loadBoundOprec(db: Queryable, formId: string) {
  const [rec] = await db
    .select({ id: recruitment.id, maxChoices: recruitment.maxChoices })
    .from(recruitment)
    .where(eq(recruitment.formId, formId));
  if (!rec) return null;
  const divisions = await db
    .select({ id: recruitmentDivision.id })
    .from(recruitmentDivision)
    .where(eq(recruitmentDivision.recruitmentId, rec.id));
  return {
    recruitmentId: rec.id,
    maxChoices: rec.maxChoices,
    divisionIds: new Set(divisions.map((d) => d.id)),
  };
}

/**
 * Aturan blok Pilihan (`unit_choice`): hanya di form terikat oprec, paling
 * banyak satu yang aktif, dan "bersedia dipindahkan" harus menunjuk kotak
 * centang di form yang sama. Dipanggil di dalam transaksi yang memegang `lockForm`.
 */
export async function assertUnitChoiceAllowed(
  tx: Tx,
  formId: string,
  input: { willingFieldId?: string; selfId?: string },
) {
  if (!(await loadBoundOprec(tx, formId))) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Blok Pilihan hanya bisa dipakai di formulir oprec.',
    });
  }
  const others = await tx
    .select({ id: formField.id })
    .from(formField)
    .where(
      and(
        eq(formField.formId, formId),
        eq(formField.type, 'unit_choice'),
        isNull(formField.archivedAt),
      ),
    );
  if (others.some((f) => f.id !== input.selfId)) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Formulir oprec hanya boleh punya satu blok Pilihan.',
    });
  }
  if (input.willingFieldId !== undefined) {
    const [target] = await tx
      .select({ type: formField.type })
      .from(formField)
      .where(
        and(
          eq(formField.id, input.willingFieldId),
          eq(formField.formId, formId),
          isNull(formField.archivedAt),
        ),
      );
    if (target?.type !== 'checkbox') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'Pertanyaan "bersedia dipindahkan" harus berupa kotak centang.',
      });
    }
  }
}

export async function enforceConditions(
  tx: Tx,
  formId: string,
  opts: { clearDependents?: boolean; edited?: string[] } = {},
) {
  const [fields, sections, endings] = await Promise.all([
    loadActiveFields(tx, formId),
    loadSections(tx, formId),
    loadEndings(tx, formId),
  ]);
  const optionIds = new Map(
    fields.map((f) => [f.id, new Set(f.options.map((o) => o.id))]),
  );
  const issues: ConditionIssue[] = validateConditions(
    toCondFields(fields),
    sections,
    endings,
  );
  const flagged = new Set(issues.map((i) => i.targetId));
  const typeById = new Map(fields.map((f) => [f.id, f.type]));
  const bound = fields.some((f) => f.type === 'unit_choice')
    ? await loadBoundOprec(tx, formId)
    : null;
  const checkOptions = (
    targetId: string,
    kind: ConditionIssue['kind'],
    condition: unknown,
  ) => {
    if (flagged.has(targetId)) return;
    for (const rule of readCondition(condition)?.aturan ?? []) {
      if (typeById.get(rule.fieldId) === 'unit_choice') {
        const rank = rule.nilai2;
        const badDivision =
          typeof rule.nilai !== 'string' || !bound?.divisionIds.has(rule.nilai);
        const badRank =
          rule.op === 'pilihan_ke' &&
          (typeof rank !== 'number' ||
            !Number.isInteger(rank) ||
            rank < 1 ||
            rank > (bound?.maxChoices ?? 0));
        if (badDivision || badRank) {
          flagged.add(targetId);
          issues.push({
            targetId,
            kind,
            message:
              'Tujuan atau urutan pilihan yang dirujuk kondisi sudah tidak ada.',
          });
          return;
        }
        continue;
      }
      const known = optionIds.get(rule.fieldId);
      const wanted = [
        'adalah',
        'bukan',
        'salah_satu',
        'memuat',
        'tidak_memuat',
        'memuat_salah_satu',
      ];
      if (!known || !wanted.includes(rule.op)) continue;
      const values = Array.isArray(rule.nilai) ? rule.nilai : [rule.nilai];
      if (values.some((v) => typeof v !== 'string' || !known.has(v))) {
        flagged.add(targetId);
        issues.push({
          targetId,
          kind,
          message: 'Pilihan yang dirujuk kondisi sudah tidak ada.',
        });
        return;
      }
    }
  };
  for (const f of fields) checkOptions(f.id, 'field', f.condition);
  for (const sct of sections) checkOptions(sct.id, 'section', sct.condition);
  for (const e of endings) checkOptions(e.id, 'ending', e.condition);
  if (issues.length === 0) return;

  const edited = new Set(opts.edited ?? []);
  const own = issues.find((i) => edited.has(i.targetId));
  if (own) throw new TRPCError({ code: 'BAD_REQUEST', message: own.message });

  if (opts.clearDependents) {
    for (const issue of issues) {
      if (issue.kind === 'field') {
        await tx
          .update(formField)
          .set({ condition: null })
          .where(eq(formField.id, issue.targetId));
      } else if (issue.kind === 'section') {
        await tx
          .update(formSection)
          .set({ condition: null })
          .where(eq(formSection.id, issue.targetId));
      } else {
        await tx
          .update(formEnding)
          .set({ condition: null })
          .where(eq(formEnding.id, issue.targetId));
      }
    }
    return;
  }

  const label = (i: ConditionIssue) =>
    i.kind === 'field'
      ? (fields.find((f) => f.id === i.targetId)?.label ?? 'pertanyaan')
      : i.kind === 'section'
        ? (sections.find((x) => x.id === i.targetId)?.title ?? 'bagian')
        : (endings.find((x) => x.id === i.targetId)?.title ?? 'ending');
  const names = issues.map(
    (i) =>
      `${i.kind === 'field' ? 'pertanyaan' : i.kind === 'section' ? 'bagian' : 'ending'} "${richTextToPlain(label(i))}"`,
  );
  throw new TRPCError({
    code: 'CONFLICT',
    message: `Perubahan ini membuat kondisi tidak berlaku pada: ${names.join(', ')}. Hapus kondisi terkait untuk melanjutkan.`,
  });
}
