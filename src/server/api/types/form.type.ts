import { z } from 'zod';
import { MAX_RULES } from '~/lib/forms/conditions';
import { FORM_FIELD_TYPES, FORM_STATUSES } from '~/server/db/schema';

import {
  FILE_MAX_FILES,
  FILE_MAX_SIZE_MB,
  FILE_PRESET_KEYS,
  LONG_TEXT_MAX_LENGTH,
  MATRIX_MAX_COLUMNS,
  MATRIX_MAX_ROWS,
  MAX_FIELDS_PER_FORM,
  MAX_OPTIONS_PER_FIELD,
  MAX_SECTIONS_PER_FORM,
  SHORT_TEXT_MAX_LENGTH,
  TEXT_PATTERN_PRESETS,
  isAllowedFileHost,
  isAllowedImageHost,
} from './form.constants';

// Konstanta dan aturan format ada di `form.constants.ts` (tanpa impor skema
// database) supaya kode browser bisa memakainya tanpa menarik drizzle.
export {
  LINK_MAX_LENGTH,
  LONG_TEXT_MAX_LENGTH,
  MATRIX_MAX_COLUMNS,
  MATRIX_MAX_ROWS,
  MAX_FIELDS_PER_FORM,
  MAX_OPTIONS_PER_FIELD,
  MAX_SECTIONS_PER_FORM,
  SHORT_TEXT_MAX_LENGTH,
  TEXT_PATTERN_PRESETS,
  TEXT_PATTERN_RULES,
  type TextPatternPreset,
} from './form.constants';

/**
 * Dynamic Form Builder (#210).
 *
 * Field definitions are a discriminated union on `type`, so the docs show the
 * exact `config` each type accepts. Rules that span keys (min <= max,
 * selection limits fit the option count) live in
 * `refineFieldDefinition`, applied with `superRefine` on the outer schema:
 * a discriminated union cannot hold `ZodEffects` members.
 */

const FormStatusSchema = z.enum(FORM_STATUSES, {
  error: 'Status formulir tidak valid',
});
const FormFieldTypeSchema = z.enum(FORM_FIELD_TYPES, {
  error: 'Tipe pertanyaan tidak valid',
});
const TextPatternPresetSchema = z.enum(TEXT_PATTERN_PRESETS, {
  error: 'Format teks tidak dikenali',
});

/** Semua kolom id di skema ini `varchar(255)`. */
/**
 * Postgres menolak byte NUL di `jsonb` maupun `varchar`, jadi teks yang
 * memuatnya gagal di driver dan muncul sebagai 500 — bukan pesan validasi.
 * Dijaga di sini supaya ditolak sebagai BAD_REQUEST, termasuk pada jawaban
 * mahasiswa (tanpa ini transaksinya rollback dan jawabannya hilang).
 *
 * Kelas karakter yang dinegasikan tetap mengizinkan baris baru, jadi jawaban
 * teks panjang tidak terpengaruh.
 */
const TANPA_NUL = /^[^\u0000]*$/;
const PESAN_NUL = 'Teks memuat karakter yang tidak didukung';

const IdSchema = z
  .string()
  .min(1)
  .max(255, 'Id terlalu panjang')
  .regex(TANPA_NUL, PESAN_NUL);

// ---------------------------------------------------------------------------
// Field config per type
// ---------------------------------------------------------------------------

const textConfig = (cap: number) =>
  z
    .object({
      minLength: z.number().int().min(0).max(cap).optional(),
      maxLength: z.number().int().min(1).max(cap).optional(),
      pattern: TextPatternPresetSchema.optional(),
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

const SingleChoiceConfigSchema = z
  .object({ tampilan: z.enum(['daftar', 'dropdown']).default('daftar') })
  .strict()
  .default({ tampilan: 'daftar' });

const ShortLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(50, 'Label maksimal 50 karakter')
  .regex(TANPA_NUL, PESAN_NUL);

export const FileConfigSchema = z
  .object({
    preset: z.enum(FILE_PRESET_KEYS).default('pdf'),
    maxFiles: z.number().int().min(1).max(FILE_MAX_FILES).default(1),
    maxSizeMb: z.number().int().min(1).max(FILE_MAX_SIZE_MB).default(10),
    linkAccess: z.enum(['anyone', 'organization']).default('anyone'),
  })
  .strict()
  .default({
    preset: 'pdf',
    maxFiles: 1,
    maxSizeMb: 10,
    linkAccess: 'anyone',
  });

export const FileAnswerSchema = z
  .object({
    itemId: z.string().min(1).max(255),
    driveId: z.string().min(1).max(255),
    name: z.string().min(1).max(255).regex(TANPA_NUL, PESAN_NUL),
    size: z.number().int().min(0),
    mime: z.string().max(150),
    url: z.string().max(2048),
    eTag: z.string().max(255).optional(),
    scope: z.enum(['anyone', 'organization']),
  })
  .strict()
  .superRefine((file, ctx) => {
    if (!isAllowedFileHost(file.url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'Tautan berkas harus berasal dari OneDrive atau SharePoint.',
      });
    }
  });

/** Daftar berkas jawaban: item yang sama tidak boleh dikirim dua kali. */
export const FileAnswerListSchema = z
  .array(FileAnswerSchema)
  .max(FILE_MAX_FILES, 'Berkas terlalu banyak')
  .superRefine((files, ctx) => {
    const seen = new Set<string>();
    files.forEach((file, index) => {
      if (seen.has(file.itemId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'itemId'],
          message: 'Berkas yang sama tidak boleh dikirim dua kali.',
        });
      }
      seen.add(file.itemId);
    });
  });

