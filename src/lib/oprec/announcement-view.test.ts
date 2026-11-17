import { describe, expect, it } from 'vitest';
import { resolveActiveIndex } from './announcement-view';

describe('resolveActiveIndex', () => {
  it('memakai indeks yang sah', () => {
    expect(resolveActiveIndex('2', 3)).toBe(2);
  });
  it.each([null, undefined, '', 'x', '-1', '3', '1.5'])(
    'jatuh ke 0 untuk %s',
    (v) => {
      expect(resolveActiveIndex(v, 3)).toBe(0);
    },
  );
});
