import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { type ZodIssue, ZodIssueCode } from 'zod';
import { computeVisibility, pickEnding } from '~/lib/forms/conditions';
import { fileRuleProblem } from '~/lib/forms/file-answer';
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from '~/server/api/trpc';
import {
  form,
  formAnswer,
  formSubmission,
  mahasiswa,
} from '~/server/db/schema';

import {
  type FieldOutput,
  FileAnswerListSchema,
  GetMySubmissionInputSchema,
  GetMySubmissionOutputSchema,
  GetPreviewInputSchema,
  GetPublicFormInputSchema,
  GetPublicFormOutputSchema,
  LINK_MAX_LENGTH,
  LONG_TEXT_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  type StoredAnswerValue,
  SubmitFormInputSchema,
  SubmitFormOutputSchema,
  TEXT_PATTERN_RULES,
} from '../../types/form.type';
import {
  buildPublicForm,
  hasSubmitted,
  isAcceptingResponses,
  loadActiveFields,
  loadEndings,
  loadSections,
  lockFormShared,
  lockSubmitSlot,
  rethrow,
  toCondFields,
} from './services';

/**
 * Pembawa issue per pertanyaan ke `errorFormatter`.
 *
 * Tidak memakai `ZodError`: di Zod 4 kelas itu tidak mewarisi `Error`, jadi
 * tRPC menyalin isinya ke `UnknownCauseError` dan `issues` (non-enumerable)
 * hilang di jalan. Error lemparan zod sendiri aman karena kelas internalnya
 * memang turunan `Error`; yang dibangun manual tidak.
 */
class AnswerIssuesError extends Error {
  constructor(readonly issues: ZodIssue[]) {
    super(issues.map((i) => i.message).join('; '));
    this.name = 'AnswerIssuesError';
  }
}

type AnswerInput = { fieldId: string; value: unknown };
type AnswerRow = {
  fieldId: string;
  fieldLabel: string;
  fieldType: FieldOutput['type'];
  value: StoredAnswerValue;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  // Round-trip rejects impossible dates such as 2026-02-30.
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0) ||
    // A matrix answer with no row answered.
    (typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0)
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Compile-time guard for the `switch` on the field type below: a new type
 * with no `case` stops the build instead of having its answers accepted
 * without any validation.
 */
function assertNever(value: never): never {
  throw new Error(`Tipe pertanyaan tidak dikenal: ${String(value)}`);
}

/**
 * Validates submitted answers against the form's active fields and returns
 * the rows to store, with label/type/option-label snapshots. Every problem is
 * reported (not just the first), keyed by fieldId.
 */
