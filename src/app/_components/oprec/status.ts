export const RECRUITMENT_STATUS_LABEL = {
  draft: 'Draf',
  open: 'Dibuka',
  closed: 'Ditutup',
} as const;

export const RECRUITMENT_STATUS_STYLE = {
  draft: 'bg-neutral-200 text-neutral-700',
  open: 'bg-success-light text-success-dark',
  closed: 'bg-warning-light text-neutral-1000',
} as const;

export type OprecBase = '/lembaga' | '/mahasiswa';

export const pendaftarHref = (
  base: OprecBase,
  kegiatanId: string,
  recruitmentId: string,
) => `${base}/kegiatan/${kegiatanId}/oprec/${recruitmentId}/pendaftar`;
