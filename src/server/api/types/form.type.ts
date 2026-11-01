import { z } from 'zod';
import { FORM_FIELD_TYPES, FORM_STATUSES } from '~/server/db/schema';

/**
 * Dynamic Form Builder (#210).
 *
 * Field definitions are a discriminated union on `type`, so the docs show the
 * exact `config` each type accepts. Rules that span keys (min <= max, the
 * pattern compiles, selection limits fit the option count) live in
 * `refineFieldDefinition`, applied with `superRefine` on the outer schema:
 * a discriminated union cannot hold `ZodEffects` members.
 */

export const SHORT_TEXT_MAX_LENGTH = 500;
export const LONG_TEXT_MAX_LENGTH = 5000;
export const PATTERN_MAX_LENGTH = 200;
export const MAX_FIELDS_PER_FORM = 100;
export const MAX_OPTIONS_PER_FIELD = 100;

const FormStatusSchema = z.enum(FORM_STATUSES, {
  errorMap: () => ({ message: 'Status formulir tidak valid' }),
});
const FormFieldTypeSchema = z.enum(FORM_FIELD_TYPES, {
  errorMap: () => ({ message: 'Tipe pertanyaan tidak valid' }),
});

const IdSchema = z.string().min(1);

// ---------------------------------------------------------------------------
// Field config per type
// ---------------------------------------------------------------------------

const textConfig = (cap: number) =>
  z
    .object({
      minLength: z.number().int().min(0).max(cap).optional(),
      maxLength: z.number().int().min(1).max(cap).optional(),
      pattern: z
        .string()
        .min(1)
        .max(PATTERN_MAX_LENGTH, `Pola maksimal ${PATTERN_MAX_LENGTH} karakter`)
        .optional(),
    })
    .strict()
    .default({});

const NumberConfigSchema = z
  .object({
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  })
  .strict()
  .default({});

const MultipleChoiceConfigSchema = z
  .object({
    minSelections: z.number().int().min(0).optional(),
    maxSelections: z.number().int().min(1).optional(),
  })
  .strict()
  .default({});

const EmptyConfigSchema = z.object({}).strict().default({});

const OptionInputSchema = z.object({
  /** Present when editing an existing option; omit for a new one. */
  id: IdSchema.optional(),
  label: z
    .string()
    .trim()
    .min(1, 'Pilihan tidak boleh kosong')
    .max(255, 'Pilihan maksimal 255 karakter'),
});

const OptionsInputSchema = z
  .array(OptionInputSchema)
  .min(1, 'Minimal satu pilihan')
  .max(MAX_OPTIONS_PER_FIELD, `Maksimal ${MAX_OPTIONS_PER_FIELD} pilihan`);

const fieldBase = {
  label: z
    .string()
    .trim()
    .min(1, 'Pertanyaan tidak boleh kosong')
    .max(500, 'Pertanyaan maksimal 500 karakter'),
  description: z.string().trim().max(2000).nullish(),
  required: z.boolean().default(false),
};

const fieldVariants = {
  short_text: z.object({
    type: z.literal('short_text'),
    config: textConfig(SHORT_TEXT_MAX_LENGTH),
  }),
  long_text: z.object({
    type: z.literal('long_text'),
    config: textConfig(LONG_TEXT_MAX_LENGTH),
  }),
  number: z.object({
    type: z.literal('number'),
    config: NumberConfigSchema,
  }),
  date: z.object({ type: z.literal('date'), config: EmptyConfigSchema }),
  single_choice: z.object({
    type: z.literal('single_choice'),
    config: EmptyConfigSchema,
    options: OptionsInputSchema,
  }),
  multiple_choice: z.object({
    type: z.literal('multiple_choice'),
    config: MultipleChoiceConfigSchema,
    options: OptionsInputSchema,
  }),
  checkbox: z.object({
    type: z.literal('checkbox'),
    config: EmptyConfigSchema,
  }),
};

type FieldVariant = z.infer<(typeof fieldVariants)[keyof typeof fieldVariants]>;

