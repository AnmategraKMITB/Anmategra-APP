import { describe, expect, it } from 'vitest';

import {
  decideFormsPath,
  isSafeFormsCallback,
  pickFormsCallback,
} from './forms-path';

describe('isSafeFormsCallback', () => {
  it.each([
    '/forms/abc123',
    '/forms/abc123?ref=email&x=1',
    '/forms/preview/abc',
    '/forms/Rapat-2026',
    '/f/abc123',
    '/f/Rapat-2026?ref=email&x=1',
  ])('menerima %s', (value) => {
    expect(isSafeFormsCallback(value)).toBe(true);
  });

  it.each([
    undefined,
    null,
    42,
    '',
    '/',
    '/admin',
    '/forms',
    '/forms/',
    '/forms/a/b',
    'https://evil.example/forms/a',
    '//evil.example/forms/a',
    '/forms//evil.example',
    '/forms/a\\b',
    '/forms/..%2fadmin',
    '/forms/%2e%2e',
    '/forms/a?next=<script>',
    '/forms/a\nb',
    `/forms/${'a'.repeat(301)}`,
    '/f',
    '/f/',
    '/f/a/b',
    '/f//evil.example',
    '/f/..%2fadmin',
    '/f/a?next=<script>',
  ])('menolak %j', (value) => {
    expect(isSafeFormsCallback(value)).toBe(false);
  });
});

describe('pickFormsCallback', () => {
  it('mengembalikan callbackUrl form beserta query aman', () => {
    const search = `?callbackUrl=${encodeURIComponent('/forms/abc?ref=x')}`;
    expect(pickFormsCallback(search)).toBe('/forms/abc?ref=x');
  });

  it('mengabaikan callbackUrl di luar /forms', () => {
    expect(pickFormsCallback('?callbackUrl=%2Fadmin')).toBeUndefined();
    expect(
      pickFormsCallback('?callbackUrl=https%3A%2F%2Fevil.example'),
    ).toBeUndefined();
  });

  it('undefined bila tidak ada callbackUrl', () => {
    expect(pickFormsCallback('')).toBeUndefined();
    expect(pickFormsCallback('?foo=bar')).toBeUndefined();
  });

  it('konsisten dengan lokasi login buatan middleware', () => {
    const decision = decideFormsPath('/forms/abc', '?ref=x', false);
    expect(decision.kind).toBe('login');
    if (decision.kind !== 'login') return;
    const search = decision.location.slice(decision.location.indexOf('?'));
    expect(pickFormsCallback(search)).toBe('/forms/abc?ref=x');
  });

  it('konsisten untuk alias /f dengan slug berhuruf besar', () => {
    const decision = decideFormsPath('/f/Rapat-2026', '?ref=x', false);
    expect(decision.kind).toBe('login');
    if (decision.kind !== 'login') return;
    const search = decision.location.slice(decision.location.indexOf('?'));
    expect(pickFormsCallback(search)).toBe('/f/Rapat-2026?ref=x');
  });
});