export const FieldImageSchema = z
  .object({
    url: z
      .string()
      .max(2048)
      .refine(
        isAllowedImageHost,
        'Gambar harus berasal dari penyimpanan Anmategra',
      ),
    key: z.string().min(1).max(255),
    alt: z.string().trim().max(255).regex(TANPA_NUL, PESAN_NUL).nullish(),
  })
  .strict();

export const LinkConfigSchema = z
  .object({ buttonLabel: ShortLabelSchema.optional() })
  .strict()
  .default({});

const MatrixAxisItemSchema = z.object({
  /** Present when editing an existing row/column; the server fills new ones. */
  id: IdSchema.optional(),
  label: z
    .string()
    .trim()
    .min(1, 'Label tidak boleh kosong')
    .max(255, 'Label maksimal 255 karakter')
    .regex(TANPA_NUL, PESAN_NUL),
});

/** Labels are unique ignoring case; given ids are unique within the axis. */
function checkAxis(
  items: { id?: string | undefined; label: string }[],
  axis: 'rows' | 'columns',
  noun: string,
  ctx: z.RefinementCtx,
) {
  const labels = new Set<string>();
  const ids = new Set<string>();
  for (const item of items) {
    const key = item.label.toLowerCase();
    if (labels.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [axis],
        message: `${noun} "${item.label}" duplikat`,
      });
    }
    labels.add(key);
    if (item.id !== undefined) {
      if (ids.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [axis],
          message: `Id ${noun.toLowerCase()} duplikat`,
        });
      }
      ids.add(item.id);
    }
  }
}

export const MatrixConfigSchema = z
  .object({
    rows: z
      .array(MatrixAxisItemSchema)
      .min(1, 'Minimal satu baris')
      .max(MATRIX_MAX_ROWS, `Maksimal ${MATRIX_MAX_ROWS} baris`),
    columns: z
      .array(MatrixAxisItemSchema)
      .min(2, 'Minimal dua kolom')
      .max(MATRIX_MAX_COLUMNS, `Maksimal ${MATRIX_MAX_COLUMNS} kolom`),
    multiple: z.boolean().default(false),
  })
  .strict()
  .superRefine((config, ctx) => {
    checkAxis(config.rows, 'rows', 'Baris', ctx);
    checkAxis(config.columns, 'columns', 'Kolom', ctx);
  });

export type MatrixConfig = z.infer<typeof MatrixConfigSchema>;
export type NormalizedMatrixConfig = {
  rows: { id: string; label: string }[];
  columns: { id: string; label: string }[];
  multiple: boolean;
};

/** Fills ids the client left out; ids that were sent are kept as they are. */
export function normalizeMatrixConfig(
  config: MatrixConfig,
): NormalizedMatrixConfig {
  const withId = (item: { id?: string | undefined; label: string }) => ({
    id: item.id ?? crypto.randomUUID(),
    label: item.label,
  });
  return {
    rows: config.rows.map(withId),
    columns: config.columns.map(withId),
    multiple: config.multiple,
  };
}

// `min` 0..1 and `max` 2..10 already guarantee max > min, so no cross-key rule.
export const ScaleConfigSchema = z
  .object({
    min: z.number().int().min(0).max(1),
    max: z.number().int().min(2).max(10),
    minLabel: ShortLabelSchema.optional(),
    maxLabel: ShortLabelSchema.optional(),
    tampilan: z.enum(['angka', 'bintang']).default('angka'),
  })
  .strict();

