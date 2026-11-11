import { TRPCError } from '@trpc/server';
import { and, asc, eq, inArray, isNull, max, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { OPERATORS_BY_TYPE } from '~/lib/forms/conditions';
import { oprecScopedProcedure } from '~/server/api/trpc';
import {
  criterion,
  criterionField,
  formField,
  formFieldOption,
  formSection,
  organizationUnit,
  recruitmentDivision,
  recruitmentSectionBinding,
} from '~/server/db/schema';

import { type Tx } from '../form/services';
import { logAction } from './log';
import { recomputeDivisions } from './recompute';
import { type Database, conflict, notFound, pgCode } from './services';

type Q = Tx | Database;

type CriterionKind = 'skor' | 'gugur_otomatis' | 'gugur_manual';
type GateRuleValue = {
  fieldId: string;
  op: string;
  nilai?: unknown;
  nilai2?: unknown;
};

type SlotQuestion = {
  fieldId: string;
  no: number;
  label: string;
  type: string;
  required: boolean;
  optionLabels: string[];
};

type Slot = {
  key: string;
  label: string;
  divisionId: string | null;
  questions: SlotQuestion[];
  byField: Map<string, SlotQuestion>;
};

type SlotSet = {
  slots: Slot[];
  byKey: Map<string, Slot>;
  byLabel: Map<string, Slot>;
};

type ExistingCriterion = {
  id: string;
  name: string;
  kind: CriterionKind;
  gateRule: GateRuleValue | null;
  sortOrder: number;
};

type ParsedImportRow = {
  slotKey: string;
  divisionId: string | null;
  name: string;
  kind: CriterionKind;
  weight: number | null;
  expectation: string | null;
  fieldIds: string[];
  existingId: string | null;
  gateRule: GateRuleValue | null;
};

type ParseResult = {
  rows: ParsedImportRow[];
  problems: { row: number; message: string }[];
  newRows: number;
  updatedRows: number;
  valid: number;
};

const GateRuleSchema = z.object({
  fieldId: z.string().min(1),
  op: z.string().min(1),
  nilai: z.unknown().optional(),
  nilai2: z.unknown().optional(),
});

const CriterionSaveInput = z.object({
  recruitmentId: z.string().min(1),
  criterionId: z.string().min(1).optional(),
  scope: z.string().min(1),
  name: z.string().trim().min(1).max(255),
  kind: z.enum(['skor', 'gugur_otomatis', 'gugur_manual']),
  weight: z.number().int().min(0).max(100).nullable().optional(),
  expectation: z.string().max(2000).nullable().optional(),
  gateRule: GateRuleSchema.nullable().optional(),
  fieldIds: z.array(z.string().min(1)).max(50),
});

const CriterionDeleteInput = z.object({
  recruitmentId: z.string().min(1),
  criterionId: z.string().min(1),
});

const CriteriaReorderInput = z.object({
  recruitmentId: z.string().min(1),
  scope: z.string().min(1),
  criterionIds: z.array(z.string().min(1)),
});

const ImportRowSchema = z.object({
  divisi: z.string(),
  kriteria: z.string(),
  jenis: z.string(),
  bobot: z.union([z.number(), z.string(), z.null()]).optional(),
  ekspektasi: z.string().optional(),
  pertanyaanTerkait: z.string().optional(),
});

const ImportInputSchema = z.object({
  recruitmentId: z.string().min(1),
  rows: z.array(ImportRowSchema).max(500),
});

const OP_WITHOUT_VALUE = new Set([
  'kosong',
  'tidak_kosong',
  'dicentang',
  'tidak_dicentang',
]);

function operatorsFor(type: string): string[] {
  const table = OPERATORS_BY_TYPE as unknown as Record<
    string,
    readonly unknown[]
  >;
  const list = table[type] ?? [];
  return list.flatMap((entry) => {
    if (typeof entry === 'string') return [entry];
    if (entry && typeof entry === 'object') {
      const value = (entry as { value?: unknown }).value;
      if (typeof value === 'string') return [value];
      const op = (entry as { op?: unknown }).op;
      if (typeof op === 'string') return [op];
      const id = (entry as { id?: unknown }).id;
      if (typeof id === 'string') return [id];
    }
    return [];
  });
}

function normalizeKind(value: string): CriterionKind | null {
  const normalized = value.trim().toLowerCase().replace(/_/g, ' ');
  if (normalized === 'skor') return 'skor';
  if (normalized === 'gugur otomatis') return 'gugur_otomatis';
  if (normalized === 'gugur manual') return 'gugur_manual';
  return null;
}

function kindLabel(
  kind: CriterionKind,
): 'Skor' | 'Gugur otomatis' | 'Gugur manual' {
  if (kind === 'skor') return 'Skor';
  if (kind === 'gugur_otomatis') return 'Gugur otomatis';
  return 'Gugur manual';
}

function parseWeight(value: number | string | null | undefined): {
  ok: boolean;
  value: number | null;
} {
  if (value === null || value === undefined || value === '') {
    return { ok: true, value: null };
  }
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return { ok: false, value: null };
  }
  return { ok: true, value: Math.round(n) };
}

