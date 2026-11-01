import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { ZodError, type ZodIssue, ZodIssueCode } from 'zod';
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from '~/server/api/trpc';
import {
  events,
  form,
  formAnswer,
  formSubmission,
  lembaga,
  mahasiswa,
} from '~/server/db/schema';

import {
  type FieldOutput,
  GetPublicFormInputSchema,
  GetPublicFormOutputSchema,
  LONG_TEXT_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
  type StoredAnswerValue,
  SubmitFormInputSchema,
  SubmitFormOutputSchema,
} from '../../types/form.type';
import {
  type Queryable,
  isAcceptingResponses,
  loadActiveFields,
  lockForm,
  rethrow,
} from './services';

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
    (Array.isArray(value) && value.length === 0)
  );
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
        // Runs only on length-capped text; the pattern itself is capped and
        // compile-checked when the field is saved. Anchored: whole answer.
        if (
          config.pattern !== undefined &&
          !new RegExp(`^(?:${config.pattern})$`, 'u').test(text)
        ) {
          fail(field.id, `${label} tidak sesuai format yang diminta.`);
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
    }
  }

  return { issues, rows };
}

async function ownerOf(db: Queryable, row: typeof form.$inferSelect) {
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

async function hasSubmitted(db: Queryable, formId: string, userId: string) {
  const [row] = await db
    .select({ id: formSubmission.id })
    .from(formSubmission)
    .where(
      and(eq(formSubmission.formId, formId), eq(formSubmission.userId, userId)),
    )
    .limit(1);
  return !!row;
}

export const formSubmissionRouter = createTRPCRouter({
  getPublic: publicProcedure
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

      const userId = ctx.session?.user.id;
      const [fields, owner, submitted] = await Promise.all([
        loadActiveFields(ctx.db, row.id),
        ownerOf(ctx.db, row),
        userId ? hasSubmitted(ctx.db, row.id, userId) : Promise.resolve(null),
      ]);

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        closesAt: row.closesAt,
        allowMultipleSubmissions: row.allowMultipleSubmissions,
        owner,
        isAcceptingResponses: isAcceptingResponses(row),
        hasSubmitted: submitted,
        fields: fields.map(({ sortOrder: _sortOrder, ...field }) => field),
      };
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
          // The row lock serialises submits per form, so two concurrent
          // requests from one student cannot both pass the duplicate check.
          const current = await lockForm(tx, input.formId);
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
          if (
            !current.allowMultipleSubmissions &&
            (await hasSubmitted(tx, current.id, userId))
          ) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Kamu sudah mengisi formulir ini.',
            });
          }

          const fields = await loadActiveFields(tx, current.id);
          const { issues, rows } = validateAnswers(fields, input.answers);
          if (issues.length > 0) {
            // A ZodError cause makes the error formatter expose
            // data.zodError.fieldErrors[fieldId], same as input validation.
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: issues.map((i) => i.message).join('; '),
              cause: new ZodError(issues),
            });
          }

          const [submission] = await tx
            .insert(formSubmission)
            .values({ formId: current.id, userId })
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
          };
        });
      } catch (error) {
        rethrow(error, 'Gagal mengirim jawaban.');
      }
    }),
});
