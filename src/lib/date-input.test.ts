import { describe, expect, it } from 'vitest';

import { isValidDateInput } from './date-input';

describe('isValidDateInput (L-06)', () => {
  it('menerima tanggal 4 digit tahun dalam batas', () => {
    expect(isValidDateInput('2026-11-12')).toBe(true);
    expect(isValidDateInput('2026-11-12T08:30')).toBe(true);
    expect(isValidDateInput('')).toBe(true);
  });
  it('menolak tahun 5-6 digit atau di luar batas', () => {
    expect(isValidDateInput('202611-11-12')).toBe(false);
    expect(isValidDateInput('20261-11-12T08:30')).toBe(false);
    expect(isValidDateInput('1999-01-01')).toBe(false);
    expect(isValidDateInput('2100-01-01')).toBe(false);
  });
  it('menolak format dan tanggal tak sah', () => {
    expect(isValidDateInput('abc')).toBe(false);
    expect(isValidDateInput('2026-13-40')).toBe(false);
  });
});
