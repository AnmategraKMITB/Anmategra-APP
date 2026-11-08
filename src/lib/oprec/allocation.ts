/**
 * Aturan alokasi penempatan oprec, murni tanpa akses basis data.
 *
 * Tahap pilihan diturunkan, bukan disimpan: pilihan ke-n aktif bila semua
 * pilihan sebelumnya ditolak atau berstatus efektif `tidak_lolos`. Begitu satu
 * pilihan diterima, pilihan lain tertutup. Kuota dibaca dari posisi divisi
 * (0 = tanpa batas) dan tidak pernah memblokir; menerima melewati kuota cukup
 * dikonfirmasi.
 */

export type ChoiceStage = 'aktif' | 'menunggu' | 'tertutup';

export type StageReason =
  | 'siap'
  | 'menunggu_pilihan_sebelumnya'
  | 'ditolak'
  | 'tidak_lolos'
  | 'diterima_di_lain';

export type Decision = 'terima' | 'tolak';

export type StageStatus =
  | 'lolos'
  | 'tidak_lolos'
  | 'belum_lengkap'
  | 'perlu_ditinjau'
  | null;

export type StageInput = {
  id: string;
  rank: number | null;
  /** Status efektif pilihan (override aktif sudah diterapkan). */
  status: StageStatus;
  decision: Decision | null;
};

export type StageResult = {
  stage: ChoiceStage;
  reason: StageReason;
};

/** Rank kosong (dialihkan/closerec) diletakkan setelah pilihan bernomor. */
function ordered(choices: readonly StageInput[]): StageInput[] {
  return [...choices].sort((a, b) => {
    if (a.rank === null && b.rank === null) return a.id.localeCompare(b.id);
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.id.localeCompare(b.id);
  });
}

export function deriveChoiceStage(
  choices: readonly StageInput[],
): Map<string, StageResult> {
  const sorted = ordered(choices);
  const result = new Map<string, StageResult>();
  const accepted = sorted.find((choice) => choice.decision === 'terima');

  if (accepted) {
    for (const choice of sorted) {
      result.set(
        choice.id,
        choice.id === accepted.id
          ? { stage: 'aktif', reason: 'siap' }
          : { stage: 'tertutup', reason: 'diterima_di_lain' },
      );
    }
    return result;
  }

  // Belum ada penerimaan: pilihan pertama yang tidak ditolak/tidak lolos aktif.
  let open = true;
  for (const choice of sorted) {
    const rejected = choice.decision === 'tolak';
    const failed = choice.status === 'tidak_lolos';
    if (open && !rejected && !failed) {
      result.set(choice.id, { stage: 'aktif', reason: 'siap' });
      open = false;
    } else if (open) {
      result.set(choice.id, {
        stage: 'tertutup',
        reason: rejected ? 'ditolak' : 'tidak_lolos',
      });
    } else {
      result.set(choice.id, {
        stage: 'menunggu',
        reason: 'menunggu_pilihan_sebelumnya',
      });
    }
  }
  return result;
}

export function acceptedChoiceId(
  choices: readonly StageInput[],
): string | null {
  return choices.find((choice) => choice.decision === 'terima')?.id ?? null;
}

/**
 * Jumlah penerimaan aktif sebuah divisi. Penempatan closerec tidak dihitung
 * ke kuota.
 */
export function acceptedCount(
  decisions: readonly {
    divisionId: string;
    decision: Decision;
    origin: string;
  }[],
  divisionId: string,
): number {
  return decisions.filter(
    (row) =>
      row.divisionId === divisionId &&
      row.decision === 'terima' &&
      row.origin !== 'closerec',
  ).length;
}

/** `null` = tanpa batas (kuota 0). Negatif berarti sudah melewati kuota. */
export function remainingQuota(
  quota: number,
  accepted: number,
): number | null {
  return quota === 0 ? null : quota - accepted;
}

export type AutofillChoice = StageInput & {
  applicationId: string;
  divisionId: string;
  score: number | null;
};

export type AutofillDivision = {
  divisionId: string;
  terima: number;
  tolak: number;
  dilewati: number;
  remaining: number | null;
};

export type AutofillPlan = {
  terima: string[];
  tolak: string[];
  dilewati: string[];
  overQuotaApplied: number;
  perDivision: AutofillDivision[];
};

/**
 * Rencana pengisian keputusan dari status efektif. Hanya mengisi sel aktif yang
 * belum diputuskan: `lolos` menjadi terima, `tidak_lolos` menjadi tolak,
 * sisanya dilewati. Tidak pernah menimpa keputusan yang sudah ada.
 *
 * Bila penerimaan melebihi sisa kuota: `masukkan` menerima semuanya,
 * `tolak` menolak yang melebihi (skor tertinggi didahulukan).
 */