export function validateAnswers(
  fields: FieldOutput[],
  answers: AnswerInput[],
): { issues: ZodIssue[]; rows: AnswerRow[] } {
  const issues: ZodIssue[] = [];
  const rows: AnswerRow[] = [];
  const fail = (fieldId: string, message: string) =>
    issues.push({ code: ZodIssueCode.custom, path: [fieldId], message });

  const byId = new Map(fields.map((f) => [f.id, f]));
  const given = new Map<string, unknown>();
  for (const answer of answers) {
    if (!byId.has(answer.fieldId)) {
      fail(answer.fieldId, 'Pertanyaan tidak dikenal atau sudah dihapus.');
    } else if (given.has(answer.fieldId)) {
      fail(answer.fieldId, 'Pertanyaan dijawab lebih dari sekali.');
    } else {
      given.set(answer.fieldId, answer.value);
    }
  }

  for (const field of fields) {
    const raw = given.get(field.id);
    const label = `"${field.label}"`;
    const push = (value: StoredAnswerValue) =>
      rows.push({
        fieldId: field.id,
        fieldLabel: field.label,
        fieldType: field.type,
        value,
      });

    // A text block is shown, never answered: any answer for it is an error.
    if (field.type === 'text_block') {
      if (given.has(field.id)) fail(field.id, 'Field ini bukan pertanyaan.');
      continue;
    }

    if (field.type === 'checkbox') {
      if (raw !== undefined && typeof raw !== 'boolean') {
        fail(field.id, `${label} harus bernilai ya atau tidak.`);
      } else if (field.required && raw !== true) {
        fail(field.id, `${label} wajib dicentang.`);
      } else if (raw !== undefined) {
        push(raw);
      }
      continue;
    }

    if (isEmpty(raw)) {
      if (field.required) fail(field.id, `${label} wajib diisi.`);
      continue;
    }

    const config = field.config;
    switch (field.type) {
      case 'short_text':
      case 'long_text': {
        if (typeof raw !== 'string') {
          fail(field.id, `${label} harus berupa teks.`);
          break;
        }
        const text = raw.trim();
        const cap =
          field.type === 'short_text'
            ? SHORT_TEXT_MAX_LENGTH
            : LONG_TEXT_MAX_LENGTH;
        const maxLength = Math.min(config.maxLength ?? cap, cap);
        if (text.length > maxLength) {
          fail(field.id, `${label} maksimal ${maxLength} karakter.`);
          break;
        }
        if (config.minLength !== undefined && text.length < config.minLength) {
          fail(field.id, `${label} minimal ${config.minLength} karakter.`);
          break;
        }
        // Preset, bukan regex dari pembuat formulir: pola sudah di-compile
        // sekali di `form.type.ts`, jadi tidak ada regex yang dibangun di
        // jalur request dan tidak ada risiko ReDoS. Pola berjangkar penuh.
        const rule = config.pattern
          ? TEXT_PATTERN_RULES[config.pattern]
          : undefined;
        if (rule !== undefined && !rule.regex.test(text)) {
          fail(field.id, `${label} harus berupa ${rule.description}.`);
          break;
        }
        push(text);
        break;
      }

      case 'number': {
        if (typeof raw !== 'number' || !Number.isFinite(raw)) {
          fail(field.id, `${label} harus berupa angka.`);
          break;
        }
        if (config.min !== undefined && raw < config.min) {
          fail(field.id, `${label} minimal ${config.min}.`);
          break;
        }
        if (config.max !== undefined && raw > config.max) {
          fail(field.id, `${label} maksimal ${config.max}.`);
          break;
        }
        push(raw);
        break;
      }

      case 'date': {
        if (typeof raw !== 'string' || !isValidIsoDate(raw)) {
          fail(field.id, `${label} harus berupa tanggal (YYYY-MM-DD).`);
          break;
        }
        push(raw);
        break;
      }

      case 'single_choice': {
        const option =
          typeof raw === 'string'
            ? field.options.find((o) => o.id === raw)
            : undefined;
        if (!option) {
          fail(field.id, `Pilihan pada ${label} tidak valid.`);
          break;
        }
        push({ optionId: option.id, label: option.label });
        break;
      }

      case 'multiple_choice': {
        if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'string')) {
          fail(field.id, `Pilihan pada ${label} tidak valid.`);
          break;
        }
        const ids = raw as string[];
        if (new Set(ids).size !== ids.length) {
          fail(field.id, `Pilihan pada ${label} tidak boleh duplikat.`);
          break;
        }
        const picked = ids.map((id) => field.options.find((o) => o.id === id));
        if (picked.some((o) => o === undefined)) {
          fail(field.id, `Pilihan pada ${label} tidak valid.`);
          break;
        }
        if (
          config.minSelections !== undefined &&
          ids.length < config.minSelections
        ) {
          fail(field.id, `${label} minimal ${config.minSelections} pilihan.`);
          break;
        }
        if (
          config.maxSelections !== undefined &&
          ids.length > config.maxSelections
        ) {
          fail(field.id, `${label} maksimal ${config.maxSelections} pilihan.`);
          break;
        }
        push(picked.map((o) => ({ optionId: o!.id, label: o!.label })));
        break;
      }

      case 'link': {
        const text = typeof raw === 'string' ? raw.trim() : undefined;
        if (text === undefined || !isHttpUrl(text)) {
          // Only http(s): `javascript:` or `data:` links would run when a
          // reviewer clicks them.
          if (text !== undefined && text.length > LINK_MAX_LENGTH) {
            fail(field.id, `Tautan maksimal ${LINK_MAX_LENGTH} karakter.`);
          } else {
            fail(
              field.id,
              'Tautan harus berupa URL http atau https yang valid.',
            );
          }
          break;
        }
        if (text.length > LINK_MAX_LENGTH) {
          fail(field.id, `Tautan maksimal ${LINK_MAX_LENGTH} karakter.`);
          break;
        }
        push(text);
        break;
      }

      case 'scale': {
        // The widest bounds the config schema allows; a stored config always
        // carries both.
        const min = config.min ?? 0;
        const max = config.max ?? 10;
        if (
          typeof raw !== 'number' ||
          !Number.isInteger(raw) ||
          raw < min ||
          raw > max
        ) {
          fail(
            field.id,
            `Nilai harus bilangan bulat antara ${min} dan ${max}.`,
          );
          break;
        }
        push(raw);
        break;
      }

      case 'matrix': {
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
          fail(field.id, 'Pilihan jawaban tidak sesuai.');
          break;
        }
        const rows = config.rows ?? [];
        const columnById = new Map(
          (config.columns ?? []).map((c) => [c.id, c]),
        );
        const rowIds = new Set(rows.map((r) => r.id));
        const answered = new Map<string, string[]>();
        let problem: string | undefined;
        for (const [rowId, value] of Object.entries(raw)) {
          if (!rowIds.has(rowId)) {
            problem = 'Baris atau kolom jawaban tidak dikenal.';
            break;
          }
          // One column per row, or a list of columns when the field allows it.
          const ids = config.multiple ? value : [value];
          if (
            !Array.isArray(ids) ||
            ids.some((v) => typeof v !== 'string') ||
            (config.multiple && !Array.isArray(value)) ||
            new Set(ids).size !== ids.length
          ) {
            problem = 'Pilihan jawaban tidak sesuai.';
            break;
          }
          if ((ids as string[]).some((id) => !columnById.has(id))) {
            problem = 'Baris atau kolom jawaban tidak dikenal.';
            break;
          }
          // An empty list means the row was left unanswered.
          if (ids.length > 0) answered.set(rowId, ids as string[]);
        }
        if (problem !== undefined) {
          fail(field.id, problem);
          break;
        }
        if (answered.size === 0) {
          if (field.required) fail(field.id, `${label} wajib diisi.`);
          break;
        }
        if (field.required && answered.size < rows.length) {
          fail(field.id, 'Semua baris wajib dijawab.');
          break;
        }
        push(
          rows
            .filter((r) => answered.has(r.id))
            .map((r) => ({
              rowId: r.id,
              rowLabel: r.label,
              selected: answered.get(r.id)!.map((columnId) => ({
                columnId,
                label: columnById.get(columnId)!.label,
              })),
            })),
        );
        break;
      }

      case 'file': {
        const parsed = FileAnswerListSchema.safeParse(raw);
        if (!parsed.success) {
          fail(field.id, `Berkas untuk ${label} tidak valid.`);
          break;
        }
        const files = parsed.data;
        const problem = fileRuleProblem(files, field.config);
        if (problem) {
          fail(field.id, problem);
          break;
        }
        push(files);
        break;
      }

      default:
        assertNever(field.type);
    }
  }

  return { issues, rows };
}

