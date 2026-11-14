import { describe, expect, it } from 'vitest';

import {
  assertConfirmEmail,
  isEmergencySuperadmin,
  remainingSuperadmins,
} from './superadmin';

describe('remainingSuperadmins', () => {
  it('menolak bila yang diturunkan adalah satu-satunya Superadmin', () => {
    expect(remainingSuperadmins(['a@x.id'], [], 'a@x.id')).toBe(0);
  });
  it('akun darurat dihitung', () => {
    expect(remainingSuperadmins(['a@x.id'], ['d@x.id'], 'a@x.id')).toBe(1);
  });
  it('email yang sama di basis data dan env tidak dihitung ganda', () => {
    expect(remainingSuperadmins(['a@x.id', 'D@x.id'], ['d@x.id'], 'a@x.id')).toBe(1);
  });
  it('akun darurat tidak pernah hilang walau dikecualikan', () => {
    expect(remainingSuperadmins(['d@x.id'], ['d@x.id'], 'd@x.id')).toBe(1);
  });
});

describe('isEmergencySuperadmin & assertConfirmEmail', () => {
  it('mengabaikan huruf besar dan spasi', () => {
    expect(isEmergencySuperadmin(' D@X.id ', ['d@x.id'])).toBe(true);
    expect(isEmergencySuperadmin(null, ['d@x.id'])).toBe(false);
  });
  it('konfirmasi harus cocok', () => {
    expect(() => assertConfirmEmail('A@x.id ', 'a@x.id')).not.toThrow();
    expect(() => assertConfirmEmail('b@x.id', 'a@x.id')).toThrow();
    expect(() => assertConfirmEmail(undefined, 'a@x.id')).toThrow();
  });
});
