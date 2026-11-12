import { describe, expect, it } from 'vitest';

import { waveOverlapMessage } from './waves';

const w = (label: string, s: string, e: string) => ({
  label,
  startsAt: new Date(s),
  endsAt: new Date(e),
});

describe('waveOverlapMessage', () => {
  it('menolak tumpang tindih dan menyebut kedua gelombang', () => {
    const m = waveOverlapMessage([
      w('B', '2026-01-05', '2026-01-20'),
      w('A', '2026-01-01', '2026-01-10'),
    ]);
    expect(m).toContain('"A"');
    expect(m).toContain('"B"');
  });
  it('mengizinkan bersebelahan dan terpisah', () => {
    expect(
      waveOverlapMessage([
        w('A', '2026-01-01', '2026-01-10'),
        w('B', '2026-01-10', '2026-01-20'),
        w('C', '2026-02-01', '2026-02-10'),
      ]),
    ).toBeNull();
  });
});
