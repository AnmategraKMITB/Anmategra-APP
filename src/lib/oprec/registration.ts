/**
 * Status pendaftaran oprec: modul murni. Status oprec (draft/open/closed) dan
 * status formulirnya (Draft/Published/Closed) selalu diubah berpasangan, dan
 * pendaftaran dianggap berakhir bila oprec ditutup, formulir ditutup, tenggat
 * formulir lewat, atau semua gelombang sudah berakhir.
 */

export type RecruitmentStatus = 'draft' | 'open' | 'closed';
export type FormStatus = 'Draft' | 'Published' | 'Closed';

const FORM_STATUS: Record<RecruitmentStatus, FormStatus> = {
  draft: 'Draft',
  open: 'Published',
  closed: 'Closed',
};

const RECRUITMENT_STATUS: Record<FormStatus, RecruitmentStatus> = {
  Draft: 'draft',
  Published: 'open',
  Closed: 'closed',
};

/** Status formulir yang sepasang dengan status oprec. */
export function formStatusFor(status: RecruitmentStatus): FormStatus {
  return FORM_STATUS[status];
}

/** Status oprec yang sepasang dengan status formulirnya. */
export function recruitmentStatusFor(status: FormStatus): RecruitmentStatus {
  return RECRUITMENT_STATUS[status];
}

/**
 * Perpindahan status yang diizinkan, sebelum syarat data (kesiapan, pendaftar,
 * keputusan) diperiksa. Draf tidak bisa langsung ditutup.
 */
export const REGISTRATION_TRANSITIONS: Record<
  RecruitmentStatus,
  readonly RecruitmentStatus[]
> = {
  draft: ['open'],
  open: ['closed', 'draft'],
  closed: ['open', 'draft'],
};

/**
 * Pendaftaran sudah berakhir: tidak ada lagi pendaftar baru yang bisa masuk.
 * Oprec draf belum pernah dibuka, jadi belum berakhir.
 */
export function registrationEnded(input: {
  status: RecruitmentStatus;
  formStatus: FormStatus;
  formClosesAt: Date | null;
  waveEnds: readonly Date[];
  now: Date;
}): boolean {
  if (input.status === 'closed') return true;
  if (input.status !== 'open') return false;
  if (input.formStatus === 'Closed') return true;
  const now = input.now.getTime();
  if (input.formClosesAt && input.formClosesAt.getTime() <= now) return true;
  return (
    input.waveEnds.length > 0 && input.waveEnds.every((e) => e.getTime() <= now)
  );
}
