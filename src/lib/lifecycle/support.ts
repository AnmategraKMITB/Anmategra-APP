import { type Move, defineLifecycle } from './define';

type SupportStatus =
  | 'Open'
  | 'In Progress'
  | 'Resolved'
  | 'Closed'
  | 'Draft'
  | 'Backlog'
  | 'Reported';

const STATES: readonly SupportStatus[] = [
  'Open',
  'In Progress',
  'Resolved',
  'Closed',
  'Draft',
  'Backlog',
  'Reported',
];

/**
 * Urutan papan laporan; status hanya boleh maju, boleh melompat. Status lama
 * di luar urutan (Open, Closed, Backlog) tidak dibatasi ke arah mana pun,
 * sama dengan perilaku sebelum siklus hidup ini dideklarasikan.
 */
const RANK: Partial<Record<SupportStatus, number>> = {
  Draft: 0,
  Reported: 1,
  'In Progress': 2,
  Resolved: 3,
};

function forward(from: SupportStatus, to: SupportStatus) {
  const a = RANK[from];
  const b = RANK[to];
  return a === undefined || b === undefined || b >= a;
}

export const supportLifecycle = defineLifecycle<SupportStatus>({
  name: 'laporan',
  states: STATES,
  moves: Object.fromEntries(
    STATES.map((from) => [
      from,
      Object.fromEntries(
        STATES.filter((to) => to !== from && forward(from, to)).map((to) => [
          to,
          {} satisfies Move<void>,
        ]),
      ),
    ]),
  ) as Record<SupportStatus, Partial<Record<SupportStatus, Move<void>>>>,
  illegal: (from, to) => ({
    code: 'BAD_REQUEST',
    message: `Tidak dapat mengubah status laporan mundur dari ${from} ke ${to}`,
  }),
});