async function loadSlotSet(
  db: Q,
  recruitmentId: string,
  formId: string,
): Promise<SlotSet> {
  const [divisions, sections, bindings, fields] = await Promise.all([
    db
      .select({
        id: recruitmentDivision.id,
        label: organizationUnit.name,
      })
      .from(recruitmentDivision)
      .innerJoin(
        organizationUnit,
        eq(organizationUnit.id, recruitmentDivision.unitId),
      )
      .where(eq(recruitmentDivision.recruitmentId, recruitmentId))
      .orderBy(asc(recruitmentDivision.sortOrder), asc(organizationUnit.name)),
    db
      .select({
        id: formSection.id,
        sortOrder: formSection.sortOrder,
      })
      .from(formSection)
      .where(eq(formSection.formId, formId))
      .orderBy(asc(formSection.sortOrder)),
    db
      .select({
        sectionId: recruitmentSectionBinding.formSectionId,
        divisionId: recruitmentSectionBinding.divisionId,
      })
      .from(recruitmentSectionBinding)
      .where(eq(recruitmentSectionBinding.recruitmentId, recruitmentId)),
    db
      .select({
        id: formField.id,
        label: formField.label,
        type: formField.type,
        required: formField.required,
        sortOrder: formField.sortOrder,
        sectionId: formField.sectionId,
      })
      .from(formField)
      .where(and(eq(formField.formId, formId), isNull(formField.archivedAt))),
  ]);

  const answerable = fields.filter(
    (f) => f.type !== 'text_block' && f.type !== 'unit_choice',
  );
  const fieldIds = answerable.map((f) => f.id);
  const optionRows =
    fieldIds.length > 0
      ? await db
          .select({
            id: formFieldOption.id,
            fieldId: formFieldOption.fieldId,
            label: formFieldOption.label,
            sortOrder: formFieldOption.sortOrder,
          })
          .from(formFieldOption)
          .where(inArray(formFieldOption.fieldId, fieldIds))
          .orderBy(asc(formFieldOption.sortOrder))
      : [];
  const optionsByField = new Map<string, { id: string; label: string }[]>();
  for (const option of optionRows) {
    const list = optionsByField.get(option.fieldId) ?? [];
    list.push({ id: option.id, label: option.label });
    optionsByField.set(option.fieldId, list);
  }

  const sectionDivisions = new Map<string, string[]>();
  for (const binding of bindings) {
    const list = sectionDivisions.get(binding.sectionId) ?? [];
    list.push(binding.divisionId);
    sectionDivisions.set(binding.sectionId, list);
  }
  const sectionSort = new Map(sections.map((s) => [s.id, s.sortOrder]));
  answerable.sort((a, b) => {
    const ao =
      a.sectionId === null ? -1 : (sectionSort.get(a.sectionId) ?? 1_000_000);
    const bo =
      b.sectionId === null ? -1 : (sectionSort.get(b.sectionId) ?? 1_000_000);
    if (ao !== bo) return ao - bo;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.label.localeCompare(b.label);
  });

  const umum: Slot = {
    key: 'umum',
    label: 'Umum',
    divisionId: null,
    questions: [],
    byField: new Map(),
  };
  const divisionSlots: Slot[] = divisions.map((d) => ({
    key: d.id,
    label: d.label,
    divisionId: d.id,
    questions: [],
    byField: new Map(),
  }));
  const slots = [umum, ...divisionSlots];
  const slotByKey = new Map(slots.map((s) => [s.key, s]));

  for (const field of answerable) {
    const boundDivisions = field.sectionId
      ? (sectionDivisions.get(field.sectionId) ?? [])
      : [];
    const targetKeys = boundDivisions.length > 0 ? boundDivisions : ['umum'];
    const optionLabels = (optionsByField.get(field.id) ?? []).map(
      (o) => o.label,
    );
    for (const key of targetKeys) {
      const slot = slotByKey.get(key);
      if (!slot) continue;
      const question: SlotQuestion = {
        fieldId: field.id,
        no: slot.questions.length + 1,
        label: field.label,
        type: field.type,
        required: field.required,
        optionLabels,
      };
      slot.questions.push(question);
      slot.byField.set(field.id, question);
    }
  }

  const byLabel = new Map<string, Slot>();
  for (const slot of slots) {
    const key = slot.label.trim().toLowerCase();
    if (!byLabel.has(key)) byLabel.set(key, slot);
  }

  return { slots, byKey: slotByKey, byLabel };
}

