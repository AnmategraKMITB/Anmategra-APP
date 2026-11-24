import { defineLifecycle } from './define';

/**
 * Keadaan penempatan oprec. Syarat menuju final yang butuh konfirmasi
 * (permintaan pindah terbuka, kuota terlampaui) tetap di router karena
 * dijawab dengan `{ success: false }`, bukan galat.
 */
export const placementLifecycle = defineLifecycle<
  'berjalan' | 'masa_banding' | 'final',
  { resultsReleased: boolean }
>({
  name: 'penempatan',
  states: ['berjalan', 'masa_banding', 'final'],
  moves: {
    berjalan: { masa_banding: {} },
    masa_banding: {
      berjalan: {
        when: 'hasil belum dirilis',
        guard: (ctx) =>
          ctx.resultsReleased
            ? {
                code: 'CONFLICT',
                message:
                  'Tarik rilis hasil dulu sebelum mengembalikan penempatan ke berjalan.',
              }
            : null,
      },
      final: {},
    },
    final: { masa_banding: {} },
  },
  illegal: (_from, to) => ({
    code: 'BAD_REQUEST',
    message:
      to === 'final'
        ? 'Menuju final harus lewat masa banding.'
        : 'Perpindahan keadaan penempatan itu tidak diizinkan.',
  }),
});
