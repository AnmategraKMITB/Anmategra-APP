import { describe, expect, it } from 'vitest';

import { assessmentOpen } from './scoring';

const now = new Date('2026-03-10T00:00:00Z');
const base = {
  now,
  allowEarly: false,
  recruitmentStatus: 'open' as const,
  waveEndsAt: null,
  hasWaves: false,
};

describe('assessmentOpen', () => {
  it('oprec tanpa gelombang dibuka saat oprec ditutup', () => {
    expect(assessmentOpen(base)).toBe(false);
    expect(assessmentOpen({ ...base, recruitmentStatus: 'closed' })).toBe(true);
  });
  it('mengikuti akhir gelombang pendaftar', () => {
    const w = { ...base, hasWaves: true };
    expect(
      assessmentOpen({ ...w, waveEndsAt: new Date('2026-03-01T00:00:00Z') }),
    ).toBe(true);
    expect(
      assessmentOpen({ ...w, waveEndsAt: new Date('2026-03-20T00:00:00Z') }),
    ).toBe(false);
  });
  it('pendaftar tanpa gelombang di oprec bergelombang mengikuti status oprec', () => {
    const w = { ...base, hasWaves: true };
    expect(assessmentOpen(w)).toBe(false);
    expect(assessmentOpen({ ...w, recruitmentStatus: 'closed' })).toBe(true);
  });
  it('penilaian lebih awal selalu terbuka', () => {
    expect(assessmentOpen({ ...base, allowEarly: true })).toBe(true);
  });
});
