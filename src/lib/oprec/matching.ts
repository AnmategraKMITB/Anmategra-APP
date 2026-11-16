/**
 * Penempatan otomatis mode prioritas: deferred acceptance (Gale–Shapley,
 * pendaftar yang melamar). Modul murni tanpa I/O, dipakai server untuk
 * pratinjau dan penerapan, dan diuji tanpa basis data.
 *
 * Pendaftar melamar ke pilihannya secara berurutan. Tiap divisi menahan
 * sebanyak kuota orang dengan prioritas terbaik dan menolak sisanya; yang
 * tergeser melamar ke pilihan berikutnya, sampai tidak ada perubahan.
 *
 * Hasilnya stabil: tidak ada pendaftar dan divisi yang sama-sama lebih memilih
 * satu sama lain daripada hasil akhir. Hasilnya juga tunggal (terbaik bagi
 * pendaftar), jadi tidak bergantung pada urutan proses, dan pendaftar tidak
 * diuntungkan dengan memalsukan urutan pilihannya.
 */

export type MatchingApplicant = {
  id: string;
  /** Pilihan sendiri, berurutan: indeks 0 = pilihan ke-1. */
  choices: readonly string[];
  /** Bersedia ditempatkan di divisi di luar pilihannya. */
  willingToMove: boolean;
};

export type MatchingDivision = {
  id: string;
  /** Kuota penerimaan; 0 = tanpa batas. */
  quota: number;
  sortOrder: number;
  /**
   * Urutan prioritas divisi: id pendaftar → urutan (1 = paling diinginkan).
   * Pendaftar yang tidak ada di sini tidak diprioritaskan, berarti ditolak.
   */
  priority: ReadonlyMap<string, number>;
};

export type MatchingInput = {
  applicants: readonly MatchingApplicant[];
  divisions: readonly MatchingDivision[];
  /** Oprec mengizinkan penempatan di luar pilihan bagi yang bersedia dipindahkan. */
  allowRedirect: boolean;
};

export type StepOutcome =
  /** Diterima di divisi ini (hasil akhir). */
  | 'diterima'
  /** Divisi tidak memasukkan pendaftar ke daftar prioritasnya. */
  | 'tidak_diprioritaskan'
  /** Kuota terisi oleh pendaftar dengan prioritas lebih baik. */
  | 'tergeser'
  /** Tidak diproses karena sudah diterima di pilihan yang lebih tinggi. */
  | 'tidak_diproses';

export type MatchingStep = {
  divisionId: string;
  /** Pilihan ke-n; null untuk divisi di luar pilihan (bersedia dipindahkan). */
  choiceRank: number | null;
  /** Urutan prioritas di divisi itu; null bila tidak diprioritaskan. */
  priorityRank: number | null;
  outcome: StepOutcome;
};

export type MatchingResult = {
  /** id pendaftar → id divisi tempatnya diterima, atau null. */
  assignment: Map<string, string | null>;
  /** id divisi → id pendaftar yang diterima, urut prioritas terbaik. */
  accepted: Map<string, string[]>;
  /**
   * id divisi → urutan prioritas terburuk yang diterima bila kuota penuh;
   * null bila kuota tidak penuh atau tanpa batas.
   */
  cutoff: Map<string, number | null>;
  /** id pendaftar → langkah per divisi dalam urutan preferensinya. */
  trace: Map<string, MatchingStep[]>;
};

type Preference = { divisionId: string; choiceRank: number | null };

/**
 * Urutan preferensi pendaftar: pilihan sendiri lebih dulu, lalu, bila oprec
 * mengizinkan dan pendaftar bersedia dipindahkan, divisi lain yang
 * memprioritaskannya, diurutkan menurut urutan yang diberikan divisi itu.
 * Pilihan ganda atau divisi yang tidak dikenal diabaikan.
 */
