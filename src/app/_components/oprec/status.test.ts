import { describe, expect, it } from 'vitest';

import { canOpenRegistration, waveTitle } from './status';

describe('canOpenRegistration (H-02)', () => {
  it('hanya untuk oprec Draf', () => {
    expect(canOpenRegistration('draft')).toBe(true);
    expect(canOpenRegistration('open')).toBe(false);
    expect(canOpenRegistration('closed')).toBe(false);
  });
});

describe('waveTitle (L-01)', () => {
  it('tidak menggandakan kata Gelombang', () => {
    expect(waveTitle('1')).toBe('Gelombang 1');
    expect(waveTitle('Gelombang 1')).toBe('Gelombang 1');
    expect(waveTitle(' gelombang 3.1 ')).toBe('Gelombang 3.1');
  });
});