async function loadExistingCriteria(
  db: Q,
  recruitmentId: string,
): Promise<Map<string, Map<string, ExistingCriterion>>> {
  const rows = await db
    .select({
      id: criterion.id,
      name: criterion.name,
      kind: criterion.kind,
      gateRule: criterion.gateRule,
      divisionId: criterion.divisionId,
      sortOrder: criterion.sortOrder,
    })
    .from(criterion)
    .where(eq(criterion.recruitmentId, recruitmentId));
  const bySlot = new Map<string, Map<string, ExistingCriterion>>();
  for (const row of rows) {
    const key = row.divisionId ?? 'umum';
    const map = bySlot.get(key) ?? new Map<string, ExistingCriterion>();
    map.set(row.name.trim().toLowerCase(), {
      id: row.id,
      name: row.name,
      kind: row.kind as CriterionKind,
      gateRule: row.gateRule as unknown as GateRuleValue | null,
      sortOrder: row.sortOrder,
    });
    bySlot.set(key, map);
  }
  return bySlot;
}

function parseImportRows(args: {
  rows: z.infer<typeof ImportRowSchema>[];
  slots: SlotSet;
  existingBySlot: Map<string, Map<string, ExistingCriterion>>;
}): ParseResult {
  const problems: { row: number; message: string }[] = [];
  const parsed: ParsedImportRow[] = [];
  let newRows = 0;
  let updatedRows = 0;
  let valid = 0;

  args.rows.forEach((row, index) => {
    const rowNo = index + 1;
    const messages: string[] = [];
    const divisionText = row.divisi.trim();
    const slot = args.slots.byLabel.get(divisionText.toLowerCase());
    if (!slot) {
      messages.push(`Divisi "${divisionText}" tidak dikenal.`);
    }
    const name = row.kriteria.trim();
    if (!name) messages.push('Nama kriteria wajib diisi.');
    const kind = normalizeKind(row.jenis);
    if (!kind) messages.push('Jenis kriteria tidak dikenal.');

    let weight: number | null = null;
    if (kind === 'skor') {
      const parsedWeight = parseWeight(row.bobot);
      if (!parsedWeight.ok) messages.push('Bobot harus angka 0-100.');
      weight = parsedWeight.value;
    }
    const expectationText = row.ekspektasi?.trim() ?? '';
    if (expectationText.length > 2000) {
      messages.push('Ekspektasi maksimal 2000 karakter.');
    }

    const fieldIds: string[] = [];
    if (slot && row.pertanyaanTerkait) {
      const byNo = new Map(slot.questions.map((q) => [q.no, q.fieldId]));
      for (const part of row.pertanyaanTerkait.split(',')) {
        const text = part.trim();
        if (!text) continue;
        const no = Number(text);
        const fieldId = Number.isInteger(no) ? byNo.get(no) : undefined;
        if (fieldId) fieldIds.push(fieldId);
        else
          messages.push(`Pertanyaan nomor ${text} tidak ada di ${slot.label}.`);
      }
    }

    const existing = slot
      ? (args.existingBySlot.get(slot.key)?.get(name.toLowerCase()) ?? null)
      : null;
    let gateRule: GateRuleValue | null = null;
    if (kind === 'gugur_otomatis') {
      if (existing?.kind !== 'gugur_otomatis' || existing.gateRule === null) {
        messages.push(
          'Aturan gugur otomatis diatur di editor, bukan lewat impor',
        );
      } else {
        gateRule = existing.gateRule;
      }
    }

    if (messages.length > 0) {
      for (const message of messages) problems.push({ row: rowNo, message });
      return;
    }
    if (!slot || !kind) return;

    parsed.push({
      slotKey: slot.key,
      divisionId: slot.divisionId,
      name,
      kind,
      weight,
      expectation: expectationText || null,
      fieldIds: [...new Set(fieldIds)],
      existingId: existing?.id ?? null,
      gateRule,
    });
    if (existing) updatedRows++;
    else newRows++;
    valid++;
  });

  return { rows: parsed, problems, newRows, updatedRows, valid };
}

