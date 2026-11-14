import { type RouterInputs, type RouterOutputs } from '~/trpc/react';

import {
  type RuleDraft,
  type StepId,
  type WizardCtx,
  type WizardState,
  defaultState,
  ruleValue,
  stepProblem,
} from '../wizard/model';

export type OprecDetail = RouterOutputs['oprec']['get'];
type SettingsPatch = RouterInputs['oprec']['update']['settings'];
type WaveInput = RouterInputs['oprec']['replaceWaves']['waves'][number];
type EligibilityInput = Omit<
  RouterInputs['oprec']['replaceEligibility'],
  'recruitmentId'
>;

/** Pengaturan yang tidak ditanyakan wizard, tetapi berlaku di server. */
export type SettingsExtra = {
  statusMinScore: number;
  weightUmum: number;
  minReviewers: number;
  blind: boolean;
  allowEarlyAssessment: boolean;
};

export type SettingsDraft = { s: WizardState; x: SettingsExtra };

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → isian `datetime-local` (waktu lokal browser), mis. "2026-03-01T08:00". */
export function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Nilai syarat tersimpan (angka, teks, atau daftar) → isian teks wizard. */
const ruleText = (value: unknown): string =>
  Array.isArray(value)
    ? value.map(ruleText).join(', ')
    : typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ? String(value)
      : '';

/** Isian Pengaturan dari oprec tersimpan, memakai bentuk jawaban wizard. */
export function draftFromDetail(d: OprecDetail): SettingsDraft {
  const rubrics = (d.setupAnswers as { rubrics?: unknown } | null)?.rubrics;
  const s: WizardState = {
    ...defaultState('', d.periodId),
    name: d.name,
    divisions: Object.fromEntries(
      d.divisions.map((v) => [
        v.unitId,
        { positionId: v.positionId, sourcePeriodId: d.periodId },
      ]),
    ),
    useWaves: d.waves.length > 0,
    waves: d.waves.map((w) => ({
      id: w.id,
      label: w.label,
      startsAt: toLocalInput(w.startsAt),
      endsAt: toLocalInput(w.endsAt),
    })),
    eligibility: {
      enabled: d.eligibilityRules.length > 0,
      match: d.eligibilityMatch,
      rules: d.eligibilityRules.map((r) => ({
        attribute: r.attribute as RuleDraft['attribute'],
        op: r.op as RuleDraft['op'],
        value: ruleText(r.value),
      })),
    },
    minChoices: d.minChoices,
    maxChoices: d.maxChoices,
    allowRedirect: d.allowRedirect,
    rubrics: rubrics === 'divisi' || rubrics === 'umum' ? rubrics : 'keduanya',
    scoringMode: d.scoringMode,
    statusMethod: d.statusMethod,
    scoreSource: d.scoreSource,
    assessors: d.assessorMode,
    hasGugur: d.hasGugur,
    veto: d.headDecides,
    staged: d.stagedPlacement,
    visibility: d.visibilityDefault ? 'ya' : 'tidak',
    resultsAccess: d.resultsAccess,
    releaseToApplicants: d.resultsVisibleToApplicants,
    closerec: d.closerecEnabled,
  };
  return {
    s,
    x: {
      statusMinScore: d.statusMinScore,
      weightUmum: d.weightUmum,
      minReviewers: d.minReviewers,
      blind: d.blind,
      allowEarlyAssessment: d.allowEarlyAssessment,
    },
  };
}

function settingsOf({ s, x }: SettingsDraft): Required<SettingsPatch> {
  return {
    name: s.name.trim(),
    minChoices: s.minChoices,
    maxChoices: s.maxChoices,
    allowRedirect: s.allowRedirect,
    scoringMode: s.scoringMode,
    statusMethod: s.statusMethod,
    statusMinScore: x.statusMinScore,
    scoreSource: s.scoreSource,
    weightUmum: x.weightUmum,
    minReviewers: x.minReviewers,
    blind: x.blind,
    allowEarlyAssessment: x.allowEarlyAssessment,
    visibilityDefault: s.visibility === 'ya',
    resultsVisibleToApplicants: s.releaseToApplicants,
    assessorMode: s.assessors,
    hasGugur: s.hasGugur,
    headDecides: s.veto,
    stagedPlacement: s.staged,
    resultsAccess: s.resultsAccess,
    closerecEnabled: s.closerec,
  };
}

const wavesOf = (s: WizardState): WaveInput[] =>
  s.useWaves
    ? s.waves.map((w) => ({
        ...(w.id ? { id: w.id } : {}),
        label: w.label.trim(),
        startsAt: new Date(w.startsAt),
        endsAt: new Date(w.endsAt),
      }))
    : [];

const eligibilityOf = (
  s: WizardState,
  lembagaId: string | null,
): EligibilityInput => ({
  match: s.eligibility.match,
  rules: s.eligibility.enabled
    ? s.eligibility.rules.map((r) => {
        const v = ruleValue(r, lembagaId);
        return { attribute: r.attribute, op: r.op, value: v.ok ? v.value : '' };
      })
    : [],
});

/** Hanya bagian yang berubah dari isian awal; `null` = bagian itu tidak dikirim. */
export function changesOf(
  initial: SettingsDraft,
  current: SettingsDraft,
  lembagaId: string | null,
) {
  const before = settingsOf(initial);
  const after = settingsOf(current);
  const settings = Object.fromEntries(
    Object.entries(after).filter(
      ([k, v]) => before[k as keyof typeof before] !== v,
    ),
  ) as SettingsPatch;
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  const waves = same(wavesOf(initial.s), wavesOf(current.s))
    ? null
    : wavesOf(current.s);
  const eligibility = same(
    eligibilityOf(initial.s, lembagaId),
    eligibilityOf(current.s, lembagaId),
  )
    ? null
    : eligibilityOf(current.s, lembagaId);
  return {
    settings: Object.keys(settings).length > 0 ? settings : null,
    waves,
    eligibility,
  };
}

/** Langkah wizard yang ikut dicek sebelum menyimpan Pengaturan. */
const CHECKED_STEPS: StepId[] = ['S1', 'S4', 'S5', 'S6'];

const intIn = (n: number, min: number, max: number) =>
  Number.isInteger(n) && n >= min && n <= max;

/** Pesan masalah pertama pada isian, atau null bila boleh disimpan. */
export function draftProblem(d: SettingsDraft, c: WizardCtx): string | null {
  for (const id of CHECKED_STEPS) {
    const problem = stepProblem(id, d.s, c);
    if (problem) return problem;
  }
  if (!intIn(d.x.statusMinScore, 0, 100))
    return 'Nilai minimum berupa bilangan bulat 0 sampai 100.';
  if (!intIn(d.x.weightUmum, 0, 100))
    return 'Bobot nilai umum berupa bilangan bulat 0 sampai 100.';
  if (!intIn(d.x.minReviewers, 1, 5))
    return 'Jumlah penilai minimum berupa bilangan bulat 1 sampai 5.';
  return null;
}
