import { and, asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { isWithinDeadline } from '~/lib/forms/grace';
import {
  type ApplicantProfile,
  type EligibilityRule,
  eligibilityMessage,
  evaluateEligibility,
} from '~/lib/oprec/eligibility';
import {
  application,
  applicationChoice,
  lembagaMembership,
  mahasiswa,
  organizationPosition,
  organizationUnit,
  recruitment,
  recruitmentDivision,
  recruitmentEligibilityRule,
  recruitmentWave,
} from '~/server/db/schema';

import { type Database, type Queryable } from './services';

export type OprecDivision = {
  id: string;
  label: string;
  /** Nama bagian induk (mis. bidang) untuk pengelompokan; null bila di akar. */
  groupLabel: string | null;
  quota: number;
  sortOrder: number;
};

export type OprecForForm = {
  recruitment: typeof recruitment.$inferSelect;
  divisions: OprecDivision[];
  waves: (typeof recruitmentWave.$inferSelect)[];
};

/** Oprec yang terikat pada form ini, atau null bila form biasa. */
export async function loadOprecForForm(
  db: Queryable,
  formId: string,
): Promise<OprecForForm | null> {
  const rec = await db.query.recruitment.findFirst({
    where: eq(recruitment.formId, formId),
  });
  if (!rec) return null;
  const parent = alias(organizationUnit, 'parent_unit');
  const [divisions, waves] = await Promise.all([
    db
      .select({
        id: recruitmentDivision.id,
        label: organizationUnit.name,
        groupLabel: parent.name,
        quota: organizationPosition.quota,
        sortOrder: recruitmentDivision.sortOrder,
      })
      .from(recruitmentDivision)
      .innerJoin(
        organizationUnit,
        eq(organizationUnit.id, recruitmentDivision.unitId),
      )
      .leftJoin(parent, eq(parent.id, organizationUnit.parent_id))
      .innerJoin(
        organizationPosition,
        eq(organizationPosition.id, recruitmentDivision.positionId),
      )
      .where(eq(recruitmentDivision.recruitmentId, rec.id))
      .orderBy(asc(recruitmentDivision.sortOrder)),
    db
      .select()
      .from(recruitmentWave)
      .where(eq(recruitmentWave.recruitmentId, rec.id))
      .orderBy(asc(recruitmentWave.sortOrder), asc(recruitmentWave.startsAt)),
  ]);
  return { recruitment: rec, divisions, waves };
}

/** Nilai atribut pendaftar untuk mengevaluasi syarat. */
export async function loadApplicantProfile(
  db: Queryable,
  userId: string,
): Promise<ApplicantProfile> {
  const [student] = await db
    .select({
      angkatan: mahasiswa.angkatan,
      jurusan: mahasiswa.jurusan,
      status: mahasiswa.status,
    })
    .from(mahasiswa)
    .where(eq(mahasiswa.userId, userId));
  const memberships = await db
    .select({
      lembagaId: lembagaMembership.lembagaId,
      cohortYear: lembagaMembership.cohortYear,
    })
    .from(lembagaMembership)
    .where(
      and(
        eq(lembagaMembership.userId, userId),
        eq(lembagaMembership.status, 'aktif'),
      ),
    );
  return {
    angkatan_kuliah: student ? [student.angkatan] : [],
    prodi: student ? [student.jurusan] : [],
    status_mahasiswa: student ? [student.status] : [],
    // Fakultas belum tersimpan di data mahasiswa; syarat atasnya tidak terpenuhi.
    fakultas: null,
    keanggotaan_lembaga: memberships.map((m) => m.lembagaId),
    angkatan_lembaga: memberships.flatMap((m) =>
      m.cohortYear === null ? [] : [m.cohortYear],
    ),
  };
}

export function currentWave<T extends { startsAt: Date; endsAt: Date }>(
  waves: T[],
  now: Date,
): T | null {
  return (
    waves.find((w) => w.startsAt <= now && isWithinDeadline(w.endsAt, now)) ??
    null
  );
}

export type ApplyGate = {
  canApply: boolean;
  /** false hanya bila syarat pendaftar tidak terpenuhi (bukan karena jadwal). */
  eligible: boolean;
  /** Alasan bila `canApply` false; kalimat siap tampil ke pendaftar. */
  reason: string | null;
  /** Gelombang yang sedang berjalan (null bila oprec tanpa gelombang). */
  wave: typeof recruitmentWave.$inferSelect | null;
};

/**
 * Apakah `userId` boleh mengirim form oprec sekarang: oprec harus terbuka,
 * berada di dalam gelombang (bila ada gelombang), dan syarat terpenuhi.
 */
export async function checkApplyGate(
  db: Queryable,
  oprec: OprecForForm,
  userId: string,
  now = new Date(),
): Promise<ApplyGate> {
  const { recruitment: rec, waves } = oprec;
  if (rec.status !== 'open') {
    return {
      canApply: false,
      eligible: true,
      reason:
        rec.status === 'draft'
          ? 'Pendaftaran belum dibuka.'
          : 'Pendaftaran sudah ditutup.',
      wave: null,
    };
  }
  const wave = waves.length > 0 ? currentWave(waves, now) : null;
  if (waves.length > 0 && !wave) {
    return {
      canApply: false,
      eligible: true,
      reason: 'Saat ini tidak ada gelombang pendaftaran yang berjalan.',
      wave: null,
    };
  }
  const rules = await db
    .select()
    .from(recruitmentEligibilityRule)
    .where(eq(recruitmentEligibilityRule.recruitmentId, rec.id));
  if (rules.length > 0) {
    const profile = await loadApplicantProfile(db, userId);
    const result = evaluateEligibility(
      rec.eligibilityMatch,
      rules as EligibilityRule[],
      profile,
    );
    if (!result.eligible) {
      return {
        canApply: false,
        eligible: false,
        reason: eligibilityMessage(result.failed),
        wave,
      };
    }
  }
  return { canApply: true, eligible: true, reason: null, wave };
}

/**
 * Membuat pendaftar beserta pilihannya dari respons yang baru dikirim.
 * `divisionIds` berurutan: indeks 0 = pilihan ke-1.
 */
export async function createApplicationFromSubmission(
  tx: Queryable & Pick<Database, 'insert'>,
  input: {
    recruitmentId: string;
    userId: string;
    waveId: string | null;
    formSubmissionId: string;
    divisionIds: string[];
    willingToMove: boolean;
  },
) {
  const [app] = await tx
    .insert(application)
    .values({
      recruitmentId: input.recruitmentId,
      userId: input.userId,
      waveId: input.waveId,
      formSubmissionId: input.formSubmissionId,
      source: 'form',
      willingToMove: input.willingToMove,
      submittedAt: new Date(),
    })
    .returning({ id: application.id });
  await tx.insert(applicationChoice).values(
    input.divisionIds.map((divisionId, index) => ({
      applicationId: app!.id,
      divisionId,
      rank: index + 1,
      origin: 'dipilih' as const,
    })),
  );
  return app!.id;
}
