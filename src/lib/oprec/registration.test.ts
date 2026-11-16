import { describe, expect, it } from 'vitest';

import { registrationEnded } from './registration';

const now = new Date('2026-11-20T12:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe('registrationEnded', () => {
  it('ditutup selalu berakhir, draf tidak pernah', () => {
    const base = { formClosesAt: null, waveEndsAt: [], now };
    expect(registrationEnded({ ...base, status: 'closed' })).toBe(true);
    expect(
      registrationEnded({
        ...base,
        status: 'draft',
        formClosesAt: minutesAgo(60),
      }),
    ).toBe(false);
  });

  it('dibuka tanpa tenggat dan tanpa gelombang belum berakhir', () => {
    expect(
      registrationEnded({
        status: 'open',
        formClosesAt: null,
        waveEndsAt: [],
        now,
      }),
    ).toBe(false);
  });

  it('tenggat formulir berakhir setelah masa tambahan 10 menit', () => {
    const at = (m: number) =>
      registrationEnded({
        status: 'open',
        formClosesAt: minutesAgo(m),
        waveEndsAt: [],
        now,
      });
    expect(at(5)).toBe(false);
    expect(at(10)).toBe(true);
    expect(at(60)).toBe(true);
  });

  it('gelombang: berakhir hanya bila semua gelombang lewat', () => {
    const base = { status: 'open' as const, formClosesAt: null, now };
    expect(
      registrationEnded({
        ...base,
        waveEndsAt: [minutesAgo(60), minutesAgo(30)],
      }),
    ).toBe(true);
    expect(
      registrationEnded({
        ...base,
        waveEndsAt: [minutesAgo(60), new Date(now.getTime() + 60_000)],
      }),
    ).toBe(false);
  });
});