// ---------------------------------------------------------------------------
// Form-level JSON columns (settings, theme, welcome)
// ---------------------------------------------------------------------------

const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Warna harus berformat #RRGGBB');

const HttpsUrlSchema = z
  .string()
  .max(2048, 'Alamat gambar terlalu panjang')
  .regex(/^https:\/\/[^\s\u0000]+$/u, 'Alamat gambar harus berupa URL https');

const ThemeImageUrlSchema = HttpsUrlSchema.refine(
  isAllowedImageHost,
  'Gambar harus berasal dari penyimpanan Anmategra',
);

export const FormSettingsSchema = z
  .object({
    showNumbers: z.boolean().default(true),
    showProgress: z.boolean().default(true),
    shuffleOptions: z.boolean().default(false),
    reviewBeforeSubmit: z.boolean().default(false),
    confirmOnLeave: z.boolean().default(true),
    autosaveDraft: z.boolean().default(true),
    requiredByDefault: z.boolean().default(false),
    closedMessage: z
      .string()
      .max(500, 'Pesan penutup maksimal 500 karakter')
      .regex(TANPA_NUL, PESAN_NUL)
      .default(''),
  })
  .strict();

export const FormThemeSchema = z
  .object({
    accent: HexColorSchema.optional(),
    font: z.enum(['sans', 'serif', 'mono']).optional(),
    bg: HexColorSchema.optional(),
    banner: ThemeImageUrlSchema.nullish(),
    logo: ThemeImageUrlSchema.nullish(),
  })
  .strict();

/**
 * Bentuk theme yang dibaca dari database. Sengaja lebih longgar daripada
 * `FormThemeSchema` (yang dipakai untuk input): satu URL lama dari host lain
 * atau kunci yang belum dikenal tidak boleh menghapus warna dan font yang
 * masih sah dari seluruh formulir.
 */
export const StoredFormThemeSchema = z
  .object({
    accent: HexColorSchema.optional(),
    font: z.enum(['sans', 'serif', 'mono']).optional(),
    bg: HexColorSchema.optional(),
    banner: z.string().max(2048).nullish(),
    logo: z.string().max(2048).nullish(),
  })
  .passthrough();

export const FormWelcomeSchema = z
  .object({
    title: z
      .string()
      .max(200, 'Judul sambutan maksimal 200 karakter')
      .regex(TANPA_NUL, PESAN_NUL)
      .optional(),
    description: z
      .string()
      .max(2000, 'Deskripsi sambutan maksimal 2000 karakter')
      .regex(TANPA_NUL, PESAN_NUL)
      .optional(),
    buttonLabel: ShortLabelSchema.optional(),
  })
  .strict();

export type FormSettings = z.infer<typeof FormSettingsSchema>;
export type FormTheme = z.infer<typeof FormThemeSchema>;
export type FormWelcome = z.infer<typeof FormWelcomeSchema>;

const OptionInputSchema = z.object({
  /** Present when editing an existing option; omit for a new one. */
  id: IdSchema.optional(),
  label: z
    .string()
    .trim()
    .min(1, 'Pilihan tidak boleh kosong')
    .max(255, 'Pilihan maksimal 255 karakter')
    .regex(TANPA_NUL, PESAN_NUL),
});

const OptionsInputSchema = z
  .array(OptionInputSchema)
  .min(1, 'Minimal satu pilihan')
  .max(MAX_OPTIONS_PER_FIELD, `Maksimal ${MAX_OPTIONS_PER_FIELD} pilihan`);

const RuleValueSchema = z.union([
  z.string().max(200).regex(TANPA_NUL, PESAN_NUL),
  z.number(),
]);
const RuleSchema = z
  .object({
    jenis: z.literal('jawaban'),
    fieldId: IdSchema,
    op: z.string().max(32),
    nilai: z
      .union([RuleValueSchema, z.array(z.string().max(200)).max(50)])
      .optional(),
    nilai2: RuleValueSchema.optional(),
  })
  .strict();
/** Kondisi "tampil jika"; kesahihannya terhadap isi form diperiksa di server. */
export const ConditionSchema = z
  .object({
    cocok: z.enum(['semua', 'salah-satu']),
    aturan: z.array(RuleSchema).max(MAX_RULES, `Maksimal ${MAX_RULES} aturan`),
  })
  .strict();