export const formSubmissionRouter = createTRPCRouter({
  /** The fill-in page: logging in is required to open it, not only to submit. */
  getPublic: protectedProcedure
    .input(GetPublicFormInputSchema)
    .output(GetPublicFormOutputSchema)
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(form)
        .where(eq(form.id, input.formId));
      // Drafts are invisible to respondents: same answer as a missing form.
      if (!row || row.status === 'Draft') {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Formulir tidak ditemukan.',
        });
      }
      return buildPublicForm(ctx.db, row, 'form', ctx.session.user.id);
    }),

  /** The caller's own latest submission to this form, or null. */
  getMySubmission: protectedProcedure
    .input(GetMySubmissionInputSchema)
    .output(GetMySubmissionOutputSchema)
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          id: formSubmission.id,
          submittedAt: formSubmission.submittedAt,
        })
        .from(formSubmission)
        .where(
          and(
            eq(formSubmission.formId, input.formId),
            eq(formSubmission.userId, ctx.session.user.id),
          ),
        )
        .orderBy(desc(formSubmission.submittedAt))
        .limit(1);
      return row ?? null;
    }),

  /**
   * Read-only view through the public preview link; no login. Unknown tokens
   * and links switched off answer the same way, so a token cannot be probed.
   */
  getPreview: publicProcedure
    .input(GetPreviewInputSchema)
    .output(GetPublicFormOutputSchema)
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(form)
        .where(
          and(
            eq(form.previewToken, input.token),
            eq(form.previewEnabled, true),
          ),
        );
      if (!row) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pratinjau tidak ditemukan.',
        });
      }
      return buildPublicForm(ctx.db, row, 'preview');
    }),

  submit: protectedProcedure
    .input(SubmitFormInputSchema)
    .output(SubmitFormOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;

        // Only active students may apply (DKB FR-44: calon anggota).
        const [student] = await ctx.db
          .select({ status: mahasiswa.status })
          .from(mahasiswa)
          .where(eq(mahasiswa.userId, userId));
        if (
          ctx.session.user.role !== 'mahasiswa' ||
          student?.status !== 'aktif'
        ) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Hanya mahasiswa aktif yang dapat mengisi formulir.',
          });
        }

        return await ctx.db.transaction(async (tx) => {
          // Shared lock: respondents do not block each other, but the form
          // cannot be closed, deleted, or have fields rewritten underneath an
          // in-flight submit.
          const current = await lockFormShared(tx, input.formId);
          if (current.status === 'Draft') {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Formulir tidak ditemukan.',
            });
          }
          if (!isAcceptingResponses(current)) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Formulir sudah ditutup dan tidak menerima jawaban.',
            });
          }
          if (!current.allowMultipleSubmissions) {
            // Per-respondent lock, so the duplicate check below cannot be run
            // twice concurrently by the same student.
            await lockSubmitSlot(tx, current.id, userId);
            if (await hasSubmitted(tx, current.id, userId)) {
              throw new TRPCError({
                code: 'CONFLICT',
                message: 'Kamu sudah mengisi formulir ini.',
              });
            }
          }

          const allFields = await loadActiveFields(tx, current.id);
          const [sections, endings] = await Promise.all([
            loadSections(tx, current.id),
            loadEndings(tx, current.id),
          ]);
          // Pertanyaan yang tersembunyi menurut jawaban ini tidak wajib dan
          // jawabannya dibuang, bukan ditolak.
          const given = Object.fromEntries(
            input.answers.map((a) => [a.fieldId, a.value]),
          );
          const condFields = toCondFields(allFields);
          const visibility = computeVisibility(condFields, sections, given);
          const fields = allFields.filter((f) => visibility.fields.has(f.id));
          const hidden = new Set(
            allFields
              .filter((f) => !visibility.fields.has(f.id))
              .map((f) => f.id),
          );
          const { issues, rows } = validateAnswers(
            fields,
            input.answers.filter((a) => !hidden.has(a.fieldId)),
          );
          if (issues.length > 0) {
            // Cause yang membawa `issues` membuat errorFormatter memaparkan
            // data.zodError.fieldErrors[fieldId], sama seperti error validasi
            // input.
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: issues.map((i) => i.message).join('; '),
              cause: new AnswerIssuesError(issues),
            });
          }

          const endingId = pickEnding(endings, visibility, given, condFields);
          const [submission] = await tx
            .insert(formSubmission)
            .values({ formId: current.id, userId, endingId })
            .returning();
          if (rows.length > 0) {
            await tx
              .insert(formAnswer)
              .values(
                rows.map((r) => ({ ...r, submissionId: submission!.id })),
              );
          }
          return {
            submissionId: submission!.id,
            submittedAt: submission!.submittedAt,
            ending: endings.find((e) => e.id === endingId) ?? null,
          };
        });
      } catch (error) {
        rethrow(error, 'Gagal mengirim jawaban.');
      }
    }),
});