export const criteriaProcedures = {
  criteriaList: oprecScopedProcedure
    .input(z.object({ recruitmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const recruitmentId = input.recruitmentId;
      const formId = ctx.recruitment.formId;
      const [divisions, criteriaRows, links, allFields, sections] =
        await Promise.all([
          ctx.db
            .select({
              id: recruitmentDivision.id,
              label: organizationUnit.name,
            })
            .from(recruitmentDivision)
            .innerJoin(
              organizationUnit,
              eq(organizationUnit.id, recruitmentDivision.unitId),
            )
            .where(eq(recruitmentDivision.recruitmentId, recruitmentId))
            .orderBy(
              asc(recruitmentDivision.sortOrder),
              asc(organizationUnit.name),
            ),
          ctx.db
            .select({
              id: criterion.id,
              name: criterion.name,
              kind: criterion.kind,
              weight: criterion.weight,
              expectation: criterion.expectation,
              gateRule: criterion.gateRule,
              sortOrder: criterion.sortOrder,
              divisionId: criterion.divisionId,
            })
            .from(criterion)
            .where(eq(criterion.recruitmentId, recruitmentId))
            .orderBy(asc(criterion.sortOrder), asc(criterion.name)),
          ctx.db
            .select({
              criterionId: criterionField.criterionId,
              fieldId: criterionField.formFieldId,
            })
            .from(criterionField)
            .innerJoin(criterion, eq(criterion.id, criterionField.criterionId))
            .where(eq(criterion.recruitmentId, recruitmentId)),
          ctx.db
            .select({
              id: formField.id,
              label: formField.label,
              type: formField.type,
              sectionId: formField.sectionId,
              sortOrder: formField.sortOrder,
              archivedAt: formField.archivedAt,
            })
            .from(formField)
            .where(eq(formField.formId, formId)),
          ctx.db
            .select({
              id: formSection.id,
              title: formSection.title,
              sortOrder: formSection.sortOrder,
            })
            .from(formSection)
            .where(eq(formSection.formId, formId))
            .orderBy(asc(formSection.sortOrder)),
        ]);

      const sectionBindings = await ctx.db
        .select({
          sectionId: recruitmentSectionBinding.formSectionId,
          divisionId: recruitmentSectionBinding.divisionId,
        })
        .from(recruitmentSectionBinding)
        .where(eq(recruitmentSectionBinding.recruitmentId, recruitmentId));

      const boundFieldIds = new Set(links.map((l) => l.fieldId));
      const visibleFields = allFields.filter(
        (f) => f.archivedAt === null || boundFieldIds.has(f.id),
      );
      const fieldIds = visibleFields.map((f) => f.id);
      const optionRows =
        fieldIds.length > 0
          ? await ctx.db
              .select({
                id: formFieldOption.id,
                fieldId: formFieldOption.fieldId,
                label: formFieldOption.label,
                sortOrder: formFieldOption.sortOrder,
              })
              .from(formFieldOption)
              .where(inArray(formFieldOption.fieldId, fieldIds))
              .orderBy(asc(formFieldOption.sortOrder))
          : [];
      const optionsByField = new Map<string, { id: string; label: string }[]>();
      for (const option of optionRows) {
        const list = optionsByField.get(option.fieldId) ?? [];
        list.push({ id: option.id, label: option.label });
        optionsByField.set(option.fieldId, list);
      }

      const sectionTitle = new Map(sections.map((s) => [s.id, s.title]));
      const sectionSort = new Map(sections.map((s) => [s.id, s.sortOrder]));
      visibleFields.sort((a, b) => {
        const ao =
          a.sectionId === null
            ? -1
            : (sectionSort.get(a.sectionId) ?? 1_000_000);
        const bo =
          b.sectionId === null
            ? -1
            : (sectionSort.get(b.sectionId) ?? 1_000_000);
        if (ao !== bo) return ao - bo;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.label.localeCompare(b.label);
      });

      const fields = visibleFields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        sectionId: f.sectionId,
        sectionTitle:
          f.sectionId === null ? null : (sectionTitle.get(f.sectionId) ?? null),
        archived: f.archivedAt !== null,
        options: optionsByField.get(f.id) ?? [],
      }));

      const fieldsByCriterion = new Map<string, string[]>();
      for (const link of links) {
        const list = fieldsByCriterion.get(link.criterionId) ?? [];
        list.push(link.fieldId);
        fieldsByCriterion.set(link.criterionId, list);
      }
      const criteriaBySlot = new Map<string, typeof criteriaRows>();
      for (const row of criteriaRows) {
        const key = row.divisionId ?? 'umum';
        const list = criteriaBySlot.get(key) ?? [];
        list.push(row);
        criteriaBySlot.set(key, list);
      }

      const slotDefs = [
        { scope: 'umum' as const, label: 'Umum', key: 'umum' },
        ...divisions.map((d) => ({
          scope: d.id,
          label: d.label,
          key: d.id,
        })),
      ];
      const slots = slotDefs.map((def) => {
        const list = criteriaBySlot.get(def.key) ?? [];
        const weightSum = list
          .filter((c) => c.kind === 'skor')
          .reduce((n, c) => n + (c.weight ?? 0), 0);
        return {
          scope: def.scope,
          label: def.label,
          criteria: list.map((c) => ({
            id: c.id,
            name: c.name,
            kind: c.kind,
            weight: c.weight,
            expectation: c.expectation,
            gateRule: c.gateRule,
            sortOrder: c.sortOrder,
            fieldIds: fieldsByCriterion.get(c.id) ?? [],
          })),
          weightSum,
        };
      });

      return {
        slots,
        fields,
        sections: sections.map((section) => ({
          id: section.id,
          title: section.title,
          divisionIds: sectionBindings
            .filter((binding) => binding.sectionId === section.id)
            .map((binding) => binding.divisionId),
        })),
      };
    }),

  criterionSave: oprecScopedProcedure
    .input(CriterionSaveInput)
    .mutation(async ({ ctx, input }) => {
      const recruitmentId = input.recruitmentId;
      const formId = ctx.recruitment.formId;
      const name = input.name.trim();
      const divisionId = input.scope === 'umum' ? null : input.scope;
      try {
        return await ctx.db.transaction(async (tx) => {
          if (divisionId !== null) {
            const [division] = await tx
              .select({ id: recruitmentDivision.id })
              .from(recruitmentDivision)
              .where(
                and(
                  eq(recruitmentDivision.id, divisionId),
                  eq(recruitmentDivision.recruitmentId, recruitmentId),
                ),
              )
              .for('update');
            if (!division) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Divisi itu bukan milik oprec ini.',
              });
            }
          }

          const uniqueFieldIds = [...new Set(input.fieldIds)];
          const formFields = await tx
            .select({ id: formField.id, type: formField.type })
            .from(formField)
            .where(eq(formField.formId, formId));
          const fieldById = new Map(formFields.map((f) => [f.id, f]));
          for (const fieldId of uniqueFieldIds) {
            if (!fieldById.has(fieldId)) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Ada pertanyaan yang bukan milik form oprec ini.',
              });
            }
          }

          let gateRule: GateRuleValue | null = input.gateRule ?? null;
          if (input.kind === 'gugur_otomatis') {
            if (!gateRule) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Aturan gugur otomatis wajib diisi.',
              });
            }
            const field = fieldById.get(gateRule.fieldId);
            if (!field) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Pertanyaan aturan gugur bukan milik form oprec ini.',
              });
            }
            if (!operatorsFor(field.type).includes(gateRule.op)) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Operator aturan tidak cocok dengan tipe pertanyaan.',
              });
            }
            if (
              !OP_WITHOUT_VALUE.has(gateRule.op) &&
              (gateRule.nilai === undefined || gateRule.nilai === null)
            ) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Nilai aturan wajib diisi untuk operator itu.',
              });
            }
          } else {
            if (input.gateRule !== undefined && input.gateRule !== null) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Aturan gugur hanya untuk jenis gugur otomatis.',
              });
            }
            gateRule = null;
          }

          const weight = input.kind === 'skor' ? (input.weight ?? null) : null;
          const expectationText = input.expectation?.trim() ?? '';
          const expectation = expectationText || null;

          const [duplicate] = await tx
            .select({ id: criterion.id })
            .from(criterion)
            .where(
              and(
                eq(criterion.recruitmentId, recruitmentId),
                divisionId === null
                  ? isNull(criterion.divisionId)
                  : eq(criterion.divisionId, divisionId),
                sql`lower(${criterion.name}) = ${name.toLowerCase()}`,
                input.criterionId
                  ? ne(criterion.id, input.criterionId)
                  : undefined,
              ),
            );
          if (duplicate) {
            conflict('Nama kriteria sudah dipakai di slot ini.');
          }

          let criterionId = input.criterionId ?? null;
          if (criterionId) {
            const [existing] = await tx
              .select({ id: criterion.id })
              .from(criterion)
              .where(
                and(
                  eq(criterion.id, criterionId),
                  eq(criterion.recruitmentId, recruitmentId),
                ),
              )
              .for('update');
            if (!existing) notFound('Kriteria tidak ditemukan.');
            await tx
              .update(criterion)
              .set({
                divisionId,
                name,
                kind: input.kind,
                weight,
                expectation,
                gateRule,
              })
              .where(eq(criterion.id, criterionId));
          } else {
            const [maxRow] = await tx
              .select({ n: max(criterion.sortOrder) })
              .from(criterion)
              .where(
                and(
                  eq(criterion.recruitmentId, recruitmentId),
                  divisionId === null
                    ? isNull(criterion.divisionId)
                    : eq(criterion.divisionId, divisionId),
                ),
              );
            const sortOrder = (maxRow?.n ?? -1) + 1;
            const [row] = await tx
              .insert(criterion)
              .values({
                recruitmentId,
                divisionId,
                name,
                kind: input.kind,
                weight,
                expectation,
                gateRule,
                sortOrder,
              })
              .returning({ id: criterion.id });
            criterionId = row!.id;
          }

          const savedId = criterionId;
          await tx
            .delete(criterionField)
            .where(eq(criterionField.criterionId, savedId));
          if (uniqueFieldIds.length > 0) {
            await tx.insert(criterionField).values(
              uniqueFieldIds.map((fieldId) => ({
                criterionId: savedId,
                formFieldId: fieldId,
              })),
            );
          }

          await recomputeDivisions(tx, recruitmentId, 'all');
          await logAction(tx, {
            recruitmentId,
            actorId: ctx.session.user.id,
            action: 'kriteria_disimpan',
            entityType: 'criterion',
            entityId: savedId,
            detail: { kind: input.kind, scope: input.scope },
          });
          return { id: savedId };
        });
      } catch (error) {
        if (pgCode(error) === '23505') {
          conflict('Nama kriteria sudah dipakai di slot ini.');
        }
        throw error;
      }
    }),

  criterionDelete: oprecScopedProcedure
    .input(CriterionDeleteInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .select({ id: criterion.id })
          .from(criterion)
          .where(
            and(
              eq(criterion.id, input.criterionId),
              eq(criterion.recruitmentId, input.recruitmentId),
            ),
          )
          .for('update');
        if (!row) notFound('Kriteria tidak ditemukan.');
        await tx.delete(criterion).where(eq(criterion.id, input.criterionId));
        await recomputeDivisions(tx, input.recruitmentId, 'all');
        await logAction(tx, {
          recruitmentId: input.recruitmentId,
          actorId: ctx.session.user.id,
          action: 'kriteria_dihapus',
          entityType: 'criterion',
          entityId: input.criterionId,
        });
        return { success: true };
      });
    }),

  criteriaReorder: oprecScopedProcedure
    .input(CriteriaReorderInput)
    .mutation(async ({ ctx, input }) => {
      const divisionId = input.scope === 'umum' ? null : input.scope;
      if (new Set(input.criterionIds).size !== input.criterionIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Daftar kriteria memuat id ganda.',
        });
      }
      return ctx.db.transaction(async (tx) => {
        const rows = await tx
          .select({ id: criterion.id })
          .from(criterion)
          .where(
            and(
              eq(criterion.recruitmentId, input.recruitmentId),
              divisionId === null
                ? isNull(criterion.divisionId)
                : eq(criterion.divisionId, divisionId),
            ),
          );
        const existing = new Set(rows.map((r) => r.id));
        if (
          existing.size !== input.criterionIds.length ||
          input.criterionIds.some((id) => !existing.has(id))
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Daftar kriteria tidak cocok dengan slot ini.',
          });
        }
        for (const [index, id] of input.criterionIds.entries()) {
          await tx
            .update(criterion)
            .set({ sortOrder: index })
            .where(eq(criterion.id, id));
        }
        await logAction(tx, {
          recruitmentId: input.recruitmentId,
          actorId: ctx.session.user.id,
          action: 'kriteria_diurutkan',
          entityType: 'criterion',
          detail: { scope: input.scope, order: input.criterionIds },
        });
        return { success: true };
      });
    }),

  criteriaExport: oprecScopedProcedure
    .input(z.object({ recruitmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const slots = await loadSlotSet(
        ctx.db,
        input.recruitmentId,
        ctx.recruitment.formId,
      );
      const [criteriaRows, links] = await Promise.all([
        ctx.db
          .select({
            id: criterion.id,
            name: criterion.name,
            kind: criterion.kind,
            weight: criterion.weight,
            expectation: criterion.expectation,
            divisionId: criterion.divisionId,
            sortOrder: criterion.sortOrder,
          })
          .from(criterion)
          .where(eq(criterion.recruitmentId, input.recruitmentId))
          .orderBy(asc(criterion.sortOrder), asc(criterion.name)),
        ctx.db
          .select({
            criterionId: criterionField.criterionId,
            fieldId: criterionField.formFieldId,
          })
          .from(criterionField)
          .innerJoin(criterion, eq(criterion.id, criterionField.criterionId))
          .where(eq(criterion.recruitmentId, input.recruitmentId)),
      ]);
      const fieldIdsByCriterion = new Map<string, string[]>();
      for (const link of links) {
        const list = fieldIdsByCriterion.get(link.criterionId) ?? [];
        list.push(link.fieldId);
        fieldIdsByCriterion.set(link.criterionId, list);
      }

      const kriteria = criteriaRows.map((c) => {
        const slot = slots.byKey.get(c.divisionId ?? 'umum');
        const numbers = (fieldIdsByCriterion.get(c.id) ?? [])
          .map((fieldId) => slot?.byField.get(fieldId)?.no)
          .filter((n): n is number => n !== undefined)
          .sort((a, b) => a - b);
        return {
          divisi: slot?.label ?? 'Umum',
          kriteria: c.name,
          jenis: kindLabel(c.kind),
          bobot: c.kind === 'skor' ? c.weight : null,
          ekspektasi: c.expectation ?? '',
          pertanyaanTerkait: numbers.join(', '),
        };
      });

      const pertanyaan = slots.slots.flatMap((slot) =>
        slot.questions.map((q) => ({
          divisi: slot.label,
          no: q.no,
          pertanyaan: q.label,
          tipe: q.type,
          wajib: q.required ? 'Ya' : 'Tidak',
          opsi: q.optionLabels.join('; '),
        })),
      );

      return { kriteria, pertanyaan };
    }),

  criteriaImportPreview: oprecScopedProcedure
    .input(ImportInputSchema)
    .mutation(async ({ ctx, input }) => {
      const slots = await loadSlotSet(
        ctx.db,
        input.recruitmentId,
        ctx.recruitment.formId,
      );
      const existingBySlot = await loadExistingCriteria(
        ctx.db,
        input.recruitmentId,
      );
      const parsed = parseImportRows({
        rows: input.rows,
        slots,
        existingBySlot,
      });
      return {
        newRows: parsed.newRows,
        updatedRows: parsed.updatedRows,
        problems: parsed.problems,
        valid: parsed.valid,
      };
    }),

  criteriaImportApply: oprecScopedProcedure
    .input(ImportInputSchema)
    .mutation(async ({ ctx, input }) => {
      const recruitmentId = input.recruitmentId;
      return ctx.db.transaction(async (tx) => {
        const slots = await loadSlotSet(
          tx,
          recruitmentId,
          ctx.recruitment.formId,
        );
        const existingBySlot = await loadExistingCriteria(tx, recruitmentId);
        const parsed = parseImportRows({
          rows: input.rows,
          slots,
          existingBySlot,
        });
        if (parsed.rows.length === 0) {
          return { applied: 0, problems: parsed.problems };
        }

        const maxRows = await tx
          .select({
            divisionId: criterion.divisionId,
            n: max(criterion.sortOrder),
          })
          .from(criterion)
          .where(eq(criterion.recruitmentId, recruitmentId))
          .groupBy(criterion.divisionId);
        const nextSort = new Map<string, number>();
        for (const row of maxRows) {
          nextSort.set(row.divisionId ?? 'umum', row.n ?? -1);
        }

        const written = new Map<string, string>();
        for (const row of parsed.rows) {
          const key = `${row.slotKey}:${row.name.toLowerCase()}`;
          let id = row.existingId ?? written.get(key) ?? null;
          if (id) {
            await tx
              .update(criterion)
              .set({
                divisionId: row.divisionId,
                name: row.name,
                kind: row.kind,
                weight: row.weight,
                expectation: row.expectation,
                gateRule: row.gateRule,
              })
              .where(eq(criterion.id, id));
          } else {
            const sortOrder = (nextSort.get(row.slotKey) ?? -1) + 1;
            nextSort.set(row.slotKey, sortOrder);
            const [inserted] = await tx
              .insert(criterion)
              .values({
                recruitmentId,
                divisionId: row.divisionId,
                name: row.name,
                kind: row.kind,
                weight: row.weight,
                expectation: row.expectation,
                gateRule: row.gateRule,
                sortOrder,
              })
              .returning({ id: criterion.id });
            id = inserted!.id;
            written.set(key, id);
          }

          const criterionId = id;
          if (!criterionId) continue;
          await tx
            .delete(criterionField)
            .where(eq(criterionField.criterionId, criterionId));
          if (row.fieldIds.length > 0) {
            await tx.insert(criterionField).values(
              row.fieldIds.map((fieldId) => ({
                criterionId,
                formFieldId: fieldId,
              })),
            );
          }
        }

        await recomputeDivisions(tx, recruitmentId, 'all');
        await logAction(tx, {
          recruitmentId,
          actorId: ctx.session.user.id,
          action: 'kriteria_diimpor',
          entityType: 'criterion',
          detail: {
            applied: parsed.rows.length,
            newRows: parsed.newRows,
            updatedRows: parsed.updatedRows,
          },
        });
        return { applied: parsed.rows.length, problems: parsed.problems };
      });
    }),
};
