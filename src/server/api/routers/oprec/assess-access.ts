import { and, eq } from 'drizzle-orm';
import { canManageEvent } from '~/server/api/access';
import { type db as Db } from '~/server/db';
import {
  organizationPosition,
  placement,
  recruitmentAssessor,
  recruitmentDivision,
} from '~/server/db/schema';

type Database = typeof Db;

export type AssessAccess = {
  /** Pengelola oprec (owner/admin, atau hibah fitur oprec): bisa semuanya. */
  isAdmin: boolean;
  /** Boleh menilai kriteria umum. */
  generalAssessor: boolean;
  /** Divisi yang boleh dinilai: Kadiv (turunan organogram) dan penilai tambahan divisi. */
  divisionIds: Set<string>;
  /** Divisi yang keputusannya dipegang: hanya Kadiv. */
  deciderDivisionIds: Set<string>;
};

export type AssessActor = {
  id: string;
  role: string;
  lembagaId: string | null | undefined;
};

/**
 * Peran seseorang atas satu oprec, atau `null` bila tidak punya peran apa pun.
 *
 * - Admin: `canManageEvent` dengan fitur `oprec`; mengabaikan batas divisi.
 * - Kadiv: pemegang posisi `head` pada bagian tujuan sebuah divisi oprec; menilai
 *   dan memutuskan divisi itu. Diturunkan dari organogram, tanpa baris tabel.
 * - Penilai tambahan (`recruitment_assessor`): umum bila `division_id` kosong,
 *   atau penilai divisi tertentu (tanpa hak memutuskan).
 */
export async function resolveAssessAccess(
  db: Database,
  actor: AssessActor,
  recruitment: { id: string; periodId: string },
): Promise<AssessAccess | null> {
  const isAdmin =
    (await canManageEvent(
      db,
      actor.id,
      actor.role,
      actor.lembagaId,
      recruitment.periodId,
      'oprec',
    )) !== null;

  const kadiv = await db
    .select({ divisionId: recruitmentDivision.id })
    .from(recruitmentDivision)
    .innerJoin(
      organizationPosition,
      eq(organizationPosition.unitId, recruitmentDivision.unitId),
    )
    .innerJoin(placement, eq(placement.positionId, organizationPosition.id))
    .where(
      and(
        eq(recruitmentDivision.recruitmentId, recruitment.id),
        eq(organizationPosition.rank, 'head'),
        eq(placement.userId, actor.id),
      ),
    );
  const extras = await db
    .select({ divisionId: recruitmentAssessor.divisionId })
    .from(recruitmentAssessor)
    .where(
      and(
        eq(recruitmentAssessor.recruitmentId, recruitment.id),
        eq(recruitmentAssessor.userId, actor.id),
      ),
    );

  const deciderDivisionIds = new Set(kadiv.map((k) => k.divisionId));
  const divisionIds = new Set([
    ...deciderDivisionIds,
    ...extras.flatMap((e) => (e.divisionId ? [e.divisionId] : [])),
  ]);
  const generalAssessor = extras.some((e) => e.divisionId === null);

  if (!isAdmin && !generalAssessor && divisionIds.size === 0) return null;
  return { isAdmin, generalAssessor, divisionIds, deciderDivisionIds };
}

/** Boleh menilai kriteria pada lingkup ini (`null` = umum, selain itu id divisi). */
export const canAssessScope = (a: AssessAccess, divisionId: string | null) =>
  a.isAdmin ||
  (divisionId === null ? a.generalAssessor : a.divisionIds.has(divisionId));

/** Boleh memutuskan (override, label sensitif) atas sebuah divisi. */
export const canDecideDivision = (a: AssessAccess, divisionId: string) =>
  a.isAdmin || a.deciderDivisionIds.has(divisionId);

/** Melihat hal yang bertanda sensitif: admin dan Kadiv mana pun. */
export const canSeeSensitive = (a: AssessAccess) =>
  a.isAdmin || a.deciderDivisionIds.size > 0;
