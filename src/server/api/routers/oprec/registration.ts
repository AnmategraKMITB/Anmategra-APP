/**
 * Satu-satunya jalan mengubah status pendaftaran oprec. Status oprec dan status
 * formulirnya ditulis bersama di bawah kunci yang sama, baik dari halaman oprec
 * maupun dari editor Forms, sehingga keduanya tidak pernah berselisih.
 *
 * Urutan kunci: baris formulir dulu (`lockForm`), baru baris oprec. Submit
 * memegang kunci formulir (FOR SHARE) sebelum menulis pendaftar, jadi urutan
 * yang terbalik bisa saling menunggu.
 */
import { TRPCError } from '@trpc/server';
import { and, count, eq, isNull } from 'drizzle-orm';
import {
  type FormStatus,
  REGISTRATION_TRANSITIONS,
  type RecruitmentStatus,
  formStatusFor,
  registrationEnded,
} from '~/lib/oprec/registration';
import { canManageEvent } from '~/server/api/access';
import {
  form,
  formField,
  formSubmission,
  recruitment,
  recruitmentDivision,
  recruitmentWave,
} from '~/server/db/schema';

import {
  type FormRow,
  type Tx,
  assertPublishable,
  loadActiveFields,
  lockForm,
} from '../form/services';
import { logAction } from './log';
import {
  type Database,
  type Queryable,
  conflict,
  countApplications,
  notFound,
} from './services';

type RecruitmentRow = typeof recruitment.$inferSelect;

export type RegistrationLock = {
  form: FormRow;
  recruitment: RecruitmentRow;
};

/** Mengunci formulir lalu oprec, dimulai dari id oprec. */
export async function lockRegistrationByRecruitment(
  tx: Tx,
  recruitmentId: string,
): Promise<RegistrationLock> {
  const [ref] = await tx
    .select({ formId: recruitment.formId })
    .from(recruitment)
    .where(eq(recruitment.id, recruitmentId));
  if (!ref) notFound('Oprec tidak ditemukan.');
  const formRow = await lockForm(tx, ref.formId);
  const [rec] = await tx
    .select()
    .from(recruitment)
    .where(eq(recruitment.id, recruitmentId))
    .for('update');
  if (!rec) notFound('Oprec tidak ditemukan.');
  if (rec.formId !== formRow.id)
    conflict('Oprec baru saja berubah. Coba lagi.');
  return { form: formRow, recruitment: rec };
}

/** Mengunci formulir lalu oprec yang memakainya; null bila formulir biasa. */
export async function lockRegistrationByForm(
  tx: Tx,
  formId: string,
): Promise<RegistrationLock | null> {
  const formRow = await lockForm(tx, formId);
  const [rec] = await tx
    .select()
    .from(recruitment)
    .where(eq(recruitment.formId, formId))
    .for('update');
  return rec ? { form: formRow, recruitment: rec } : null;
}

/** Status formulir oprec hanya boleh diubah pengelola oprec, bukan sekadar pengelola Forms. */
export async function assertOprecManager(
  db: Database,
  user: { id: string; role: string; lembagaId?: string | null },
  periodId: string,
) {
  const access = await canManageEvent(
    db,
    user.id,
    user.role,
    user.lembagaId,
    periodId,
    'oprec',
  );
  if (!access) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Status formulir oprec hanya bisa diubah pengelola oprec.',
    });
  }
}

/** Hal yang harus beres sebelum pendaftaran dibuka; kosong bila siap. */
export async function readinessProblems(
  db: Queryable,
  lock: RegistrationLock,
): Promise<string[]> {
  const problems: string[] = [];
  if (!lock.recruitment.setupCompletedAt) {
    problems.push('Selesaikan pengaturan oprec sebelum membukanya.');
  }
  const [divisions] = await db
    .select({ n: count() })
    .from(recruitmentDivision)
    .where(eq(recruitmentDivision.recruitmentId, lock.recruitment.id));
  if ((divisions?.n ?? 0) === 0) {
    problems.push(
      'Pilih minimal satu tujuan penempatan sebelum membuka oprec.',
    );
  }
  const [choice] = await db
    .select({ n: count() })
    .from(formField)
    .where(
      and(
        eq(formField.formId, lock.form.id),
        eq(formField.type, 'unit_choice'),
        isNull(formField.archivedAt),
      ),
    );
  if ((choice?.n ?? 0) === 0) {
    problems.push(
      'Tambahkan blok Pilihan tujuan ke formulir sebelum membuka oprec.',
    );
  }
  return problems;
}

/**
 * Pendaftaran yang sudah berakhir boleh dibuka lagi selama penempatan masih
 * berjalan dan hasil belum dirilis. Keputusan yang sudah ada tetap berlaku;
 * pendaftar baru masuk sebagai pendaftar yang belum diputuskan. UI meminta
 * konfirmasi sebelum membuka lagi.
 */
