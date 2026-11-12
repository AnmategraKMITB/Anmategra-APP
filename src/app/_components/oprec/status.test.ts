import { describe, expect, it } from 'vitest';

import { canOpenRegistration, placementLockReason, waveTitle } from './status';

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

describe('placementLockReason (#381)', () => {
  it('terkunci pada Draf/Dibuka tanpa pendaftar', () => {
    expect(placementLockReason('draft', 0)).toContain('Terkunci');
    expect(placementLockReason('open', 0)).toContain('Terkunci');
  });
  it('terbuka bila ada pendaftar atau sudah ditutup', () => {
    expect(placementLockReason('draft', 1)).toBeNull();
    expect(placementLockReason('closed', 0)).toBeNull();
  });
});
