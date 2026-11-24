import { defineLifecycle } from './define';

/**
 * Permintaan pindah divisi selama masa banding. Hanya `diminta` yang punya
 * perpindahan keluar; keputusan apa pun bersifat akhir.
 */
export const transferLifecycle = defineLifecycle<
  'diminta' | 'disetujui' | 'ditolak' | 'dibatalkan'
>({
  name: 'permintaan pindah',
  states: ['diminta', 'disetujui', 'ditolak', 'dibatalkan'],
  moves: {
    diminta: { disetujui: {}, ditolak: {}, dibatalkan: {} },
    disetujui: {},
    ditolak: {},
    dibatalkan: {},
  },
  illegal: () => ({
    code: 'BAD_REQUEST',
    message: 'Permintaan ini sudah diputuskan.',
  }),
});
