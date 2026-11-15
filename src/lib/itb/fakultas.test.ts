import { describe, expect, it } from 'vitest';

import { fakultasOfNim } from './fakultas';

describe('fakultasOfNim', () => {
  it('membaca kode program studi dari tiga digit awal NIM', () => {
    expect(fakultasOfNim(13523001)).toBe('STEI');
    expect(fakultasOfNim('16426355')).toBe('FTTM');
  });
  it('null bila NIM kosong atau kodenya tidak dikenal', () => {
    expect(fakultasOfNim(null)).toBeNull();
    expect(fakultasOfNim(99900001)).toBeNull();
  });
});