export function preferenceList(
  applicant: MatchingApplicant,
  divisions: readonly MatchingDivision[],
  allowRedirect: boolean,
): Preference[] {
  const known = new Set(divisions.map((d) => d.id));
  const seen = new Set<string>();
  const list: Preference[] = [];
  applicant.choices.forEach((divisionId, index) => {
    if (!known.has(divisionId) || seen.has(divisionId)) return;
    seen.add(divisionId);
    list.push({ divisionId, choiceRank: index + 1 });
  });
  if (allowRedirect && applicant.willingToMove) {
    const extra = divisions
      .filter((d) => !seen.has(d.id) && d.priority.has(applicant.id))
      .sort(
        (a, b) =>
          a.priority.get(applicant.id)! - b.priority.get(applicant.id)! ||
          a.sortOrder - b.sortOrder ||
          a.id.localeCompare(b.id),
      );
    for (const d of extra) list.push({ divisionId: d.id, choiceRank: null });
  }
  return list;
}

/** Urutan di divisi; seri dipecah dengan id agar hasil deterministik. */
function better(
  priority: ReadonlyMap<string, number>,
  a: string,
  b: string,
): number {
  return priority.get(a)! - priority.get(b)! || a.localeCompare(b);
}

export function runPriorityMatching(input: MatchingInput): MatchingResult {
  const divisionById = new Map(input.divisions.map((d) => [d.id, d]));
  const applicants = [...input.applicants].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const prefsOf = new Map(
    applicants.map((a) => [
      a.id,
      preferenceList(a, input.divisions, input.allowRedirect),
    ]),
  );

  const held = new Map<string, string[]>(
    input.divisions.map((d) => [d.id, []]),
  );
  const next = new Map<string, number>();
  const queue = applicants.map((a) => a.id);

  while (queue.length > 0) {
    const applicantId = queue.shift()!;
    const prefs = prefsOf.get(applicantId)!;
    let index = next.get(applicantId) ?? 0;
    while (index < prefs.length) {
      const division = divisionById.get(prefs[index]!.divisionId)!;
      index += 1;
      if (!division.priority.has(applicantId)) continue;

      const list = held.get(division.id)!;
      list.push(applicantId);
      list.sort((a, b) => better(division.priority, a, b));
      if (division.quota > 0 && list.length > division.quota) {
        const bumped = list.pop()!;
        if (bumped === applicantId) continue;
        queue.push(bumped);
      }
      break;
    }
    next.set(applicantId, index);
  }

  const assignment = new Map<string, string | null>(
    applicants.map((a) => [a.id, null]),
  );
  for (const [divisionId, list] of held) {
    for (const applicantId of list) assignment.set(applicantId, divisionId);
  }

  const cutoff = new Map<string, number | null>();
  for (const division of input.divisions) {
    const list = held.get(division.id)!;
    const full = division.quota > 0 && list.length >= division.quota;
    cutoff.set(
      division.id,
      full ? division.priority.get(list[list.length - 1]!)! : null,
    );
  }

  // Jejak dibangun dari hasil akhir. Pada deferred acceptance, pendaftar
  // melamar ke semua divisi di atas tempat akhirnya dan ditolak di sana, jadi
  // jejak ini sama apa pun urutan prosesnya.
  const trace = new Map<string, MatchingStep[]>();
  for (const applicant of applicants) {
    const prefs = prefsOf.get(applicant.id)!;
    const final = assignment.get(applicant.id);
    const finalIndex = final
      ? prefs.findIndex((p) => p.divisionId === final)
      : prefs.length;
    const steps: MatchingStep[] = [];
    prefs.forEach((pref, index) => {
      const priorityRank =
        divisionById.get(pref.divisionId)!.priority.get(applicant.id) ?? null;
      if (index < finalIndex) {
        steps.push({
          ...pref,
          priorityRank,
          outcome: priorityRank === null ? 'tidak_diprioritaskan' : 'tergeser',
        });
      } else if (index === finalIndex) {
        steps.push({ ...pref, priorityRank, outcome: 'diterima' });
      } else if (pref.choiceRank !== null) {
        // Hanya pilihan sendiri yang ditampilkan sebagai "tidak diproses".
        steps.push({ ...pref, priorityRank, outcome: 'tidak_diproses' });
      }
    });
    trace.set(applicant.id, steps);
  }

  return { assignment, accepted: held, cutoff, trace };
}
