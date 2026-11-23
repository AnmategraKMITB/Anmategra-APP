import { defineLifecycle } from './define';

export type OprecStatus = 'draft' | 'open' | 'closed';
type FormStatus = 'Draft' | 'Published' | 'Closed';

const open = { when: 'pengaturan lengkap', guard: readyToOpen };
const backToDraft = { when: 'belum ada pendaftar', guard: noApplications };

/**
 * Status oprec. Membuka mensyaratkan pengaturan lengkap (`openProblems` dari
 * `oprecOpenProblems`); kembali ke draf mensyaratkan belum ada pendaftar.
 * Status form yang terikat bergerak bersama lewat `formStatusForOprec` dan
 * `oprecStatusForForm`.
 */
export const oprecLifecycle = defineLifecycle<
  OprecStatus,
  { openProblems: string[]; applications: number }
>({
  name: 'oprec',
  states: ['draft', 'open', 'closed'],
  moves: {
    draft: { open: open, closed: {} },
    open: { draft: backToDraft, closed: {} },
    closed: { open: open, draft: backToDraft },
  },
  // Semua pasangan berbeda sah; pesan ini hanya untuk jaga-jaga.
  illegal: (from, to) => ({
    code: 'BAD_REQUEST',
    message: `Status oprec tidak dapat diubah dari ${from} ke ${to}.`,
  }),
});

function readyToOpen(ctx: { openProblems: string[] }) {
  const [problem] = ctx.openProblems;
  return problem ? ({ code: 'CONFLICT', message: problem } as const) : null;
}

function noApplications(ctx: { applications: number }) {
  return ctx.applications > 0
    ? ({
        code: 'CONFLICT',
        message: 'Oprec yang sudah punya pendaftar tidak bisa kembali ke draf.',
      } as const)
    : null;
}

export function formStatusForOprec(status: OprecStatus): FormStatus {
  return status === 'open'
    ? 'Published'
    : status === 'closed'
      ? 'Closed'
      : 'Draft';
}

export function oprecStatusForForm(status: FormStatus): OprecStatus {
  return status === 'Published'
    ? 'open'
    : status === 'Closed'
      ? 'closed'
      : 'draft';
}
