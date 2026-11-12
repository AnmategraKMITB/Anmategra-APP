import { type PresetId, type WizardState } from './model';

export type Preset = {
  id: Exclude<PresetId, 'custom'>;
  title: string;
  example: string;
  blurb: string;
  patch: Partial<WizardState>;
};

/** Tiga preset setup; hanya mengisi pengaturan, bukan organogram atau tanggal. */
export const PRESETS: Preset[] = [
  {
    id: 'besar',
    title: 'Kepanitiaan besar',
    example: 'OSKM, KAT',
    blurb:
      'Banyak divisi, pendaftaran bergelombang, penilaian ketua divisi dan penilai umum.',
    patch: {
      useWaves: true,
      waves: [
        { label: '1', startsAt: '', endsAt: '' },
        { label: '2', startsAt: '', endsAt: '' },
      ],
      minChoices: 1,
      maxChoices: 3,
      allowRedirect: true,
      attachments: ['CV', 'Portofolio', 'Surat izin'],
      grouping: 'per_divisi',
      rubrics: 'keduanya',
      scoringMode: 'skor',
      statusMethod: 'peringkat_kuota_minimum',
      scoreSource: 'gabungan',
      assessors: 'keduanya',
      generalAssessorUnitId: null,
      hasGugur: true,
      veto: true,
      staged: true,
      visibility: 'tidak',
      resultsAccess: 'admin_ketua',
      releaseToApplicants: true,
      closerec: true,
      criteria: {},
    },
  },
  {
    id: 'ami',
    title: 'Acara dengan penilai ketua divisi',
    example: 'AMI',
    blurb:
      'Satu hingga dua pilihan divisi, rubrik per divisi, tanpa gelombang pendaftaran.',
    patch: {
      useWaves: false,
      waves: [],
      minChoices: 1,
      maxChoices: 2,
      allowRedirect: false,
      attachments: ['CV'],
      grouping: 'per_divisi',
      rubrics: 'divisi',
      scoringMode: 'skor',
      statusMethod: 'peringkat_kuota',
      scoreSource: 'divisi',
      assessors: 'ketua',
      generalAssessorUnitId: null,
      hasGugur: false,
      veto: true,
      staged: true,
      visibility: 'tidak',
      resultsAccess: 'admin_ketua',
      releaseToApplicants: true,
      closerec: true,
      criteria: {},
    },
  },
  {
    id: 'himpunan',
    title: 'Staf himpunan atau badan',
    example: 'Himpunan, UKM',
    blurb: 'Satu pilihan, rubrik umum, keputusan cepat untuk oprec kecil.',
    patch: {
      useWaves: false,
      waves: [],
      minChoices: 1,
      maxChoices: 1,
      allowRedirect: true,
      attachments: ['CV', 'Transkrip'],
      grouping: 'satu_bagian',
      rubrics: 'umum',
      scoringMode: 'skor',
      statusMethod: 'peringkat_kuota',
      scoreSource: 'umum',
      assessors: 'ketua',
      generalAssessorUnitId: null,
      hasGugur: false,
      veto: true,
      staged: true,
      visibility: 'tidak',
      resultsAccess: 'admin_ketua',
      releaseToApplicants: true,
      closerec: false,
      criteria: {
        umum: [
          { name: 'Motivasi', kind: 'skor', weight: 40 },
          { name: 'Komitmen', kind: 'skor', weight: 30 },
          { name: 'Komunikasi', kind: 'skor', weight: 30 },
        ],
      },
    },
  },
];

export function presetLabel(id: PresetId | null): string {
  if (id === null) return 'Belum dipilih';
  if (id === 'custom') return 'Atur sendiri';
  return PRESETS.find((preset) => preset.id === id)?.title ?? 'Atur sendiri';
}

export function presetHighlights(preset: Preset): string[] {
  const p = preset.patch;
  return [
    p.maxChoices === 1 ? '1 pilihan' : `${p.maxChoices ?? 3} pilihan`,
    p.useWaves ? 'bergelombang' : 'tanpa gelombang',
    p.rubrics === 'keduanya'
      ? 'rubrik umum + divisi'
      : p.rubrics === 'divisi'
        ? 'rubrik divisi'
        : 'rubrik umum',
    p.assessors === 'keduanya' ? 'ketua divisi + penilai umum' : 'ketua divisi',
  ];
}
