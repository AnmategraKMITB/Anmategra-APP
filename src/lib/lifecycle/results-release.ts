import { defineLifecycle } from './define';

export type ResultsReleaseState = 'belum_dirilis' | 'dirilis';

/**
 * Rilis hasil oprec, diturunkan dari `recruitment.resultsReleasedAt`. Yang
 * ditulis adalah timestamp, jadi router memakai `assertMove` saja. Rilis saat
 * masa banding sah (hasil sementara); hanya penempatan berjalan yang menolak.
 */
export const resultsReleaseLifecycle = defineLifecycle<
  ResultsReleaseState,
  { placementState: 'berjalan' | 'masa_banding' | 'final' }
>({
  name: 'rilis hasil',
  states: ['belum_dirilis', 'dirilis'],
  moves: {
    belum_dirilis: {
      dirilis: {
        when: 'penempatan tidak berjalan',
        guard: (ctx) =>
          ctx.placementState === 'berjalan'
            ? {
                code: 'CONFLICT',
                message:
                  'Buka masa banding atau tetapkan final sebelum merilis hasil.',
              }
            : null,
      },
    },
    dirilis: { belum_dirilis: {} },
  },
  // Rilis ulang dan tarik ulang. Hasil dirilis tidak pernah bersamaan dengan
  // penempatan berjalan (placementLifecycle menolaknya), jadi urutan pesan
  // lama tetap terjaga tanpa melihat ctx.
  illegal: (from) => ({
    code: 'CONFLICT',
    message:
      from === 'dirilis' ? 'Hasil sudah dirilis.' : 'Hasil belum dirilis.',
  }),
});

export function releaseStateOf(
  resultsReleasedAt: Date | null,
): ResultsReleaseState {
  return resultsReleasedAt === null ? 'belum_dirilis' : 'dirilis';
}
