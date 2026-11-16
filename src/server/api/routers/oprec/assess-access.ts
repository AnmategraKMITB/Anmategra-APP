import { and, eq } from 'drizzle-orm';
import { canManageEvent } from '~/server/api/access';
import { type db as Db } from '~/server/db';
import { type AssessorMode, recruitmentAssessor } from '~/server/db/schema';

import { loadDivisionPengurus } from './pengurus';

type Database = typeof Db;

export type AssessAccess = {
  /** Pengelola oprec (owner/admin, atau hibah fitur oprec): bisa semuanya. */
  isAdmin: boolean;
  /** Boleh menilai kriteria umum. */
  generalAssessor: boolean;
  /** Divisi yang boleh dinilai: pengurus (turunan organogram) dan penilai tambahan divisi. */
  divisionIds: Set<string>;
  /** Divisi yang keputusannya dipegang: hanya pengurus. */
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
 * - Pengurus: pemegang jabatan di atas Staf pada bagian tujuan sebuah divisi
 *   oprec atau bagian di atasnya (Kadiv, Kabid, Ketua, lihat `pengurus.ts`);
 *   menilai dan memutuskan divisi itu. Diturunkan dari organogram, tanpa baris
 *   tabel. `assessorMode = 'umum'` mencabut hak menilainya, `headDecides =
 *   false` mencabut hak memutuskannya (hanya admin yang memutuskan).
 * - Penilai tambahan (`recruitment_assessor`): umum bila `division_id` kosong,
 *   atau penilai divisi tertentu (tanpa hak memutuskan).
 */
export async function resolveAssessAccess(
  db: Database,
  actor: AssessActor,
  recruitment: {
    id: string;
    periodId: string;
    assessorMode: AssessorMode;
    headDecides: boolean;
  },
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

  const pengurus = await loadDivisionPengurus(db, recruitment.id, actor.id);
  const extras = await db
    .select({ divisionId: recruitmentAssessor.divisionId })
    .from(recruitmentAssessor)
    .where(
      and(
        eq(recruitmentAssessor.recruitmentId, recruitment.id),
        eq(recruitmentAssessor.userId, actor.id),
      ),
    );

  // S16: tanpa veto, keputusan hanya di admin. S13 `umum`: pengurus tidak menilai.
  const deciderDivisionIds = new Set(
    recruitment.headDecides ? pengurus.map((k) => k.divisionId) : [],
  );
  const headsAssess = recruitment.assessorMode !== 'umum';
  const divisionIds = new Set([
    ...(headsAssess ? pengurus.map((k) => k.divisionId) : []),
    ...extras.flatMap((e) => (e.divisionId ? [e.divisionId] : [])),
  ]);
  const generalAssessor = extras.some((e) => e.divisionId === null);

  if (
    !isAdmin &&
    !generalAssessor &&
    divisionIds.size === 0 &&
    deciderDivisionIds.size === 0
  ) {
    return null;
  }
  return { isAdmin, generalAssessor, divisionIds, deciderDivisionIds };
}

/** Boleh menilai kriteria pada lingkup ini (`null` = umum, selain itu id divisi). */
export const canAssessScope = (a: AssessAccess, divisionId: string | null) =>
  a.isAdmin ||
  (divisionId === null ? a.generalAssessor : a.divisionIds.has(divisionId));

/** Boleh memutuskan (override, label sensitif) atas sebuah divisi. */
export const canDecideDivision = (a: AssessAccess, divisionId: string) =>
  a.isAdmin || a.deciderDivisionIds.has(divisionId);

/**
 * Boleh menyusun daftar prioritas sebuah divisi (metode `prioritas`): admin,
 * penilai umum, penilai divisi itu, dan pengurus yang memutuskannya.
 */
export const canRankDivision = (a: AssessAccess, divisionId: string) =>
  a.isAdmin ||
  a.generalAssessor ||
  a.divisionIds.has(divisionId) ||
  a.deciderDivisionIds.has(divisionId);

/** Melihat hal yang bertanda sensitif: admin dan pengurus mana pun. */
export const canSeeSensitive = (a: AssessAccess) =>
  a.isAdmin || a.deciderDivisionIds.size > 0;
