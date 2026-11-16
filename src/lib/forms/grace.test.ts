import { describe, expect, it } from 'vitest';

import {
  isWithinDeadline,
  lastAcceptedAt,
  shouldShowGraceNotice,
} from './grace';

const deadline = new Date('2026-11-12T16:59:00Z'); // 23:59 WIB
const at = (iso: string) => new Date(iso);

describe('grace', () => {
  it('batas akhir = tenggat + 10 menit', () => {
    expect(lastAcceptedAt(deadline).toISOString()).toBe(
      '2026-11-12T17:09:00.000Z',
    );
  });

  it('menerima pada tenggat tepat dan dalam masa tambahan', () => {
    expect(isWithinDeadline(deadline, at('2026-11-12T16:59:00Z'))).toBe(true);
    expect(isWithinDeadline(deadline, at('2026-11-12T17:09:00Z'))).toBe(true);
  });

  it('menolak setelah masa tambahan', () => {
    expect(isWithinDeadline(deadline, at('2026-11-12T17:09:01Z'))).toBe(false);
  });

  it('tanpa tenggat selalu diterima', () => {
    expect(isWithinDeadline(null, new Date())).toBe(true);
  });

  it('pemberitahuan muncul tepat 5 menit sebelum tenggat, tidak lebih awal', () => {
    expect(shouldShowGraceNotice(deadline, at('2026-11-12T16:53:59Z'))).toBe(
      false,
    );
    expect(shouldShowGraceNotice(deadline, at('2026-11-12T16:54:00Z'))).toBe(
      true,
    );
    expect(shouldShowGraceNotice(deadline, at('2026-11-12T17:09:00Z'))).toBe(
      true,
    );
    expect(shouldShowGraceNotice(deadline, at('2026-11-12T17:09:01Z'))).toBe(
      false,
    );
  });
});
