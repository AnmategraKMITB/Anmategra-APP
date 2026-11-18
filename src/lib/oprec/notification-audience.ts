/**
 * Pemilihan penerima pemberitahuan manual oprec, murni tanpa akses basis data.
 *
 * Status mengikuti menu Hasil: diterima bila ada keputusan `terima`, belum
 * diputuskan bila masih ada pilihan aktif tanpa keputusan, selain itu tidak
 * diterima. Saat lingkup divisi dipilih, penerima yang sudah diterima di divisi
 * lain tidak dihitung sebagai "tidak diterima" atau "belum diputuskan" untuk
 * divisi itu.
 */
import { deriveChoiceStage } from './allocation';
import type { ComputedStatus } from './scoring';

export const NOTIFICATION_AUDIENCES = [
  'all',
  'accepted',
  'rejected',
  'undecided',
] as const;
export type NotificationAudience = (typeof NOTIFICATION_AUDIENCES)[number];

export type AudienceChoice = {
  id: string;
  divisionId: string;
  rank: number | null;
  /** Status efektif pilihan; override aktif sudah diterapkan. */
  status: ComputedStatus | null;
  decision: 'terima' | 'tolak' | null;
};

export type AudienceApplicant = {
  applicationId: string;
  userId: string;
  choices: AudienceChoice[];
};

export type AudienceTally = {
  all: number;
  accepted: number;
  rejected: number;
  undecided: number;
  /** Id pengguna unik untuk audiens yang dipilih, urut kemunculan. */
  recipients: string[];
};

function hasPending(
  choices: AudienceChoice[],
  staged: boolean,
): boolean {
  if (choices.length === 0) return false;
  const stages = deriveChoiceStage(
    choices.map((choice) => ({
      id: choice.id,
      rank: choice.rank,
      status: choice.status,
      decision: choice.decision,
    })),
    { staged },
  );
  return choices.some(
    (choice) =>
      choice.decision === null && stages.get(choice.id)?.stage === 'aktif',
  );
}

export function tallyNotificationAudience(
  applicants: AudienceApplicant[],
  options: {
    audience: NotificationAudience;
    /** Kosong/undefined = seluruh divisi oprec. */
    divisionIds?: readonly string[] | null;
    staged: boolean;
  },
): AudienceTally {
  const scoped = options.divisionIds?.length
    ? new Set(options.divisionIds)
    : null;
  const tally: AudienceTally = {
    all: 0,
    accepted: 0,
    rejected: 0,
    undecided: 0,
    recipients: [],
  };
  const seen = new Set<string>();

  for (const applicant of applicants) {
    const inScope = scoped
      ? applicant.choices.filter((choice) => scoped.has(choice.divisionId))
      : applicant.choices;
    if (scoped && inScope.length === 0) continue;

    const acceptedInScope = inScope.some(
      (choice) => choice.decision === 'terima',
    );
    const acceptedElsewhere =
      !acceptedInScope &&
      applicant.choices.some((choice) => choice.decision === 'terima');

    // Sudah diterima di divisi lain: bukan penerima "tidak diterima" atau
    // "belum diputuskan" untuk divisi ini, tetapi tetap masuk audiens "semua".
    const status = acceptedInScope
      ? ('accepted' as const)
      : acceptedElsewhere
        ? null
        : hasPending(inScope, options.staged)
          ? ('undecided' as const)
          : ('rejected' as const);

    tally.all += 1;
    if (status) tally[status] += 1;

    const matches = options.audience === 'all' || options.audience === status;
    if (!matches || seen.has(applicant.userId)) continue;
    seen.add(applicant.userId);
    tally.recipients.push(applicant.userId);
  }

  return tally;
}
