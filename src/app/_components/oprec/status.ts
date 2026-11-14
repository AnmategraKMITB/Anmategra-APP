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
 * Langkah status berikutnya untuk pengelola: Draf → Dibuka → Ditutup, dan
 * Ditutup → Dibuka lagi (perpanjangan). `confirm` = minta konfirmasi dulu.
 */
export const STATUS_ACTION = {
  draft: {
    to: 'open',
    label: 'Buka pendaftaran',
    pending: 'Membuka…',
    confirm: null,
  },
  open: {
    to: 'closed',
    label: 'Tutup pendaftaran',
    pending: 'Menutup…',
    confirm:
      'Formulir berhenti menerima jawaban. Pendaftar tanpa gelombang mulai bisa dinilai di tab Nilai. Pendaftaran bisa dibuka lagi kapan saja.',
  },
  closed: {
    to: 'open',
    label: 'Buka lagi pendaftaran',
    pending: 'Membuka…',
    confirm:
      'Formulir kembali menerima jawaban. Bila oprec memakai gelombang, pastikan ada gelombang yang sedang berjalan di Pengaturan.',
  },
} as const satisfies Record<
  'draft' | 'open' | 'closed',
  {
    to: 'draft' | 'open' | 'closed';
    label: string;
    pending: string;
    confirm: string | null;
  }
>;

/**
 * Judul gelombang dari labelnya (L-01). Label disimpan polos ("1", "3.1"),
 * tetapi data lama bisa berisi "Gelombang 1"; awalan ganda dibuang.
 */
export const waveTitle = (label: string) =>
  `Gelombang ${label.trim().replace(/^gelombang\s+/i, '')}`;

/**
 * Tab Penempatan terkunci sampai pendaftaran ditutup atau ada minimal satu
 * pendaftar (#346). Mengembalikan alasan, atau null bila terbuka.
 */
export const placementLockReason = (
  status: 'draft' | 'open' | 'closed',
  applicantCount: number,
) =>
  status === 'closed' || applicantCount > 0
    ? null
    : 'Terkunci sampai pendaftaran ditutup atau ada minimal satu pendaftar.';
