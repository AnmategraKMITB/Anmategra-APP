import { describe, expect, it } from 'vitest';

import { canonicalEmail, isValidNim } from './alt-login';

describe('alt-login', () => {
  it('menerima NIM 8 digit saja', () => {
    expect(isValidNim('13522001')).toBe(true);
    expect(isValidNim('1352200')).toBe(false);
    expect(isValidNim('135220012')).toBe(false);
    expect(isValidNim('1352200a')).toBe(false);
    expect(isValidNim(' 13522001')).toBe(false);
  });

  it('membentuk email kanonik dari NIM', () => {
    expect(canonicalEmail('13522001')).toBe('13522001@mahasiswa.itb.ac.id');
  });
});
