import { describe, expect, it } from 'vitest';

import { resolveActiveIndex, tabParam } from './announcement-view';

const labels = ['Bidang Acara', 'Humas & Media', 'Tanpa bidang'];

describe('resolveActiveIndex', () => {
  it('memakai slug yang sah, bukan posisi', () => {
    expect(resolveActiveIndex('humas-media', labels)).toBe(1);
    expect(resolveActiveIndex('humas-media', [...labels].reverse())).toBe(1);
  });
  it.each([null, undefined, '', 'x', '2', 'tidak-ada'])(
    'jatuh ke 0 untuk %s',
    (v) => {
      expect(resolveActiveIndex(v, labels)).toBe(0);
    },
  );
  it('tabParam memakai slug label', () => {
    expect(tabParam('Humas & Media', 1)).toBe('humas-media');
    expect(tabParam(null, 0)).toBe('0');
  });
});
