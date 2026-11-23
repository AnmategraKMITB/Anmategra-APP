// Data contoh bersama untuk simulasi oprec: pendaftar, pilihan, dan skornya.
import { type PillTone } from '../ui';

export type ChoiceStatus =
  'lolos' | 'tidak_lolos' | 'perlu_ditinjau' | 'belum_lengkap' | 'gugur';

export const STATUS_LABEL: Record<ChoiceStatus, string> = {
  lolos: 'Lolos',
  tidak_lolos: 'Tidak lolos',
  perlu_ditinjau: 'Perlu ditinjau',
  belum_lengkap: 'Belum lengkap',
  gugur: 'Gugur',
};

export const STATUS_TONE: Record<ChoiceStatus, PillTone> = {
  lolos: 'success',
  tidak_lolos: 'danger',
  perlu_ditinjau: 'warning',
  belum_lengkap: 'neutral',
  gugur: 'danger',
};

export type Applicant = {
  id: string;
  name: string;
  nim: string;
  angkatan: number;
  prodi: string;
  wave: string;
  sentAt: string;
  willing: boolean;
  /** Pilihan berurutan: id divisi, skor (0-100) dan status hitungannya. */
  choices: { division: string; score: number | null; status: ChoiceStatus }[];
  flag?: string;
  answers: [string, string][];
};

export const APPLICANTS: Applicant[] = [
  {
    id: 'a1',
    name: 'Raka Pradipta',
    nim: '13524011',
    angkatan: 2024,
    prodi: 'Teknik Informatika',
    wave: '1',
    sentAt: '3 Nov 2026 19.42',
    willing: true,
    choices: [
      { division: 'acara', score: 88, status: 'lolos' },
      { division: 'publikasi', score: 71, status: 'tidak_lolos' },
    ],
    answers: [
      [
        'Kenapa kamu pengen jadi panitia AMI?',
        'pengen ngerasain nyambut ribuan maba dari belakang panggung.',
      ],
      [
        'Ceritain pengalaman kamu ngurus acara dong!',
        'Menyusun rundown malam keakraban angkatan untuk 180 peserta.',
      ],
      ['Link CV kamu', 'drive.google.com/…/cv-raka'],
    ],
  },
  {
    id: 'a2',
    name: 'Nadia Kusumawardhani',
    nim: '18224032',
    angkatan: 2024,
    prodi: 'Sistem dan Teknologi Informasi',
    wave: '1',
    sentAt: '3 Nov 2026 21.05',
    willing: false,
    choices: [
      { division: 'publikasi', score: 91, status: 'lolos' },
      { division: 'acara', score: 80, status: 'tidak_lolos' },
    ],
    flag: 'Prioritas',
    answers: [
      [
        'Kenapa kamu pengen jadi panitia AMI?',
        'Biar karya desainku dilihat seluruh maba ITB.',
      ],
      ['Link portofolio desainmu', 'behance.net/nadiakw'],
      ['Link CV kamu', 'drive.google.com/…/cv-nadia'],
    ],
  },
  {
    id: 'a3',
    name: 'Bima Arya Setiadi',
    nim: '13224057',
    angkatan: 2024,
    prodi: 'Teknik Elektro',
    wave: '1',
    sentAt: '4 Nov 2026 08.15',
    willing: true,
    choices: [
      { division: 'acara', score: 76, status: 'tidak_lolos' },
      { division: 'logistik', score: 84, status: 'lolos' },
    ],
    answers: [
      [
        'Kenapa kamu pengen jadi panitia AMI?',
        'Suka pekerjaan lapangan dan ingin kenal banyak orang.',
      ],
      [
        'Ceritain pengalaman kamu ngurus acara dong!',
        'Belum pernah, tetapi pernah jadi stage crew.',
      ],
      ['Link CV kamu', 'drive.google.com/…/cv-bima'],
    ],
  },
  {
    id: 'a4',
    name: 'Laras Ayuningtyas',
    nim: '15523018',
    angkatan: 2023,
    prodi: 'Teknik Sipil',
    wave: '2',
    sentAt: '9 Nov 2026 13.30',
    willing: true,
    choices: [
      { division: 'acara', score: 82, status: 'lolos' },
      { division: 'danus', score: null, status: 'belum_lengkap' },
    ],
    answers: [
      [
        'Kenapa kamu pengen jadi panitia AMI?',
        'Tahun lalu jadi peserta AMI, sekarang gantian yang nyambut.',
      ],
      [
        'Ceritain pengalaman kamu ngurus acara dong!',
        'Koordinator acara lomba tingkat fakultas.',
      ],
      ['Link CV kamu', 'drive.google.com/…/cv-laras'],
    ],
  },
  {
    id: 'a5',
    name: 'Fajar Nugraha',
    nim: '10523044',
    angkatan: 2023,
    prodi: 'Kimia',
    wave: '2',
    sentAt: '9 Nov 2026 16.48',
    willing: false,
    choices: [
      { division: 'logistik', score: 67, status: 'perlu_ditinjau' },
      { division: 'acara', score: 58, status: 'tidak_lolos' },
    ],
    answers: [
      [
        'Kenapa kamu pengen jadi panitia AMI?',
        'Diajak teman dan ingin mencoba.',
      ],
      ['Link CV kamu', 'drive.google.com/…/cv-fajar'],
    ],
  },
  {
    id: 'a6',
    name: 'Citra Maharani',
    nim: '19623009',
    angkatan: 2023,
    prodi: 'Manajemen',
    wave: '2',
    sentAt: '10 Nov 2026 09.02',
    willing: true,
    choices: [
      { division: 'danus', score: 90, status: 'lolos' },
      { division: 'publikasi', score: 74, status: 'tidak_lolos' },
    ],
    answers: [
      [
        'Kenapa kamu pengen jadi panitia AMI?',
        'pengen nyobain nego sponsor beneran, bukan cuma tugas kelas.',
      ],
      ['Link CV kamu', 'drive.google.com/…/cv-citra'],
    ],
  },
];
