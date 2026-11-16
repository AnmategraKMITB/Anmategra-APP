import { describe, expect, it } from 'vitest';

import { moveTo, parsePosition, remove, shift } from './order';

describe('urutan prioritas', () => {
  const order = ['a', 'b', 'c', 'd', 'e'];

  it('ketik 2 lalu Enter: pindah ke urutan 2, sisanya bergeser', () => {
    expect(moveTo(order, 'e', 2)).toEqual(['a', 'e', 'b', 'c', 'd']);
    expect(moveTo(order, 'a', 4)).toEqual(['b', 'c', 'd', 'a', 'e']);
  });

  it('angka di luar rentang dijepit; orang baru disisipkan', () => {
    expect(moveTo(order, 'c', 99)).toEqual(['a', 'b', 'd', 'e', 'c']);
    expect(moveTo(order, 'c', 0)).toEqual(['c', 'a', 'b', 'd', 'e']);
    expect(moveTo(order, 'x', 3)).toEqual(['a', 'b', 'x', 'c', 'd', 'e']);
  });

  it('PgUp/PgDn menggeser 1, Shift 10, berhenti di ujung', () => {
    expect(shift(order, 'c', -1)).toEqual(['a', 'c', 'b', 'd', 'e']);
    expect(shift(order, 'c', 1)).toEqual(['a', 'b', 'd', 'c', 'e']);
    expect(shift(order, 'c', -10)).toEqual(['c', 'a', 'b', 'd', 'e']);
    expect(shift(order, 'c', 10)).toEqual(['a', 'b', 'd', 'e', 'c']);
    expect(shift(order, 'x', 1)).toEqual(order);
  });

  it('Delete mengeluarkan dari urutan', () => {
    expect(remove(order, 'b')).toEqual(['a', 'c', 'd', 'e']);
  });

  it('isian angka: kosong, angka, atau tidak sah', () => {
    expect(parsePosition('  ')).toBeNull();
    expect(parsePosition('7')).toBe(7);
    expect(parsePosition('0')).toBe('invalid');
    expect(parsePosition('2a')).toBe('invalid');
  });
});
