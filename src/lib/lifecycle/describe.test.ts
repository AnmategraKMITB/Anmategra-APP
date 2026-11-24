import { describe, expect, it } from 'vitest';

import { defineLifecycle } from './define';
import { describeLifecycle, toMermaid } from './describe';
import { LIFECYCLES } from './index';

const door = defineLifecycle<'tertutup' | 'terbuka', { kunci: boolean }>({
  name: 'pintu',
  states: ['tertutup', 'terbuka'],
  moves: {
    tertutup: {
      terbuka: {
        when: 'tidak terkunci',
        guard: (ctx) =>
          ctx.kunci ? { code: 'CONFLICT', message: 'Pintu terkunci.' } : null,
      },
    },
    terbuka: { tertutup: {} },
  },
  illegal: () => ({ code: 'BAD_REQUEST', message: 'Tidak bisa.' }),
});

describe('describeLifecycle', () => {
  it('mendaftar keadaan dan perpindahan beserta syaratnya', () => {
    expect(describeLifecycle(door)).toEqual({
      name: 'pintu',
      states: ['tertutup', 'terbuka'],
      moves: [
        {
          from: 'tertutup',
          to: 'terbuka',
          guarded: true,
          when: 'tidak terkunci',
        },
        { from: 'terbuka', to: 'tertutup' },
      ],
    });
  });
});

describe('toMermaid', () => {
  it('menggambar diagram keadaan dengan syarat sebagai label', () => {
    expect(toMermaid(describeLifecycle(door))).toBe(
      [
        'stateDiagram-v2',
        '  tertutup --> terbuka: tidak terkunci',
        '  terbuka --> tertutup',
      ].join('\n'),
    );
  });
});

describe('toMermaid dengan nama keadaan berspasi', () => {
  it('memakai alias agar diagram tetap sah', () => {
    const board = defineLifecycle<'Draft' | 'In Progress'>({
      name: 'papan',
      states: ['Draft', 'In Progress'],
      moves: { Draft: { 'In Progress': {} }, 'In Progress': {} },
      illegal: () => ({ code: 'BAD_REQUEST', message: 'Tidak bisa.' }),
    });
    expect(toMermaid(describeLifecycle(board))).toBe(
      [
        'stateDiagram-v2',
        '  state "In Progress" as In_Progress',
        '  Draft --> In_Progress',
      ].join('\n'),
    );
  });
});

describe('LIFECYCLES', () => {
  it('setiap perpindahan bersyarat menjelaskan syaratnya', () => {
    for (const lifecycle of LIFECYCLES) {
      for (const move of lifecycle.moves.filter((m) => m.guarded)) {
        expect(
          move.when,
          `${lifecycle.name}: ${move.from}→${move.to}`,
        ).toBeTruthy();
      }
    }
  });

  it('nama siklus hidup unik', () => {
    const names = LIFECYCLES.map((l) => l.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