export function planAutofill(input: {
  choices: readonly AutofillChoice[];
  quotaByDivision: ReadonlyMap<string, number>;
  acceptedByDivision: ReadonlyMap<string, number>;
  existing?: ReadonlyMap<string, Decision>;
  overQuota?: 'masukkan' | 'tolak';
}): AutofillPlan {
  const overQuota = input.overQuota ?? 'tolak';
  const existing = input.existing ?? new Map<string, Decision>();

  const byApplication = new Map<string, AutofillChoice[]>();
  for (const choice of input.choices) {
    byApplication.set(choice.applicationId, [
      ...(byApplication.get(choice.applicationId) ?? []),
      choice,
    ]);
  }

  const terima: AutofillChoice[] = [];
  const tolak: AutofillChoice[] = [];
  const dilewati: AutofillChoice[] = [];

  for (const choices of byApplication.values()) {
    const stages = deriveChoiceStage(choices);
    for (const choice of choices) {
      const stage = stages.get(choice.id);
      if (existing.has(choice.id)) {
        dilewati.push(choice);
      } else if (
        choice.status === 'tidak_lolos' &&
        (stage?.stage === 'aktif' || stage?.reason === 'tidak_lolos')
      ) {
        // Pilihan yang sudah gagal ditulis eksplisit sebagai tolak, kecuali
        // pilihan yang tertutup karena ada penerimaan di pilihan lain.
        tolak.push(choice);
      } else if (stage?.stage === 'aktif' && choice.status === 'lolos') {
        terima.push(choice);
      } else {
        dilewati.push(choice);
      }
    }
  }

  let overQuotaApplied = 0;
  const byDivision = new Map<string, AutofillChoice[]>();
  for (const choice of terima) {
    byDivision.set(choice.divisionId, [
      ...(byDivision.get(choice.divisionId) ?? []),
      choice,
    ]);
  }

  for (const [divisionId, candidates] of byDivision) {
    const quota = input.quotaByDivision.get(divisionId) ?? 0;
    const accepted = input.acceptedByDivision.get(divisionId) ?? 0;
    const available =
      quota === 0
        ? Number.POSITIVE_INFINITY
        : Math.max(0, quota - accepted);
    if (candidates.length <= available) continue;

    if (overQuota === 'masukkan') {
      overQuotaApplied += candidates.length - available;
      continue;
    }

    const ranked = [...candidates].sort((a, b) => {
      const scoreA = a.score ?? Number.NEGATIVE_INFINITY;
      const scoreB = b.score ?? Number.NEGATIVE_INFINITY;
      if (scoreA !== scoreB) return scoreB - scoreA;
      const rankA = a.rank ?? Number.POSITIVE_INFINITY;
      const rankB = b.rank ?? Number.POSITIVE_INFINITY;
      if (rankA !== rankB) return rankA - rankB;
      return a.id.localeCompare(b.id);
    });
    byDivision.set(
      divisionId,
      Number.isFinite(available) ? ranked.slice(0, available) : ranked,
    );
  }

  const divisionOf = new Map(
    input.choices.map((choice) => [choice.id, choice.divisionId]),
  );
  const divisionIds = new Set(input.choices.map((choice) => choice.divisionId));

  const finalTerima = new Set<string>();
  for (const candidates of byDivision.values()) {
    for (const choice of candidates) finalTerima.add(choice.id);
  }

  const terimaIds: string[] = [];
  const tolakIds: string[] = [];
  for (const choice of terima) {
    if (finalTerima.has(choice.id)) terimaIds.push(choice.id);
    else tolakIds.push(choice.id);
  }
  for (const choice of tolak) tolakIds.push(choice.id);
  const dilewatiIds = dilewati.map((choice) => choice.id);

  const countIn = (ids: string[], divisionId: string) =>
    ids.filter((id) => divisionOf.get(id) === divisionId).length;

  const perDivision = [...divisionIds]
    .sort((a, b) => a.localeCompare(b))
    .map((divisionId): AutofillDivision => {
      const quota = input.quotaByDivision.get(divisionId) ?? 0;
      const accepted = input.acceptedByDivision.get(divisionId) ?? 0;
      return {
        divisionId,
        terima: countIn(terimaIds, divisionId),
        tolak: countIn(tolakIds, divisionId),
        dilewati: countIn(dilewatiIds, divisionId),
        remaining: quota === 0 ? null : Math.max(0, quota - accepted),
      };
    });

  return {
    terima: terimaIds,
    tolak: tolakIds,
    dilewati: dilewatiIds,
    overQuotaApplied,
    perDivision,
  };
}
