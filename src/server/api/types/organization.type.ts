import { z } from 'zod';
import {
  ORGANIZATION_POSITION_KINDS,
  RANK_ID_PATTERN,
  placementSourceEnum,
} from '~/server/db/schema';

import {
  MAX_POSITIONS,
  MAX_TREE_DEPTH,
  MAX_UNITS,
} from '../routers/organization/tree';

const RankSchema = z.string().regex(RANK_ID_PATTERN);
const KindSchema = z.enum(ORGANIZATION_POSITION_KINDS);
const SourceSchema = z.enum(placementSourceEnum.enumValues);

/** Id dibuat klien (crypto.randomUUID) untuk entitas baru; server menolak id yang sudah dipakai struktur lain. */
const IdSchema = z.uuid();

export const OrganogramUnitSchema = z.object({
  id: IdSchema,
  parentId: IdSchema.nullable(),
  name: z.string().trim().min(1).max(255),
  typeLabel: z.string().max(255).nullable(),
  description: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(1_000_000),
  layout: z.record(z.string(), z.unknown()).nullable(),
});

export const OrganogramPositionSchema = z.object({
  id: IdSchema,
  unitId: IdSchema,
  title: z.string().trim().min(1).max(255),
  rank: RankSchema,
  kind: KindSchema,
  quota: z.number().int().min(0).max(100_000),
  hidden: z.boolean(),
  sortOrder: z.number().int().min(0).max(1_000_000),
});

export const OrganogramPlacementSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  source: SourceSchema,
  note: z.string().nullable(),
});

const LevelLabelsSchema = z
  .array(z.string().trim().min(1).max(255))
  .max(MAX_TREE_DEPTH);
const RankDefSchema = z.object({
  id: RankSchema,
  label: z.string().trim().min(1).max(60),
});
/** Daftar rank berurutan; id harus unik. */
const RanksSchema = z
  .array(RankDefSchema)
  .min(1)
  .max(24)
  .refine(
    (ranks) => new Set(ranks.map((r) => r.id)).size === ranks.length,
    'Id rank harus unik.',
  );

export const OrganogramAccessSchema = z.object({
  /** Owner/admin lembaga atau admin periode: boleh semuanya, tidak terpengaruh kunci. */
  canManage: z.boolean(),
  canEdit: z.boolean(),
  canLock: z.boolean(),
  /** null = semua unit (pengelola); selain itu hanya unit tempat ia ditempatkan beserta turunannya. */
  editableUnitIds: z.array(z.string()).nullable(),
});

// --- structure.get
export const GetOrganogramInputSchema = z.object({
  periodId: z.string().min(1),
});
export const GetOrganogramOutputSchema = z
  .object({
    id: z.string(),
    periodId: z.string(),
    name: z.string(),
    levelLabels: LevelLabelsSchema.nullable(),
    ranks: RanksSchema.nullable(),
    editLocked: z.boolean(),
    lockedBy: z.string().nullable(),
    lockedAt: z.date().nullable(),
    /** Dikirim kembali saat menyimpan; naik setiap penyimpanan pohon. */
    version: z.number().int(),
    units: z.array(
      OrganogramUnitSchema.extend({
        id: z.string(),
        parentId: z.string().nullable(),
      }),
    ),
    positions: z.array(
      OrganogramPositionSchema.extend({
        id: z.string(),
        unitId: z.string(),
        placements: z.array(OrganogramPlacementSchema),
      }),
    ),
    access: OrganogramAccessSchema,
  })
  .nullable();

// --- structure.create
export const CreateOrganogramInputSchema = z.object({
  periodId: z.string().min(1),
  name: z.string().trim().min(1).max(255).optional(),
});
export const CreateOrganogramOutputSchema = z.object({
  id: z.string(),
  version: z.number().int(),
});

// --- structure.save
export const SaveOrganogramInputSchema = z.object({
  periodId: z.string().min(1),
  expectedVersion: z.number().int().min(0),
  /** Hanya pengelola yang boleh mengubah nama dan label. undefined = tidak diubah. */
  name: z.string().trim().min(1).max(255).optional(),
  levelLabels: LevelLabelsSchema.nullable().optional(),
  ranks: RanksSchema.nullable().optional(),
  units: z.array(OrganogramUnitSchema).max(MAX_UNITS),
  positions: z.array(OrganogramPositionSchema).max(MAX_POSITIONS),
});
export const SaveOrganogramOutputSchema = z.object({
  version: z.number().int(),
  changed: z.boolean(),
});