/** Cross-key checks shared by create and update. */
function refineFieldDefinition(field: FieldVariant, ctx: z.RefinementCtx) {
  const issue = (path: string, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

  if (field.type === 'short_text' || field.type === 'long_text') {
    const { minLength, maxLength, pattern } = field.config;
    if (
      minLength !== undefined &&
      maxLength !== undefined &&
      minLength > maxLength
    ) {
      issue('config', 'Panjang minimum melebihi panjang maksimum');
    }
    if (pattern !== undefined) {
      try {
        new RegExp(pattern, 'u');
      } catch {
        issue('config', 'Pola (regex) tidak valid');
      }
    }
  }

  if (field.type === 'number') {
    const { min, max } = field.config;
    if (min !== undefined && max !== undefined && min > max) {
      issue('config', 'Nilai minimum melebihi nilai maksimum');
    }
  }

  if (field.type === 'single_choice' || field.type === 'multiple_choice') {
    const seen = new Set<string>();
    for (const option of field.options) {
      const key = option.label.toLowerCase();
      if (seen.has(key)) {
        issue('options', `Pilihan "${option.label}" duplikat`);
      }
      seen.add(key);
    }
  }

  if (field.type === 'multiple_choice') {
    const { minSelections, maxSelections } = field.config;
    const count = field.options.length;
    if (
      minSelections !== undefined &&
      maxSelections !== undefined &&
      minSelections > maxSelections
    ) {
      issue('config', 'Jumlah pilihan minimum melebihi jumlah maksimum');
    }
    if (minSelections !== undefined && minSelections > count) {
      issue('config', 'Jumlah pilihan minimum melebihi banyaknya pilihan');
    }
    if (maxSelections !== undefined && maxSelections > count) {
      issue('config', 'Jumlah pilihan maksimum melebihi banyaknya pilihan');
    }
  }
}

// Spelled out per variant on purpose: a generic "extend every variant" helper
// loses the `type` literal and zod can no longer build the discriminated union.
const createShape = { ...fieldBase, formId: IdSchema };
const updateShape = { ...createShape, fieldId: IdSchema };

const createFieldVariants = [
  fieldVariants.short_text.extend(createShape),
  fieldVariants.long_text.extend(createShape),
  fieldVariants.number.extend(createShape),
  fieldVariants.date.extend(createShape),
  fieldVariants.single_choice.extend(createShape),
  fieldVariants.multiple_choice.extend(createShape),
  fieldVariants.checkbox.extend(createShape),
] as const;

const updateFieldVariants = [
  fieldVariants.short_text.extend(updateShape),
  fieldVariants.long_text.extend(updateShape),
  fieldVariants.number.extend(updateShape),
  fieldVariants.date.extend(updateShape),
  fieldVariants.single_choice.extend(updateShape),
  fieldVariants.multiple_choice.extend(updateShape),
  fieldVariants.checkbox.extend(updateShape),
] as const;

/** Normalised config as stored in `form_field.config`. */
export type FieldConfig = {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  minSelections?: number;
  maxSelections?: number;
};

// ---------------------------------------------------------------------------
// Shared output pieces
// ---------------------------------------------------------------------------

const FieldConfigOutputSchema = z.object({
  minLength: z.number().int().optional(),
  maxLength: z.number().int().optional(),
  pattern: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minSelections: z.number().int().optional(),
  maxSelections: z.number().int().optional(),
});

const FieldOptionOutputSchema = z.object({
  id: z.string(),
  label: z.string(),
  sortOrder: z.number().int(),
});

const FieldOutputSchema = z.object({
  id: z.string(),
  type: FormFieldTypeSchema,
  label: z.string(),
  description: z.string().nullable(),
  required: z.boolean(),
  config: FieldConfigOutputSchema,
  sortOrder: z.number().int(),
  /** Empty for non-choice types. Archived options are never included. */
  options: z.array(FieldOptionOutputSchema),
});

const FormOutputSchema = z.object({
  id: z.string(),
  lembagaId: z.string().nullable(),
  eventId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  status: FormStatusSchema,
  closesAt: z.date().nullable(),
  allowMultipleSubmissions: z.boolean(),
  publishedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const FormListItemSchema = FormOutputSchema.extend({
  submissionCount: z.number().int(),
});

const FormDetailSchema = FormOutputSchema.extend({
  submissionCount: z.number().int(),
  /** Active fields only, ordered by `sortOrder`. */
  fields: z.array(FieldOutputSchema),
});

const SuccessSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

// ---------------------------------------------------------------------------
// Form CRUD
// ---------------------------------------------------------------------------

const formMeta = {
  title: z
    .string()
    .trim()
    .min(1, 'Judul formulir tidak boleh kosong')
    .max(255, 'Judul formulir maksimal 255 karakter'),
  description: z.string().trim().max(5000).nullish(),
  closesAt: z.coerce.date().nullish(),
  allowMultipleSubmissions: z.boolean().optional(),
};

export const CreateFormForLembagaInputSchema = z.object({
  lembagaId: IdSchema,
  ...formMeta,
});
export const CreateFormForEventInputSchema = z.object({
  eventId: IdSchema,
  ...formMeta,
});
export const CreateFormOutputSchema = FormOutputSchema;

export const ListFormsByLembagaInputSchema = z.object({ lembagaId: IdSchema });
export const ListFormsByEventInputSchema = z.object({ eventId: IdSchema });
export const ListFormsOutputSchema = z.array(FormListItemSchema);

export const GetFormByIdInputSchema = z.object({ formId: IdSchema });
export const GetFormByIdOutputSchema = FormDetailSchema;

export const UpdateFormInputSchema = z.object({
  formId: IdSchema,
  title: formMeta.title.optional(),
  description: formMeta.description,
  closesAt: formMeta.closesAt,
  allowMultipleSubmissions: formMeta.allowMultipleSubmissions,
});
export const UpdateFormOutputSchema = FormOutputSchema;

export const DeleteFormInputSchema = z.object({ formId: IdSchema });
export const DeleteFormOutputSchema = SuccessSchema;

export const SetFormStatusInputSchema = z.object({
  formId: IdSchema,
  status: FormStatusSchema,
});
export const SetFormStatusOutputSchema = FormOutputSchema;

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export const CreateFieldInputSchema = z
  .discriminatedUnion('type', [...createFieldVariants])
  .superRefine(refineFieldDefinition);
export const CreateFieldOutputSchema = FieldOutputSchema;

/**
 * Full replacement of one field: send the whole question card. `options` is
 * the complete list — options left out are removed (archived if answered).
 */
export const UpdateFieldInputSchema = z
  .discriminatedUnion('type', [...updateFieldVariants])
  .superRefine(refineFieldDefinition);
export const UpdateFieldOutputSchema = FieldOutputSchema;

export const DeleteFieldInputSchema = z.object({
  formId: IdSchema,
  fieldId: IdSchema,
});
export const DeleteFieldOutputSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  /** `archived` when the field already had answers, else `deleted`. */
  result: z.enum(['archived', 'deleted']),
});

export const ReorderFieldsInputSchema = z.object({
  formId: IdSchema,
  /** Every active field id of the form, in the new order. */
  fieldIds: z.array(IdSchema).min(1).max(MAX_FIELDS_PER_FORM),
});
export const ReorderFieldsOutputSchema = SuccessSchema;

// ---------------------------------------------------------------------------
// Filling
// ---------------------------------------------------------------------------

export const GetPublicFormInputSchema = z.object({ formId: IdSchema });
export const GetPublicFormOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: FormStatusSchema,
  closesAt: z.date().nullable(),
  allowMultipleSubmissions: z.boolean(),
  owner: z.object({
    type: z.enum(['lembaga', 'event']),
    id: z.string(),
    name: z.string(),
  }),
  /** Published and not past `closesAt`. */
  isAcceptingResponses: z.boolean(),
  /** `null` when the caller is not logged in. */
  hasSubmitted: z.boolean().nullable(),
  fields: z.array(FieldOutputSchema.omit({ sortOrder: true })),
});

/**
 * Value by field type:
 * - short_text, long_text: string
 * - number: number
 * - date: "YYYY-MM-DD"
 * - single_choice: option id
 * - multiple_choice: array of option ids
 * - checkbox: boolean
 *
 * Validation failures come back as BAD_REQUEST with
 * `data.zodError.fieldErrors[<fieldId>]`, the same shape as input errors.
 */
export const AnswerValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

export const SubmitFormInputSchema = z.object({
  formId: IdSchema,
  answers: z
    .array(z.object({ fieldId: IdSchema, value: AnswerValueSchema }))
    .max(MAX_FIELDS_PER_FORM),
});
export const SubmitFormOutputSchema = z.object({
  submissionId: z.string(),
  submittedAt: z.date(),
});

/** Stored shape of `form_answer.value`. */
export type StoredAnswerValue =
  | string
  | number
  | boolean
  | { optionId: string; label: string }
  | { optionId: string; label: string }[];

export type FormOutput = z.infer<typeof FormOutputSchema>;
export type FieldOutput = z.infer<typeof FieldOutputSchema>;
export type CreateFieldInput = z.infer<typeof CreateFieldInputSchema>;
export type UpdateFieldInput = z.infer<typeof UpdateFieldInputSchema>;
