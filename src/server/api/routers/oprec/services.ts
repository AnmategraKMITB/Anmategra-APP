import { TRPCError } from '@trpc/server';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { type db as Db } from '~/server/db';
import {
  application,
  events,
  formSection,
  organizationPosition,
  organizationStructure,
  organizationUnit,
  recruitment,
  recruitmentDivision,
  recruitmentEligibilityRule,
  recruitmentSectionBinding,
  recruitmentWave,
} from '~/server/db/schema';

export type Database = typeof Db;
export type Queryable = Pick<Database, 'select' | 'query'>;

/** Batas penelusuran pohon lembaga; juga pengaman terhadap siklus. */
const MAX_LEMBAGA_TREE_DEPTH = 16;

export function notFound(message: string): never {
  throw new TRPCError({ code: 'NOT_FOUND', message });
}

export function conflict(message: string): never {
  throw new TRPCError({ code: 'CONFLICT', message });
}

/** Kode Postgres untuk pelanggaran unik / kunci asing. */
export function pgCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let i = 0; i < 4 && typeof current === 'object' && current; i++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export async function countApplications(
  db: Queryable,
  recruitmentId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(application)
    .where(eq(application.recruitmentId, recruitmentId));
  return row?.n ?? 0;
}

/**
 * Apakah lembaga `descendantId` berada di bawah (atau sama dengan) `ancestorId`
 * pada pohon `lembaga.parent_id`.
 */
async function isLembagaWithin(
  db: Queryable,
  descendantId: string,
  ancestorId: string,
): Promise<boolean> {
  const visited = new Set<string>();
  let current: string | null = descendantId;
  for (let depth = 0; current && depth < MAX_LEMBAGA_TREE_DEPTH; depth++) {
    if (current === ancestorId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    const row: { parentId: string | null } | undefined =
      await db.query.lembaga.findFirst({
        where: (l, { eq: e }) => e(l.id, current!),
        columns: { parentId: true },
      });
    current = row?.parentId ?? null;
  }
  return false;
}

/**
 * Bagian dan posisi yang dibuka harus ada di organogram periode oprec ini,
 * atau di organogram periode milik lembaga di bawahnya (oprec beberapa badan).
 */
export async function assertDivisionTarget(
  db: Queryable,
  rec: { id: string; periodId: string },
  unitId: string,
  positionId: string,
) {
  const [row] = await db
    .select({
      positionUnitId: organizationPosition.unitId,
      structurePeriodId: organizationStructure.eventId,
      structureActive: organizationStructure.is_active,
    })
    .from(organizationPosition)
    .innerJoin(
      organizationUnit,
      eq(organizationUnit.id, organizationPosition.unitId),
    )
    .innerJoin(
      organizationStructure,
      eq(organizationStructure.id, organizationUnit.structure_id),
    )
    .where(
      and(
        eq(organizationPosition.id, positionId),
        eq(organizationUnit.id, unitId),
      ),
    );
  if (row?.positionUnitId !== unitId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Posisi tersebut bukan bagian dari tujuan yang dipilih.',
    });
  }
  if (!row.structurePeriodId || !row.structureActive) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Organogram tujuan tidak aktif atau bukan milik sebuah periode.',
    });
  }
  if (row.structurePeriodId === rec.periodId) return;

  const [own, target] = await Promise.all([
    db.query.events.findFirst({
      where: eq(events.id, rec.periodId),
      columns: { org_id: true },
    }),
    db.query.events.findFirst({
      where: eq(events.id, row.structurePeriodId),
      columns: { org_id: true },
    }),
  ]);
  const ownLembaga = own?.org_id;
  const targetLembaga = target?.org_id;
  const ok =
    ownLembaga != null &&
    targetLembaga != null &&
    (await isLembagaWithin(db, targetLembaga, ownLembaga));
  if (!ok) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'Tujuan harus berada di organogram periode ini atau lembaga di bawahnya.',
    });
  }
}

/** Seluruh isi oprec yang dibutuhkan layar pengaturan. */
export async function loadRecruitmentDetail(
  db: Queryable,
  recruitmentId: string,
) {
  const rec = await db.query.recruitment.findFirst({
    where: eq(recruitment.id, recruitmentId),
  });
  if (!rec) notFound('Oprec tidak ditemukan.');

  const [waves, rules, divisionRows, bindings, applicationCount] =
    await Promise.all([
      db
        .select()
        .from(recruitmentWave)
        .where(eq(recruitmentWave.recruitmentId, recruitmentId))
        .orderBy(asc(recruitmentWave.sortOrder), asc(recruitmentWave.startsAt)),
      db
        .select()
        .from(recruitmentEligibilityRule)
        .where(eq(recruitmentEligibilityRule.recruitmentId, recruitmentId)),
      db
        .select({
          id: recruitmentDivision.id,
          unitId: recruitmentDivision.unitId,
          unitName: organizationUnit.name,
          parentUnitId: organizationUnit.parent_id,
          positionId: recruitmentDivision.positionId,
          positionTitle: organizationPosition.title,
          quota: organizationPosition.quota,
          code: recruitmentDivision.code,
          sortOrder: recruitmentDivision.sortOrder,
        })
        .from(recruitmentDivision)
        .innerJoin(
          organizationUnit,
          eq(organizationUnit.id, recruitmentDivision.unitId),
        )
        .innerJoin(
          organizationPosition,
          eq(organizationPosition.id, recruitmentDivision.positionId),
        )
        .where(eq(recruitmentDivision.recruitmentId, recruitmentId))
        .orderBy(asc(recruitmentDivision.sortOrder)),
      db
        .select({
          formSectionId: recruitmentSectionBinding.formSectionId,
          divisionId: recruitmentSectionBinding.divisionId,
        })
        .from(recruitmentSectionBinding)
        .where(eq(recruitmentSectionBinding.recruitmentId, recruitmentId)),
      countApplications(db, recruitmentId),
    ]);

  return {
    ...rec,
    waves,
    eligibilityRules: rules,
    divisions: divisionRows,
    sectionBindings: bindings,
    applicationCount,
    /** Pilihan dan daftar divisi dikunci begitu ada pendaftar. */
    structureLocked: applicationCount > 0,
  };
}

/** Pastikan semua `sectionIds` milik form oprec ini. */
export async function assertSectionsOfForm(
  db: Queryable,
  formId: string,
  sectionIds: string[],
) {
  if (sectionIds.length === 0) return;
  const rows = await db
    .select({ id: formSection.id })
    .from(formSection)
    .where(
      and(eq(formSection.formId, formId), inArray(formSection.id, sectionIds)),
    );
  if (rows.length !== new Set(sectionIds).size) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Ada bagian formulir yang bukan milik form oprec ini.',
    });
  }
}