export async function assertReopenable(
  db: Queryable,
  rec: RecruitmentRow,
  now: Date,
) {
  if (rec.placementState !== 'berjalan') {
    conflict(
      'Penempatan sudah masuk masa banding atau final, jadi pendaftaran tidak bisa dibuka lagi.',
    );
  }
  if (rec.resultsReleasedAt) {
    conflict('Hasil sudah dirilis, jadi pendaftaran tidak bisa dibuka lagi.');
  }
  const waves = await db
    .select({ endsAt: recruitmentWave.endsAt })
    .from(recruitmentWave)
    .where(eq(recruitmentWave.recruitmentId, rec.id));
  if (
    waves.length > 0 &&
    waves.every((w) => w.endsAt.getTime() <= now.getTime())
  ) {
    conflict(
      'Semua gelombang sudah berakhir. Tambahkan gelombang baru sebelum membuka pendaftaran lagi.',
    );
  }
}

async function writeFormStatus(tx: Tx, row: FormRow, status: FormStatus) {
  if (row.status === status) return;
  await tx
    .update(form)
    .set({
      status,
      ...(status === 'Published' &&
        row.publishedAt === null && { publishedAt: new Date() }),
    })
    .where(eq(form.id, row.id));
}

/**
 * Mengubah status pendaftaran beserta status formulirnya. Dipanggil di dalam
 * transaksi yang memegang `RegistrationLock`.
 */
export async function setRegistrationStatus(
  tx: Tx,
  lock: RegistrationLock,
  to: RecruitmentStatus,
  opts: { actorId: string; via: 'oprec' | 'form'; now?: Date },
): Promise<{ from: RecruitmentStatus; changed: boolean }> {
  const now = opts.now ?? new Date();
  const rec = lock.recruitment;
  const from = rec.status as RecruitmentStatus;
  const formTarget = formStatusFor(to);

  if (from === to) {
    // Hanya memperbaiki formulir yang statusnya berselisih dengan oprec.
    if (lock.form.status !== formTarget) {
      if (formTarget === 'Published') {
        assertPublishable(lock.form, await loadActiveFields(tx, lock.form.id));
      }
      await writeFormStatus(tx, lock.form, formTarget);
    }
    return { from, changed: false };
  }

  if (!REGISTRATION_TRANSITIONS[from].includes(to)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        from === 'draft' && to === 'closed'
          ? 'Oprec draf belum pernah dibuka, jadi tidak bisa ditutup.'
          : 'Perpindahan status pendaftaran itu tidak diizinkan.',
    });
  }

  if (to === 'open') {
    const problems = await readinessProblems(tx, lock);
    if (problems.length > 0) conflict(problems.join('\n'));
    if (from === 'closed') await assertReopenable(tx, rec, now);
    // Menolak formulir tanpa pertanyaan atau dengan tenggat yang sudah lewat.
    assertPublishable(lock.form, await loadActiveFields(tx, lock.form.id));
  }

  if (to === 'draft') {
    if ((await countApplications(tx, rec.id)) > 0) {
      conflict('Oprec yang sudah punya pendaftar tidak bisa kembali ke draf.');
    }
    const [submissions] = await tx
      .select({ n: count() })
      .from(formSubmission)
      .where(eq(formSubmission.formId, lock.form.id));
    if ((submissions?.n ?? 0) > 0) {
      conflict(
        'Formulir yang sudah memiliki jawaban tidak bisa kembali ke draf.',
      );
    }
  }

  await tx
    .update(recruitment)
    .set({ status: to })
    .where(eq(recruitment.id, rec.id));
  await writeFormStatus(tx, lock.form, formTarget);
  await logAction(tx, {
    recruitmentId: rec.id,
    actorId: opts.actorId,
    action: 'status_pendaftaran',
    entityType: 'recruitment',
    entityId: rec.id,
    detail: { from, to, via: opts.via },
  });
  return { from, changed: true };
}

/**
 * Gelombang oprec dan apakah pendaftarannya sudah berakhir, dibaca dalam satu
 * kali jalan. Dipakai jendela penilaian dan penjaga masa banding.
 */
export async function loadRegistrationWindow(
  db: Queryable,
  recruitmentId: string,
  now: Date,
) {
  const [state] = await db
    .select({
      status: recruitment.status,
      formStatus: form.status,
      closesAt: form.closesAt,
    })
    .from(recruitment)
    .innerJoin(form, eq(form.id, recruitment.formId))
    .where(eq(recruitment.id, recruitmentId));
  const waves = await db
    .select({ id: recruitmentWave.id, endsAt: recruitmentWave.endsAt })
    .from(recruitmentWave)
    .where(eq(recruitmentWave.recruitmentId, recruitmentId));
  return {
    waves: new Map(waves.map((w) => [w.id, w.endsAt])),
    registrationEnded: state
      ? registrationEnded({
          status: state.status as RecruitmentStatus,
          formStatus: state.formStatus as FormStatus,
          formClosesAt: state.closesAt,
          waveEnds: waves.map((w) => w.endsAt),
          now,
        })
      : false,
  };
}
