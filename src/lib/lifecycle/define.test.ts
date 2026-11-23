import { describe, expect, it } from 'vitest';

import { check, defineLifecycle, nextMoves } from './define';

const door = defineLifecycle<
  'tertutup' | 'terbuka' | 'terkunci',
  { kunci: boolean }
>({
  name: 'pintu',
  states: ['tertutup', 'terbuka', 'terkunci'],
  moves: {
    tertutup: {
      terbuka: {
        guard: (ctx) =>
          ctx.kunci ? { code: 'CONFLICT', message: 'Pintu terkunci.' } : null,
      },
      terkunci: {},
    },
    terbuka: { tertutup: {} },
    terkunci: { tertutup: {} },
  },
  illegal: (from, to) => ({
    code: 'BAD_REQUEST',
    message: `Pintu tidak bisa dari ${from} ke ${to}.`,
  }),
});

describe('check', () => {
  it('mengizinkan perpindahan yang dideklarasikan', () => {
    expect(check(door, 'terbuka', 'tertutup', { kunci: false })).toEqual({
      ok: true,
    });
  });

  it('menolak perpindahan yang tidak dideklarasikan dengan pesan illegal', () => {
    expect(check(door, 'terbuka', 'terkunci', { kunci: false })).toEqual({
      ok: false,
      code: 'BAD_REQUEST',
      message: 'Pintu tidak bisa dari terbuka ke terkunci.',
    });
  });

  it('meneruskan penolakan dari guard', () => {
    expect(check(door, 'tertutup', 'terbuka', { kunci: true })).toEqual({
      ok: false,
      code: 'CONFLICT',
      message: 'Pintu terkunci.',
    });
  });
});

describe('nextMoves', () => {
  it('mendaftar perpindahan keluar beserta alasan yang menolaknya', () => {
    expect(nextMoves(door, 'tertutup', { kunci: true })).toEqual([
      { to: 'terbuka', enabled: false, reason: 'Pintu terkunci.' },
      { to: 'terkunci', enabled: true },
    ]);
  });
});
