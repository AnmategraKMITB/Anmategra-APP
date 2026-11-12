import { type AppBase } from '~/lib/app-base';

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

export type OprecBase = AppBase;

export const pendaftarHref = (
  base: OprecBase,
  kegiatanId: string,
  recruitmentId: string,
) => `${base}/kegiatan/${kegiatanId}/oprec/${recruitmentId}/pendaftar`;

/** Tombol Buka pendaftaran hanya berlaku untuk oprec yang masih Draf. */
export const canOpenRegistration = (status: 'draft' | 'open' | 'closed') =>
  status === 'draft';

/**
 * Judul gelombang dari labelnya (L-01). Label disimpan polos ("1", "3.1"),
 * tetapi data lama bisa berisi "Gelombang 1"; awalan ganda dibuang.
 */
export const waveTitle = (label: string) =>
  `Gelombang ${label.trim().replace(/^gelombang\s+/i, '')}`;
