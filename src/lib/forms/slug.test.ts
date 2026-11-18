import { describe, expect, it } from 'vitest';

import { FORM_SLUG_RE, isReservedFormSlug } from './slug';

describe('FORM_SLUG_RE', () => {
  it.each(['form', 'Form', 'FORM', 'Form-Oprec', 'A1-b2', '2026'])(
    'menerima %s',
    (value) => {
      expect(FORM_SLUG_RE.test(value)).toBe(true);
    },
  );

  it.each([
    '',
    '-form',
    'form-',
    'form--oprec',
    'form_oprec',
    'form oprec',
    'form/oprec',
  ])('menolak %j', (value) => {
    expect(FORM_SLUG_RE.test(value)).toBe(false);
  });
});

describe('isReservedFormSlug', () => {
  it('peka huruf besar-kecil, sama seperti slugnya', () => {
    expect(isReservedFormSlug('preview')).toBe(true);
    expect(isReservedFormSlug('Preview')).toBe(false);
  });
});
