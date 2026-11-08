import { z } from 'zod';
import {
  APPLICATION_SOURCES,
  ELIGIBILITY_ATTRIBUTES,
  ELIGIBILITY_MATCHES,
  ELIGIBILITY_OPERATORS,
  PLACEMENT_STATES,
  RECRUITMENT_STATUSES,
  SCORE_SOURCES,
  SCORING_MODES,
  STATUS_METHODS,
} from '~/server/db/schema';

const id = z.string().min(1).max(255);

export const MAX_WAVES_PER_RECRUITMENT = 20;
export const MAX_ELIGIBILITY_RULES = 20;
export const MAX_CHOICES_LIMIT = 10;

export const RecruitmentStatusSchema = z.enum(RECRUITMENT_STATUSES);
export const PlacementStateSchema = z.enum(PLACEMENT_STATES);
export const ApplicationSourceSchema = z.enum(APPLICATION_SOURCES);

/**
 * Pengaturan oprec yang boleh diubah lewat `update`. Semua opsional (patch);
 * `.refine` di bawah menjaga hubungan antar-kolom yang juga dijaga CHECK.
 */
const RecruitmentSettingsShape = {
  name: z.string().trim().min(1).max(255),
  minChoices: z.number().int().min(1).max(MAX_CHOICES_LIMIT),
  maxChoices: z.number().int().min(1).max(MAX_CHOICES_LIMIT),
  allowRedirect: z.boolean(),
  scoringMode: z.enum(SCORING_MODES),
  statusMethod: z.enum(STATUS_METHODS),
  statusMinScore: z.number().int().min(0).max(100),
  scoreSource: z.enum(SCORE_SOURCES),
  weightUmum: z.number().int().min(0).max(100),
  minReviewers: z.number().int().min(1).max(5),
  blind: z.boolean(),
  allowEarlyAssessment: z.boolean(),
  visibilityDefault: z.boolean(),
  resultsVisibleToApplicants: z.boolean(),
};

export const RecruitmentSettingsPatchSchema = z
  .object(RecruitmentSettingsShape)
  .partial()
  .refine(
    (v) =>
      v.minChoices === undefined ||
      v.maxChoices === undefined ||
      v.minChoices <= v.maxChoices,
    { message: 'Batas pilihan minimum tidak boleh melebihi maksimum.' },
  );

export const ListRecruitmentsInputSchema = z.object({ eventId: id });

export const CreateRecruitmentInputSchema = z.object({
  eventId: id,
  formId: id,
  name: RecruitmentSettingsShape.name,
});

export const RecruitmentIdInputSchema = z.object({ recruitmentId: id });

export const UpdateRecruitmentInputSchema = z.object({
  recruitmentId: id,
  settings: RecruitmentSettingsPatchSchema,
});

export const SetRecruitmentStatusInputSchema = z.object({
  recruitmentId: id,
  status: RecruitmentStatusSchema,
});

export const SaveSetupInputSchema = z.object({
  recruitmentId: id,
  answers: z.record(z.string(), z.unknown()),
  /** true = wizard selesai; mengisi `setupCompletedAt`. */
  complete: z.boolean().default(false),
});

export const WaveInputSchema = z
  .object({
    /** Ada = ubah gelombang itu; tidak ada = gelombang baru. */
    id: id.optional(),
    label: z.string().trim().min(1).max(255),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((v) => v.endsAt > v.startsAt, {
    message: 'Waktu berakhir harus setelah waktu mulai.',
    path: ['endsAt'],
  });

export const ReplaceWavesInputSchema = z.object({
  recruitmentId: id,
  waves: z.array(WaveInputSchema).max(MAX_WAVES_PER_RECRUITMENT),
});

const EligibilityValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z
    .array(z.union([z.string(), z.number()]))
    .min(1)
    .max(100),
]);

