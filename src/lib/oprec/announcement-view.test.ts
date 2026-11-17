import { describe, expect, it } from 'vitest';

import {
  resolveActiveIndex,
  searchTarget,
  tabParam,
} from './announcement-view';

const labels = ['Bidang Acara', 'Humas & Media', 'Tanpa bidang'];

describe('resolveActiveIndex', () => {
  it('memakai slug yang sah, bukan posisi', () => {
    expect(resolveActiveIndex('humas-media', labels)).toBe(1);
    expect(resolveActiveIndex('humas-media', [...labels].reverse())).toBe(1);
  });
  it.each([null, undefined, '', 'x', '2', 'tidak-ada'])(
    'jatuh ke Semua (null) untuk %s',
    (v) => {
      expect(resolveActiveIndex(v, labels)).toBeNull();
    },
  );
  it('tabParam memakai slug label', () => {
    expect(tabParam('Humas & Media', 1)).toBe('humas-media');
    expect(tabParam(null, 0)).toBe('0');
  });
});

describe('searchTarget', () => {
  it('tetap di tab aktif bila punya hasil', () => {
    expect(searchTarget([0, 2, 1], 1)).toBe(1);
  });
  it('pindah ke tab pertama yang punya hasil', () => {
    expect(searchTarget([0, 0, 3, 1], 0)).toBe(2);
  });
  it('null bila tak ada hasil', () => {
    expect(searchTarget([0, 0], 0)).toBeNull();
    expect(searchTarget([], 0)).toBeNull();
  });
});
