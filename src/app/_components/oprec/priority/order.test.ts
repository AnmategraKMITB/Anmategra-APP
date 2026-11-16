import { describe, expect, it } from 'vitest';

import {
  bySubmitted,
  dropBlock,
  fillQuota,
  moveTo,
  parsePosition,
  remove,
  shift,
} from './order';

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

describe('seret-lepas', () => {
  const order = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('satu baris: turun ke sesudah target, naik ke sebelum target', () => {
    expect(dropBlock(order, [], 'b', 'e')).toEqual([
      'a',
      'c',
      'd',
      'e',
      'b',
      'f',
    ]);
    expect(dropBlock(order, [], 'e', 'b')).toEqual([
      'a',
      'e',
      'b',
      'c',
      'd',
      'f',
    ]);
    expect(dropBlock(order, [], 'c', 'c')).toEqual(order);
  });

  it('beberapa terpilih pindah sebagai satu blok, urutan relatif tetap', () => {
    // Blok tidak bersebelahan: e lalu b tetap b lalu e, sesuai urutan asal.
    expect(dropBlock(order, ['e', 'b'], 'b', 'f')).toEqual([
      'a',
      'c',
      'd',
      'f',
      'b',
      'e',
    ]);
    expect(dropBlock(order, ['d', 'f'], 'f', 'a')).toEqual([
      'd',
      'f',
      'a',
      'b',
      'c',
      'e',
    ]);
  });

  it('target di dalam blok atau id asing: tidak berubah', () => {
    expect(dropBlock(order, ['b', 'c'], 'b', 'c')).toEqual(order);
    expect(dropBlock(order, ['b'], 'x', 'c')).toEqual(order);
  });

  it('baris yang diseret bukan bagian pilihan: hanya ia yang pindah', () => {
    expect(dropBlock(order, ['a', 'b'], 'f', 'c')).toEqual([
      'a',
      'b',
      'f',
      'c',
      'd',
      'e',
    ]);
  });
});

describe('waktu kirim dan isi kuota', () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 8, minute));
  const row = (
    applicationId: string,
    minute: number,
    extra: Partial<{
      kind: 'pilihan' | 'dipindahkan';
      choiceRank: number | null;
      blocked: string | null;
    }> = {},
  ) => ({
    applicationId,
    submittedAt: at(minute),
    kind: 'pilihan' as const,
    choiceRank: 1,
    blocked: null,
    ...extra,
  });

  it('urut waktu kirim naik dan turun; bawaan tidak diubah', () => {
    const rows = [row('b', 5), row('a', 1), row('c', 9)];
    const ids = (list: typeof rows) => list.map((r) => r.applicationId);
    expect(ids(bySubmitted(rows, 'kirim_awal'))).toEqual(['a', 'b', 'c']);
    expect(ids(bySubmitted(rows, 'kirim_akhir'))).toEqual(['c', 'b', 'a']);
    expect(ids(bySubmitted(rows, 'bawaan'))).toEqual(['b', 'a', 'c']);
  });

  it('mengisi sisa kuota dari pilihan 1 paling awal, melewati yang tak layak', () => {
    const rows = [
      row('telat', 50),
      row('awal', 1),
      row('pilihan2', 0, { choiceRank: 2 }),
      row('pindahan', 0, { kind: 'dipindahkan', choiceRank: null }),
      row('terblokir', 0, { blocked: 'tidak_lolos' }),
      row('sudah', 0),
      row('tengah', 20),
    ];
    const ids = (quota: number, order: string[]) =>
      fillQuota(rows, order, quota).map((r) => r.applicationId);
    expect(ids(3, ['sudah'])).toEqual(['awal', 'tengah']);
    expect(ids(10, [])).toEqual(['sudah', 'awal', 'tengah', 'telat']);
    expect(ids(1, ['sudah'])).toEqual([]);
    expect(ids(0, [])).toEqual([]);
  });
});
