import { defineLifecycle } from './define';

const backToDraft = {
  when: 'belum ada jawaban',
  guard: noSubmissions,
};

/**
 * Status formulir. Syarat terbit (isi pertanyaan) diperiksa terpisah oleh
 * `assertPublishable` karena menyangkut isi, bukan siklus hidup.
 */
export const formLifecycle = defineLifecycle<
  'Draft' | 'Published' | 'Closed',
  { submissions: number }
>({
  name: 'form',
  states: ['Draft', 'Published', 'Closed'],
  moves: {
    Draft: { Published: {} },
    Published: { Closed: {}, Draft: backToDraft },
    Closed: { Published: {}, Draft: backToDraft },
  },
  illegal: (from, to) => ({
    code: 'BAD_REQUEST',
    message: `Status formulir tidak dapat diubah dari ${from} ke ${to}.`,
  }),
});

function noSubmissions(ctx: { submissions: number }) {
  return ctx.submissions > 0
    ? ({
        code: 'CONFLICT',
        message:
          'Formulir yang sudah memiliki jawaban tidak dapat dikembalikan ke Draft.',
      } as const)
    : null;
}