export const EligibilityRuleInputSchema = z
  .object({
    attribute: z.enum(ELIGIBILITY_ATTRIBUTES),
    op: z.enum(ELIGIBILITY_OPERATORS),
    value: EligibilityValueSchema,
  })
  .superRefine((rule, ctx) => {
    const isList = Array.isArray(rule.value);
    if (['in', 'not_in', 'between'].includes(rule.op) !== isList) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: isList
          ? 'Operator ini membutuhkan satu nilai, bukan daftar.'
          : 'Operator ini membutuhkan daftar nilai.',
      });
    }
    if (
      rule.op === 'between' &&
      Array.isArray(rule.value) &&
      rule.value.length !== 2
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Rentang membutuhkan tepat dua nilai.',
      });
    }
  });

export const ReplaceEligibilityInputSchema = z.object({
  recruitmentId: id,
  match: z.enum(ELIGIBILITY_MATCHES),
  rules: z.array(EligibilityRuleInputSchema).max(MAX_ELIGIBILITY_RULES),
});

export const AddDivisionInputSchema = z.object({
  recruitmentId: id,
  unitId: id,
  positionId: id,
  code: z.string().trim().max(50).nullish(),
});

export const RemoveDivisionInputSchema = z.object({
  recruitmentId: id,
  divisionId: id,
});

export const ReorderDivisionsInputSchema = z.object({
  recruitmentId: id,
  divisionIds: z.array(id).min(1).max(500),
});

export const SetSectionBindingsInputSchema = z.object({
  recruitmentId: id,
  formSectionId: id,
  divisionIds: z.array(id).max(500),
});

export const OkOutputSchema = z.object({ success: z.boolean() });

// ---------------------------------------------------------------------------
// Pendaftar (ringkasan baca-saja)
// ---------------------------------------------------------------------------

export const APPLICANTS_MAX_PAGE_SIZE = 500;
export const APPLICANT_SORTS = [
  'nama',
  'gelombang',
  'angkatan',
  'prodi',
  'waktu',
] as const;
export const APPLICANT_GROUPS = [
  'tanpa',
  'gelombang',
  'pilihan1',
  'angkatan',
  'prodi',
] as const;

export const ApplicantsListInputSchema = z.object({
  recruitmentId: id,
  /** Cocok dengan nama atau NIM. */
  search: z.string().trim().max(100).optional(),
  waveId: id.optional(),
  /** Tujuan yang ada di pilihan mana pun. */
  divisionId: id.optional(),
  angkatan: z.number().int().optional(),
  prodi: z.string().max(255).optional(),
  /** Status efektif salah satu pilihan. */
  status: z
    .enum(['belum_lengkap', 'perlu_ditinjau', 'lolos', 'tidak_lolos'])
    .optional(),
  syaratUmum: z.enum(['lolos', 'gugur', 'perlu_ditinjau', 'belum']).optional(),
  flagLabelId: id.optional(),
  sort: z.enum(APPLICANT_SORTS).default('nama'),
  groupBy: z.enum(APPLICANT_GROUPS).default('tanpa'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(APPLICANTS_MAX_PAGE_SIZE).default(50),
});

export const ApplicantDetailInputSchema = z.object({
  recruitmentId: id,
  applicationId: id,
});

// ---------------------------------------------------------------------------
// Setup oprec (wizard)
// ---------------------------------------------------------------------------

export const SETUP_MAX_DIVISIONS = 200;
export const SETUP_MAX_ATTACHMENTS = 10;
export const SETUP_GROUPINGS = ['per_divisi', 'satu_bagian'] as const;

export const SetupOptionsInputSchema = z.object({
  eventId: id,
  /** Periode sumber organogram; bawaan periode oprec sendiri. */
  sourcePeriodId: id.optional(),
});

export const SetupFormChoiceSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('template'),
    title: z.string().trim().min(1).max(255).optional(),
  }),
  z.object({ mode: z.literal('existing'), formId: id }),
]);