const fieldBase = {
  /** Omitted keeps the stored image; `null` removes it. */
  image: FieldImageSchema.nullish(),
  condition: ConditionSchema.nullish(),
  /** Hapus kondisi lain yang rusak karena perubahan ini, alih-alih menolaknya. */
  clearDependents: z.boolean().optional(),
  label: z
    .string()
    .trim()
    .min(1, 'Pertanyaan tidak boleh kosong')
    .max(500, 'Pertanyaan maksimal 500 karakter')
    .regex(TANPA_NUL, PESAN_NUL),
  description: z
    .string()
    .trim()
    .max(2000)
    .regex(TANPA_NUL, PESAN_NUL)
    .nullish(),
  required: z.boolean().default(false),
};

const UnitChoiceConfigSchema = z
  .object({ willingFieldId: IdSchema.optional() })
  .strict();

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
    config: SingleChoiceConfigSchema,
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
  text_block: z.object({
    type: z.literal('text_block'),
    config: EmptyConfigSchema,
  }),
  link: z.object({ type: z.literal('link'), config: LinkConfigSchema }),
  file: z.object({ type: z.literal('file'), config: FileConfigSchema }),
  matrix: z.object({ type: z.literal('matrix'), config: MatrixConfigSchema }),
  scale: z.object({ type: z.literal('scale'), config: ScaleConfigSchema }),
  unit_choice: z.object({
    type: z.literal('unit_choice'),
    config: UnitChoiceConfigSchema,
  }),
};

type FieldVariant = z.infer<(typeof fieldVariants)[keyof typeof fieldVariants]>;

