import { TRPCError } from '@trpc/server';
import { and, asc, count, eq, inArray, isNull, notInArray } from 'drizzle-orm';
import { type db as Db } from '~/server/db';
import {
  application,
  events,
  form,
  formField,
  formSection,
  organizationPosition,
  organizationStructure,
  organizationUnit,
  placement,
  recruitment,
  recruitmentDivision,
  recruitmentEligibilityRule,
  recruitmentSectionBinding,
  recruitmentWave,
} from '~/server/db/schema';

import {
  type Tx,
  assertPublishable,
  countSubmissions,
  enforceConditions,
  loadActiveFields,
  lockForm,
} from '../form/services';

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
export async function isLembagaWithin(
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
  await assertPeriodInScope(db, rec.periodId, row.structurePeriodId);
}

/**
 * Organogram sumber harus milik periode oprec ini atau periode lembaga di
 * bawahnya.
 */
export async function assertPeriodInScope(
  db: Queryable,
  ownPeriodId: string,
  structurePeriodId: string,
) {
  if (structurePeriodId === ownPeriodId) return;

  const [own, target] = await Promise.all([
    db.query.events.findFirst({
      where: eq(events.id, ownPeriodId),
      columns: { org_id: true },
    }),
    db.query.events.findFirst({
      where: eq(events.id, structurePeriodId),
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

/** Bagian penilai umum harus ada di organogram aktif dalam lingkup periode ini. */
export async function assertSourceUnit(
  db: Queryable,
  periodId: string,
  unitId: string,
) {
  const [row] = await db
    .select({
      structurePeriodId: organizationStructure.eventId,
      structureActive: organizationStructure.is_active,
    })
    .from(organizationUnit)
    .innerJoin(
      organizationStructure,
      eq(organizationStructure.id, organizationUnit.structure_id),
    )
    .where(eq(organizationUnit.id, unitId));
  if (!row?.structurePeriodId || !row.structureActive) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Bagian penilai umum tidak ada di organogram yang aktif.',
    });
  }
  await assertPeriodInScope(db, periodId, row.structurePeriodId);
}

/** Bagian penilai umum harus punya orang; bila kosong, tidak ada yang bisa menilai. */
export async function assertUnitHasPeople(db: Queryable, unitId: string) {
  const [row] = await db
    .select({ name: organizationUnit.name, n: count(placement.id) })
    .from(organizationUnit)
    .leftJoin(
      organizationPosition,
      eq(organizationPosition.unitId, organizationUnit.id),
    )
    .leftJoin(placement, eq(placement.positionId, organizationPosition.id))
    .where(eq(organizationUnit.id, unitId))
    .groupBy(organizationUnit.id);
  if (row?.n === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Bagian "${row.name}" belum punya anggota, jadi tidak bisa menjadi penilai umum. Isi bagian itu di organogram atau pilih bagian lain.`,
    });
  }
}

/** Tiap divisi yang dibuka harus punya pemegang posisi ketua (rank `head`). */
export async function assertDivisionsHaveHead(
  db: Queryable,
  unitIds: string[],
) {
  if (unitIds.length === 0) return;
  const rows = await db
    .select({ id: organizationUnit.id, name: organizationUnit.name })
    .from(organizationUnit)
    .where(inArray(organizationUnit.id, unitIds));
  const withHead = await db
    .select({ unitId: organizationPosition.unitId })
    .from(organizationPosition)
    .innerJoin(placement, eq(placement.positionId, organizationPosition.id))
    .where(
      and(
        inArray(organizationPosition.unitId, unitIds),
        eq(organizationPosition.rank, 'head'),
      ),
    )
    .groupBy(organizationPosition.unitId);
  const ok = new Set(withHead.map((r) => r.unitId));
  const missing = rows.filter((r) => !ok.has(r.id)).map((r) => `"${r.name}"`);
  if (missing.length > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Divisi ${missing.join(', ')} belum punya ketua. Isi ketua di organogram, atau pilih penilai umum dan matikan veto ketua.`,
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

/**
 * Menetapkan divisi mana yang menampilkan sebuah bagian formulir. Ikatan
 * sekaligus menjadi kondisi tampil bagian itu (muncul bila salah satu tujuan
 * terikat dipilih di pilihan mana pun). Dipanggil di dalam transaksi yang
 * memegang `lockForm`.
 */
export async function applySectionBinding(
  tx: Tx,
  args: {
    recruitmentId: string;
    formId: string;
    formSectionId: string;
    divisionIds: string[];
  },
) {
  const divisionIds = args.divisionIds;
  if (divisionIds.length > 0) {
    const rows = await tx
      .select({ id: recruitmentDivision.id })
      .from(recruitmentDivision)
      .where(
        and(
          eq(recruitmentDivision.recruitmentId, args.recruitmentId),
          inArray(recruitmentDivision.id, divisionIds),
        ),
      );
    if (rows.length !== divisionIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Ada tujuan yang bukan milik oprec ini.',
      });
    }
  }
  const sameSection = and(
    eq(recruitmentSectionBinding.recruitmentId, args.recruitmentId),
    eq(recruitmentSectionBinding.formSectionId, args.formSectionId),
  );
  await tx
    .delete(recruitmentSectionBinding)
    .where(
      divisionIds.length > 0
        ? and(
            sameSection,
            notInArray(recruitmentSectionBinding.divisionId, divisionIds),
          )
        : sameSection,
    );
  if (divisionIds.length > 0) {
    await tx
      .insert(recruitmentSectionBinding)
      .values(
        divisionIds.map((divisionId) => ({
          recruitmentId: args.recruitmentId,
          formSectionId: args.formSectionId,
          divisionId,
        })),
      )
      .onConflictDoNothing();
  }

  // Ikatan sekaligus menjadi kondisi tampil bagian itu: muncul bila salah
  // satu tujuan terikat dipilih di pilihan mana pun.
  const [choice] = await tx
    .select({ id: formField.id })
    .from(formField)
    .where(
      and(
        eq(formField.formId, args.formId),
        eq(formField.type, 'unit_choice'),
        isNull(formField.archivedAt),
      ),
    );
  if (divisionIds.length > 0 && !choice) {
    conflict('Tambahkan blok Pilihan tujuan ke formulir terlebih dahulu.');
  }
  await tx
    .update(formSection)
    .set({
      condition:
        divisionIds.length === 0 || !choice
          ? null
          : {
              cocok: 'salah-satu',
              aturan: divisionIds.map((divisionId) => ({
                jenis: 'jawaban',
                fieldId: choice.id,
                op: 'memilih',
                nilai: divisionId,
              })),
            },
    })
    .where(eq(formSection.id, args.formSectionId));
  await enforceConditions(tx, args.formId, {
    edited: [args.formSectionId],
  });
}


type RecruitmentRow = typeof recruitment.$inferSelect;

/**
 * Syarat yang masih kurang agar oprec boleh dibuka. Kosong = siap. Dipakai
 * `oprec.setStatus` dan `form.setStatus` supaya keduanya menolak hal yang sama.
 */
export async function oprecOpenProblems(
  tx: Tx,
  rec: Pick<RecruitmentRow, 'id' | 'formId' | 'setupCompletedAt'>,
): Promise<string[]> {
  const problems: string[] = [];
  if (!rec.setupCompletedAt) {
    problems.push('Selesaikan pengaturan oprec sebelum membukanya.');
  }
  const [choice] = await tx
    .select({ n: count() })
    .from(formField)
    .where(
      and(
        eq(formField.formId, rec.formId),
        eq(formField.type, 'unit_choice'),
        isNull(formField.archivedAt),
      ),
    );
  if ((choice?.n ?? 0) === 0) {
    problems.push(
      'Tambahkan blok Pilihan tujuan ke formulir sebelum membuka oprec.',
    );
  }
  const [divs] = await tx
    .select({ n: count() })
    .from(recruitmentDivision)
    .where(eq(recruitmentDivision.recruitmentId, rec.id));
  if ((divs?.n ?? 0) === 0) {
    problems.push('Pilih minimal satu tujuan penempatan sebelum membuka oprec.');
  }
  return problems;
}

/**
 * Samakan status form terikat dengan status oprec (oprec = sumber kebenaran).
 * Memanggil `lockForm`, jadi pemanggil harus sudah mengunci baris oprec lebih
 * dulu; urutan kunci yang sama dipakai `form.setStatus`.
 */
export async function syncFormToOprec(
  tx: Tx,
  formId: string,
  status: 'draft' | 'open' | 'closed',
) {
  const current = await lockForm(tx, formId);
  if (status === 'open' && current.status !== 'Published') {
    assertPublishable(current, await loadActiveFields(tx, formId));
    await tx
      .update(form)
      .set({
        status: 'Published',
        ...(current.publishedAt === null && { publishedAt: new Date() }),
      })
      .where(eq(form.id, formId));
  } else if (status === 'closed' && current.status === 'Published') {
    await tx.update(form).set({ status: 'Closed' }).where(eq(form.id, formId));
  } else if (status === 'draft' && current.status !== 'Draft') {
    if (((await countSubmissions(tx, [formId])).get(formId) ?? 0) > 0) {
      conflict('Formulir sudah punya jawaban, tidak bisa kembali ke draf.');
    }
    await tx.update(form).set({ status: 'Draft' }).where(eq(form.id, formId));
  }
}