export const CreateFromSetupInputSchema = z.object({
  eventId: id,
  name: RecruitmentSettingsShape.name,
  form: SetupFormChoiceSchema,
  divisions: z
    .array(z.object({ unitId: id, positionId: id }))
    .min(1, 'Pilih minimal satu tujuan.')
    .max(SETUP_MAX_DIVISIONS),
  minChoices: RecruitmentSettingsShape.minChoices,
  maxChoices: RecruitmentSettingsShape.maxChoices,
  allowRedirect: z.boolean().default(false),
  grouping: z.enum(SETUP_GROUPINGS).default('per_divisi'),
  /** Nama lampiran wajib (tautan), mis. "Twibbon". */
  attachments: z
    .array(z.string().trim().min(1).max(120))
    .max(SETUP_MAX_ATTACHMENTS)
    .default([]),
  waves: z.array(WaveInputSchema).max(MAX_WAVES_PER_RECRUITMENT).default([]),
  eligibility: z
    .object({
      match: z.enum(ELIGIBILITY_MATCHES),
      rules: z.array(EligibilityRuleInputSchema).max(MAX_ELIGIBILITY_RULES),
    })
    .default({ match: 'all', rules: [] }),
  /** Pengaturan penilaian dan hasil yang sudah punya kolom; lainnya cukup di `answers`. */
  settings: RecruitmentSettingsPatchSchema.default({}),
  /** Kriteria awal dari wizard (S23): 'umum' atau id bagian tujuan (unitId). */
  criteria: z
    .array(
      z.object({
        scope: z.string().min(1).max(255),
        name: z.string().trim().min(1).max(255),
        kind: z.enum(['skor', 'gugur_manual']),
        weight: z.number().int().min(0).max(100).nullish(),
      }),
    )
    .max(200)
    .default([]),
  /** Jawaban mentah wizard S1-S23, disimpan untuk riwayat. */
  answers: z.record(z.string(), z.unknown()).default({}),
});

// ---------------------------------------------------------------------------
// Penilaian
// ---------------------------------------------------------------------------

export const ASSESS_MAX_PAGE_SIZE = 100;
/** Lingkup penilaian: 'umum' atau id divisi. */
const ScopeSchema = z.string().min(1).max(255);

export const AssessQueueInputSchema = z.object({
  recruitmentId: id,
  scope: ScopeSchema,
  search: z.string().trim().max(100).optional(),
  /** Hanya yang belum selesai dinilai di lingkup ini. */
  onlyIncomplete: z.boolean().default(false),
  /** Sertakan nilai milik pemanggil per kriteria (tampilan sheet). */
  withValues: z.boolean().default(false),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(ASSESS_MAX_PAGE_SIZE).default(50),
});

export const AssessGetInputSchema = z.object({
  recruitmentId: id,
  applicationId: id,
  scope: ScopeSchema,
});

export const AssessSaveInputSchema = z
  .object({
    recruitmentId: id,
    applicationId: id,
    criterionId: id,
    /** Wajib untuk kriteria divisi; kosong untuk kriteria umum. */
    choiceId: id.nullish(),
    rating: z.number().int().nullish(),
    gateState: z.enum(['memenuhi', 'ditinjau', 'tidak']).nullish(),
    note: z.string().trim().max(2000).nullish(),
  })
  .refine((v) => v.rating == null || v.gateState == null, {
    message: 'Isi skor atau gate, tidak keduanya.',
  });

export const OverrideSetInputSchema = z.object({
  recruitmentId: id,
  choiceId: id,
  status: z.enum(['lolos', 'tidak_lolos']),
  reason: z.string().trim().min(1, 'Alasan wajib diisi.').max(2000),
  isSensitive: z.boolean().default(false),
});

export const OverrideClearInputSchema = z.object({
  recruitmentId: id,
  choiceId: id,
});

export const OverrideHistoryInputSchema = z.object({
  recruitmentId: id,
  choiceId: id,
});

export const AssessStatusesSchema = z.array(
  z.object({
    choiceId: z.string(),
    score: z.number().nullable(),
    status: z
      .enum(['belum_lengkap', 'perlu_ditinjau', 'lolos', 'tidak_lolos'])
      .nullable(),
  }),
);