// --- structure.setLock
export const SetOrganogramLockInputSchema = z.object({
  periodId: z.string().min(1),
  locked: z.boolean(),
});
export const SetOrganogramLockOutputSchema = z.object({
  editLocked: z.boolean(),
});

// --- placement
const QuotaFullSchema = z.object({
  ok: z.literal(false),
  reason: z.literal('quota_full'),
  count: z.number().int(),
  quota: z.number().int(),
});
export const AddPlacementInputSchema = z.object({
  positionId: z.string().min(1),
  userId: z.string().min(1),
  source: SourceSchema.default('manual'),
  note: z.string().max(1000).nullable().optional(),
  /** Kirim true setelah pengguna mengonfirmasi peringatan kuota penuh. */
  allowOverQuota: z.boolean().default(false),
});
export const AddPlacementOutputSchema = z.union([
  z.object({ ok: z.literal(true), id: z.string() }),
  QuotaFullSchema,
]);
export const RemovePlacementInputSchema = z.object({
  placementId: z.string().min(1),
});
export const RemovePlacementOutputSchema = z.object({ success: z.boolean() });
export const MovePlacementInputSchema = z.object({
  placementId: z.string().min(1),
  toPositionId: z.string().min(1),
  allowOverQuota: z.boolean().default(false),
});
export const MovePlacementOutputSchema = AddPlacementOutputSchema;

// --- import.preview / import.apply (Fase 2D)
const ImportKeySchema = z.string().min(1).max(32);
export const ImportPlanSchema = z.object({
  units: z.array(
    z.object({
      key: ImportKeySchema,
      name: z.string(),
      variants: z.array(z.string()),
    }),
  ),
  positions: z.array(
    z.object({
      key: ImportKeySchema,
      unitKey: ImportKeySchema,
      title: z.string(),
      rank: RankSchema,
      kind: KindSchema,
      variants: z.array(z.string()),
    }),
  ),
  placements: z.array(
    z.object({
      userId: z.string(),
      positionKey: ImportKeySchema,
      order: z.number().int(),
    }),
  ),
  membershipOnly: z.number().int(),
  duplicates: z.number().int(),
});
export const PreviewImportInputSchema = z.object({
  periodId: z.string().min(1),
});
export const PreviewImportOutputSchema = z.object({
  /** Jumlah baris teks lama yang dibaca, per tabel sumber. */
  sources: z.object({
    keanggotaan: z.number().int(),
    kehimpunan: z.number().int(),
  }),
  /** Alasan impor tidak bisa dilakukan sekarang; null bila bisa. */
  blocked: z.enum(['sudah_berisi', 'tidak_ada_data']).nullable(),
  plan: ImportPlanSchema,
  /** Sidik usulan; apply menolak bila data lama berubah sejak pratinjau. */
  fingerprint: z.string(),
});
export const ApplyImportInputSchema = z.object({
  periodId: z.string().min(1),
  fingerprint: z.string().min(1),
  units: z
    .array(
      z.object({
        key: ImportKeySchema,
        name: z.string().max(255),
        mergeInto: ImportKeySchema.optional(),
        skip: z.boolean().optional(),
      }),
    )
    .max(MAX_UNITS),
  positions: z
    .array(
      z.object({
        key: ImportKeySchema,
        title: z.string().max(255),
        rank: RankSchema,
        kind: KindSchema,
        mergeInto: ImportKeySchema.optional(),
        skip: z.boolean().optional(),
      }),
    )
    .max(MAX_POSITIONS),
});
export const ApplyImportOutputSchema = z.object({
  units: z.number().int(),
  positions: z.number().int(),
  placements: z.number().int(),
  skippedPlacements: z.number().int(),
  version: z.number().int(),
});

// --- import.createCurrentPeriod
export const CreateCurrentPeriodInputSchema = z.object({
  lembagaId: z.string().min(1),
});
export const CreateCurrentPeriodOutputSchema = z.object({
  periodId: z.string(),
});