/** Cross-key checks shared by create and update. */
function refineFieldDefinition(
  field: FieldVariant & { required: boolean },
  ctx: z.RefinementCtx,
) {
  const issue = (path: string, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

  if (field.type === 'text_block' && field.required) {
    issue('required', 'Blok teks tidak bisa diwajibkan');
  }

  if (field.type === 'short_text' || field.type === 'long_text') {
    const { minLength, maxLength } = field.config;
    if (
      minLength !== undefined &&
      maxLength !== undefined &&
      minLength > maxLength
    ) {
      issue('config', 'Panjang minimum melebihi panjang maksimum');
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
const baseShape = { ...fieldBase, formId: IdSchema };
// A new field may be placed in a section (null = outside any section). Moving
// an existing field is `field.move`, so update does not take `sectionId`.
const createShape = { ...baseShape, sectionId: IdSchema.nullish() };
const updateShape = { ...baseShape, fieldId: IdSchema };

const createFieldVariants = [
  fieldVariants.short_text.extend(createShape),
  fieldVariants.long_text.extend(createShape),
  fieldVariants.number.extend(createShape),
  fieldVariants.date.extend(createShape),
  fieldVariants.single_choice.extend(createShape),
  fieldVariants.multiple_choice.extend(createShape),
  fieldVariants.checkbox.extend(createShape),
  fieldVariants.text_block.extend(createShape),
  fieldVariants.link.extend(createShape),
  fieldVariants.file.extend(createShape),
  fieldVariants.matrix.extend(createShape),
  fieldVariants.scale.extend(createShape),
  fieldVariants.unit_choice.extend(createShape),
] as const;

const updateFieldVariants = [
  fieldVariants.short_text.extend(updateShape),
  fieldVariants.long_text.extend(updateShape),
  fieldVariants.number.extend(updateShape),
  fieldVariants.date.extend(updateShape),
  fieldVariants.single_choice.extend(updateShape),
  fieldVariants.multiple_choice.extend(updateShape),
  fieldVariants.checkbox.extend(updateShape),
  fieldVariants.text_block.extend(updateShape),
  fieldVariants.link.extend(updateShape),
  fieldVariants.file.extend(updateShape),
  fieldVariants.matrix.extend(updateShape),
  fieldVariants.scale.extend(updateShape),
  fieldVariants.unit_choice.extend(updateShape),
] as const;

/**
 * Bentuk `form_field.config` seperti tersimpan di jsonb. Diturunkan dari
 * `FieldConfigSchema` supaya tipe dan validator tidak bisa berbeda diam-diam.
 */
export type FieldConfig = z.infer<typeof FieldConfigSchema>;

// ---------------------------------------------------------------------------
// Shared output pieces
// ---------------------------------------------------------------------------

/**
 * Dipakai dua arah: menyusun bentuk output, dan memvalidasi `config` yang
 * dibaca dari jsonb (lihat `parseFieldConfig` di router form). Kunci asing
 * dibuang, bukan ditolak, supaya deploy lama tetap bisa membaca baris yang
 * ditulis versi lebih baru.
 */
export const FieldConfigSchema = z.object({
  minLength: z.number().int().optional(),
  maxLength: z.number().int().optional(),
  pattern: TextPatternPresetSchema.optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minSelections: z.number().int().optional(),
  maxSelections: z.number().int().optional(),
  buttonLabel: z.string().optional(),
  rows: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  columns: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  multiple: z.boolean().optional(),
  minLabel: z.string().optional(),
  maxLabel: z.string().optional(),
  tampilan: z.enum(['daftar', 'dropdown', 'angka', 'bintang']).optional(),
  preset: z.enum(FILE_PRESET_KEYS).optional(),
  maxFiles: z.number().int().optional(),
  maxSizeMb: z.number().int().optional(),
  linkAccess: z.enum(['anyone', 'organization']).optional(),
  /** unit_choice: id pertanyaan checkbox "bersedia dipindahkan" di form yang sama. */
  willingFieldId: z.string().optional(),
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
  config: FieldConfigSchema,
  /** `null` = outside any section. */
  sectionId: z.string().nullable(),
  sortOrder: z.number().int(),
  /** Empty for non-choice types. Archived options are never included. */
  options: z.array(FieldOptionOutputSchema),
  condition: ConditionSchema.nullable(),
  image: FieldImageSchema.nullable(),
});

export const FormSectionOutputSchema = z.object({
  id: z.string(),
  formId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  condition: ConditionSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const FormEndingOutputSchema = z.object({
  id: z.string(),
  formId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  condition: ConditionSchema.nullable(),
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
  /** Pengisi boleh menyunting jawabannya; hanya untuk form satu respons. */
  allowEditAfterSubmit: z.boolean(),
  /** `null` = tanpa batas jumlah respons. */
  maxResponses: z.number().int().nullable(),
  publishedAt: z.date().nullable(),
  /** Managers only: the public preview link is `/forms/preview/<token>`. */
  previewEnabled: z.boolean(),
  previewToken: z.string().nullable(),
  settings: FormSettingsSchema,
  theme: FormThemeSchema,
  welcome: FormWelcomeSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

const FormListItemSchema = FormOutputSchema.extend({
  submissionCount: z.number().int(),
});

const FormDetailSchema = FormOutputSchema.extend({
  submissionCount: z.number().int(),
  /** Active fields only: no-section group first, then by section and `sortOrder`. */
  fields: z.array(FieldOutputSchema),
  sections: z.array(FormSectionOutputSchema),
  endings: z.array(FormEndingOutputSchema),
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
    .max(255, 'Judul formulir maksimal 255 karakter')
    .regex(TANPA_NUL, PESAN_NUL),
  description: z
    .string()
    .trim()
    .max(5000)
    .regex(TANPA_NUL, PESAN_NUL)
    .nullish(),
  closesAt: z.coerce.date().nullish(),
  allowMultipleSubmissions: z.boolean().optional(),
  allowEditAfterSubmit: z.boolean().optional(),
  maxResponses: z.number().int().min(1).max(1_000_000).nullish(),
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
  allowEditAfterSubmit: formMeta.allowEditAfterSubmit,
  maxResponses: formMeta.maxResponses,
  /** The three JSON blocks are replaced as a whole when present. */
  settings: FormSettingsSchema.optional(),
  theme: FormThemeSchema.optional(),
  welcome: FormWelcomeSchema.optional(),
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
// Sections
// ---------------------------------------------------------------------------

const sectionMeta = {
  title: z
    .string()
    .trim()
    .min(1, 'Judul bagian tidak boleh kosong')
    .max(255, 'Judul bagian maksimal 255 karakter')
    .regex(TANPA_NUL, PESAN_NUL),
  description: z
    .string()
    .trim()
    .max(2000, 'Deskripsi bagian maksimal 2000 karakter')
    .regex(TANPA_NUL, PESAN_NUL)
    .nullish(),
};

export const CreateSectionInputSchema = z.object({
  formId: IdSchema,
  ...sectionMeta,
});
export const CreateSectionOutputSchema = FormSectionOutputSchema;

/** Omitted keys stay as they are; `description: null` clears it. */
export const UpdateSectionInputSchema = z.object({
  formId: IdSchema,
  sectionId: IdSchema,
  title: sectionMeta.title.optional(),
  description: sectionMeta.description,
  /** Omitted keeps it; `null` clears it. */
  condition: ConditionSchema.nullish(),
  clearDependents: z.boolean().optional(),
});
export const UpdateSectionOutputSchema = FormSectionOutputSchema;

export const DeleteSectionInputSchema = z.object({
  formId: IdSchema,
  sectionId: IdSchema,
});
export const DeleteSectionOutputSchema = SuccessSchema;

export const ReorderSectionsInputSchema = z.object({
  formId: IdSchema,
  /** Every section id of the form, in the new order. */
  sectionIds: z.array(IdSchema).min(1).max(MAX_SECTIONS_PER_FORM),
  clearDependents: z.boolean().optional(),
});
export const ReorderSectionsOutputSchema = SuccessSchema;

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
  clearDependents: z.boolean().optional(),
});
export const DeleteFieldOutputSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  /** `archived` when the field already had answers, else `deleted`. */
  result: z.enum(['archived', 'deleted']),
});

export const ReorderFieldsInputSchema = z.object({
  formId: IdSchema,
  /** Section whose fields are reordered; `null` = fields outside any section. */
  sectionId: IdSchema.nullable().default(null),
  /** Every active field id of that section, in the new order. */
  fieldIds: z.array(IdSchema).min(1).max(MAX_FIELDS_PER_FORM),
  clearDependents: z.boolean().optional(),
});
export const ReorderFieldsOutputSchema = SuccessSchema;

export const MoveFieldInputSchema = z.object({
  formId: IdSchema,
  fieldId: IdSchema,
  /** `null` = move out of every section. */
  toSectionId: IdSchema.nullable(),
  /** Position inside the target group, counted from 0. */
  toIndex: z.number().int().min(0).max(MAX_FIELDS_PER_FORM),
  clearDependents: z.boolean().optional(),
});
export const MoveFieldOutputSchema = SuccessSchema;

// ---------------------------------------------------------------------------
// Endings
// ---------------------------------------------------------------------------

export const MAX_ENDINGS_PER_FORM = 20;
const endingMeta = {
  title: z
    .string()
    .trim()
    .min(1, 'Judul ending tidak boleh kosong')
    .max(255, 'Judul ending maksimal 255 karakter')
    .regex(TANPA_NUL, PESAN_NUL),
  description: z
    .string()
    .trim()
    .max(2000, 'Deskripsi ending maksimal 2000 karakter')
    .regex(TANPA_NUL, PESAN_NUL)
    .nullish(),
};
export const CreateEndingInputSchema = z.object({
  formId: IdSchema,
  ...endingMeta,
  condition: ConditionSchema.nullish(),
});
export const CreateEndingOutputSchema = FormEndingOutputSchema;
export const UpdateEndingInputSchema = z.object({
  formId: IdSchema,
  endingId: IdSchema,
  title: endingMeta.title.optional(),
  description: endingMeta.description,
  condition: ConditionSchema.nullish(),
});
export const UpdateEndingOutputSchema = FormEndingOutputSchema;
export const DeleteEndingInputSchema = z.object({
  formId: IdSchema,
  endingId: IdSchema,
});
export const DeleteEndingOutputSchema = SuccessSchema;
export const ReorderEndingsInputSchema = z.object({
  formId: IdSchema,
  endingIds: z.array(IdSchema).min(1).max(MAX_ENDINGS_PER_FORM),
});
export const ReorderEndingsOutputSchema = SuccessSchema;

// ---------------------------------------------------------------------------
// Public preview link
// ---------------------------------------------------------------------------

export const SetPreviewInputSchema = z.object({
  formId: IdSchema,
  enabled: z.boolean(),
});
export const SetPreviewOutputSchema = FormOutputSchema;
export const RotatePreviewTokenInputSchema = z.object({ formId: IdSchema });
export const RotatePreviewTokenOutputSchema = FormOutputSchema;
export const GetPreviewInputSchema = z.object({
  token: z.string().min(20).max(64).regex(TANPA_NUL, PESAN_NUL),
});

// ---------------------------------------------------------------------------
// Filling
// ---------------------------------------------------------------------------

export const GetPublicFormInputSchema = z.object({ formId: IdSchema });

/** Keadaan form terikat oprec bagi pengisi yang sedang membukanya. */
export const PublicOprecSchema = z.object({
  recruitmentId: z.string(),
  canApply: z.boolean(),
  /** Syarat pendaftar terpenuhi; false = tampilkan penjelasan, bukan form. */
  eligible: z.boolean(),
  /** Kalimat siap tampil bila `canApply` false. */
  reason: z.string().nullable(),
  minChoices: z.number().int(),
  maxChoices: z.number().int(),
  allowRedirect: z.boolean(),
  wave: z
    .object({ label: z.string(), startsAt: z.date(), endsAt: z.date() })
    .nullable(),
  divisions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      groupLabel: z.string().nullable(),
    }),
  ),
});
export const GetPublicFormOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: FormStatusSchema,
  closesAt: z.date().nullable(),
  allowMultipleSubmissions: z.boolean(),
  allowEditAfterSubmit: z.boolean(),
  maxResponses: z.number().int().nullable(),
  /** Terbit dan belum lewat tenggat, tanpa melihat kuota. */
  isOpen: z.boolean(),
  /** Kuota respons sudah habis; form tetap Terbit tetapi tidak menerima jawaban. */
  isFull: z.boolean(),
  owner: z.object({
    type: z.enum(['lembaga', 'event']),
    id: z.string(),
    name: z.string(),
  }),
  /** Published and not past `closesAt`. */
  isAcceptingResponses: z.boolean(),
  /** Hanya ada untuk form yang terikat oprec (dan bukan pratinjau). */
  oprec: PublicOprecSchema.nullish(),
  /** `null` in preview mode. */
  hasSubmitted: z.boolean().nullable(),
  /** `preview` = opened through the public preview link; never accepts answers. */
  mode: z.enum(['form', 'preview']),
  settings: FormSettingsSchema,
  theme: FormThemeSchema,
  welcome: FormWelcomeSchema,
  sections: z.array(FormSectionOutputSchema.omit({ sortOrder: true })),
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
 * - link: string (http or https URL)
 * - scale: number
 * - matrix: object `{ [rowId]: columnId }`, or `{ [rowId]: columnId[] }` when
 *   the field allows several columns per row
 * - text_block: never answered
 *
 * Validation failures come back as BAD_REQUEST with
 * `data.zodError.fieldErrors[<fieldId>]`, the same shape as input errors.
 */
export const AnswerValueSchema = z.union(
  [
    // Batas atas kasar, bukan aturan per pertanyaan: `validateAnswers` yang
    // menegakkan `maxLength` tiap field. Tanpa batas di sini, payload sebesar
    // apa pun tetap diparse dan divalidasi lebih dulu.
    z
      .string()
      .max(LONG_TEXT_MAX_LENGTH, 'Jawaban teks terlalu panjang')
      .regex(TANPA_NUL, PESAN_NUL),
    z.number(),
    z.boolean(),
    z
      .array(IdSchema)
      .max(MAX_OPTIONS_PER_FIELD, 'Pilihan yang dikirim terlalu banyak'),
    FileAnswerListSchema,
    z
      .record(
        IdSchema,
        z.union([IdSchema, z.array(IdSchema).max(MATRIX_MAX_COLUMNS)]),
      )
      .refine(
        (rows) => Object.keys(rows).length <= MATRIX_MAX_ROWS,
        'Baris jawaban yang dikirim terlalu banyak',
      ),
  ],
  { error: 'Bentuk jawaban tidak dikenali' },
);

export const SubmitFormInputSchema = z.object({
  formId: IdSchema,
  answers: z
    .array(z.object({ fieldId: IdSchema, value: AnswerValueSchema }))
    .max(MAX_FIELDS_PER_FORM),
});
export const SubmitFormOutputSchema = z.object({
  submissionId: z.string(),
  submittedAt: z.date(),
  updatedAt: z.date(),
  /** Layar penutup terpilih; `null` = ucapan terima kasih standar. */
  ending: z
    .object({
      id: z.string(),
      title: z.string(),
      description: z.string().nullable(),
    })
    .nullable(),
});

export const GetMySubmissionInputSchema = z.object({ formId: IdSchema });
export const GetMySubmissionOutputSchema = z
  .object({
    id: z.string(),
    submittedAt: z.date(),
    updatedAt: z.date(),
    /** Jawaban aktif dalam bentuk yang sama dengan input pengisian. */
    answers: z.record(IdSchema, AnswerValueSchema),
  })
  .nullable();

/** Menyunting jawaban yang sudah dikirim: bentuknya sama dengan `submit`. */
export const UpdateSubmissionInputSchema = SubmitFormInputSchema;
export const UpdateSubmissionOutputSchema = SubmitFormOutputSchema;

export const RESPONSES_MAX_PAGE_SIZE = 100;
export const ResponsesListInputSchema = z.object({
  formId: IdSchema,
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(RESPONSES_MAX_PAGE_SIZE).default(50),
  /** Hanya respons sampai waktu ini; dipakai ekspor agar halaman tidak bergeser. */
  until: z.date().optional(),
});
export const ResponsesGetInputSchema = z.object({
  formId: IdSchema,
  submissionId: IdSchema,
});
export const ResponsesSummaryInputSchema = z.object({ formId: IdSchema });

export const ResponseColumnSchema = z.object({
  fieldId: z.string(),
  type: FormFieldTypeSchema,
  label: z.string(),
  archived: z.boolean(),
});
export const ResponseRowSchema = z.object({
  id: z.string(),
  submittedAt: z.date(),
  updatedAt: z.date(),
  respondent: z.object({
    name: z.string().nullable(),
    nim: z.number().int().nullable(),
    email: z.string().nullable(),
  }),
  /** Jawaban tersimpan per fieldId; pertanyaan yang tidak dijawab tidak punya kunci. */
  answers: z.record(z.string(), z.unknown()),
});
export const ResponsesListOutputSchema = z.object({
  columns: z.array(ResponseColumnSchema),
  rows: z.array(ResponseRowSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export const ResponsesGetOutputSchema = z.object({
  columns: z.array(ResponseColumnSchema),
  row: ResponseRowSchema,
});

const SummaryBase = {
  fieldId: z.string(),
  label: z.string(),
  archived: z.boolean(),
};
export const FieldSummarySchema = z.discriminatedUnion('type', [
  z.object({
    ...SummaryBase,
    type: z.literal('choice'),
    answered: z.number(),
    options: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        count: z.number(),
        percent: z.number(),
        archived: z.boolean(),
      }),
    ),
  }),
  z.object({
    ...SummaryBase,
    type: z.literal('number'),
    count: z.number(),
    min: z.number().nullable(),
    max: z.number().nullable(),
    average: z.number().nullable(),
  }),
  z.object({
    ...SummaryBase,
    type: z.literal('scale'),
    count: z.number(),
    average: z.number(),
    distribution: z.array(z.object({ value: z.number(), count: z.number() })),
  }),
  z.object({
    ...SummaryBase,
    type: z.literal('text'),
    count: z.number(),
    latest: z.array(z.string()),
  }),
  z.object({
    ...SummaryBase,
    type: z.literal('checkbox'),
    yes: z.number(),
    no: z.number(),
  }),
  z.object({
    ...SummaryBase,
    type: z.literal('matrix'),
    count: z.number(),
    rows: z.array(
      z.object({
        rowId: z.string(),
        label: z.string(),
        cells: z.array(
          z.object({
            columnId: z.string(),
            label: z.string(),
            count: z.number(),
          }),
        ),
      }),
    ),
  }),
]);
export const ResponsesSummaryOutputSchema = z.object({
  total: z.number().int(),
  fields: z.array(FieldSummarySchema),
});

/** Shape of one answer as sent by the client (`submit` and edit). */
export type AnswerInputValue = z.infer<typeof AnswerValueSchema>;

/** Stored shape of `form_answer.value`. */
export type StoredAnswerValue =
  | string
  | number
  | boolean
  | { optionId: string; label: string }
  | { optionId: string; label: string }[]
  | z.infer<typeof FileAnswerSchema>[]
  | {
      rowId: string;
      rowLabel: string;
      selected: { columnId: string; label: string }[];
    }[];

export type ResponsesListOutput = z.infer<typeof ResponsesListOutputSchema>;
export type ResponsesGetOutput = z.infer<typeof ResponsesGetOutputSchema>;
export type ResponsesSummaryOutput = z.infer<
  typeof ResponsesSummaryOutputSchema
>;
export type ResponseColumn = z.infer<typeof ResponseColumnSchema>;
export type ResponseRowOut = z.infer<typeof ResponseRowSchema>;
export type FormEndingOutput = z.infer<typeof FormEndingOutputSchema>;
export type ConditionInput = z.infer<typeof ConditionSchema>;
export type FormOutput = z.infer<typeof FormOutputSchema>;
export type FormDetail = z.infer<typeof FormDetailSchema>;
export type FormSectionOutput = z.infer<typeof FormSectionOutputSchema>;
export type GetPublicFormOutput = z.infer<typeof GetPublicFormOutputSchema>;
export type FieldImage = z.infer<typeof FieldImageSchema>;
export type FieldOutput = z.infer<typeof FieldOutputSchema>;
export type UpdateFormInput = z.infer<typeof UpdateFormInputSchema>;
export type ReorderFieldsInput = z.infer<typeof ReorderFieldsInputSchema>;
export type MoveFieldInput = z.infer<typeof MoveFieldInputSchema>;
export type CreateFieldInput = z.infer<typeof CreateFieldInputSchema>;
export type UpdateFieldInput = z.infer<typeof UpdateFieldInputSchema>;
