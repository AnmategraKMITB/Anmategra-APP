/**
 * Aturan murni mode prioritas, tanpa akses basis data: siapa kandidat sebuah
 * divisi, input algoritma penempatan dari daftar yang tersimpan, dan keputusan
 * yang ditulis dari hasilnya.
 *
 * Mode gabungan: nilai dan status lulus/tidak tetap berjalan seperti biasa.
 * Pilihan berstatus efektif `tidak_lolos` tidak bisa diprioritaskan di divisi
 * itu, jadi status menjadi saringan dan daftar prioritas menjadi urutannya.
 */
import { type MatchingInput } from './matching';

export type PoolChoice = {
  id: string;
  divisionId: string;
  /** Pilihan ke-n; null untuk pilihan dialihkan atau closerec. */
  rank: number | null;
  origin: 'dipilih' | 'dialihkan' | 'closerec';
  /** Status efektif (override sudah diterapkan). */
  status: 'lolos' | 'tidak_lolos' | 'belum_lengkap' | 'perlu_ditinjau' | null;
  decision: 'terima' | 'tolak' | null;
};

export type PoolApplication = {
  id: string;
  source: 'form' | 'closerec';
  willingToMove: boolean;
  choices: readonly PoolChoice[];
};

export type PoolPriority = {
  divisionId: string;
  applicationId: string;
  rank: number | null;
};

/** Alasan kandidat tampil tetapi tidak bisa diprioritaskan. */
export type CandidateBlock = 'tidak_lolos' | 'closerec';

export type Candidacy =
  | {
      kind: 'pilihan';
      choiceId: string;
      choiceRank: number;
      blocked: CandidateBlock | null;
    }
  | { kind: 'dipindahkan'; blocked: CandidateBlock | null };

/** Pilihan sendiri pendaftar, urut dari pilihan ke-1. */
export function ownChoices(app: PoolApplication): PoolChoice[] {
  return app.choices
    .filter((c) => c.origin === 'dipilih' && c.rank !== null)
    .sort((a, b) => a.rank! - b.rank! || a.id.localeCompare(b.id));
}

/** Sudah diterima lewat closerec, jadi tidak ikut penempatan otomatis. */
export function hasCloserecAcceptance(app: PoolApplication): boolean {
  return app.choices.some(
    (c) => c.origin === 'closerec' && c.decision === 'terima',
  );
}

/**
 * Kedudukan pendaftar di daftar sebuah divisi: memilih divisi itu, atau
 * bersedia dipindahkan ke sana (bila oprec mengizinkan). null bila bukan
 * kandidat divisi itu sama sekali.
 */
export function candidacy(
  app: PoolApplication,
  divisionId: string,
  allowRedirect: boolean,
): Candidacy | null {
  if (app.source !== 'form') return null;
  const own = ownChoices(app);
  if (own.length === 0) return null;
  const closerec = hasCloserecAcceptance(app);
  const choice = own.find((c) => c.divisionId === divisionId);
  if (choice) {
    return {
      kind: 'pilihan',
      choiceId: choice.id,
      choiceRank: choice.rank!,
      blocked: closerec
        ? 'closerec'
        : choice.status === 'tidak_lolos'
          ? 'tidak_lolos'
          : null,
    };
  }
  if (allowRedirect && app.willingToMove) {
    return { kind: 'dipindahkan', blocked: closerec ? 'closerec' : null };
  }
  return null;
}

export type IgnoredPriority = {
  divisionId: string;
  applicationId: string;
  reason: CandidateBlock | 'bukan_kandidat';
};

/**
 * Input algoritma dari data tersimpan. Urutan milik orang yang kini tidak
 * lolos, sudah masuk lewat closerec, atau bukan lagi kandidat diabaikan dan
 * dilaporkan, supaya pratinjau bisa menjelaskannya.
 */
export function buildMatchingInput(input: {
  applications: readonly PoolApplication[];
  divisions: readonly { id: string; quota: number; sortOrder: number }[];
  priorities: readonly PoolPriority[];
  allowRedirect: boolean;
}): { matching: MatchingInput; ignored: IgnoredPriority[] } {
  const appById = new Map(input.applications.map((a) => [a.id, a]));
  const priorityOf = new Map(
    input.divisions.map((d) => [d.id, new Map<string, number>()]),
  );
  const ignored: IgnoredPriority[] = [];

  for (const p of input.priorities) {
    if (p.rank === null) continue;
    const map = priorityOf.get(p.divisionId);
    if (!map) continue;
    const app = appById.get(p.applicationId);
    const status = app
      ? candidacy(app, p.divisionId, input.allowRedirect)
      : null;
    if (!status || status.blocked) {
      ignored.push({
        divisionId: p.divisionId,
        applicationId: p.applicationId,
        reason: status?.blocked ?? 'bukan_kandidat',
      });
      continue;
    }
    map.set(p.applicationId, p.rank);
  }

  const applicants = input.applications
    .filter(
      (a) =>
        a.source === 'form' &&
        !hasCloserecAcceptance(a) &&
        ownChoices(a).length > 0,
    )
    .map((a) => ({
      id: a.id,
      choices: ownChoices(a).map((c) => c.divisionId),
      willingToMove: a.willingToMove,
    }));

  return {
    matching: {
      applicants,
      divisions: input.divisions.map((d) => ({
        id: d.id,
        quota: d.quota,
        sortOrder: d.sortOrder,
        priority: priorityOf.get(d.id)!,
      })),
      allowRedirect: input.allowRedirect,
    },
    ignored,
  };
}

export type WritePlan = {
  /**
   * Pilihan yang diterima. `choiceId` null = buat pilihan `dialihkan` baru di
   * `divisionId` (diterima di luar pilihannya).
   */
  terima: {
    choiceId: string | null;
    divisionId: string;
    redirected: boolean;
  } | null;
  /** Pilihan yang diproses lalu ditolak (di atas tempat diterima). */
  tolak: string[];
  /** Pilihan di bawah tempat diterima: keputusan lamanya dihapus (tertutup). */
  clear: string[];
  /** Pilihan `dialihkan` dari penempatan sebelumnya yang tidak dipakai lagi. */
  drop: string[];
};

/**
 * Keputusan satu pendaftar dari hasil penempatan. Pada deferred acceptance,
 * pendaftar melamar ke semua pilihan di atas tempat akhirnya dan ditolak di
 * sana; pilihan di bawahnya tidak pernah diproses.
 */
export function planWrites(
  app: PoolApplication,
  assigned: string | null,
): WritePlan {
  const own = ownChoices(app);
  const redirected = app.choices.filter((c) => c.origin === 'dialihkan');
  const ownIndex =
    assigned === null ? -1 : own.findIndex((c) => c.divisionId === assigned);

  const tolak: string[] = [];
  const clear: string[] = [];
  own.forEach((choice, index) => {
    if (ownIndex === -1 || index < ownIndex) tolak.push(choice.id);
    else if (index > ownIndex) clear.push(choice.id);
  });

  let terima: WritePlan['terima'] = null;
  if (assigned !== null) {
    if (ownIndex >= 0) {
      terima = {
        choiceId: own[ownIndex]!.id,
        divisionId: assigned,
        redirected: false,
      };
    } else {
      const reuse = redirected.find((c) => c.divisionId === assigned);
      terima = {
        choiceId: reuse?.id ?? null,
        divisionId: assigned,
        redirected: true,
      };
    }
  }

  const keep = terima?.redirected ? terima.choiceId : null;
  const drop = redirected.filter((c) => c.id !== keep).map((c) => c.id);
  return { terima, tolak, clear, drop };
}
