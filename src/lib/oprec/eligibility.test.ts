import { describe, expect, it } from 'vitest';

import {
  type ApplicantProfile,
  type EligibilityRule,
  eligibilityMessage,
  evaluateEligibility,
  evaluateRule,
} from './eligibility';

const profile = (over: Partial<ApplicantProfile> = {}): ApplicantProfile => ({
  angkatan_kuliah: [2023],
  fakultas: null,
  prodi: ['Teknik Informatika'],
  status_mahasiswa: ['aktif'],
  keanggotaan_lembaga: ['L1', 'L2'],
  angkatan_lembaga: [2024],
  ...over,
});

const rule = (
  attribute: EligibilityRule['attribute'],
  op: EligibilityRule['op'],
  value: unknown,
): EligibilityRule => ({ attribute, op, value });

describe('evaluateRule', () => {
  it('membandingkan angka, termasuk nilai syarat berupa teks', () => {
    expect(evaluateRule(rule('angkatan_kuliah', 'gte', 2022), profile())).toBe(
      true,
    );
    expect(
      evaluateRule(rule('angkatan_kuliah', 'gte', '2024'), profile()),
    ).toBe(false);
    expect(evaluateRule(rule('angkatan_kuliah', 'lt', '2024'), profile())).toBe(
      true,
    );
  });

  it('between memakai batas inklusif dan butuh dua nilai', () => {
    expect(
      evaluateRule(rule('angkatan_kuliah', 'between', [2021, 2023]), profile()),
    ).toBe(true);
    expect(
      evaluateRule(rule('angkatan_kuliah', 'between', [2024, 2025]), profile()),
    ).toBe(false);
    expect(
      evaluateRule(rule('angkatan_kuliah', 'between', [2021]), profile()),
    ).toBe(false);
  });

  it('teks dibandingkan tanpa membedakan huruf besar dan kecil', () => {
    expect(
      evaluateRule(rule('prodi', 'eq', 'teknik informatika'), profile()),
    ).toBe(true);
    expect(
      evaluateRule(rule('prodi', 'contains', 'INFORMATIKA'), profile()),
    ).toBe(true);
    expect(
      evaluateRule(
        rule('prodi', 'in', ['STI', 'Teknik Informatika']),
        profile(),
      ),
    ).toBe(true);
  });

  it('operator negatif gagal bila salah satu nilai pendaftar cocok', () => {
    expect(
      evaluateRule(rule('status_mahasiswa', 'neq', 'cuti'), profile()),
    ).toBe(true);
    expect(
      evaluateRule(rule('keanggotaan_lembaga', 'not_in', ['L2']), profile()),
    ).toBe(false);
    expect(
      evaluateRule(rule('keanggotaan_lembaga', 'not_in', ['L9']), profile()),
    ).toBe(true);
  });

  it('atribut yang tidak diketahui (fakultas) tidak pernah terpenuhi', () => {
    expect(evaluateRule(rule('fakultas', 'eq', 'STEI'), profile())).toBe(false);
    expect(evaluateRule(rule('fakultas', 'neq', 'STEI'), profile())).toBe(
      false,
    );
  });

  it('nilai syarat kosong tidak terpenuhi', () => {
    expect(evaluateRule(rule('prodi', 'eq', '  '), profile())).toBe(false);
  });

  it('tanpa nilai pendaftar: operator positif gagal, operator negatif lolos', () => {
    const none = profile({ angkatan_kuliah: [] });
    expect(evaluateRule(rule('angkatan_kuliah', 'eq', 2023), none)).toBe(false);
    expect(evaluateRule(rule('angkatan_kuliah', 'neq', 2023), none)).toBe(true);
  });
});

describe('evaluateEligibility', () => {
  const lolos = rule('angkatan_kuliah', 'gte', 2022);
  const gagal = rule('prodi', 'eq', 'STI');
  const gagalJuga = rule('prodi', 'contains', 'Elektro');

  it('tanpa syarat semua orang memenuhi', () => {
    expect(evaluateEligibility('all', [], profile())).toEqual({
      eligible: true,
      failed: [],
    });
  });

  it('"all" gagal bila satu syarat tidak terpenuhi', () => {
    expect(evaluateEligibility('all', [lolos, gagal], profile())).toEqual({
      eligible: false,
      failed: ['prodi'],
    });
  });

  it('"any" lolos bila satu syarat terpenuhi', () => {
    expect(evaluateEligibility('any', [lolos, gagal], profile())).toEqual({
      eligible: true,
      failed: [],
    });
  });

  it('atribut yang gagal tidak diulang', () => {
    expect(evaluateEligibility('any', [gagal, gagalJuga], profile())).toEqual({
      eligible: false,
      failed: ['prodi'],
    });
  });
});

describe('eligibilityMessage', () => {
  it('menyebut nama atribut yang gagal', () => {
    expect(eligibilityMessage([])).toBe('');
    expect(eligibilityMessage(['prodi', 'fakultas'])).toBe(
      'Kamu belum memenuhi syarat pendaftar (program studi, fakultas).',
    );
  });
});
