import { z } from 'zod';
import {
  ORGANIZATION_POSITION_KINDS,
  ORGANIZATION_POSITION_RANKS,
  placementSourceEnum,
} from '~/server/db/schema';

import {
  MAX_POSITIONS,
  MAX_TREE_DEPTH,
  MAX_UNITS,
} from '../routers/organization/tree';

const RankSchema = z.enum(ORGANIZATION_POSITION_RANKS);
const KindSchema = z.enum(ORGANIZATION_POSITION_KINDS);
const SourceSchema = z.enum(placementSourceEnum.enumValues);

/** Id dibuat klien (crypto.randomUUID) untuk entitas baru; server menolak id yang sudah dipakai struktur lain. */
const IdSchema = z.uuid();

export const OrganogramUnitSchema = z.object({
  id: IdSchema,
  parentId: IdSchema.nullable(),
  name: z.string().trim().min(1).max(255),
  typeLabel: z.string().max(255).nullable(),
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
const RankLabelsSchema = z.partialRecord(RankSchema, z.string().trim().min(1).max(255));

export const OrganogramAccessSchema = z.object({
  /** Owner/admin lembaga atau admin periode: boleh semuanya, tidak terpengaruh kunci. */
  canManage: z.boolean(),
  canEdit: z.boolean(),
  canLock: z.boolean(),
  /** null = semua unit (pengelola); selain itu hanya unit tempat ia ditempatkan beserta turunannya. */
  editableUnitIds: z.array(z.string()).nullable(),
});

// --- structure.get
export const GetOrganogramInputSchema = z.object({ periodId: z.string().min(1) });
export const GetOrganogramOutputSchema = z
  .object({
    id: z.string(),
    periodId: z.string(),
    name: z.string(),
    levelLabels: LevelLabelsSchema.nullable(),
    rankLabels: RankLabelsSchema.nullable(),
    editLocked: z.boolean(),
    lockedBy: z.string().nullable(),
    lockedAt: z.date().nullable(),
    /** Dikirim kembali saat menyimpan; naik setiap penyimpanan pohon. */
    version: z.number().int(),
    units: z.array(OrganogramUnitSchema.extend({ id: z.string(), parentId: z.string().nullable() })),
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
export const CreateOrganogramOutputSchema = z.object({ id: z.string(), version: z.number().int() });

// --- structure.save
export const SaveOrganogramInputSchema = z.object({
  periodId: z.string().min(1),
  expectedVersion: z.number().int().min(0),
  /** Hanya pengelola yang boleh mengubah nama dan label. undefined = tidak diubah. */
  name: z.string().trim().min(1).max(255).optional(),
  levelLabels: LevelLabelsSchema.nullable().optional(),
  rankLabels: RankLabelsSchema.nullable().optional(),
  units: z.array(OrganogramUnitSchema).max(MAX_UNITS),
  positions: z.array(OrganogramPositionSchema).max(MAX_POSITIONS),
});
export const SaveOrganogramOutputSchema = z.object({ version: z.number().int(), changed: z.boolean() });

// --- structure.setLock
export const SetOrganogramLockInputSchema = z.object({ periodId: z.string().min(1), locked: z.boolean() });
export const SetOrganogramLockOutputSchema = z.object({ editLocked: z.boolean() });

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
export const RemovePlacementInputSchema = z.object({ placementId: z.string().min(1) });
export const RemovePlacementOutputSchema = z.object({ success: z.boolean() });
export const MovePlacementInputSchema = z.object({
  placementId: z.string().min(1),
  toPositionId: z.string().min(1),
  allowOverQuota: z.boolean().default(false),
});
export const MovePlacementOutputSchema = AddPlacementOutputSchema;
