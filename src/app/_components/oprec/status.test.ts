import { describe, expect, it } from 'vitest';

import { canOpenRegistration } from './status';

describe('canOpenRegistration (H-02)', () => {
  it('hanya untuk oprec Draf', () => {
    expect(canOpenRegistration('draft')).toBe(true);
    expect(canOpenRegistration('open')).toBe(false);
    expect(canOpenRegistration('closed')).toBe(false);
  });
});
