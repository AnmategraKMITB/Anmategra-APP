import { describe, expect, it } from 'vitest';

import { pageCount, pageOf, pageSlice } from './pager';

describe('pager', () => {
  const rows = Array.from({ length: 23 }, (_, index) => index);

  it('menghitung jumlah halaman; 0 = semua dalam satu halaman', () => {
    expect(pageCount(23, 10)).toBe(3);
    expect(pageCount(20, 10)).toBe(2);
    expect(pageCount(0, 10)).toBe(1);
    expect(pageCount(23, 0)).toBe(1);
  });

  it('memotong baris sesuai halaman', () => {
    expect(pageSlice(rows, 1, 10)).toEqual(rows.slice(0, 10));
    expect(pageSlice(rows, 3, 10)).toEqual([20, 21, 22]);
    expect(pageSlice(rows, 2, 0)).toEqual(rows);
  });

  it('menemukan halaman sebuah indeks', () => {
    expect(pageOf(0, 10)).toBe(1);
    expect(pageOf(9, 10)).toBe(1);
    expect(pageOf(10, 10)).toBe(2);
    expect(pageOf(22, 0)).toBe(1);
  });
});
