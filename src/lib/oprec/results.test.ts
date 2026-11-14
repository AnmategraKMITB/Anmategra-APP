import { describe, expect, it } from 'vitest';

import { fallbackReason, finalStatus, resultsMode } from './results';

describe('resultsMode', () => {
  it('membaca resultsAccess dari jawaban setup', () => {
    expect(resultsMode({ resultsAccess: 'admin' })).toBe('admin');
    expect(resultsMode({ resultsAccess: 'semua' })).toBe('semua');
    expect(resultsMode({ resultsAccess: 'admin_ketua' })).toBe('admin_ketua');
  });

  it('nilai kosong atau tak dikenal memakai bawaan admin_ketua', () => {
    expect(resultsMode(null)).toBe('admin_ketua');
    expect(resultsMode(undefined)).toBe('admin_ketua');
    expect(resultsMode({ resultsAccess: 'lain' })).toBe('admin_ketua');
  });
});

describe('fallbackReason', () => {
  it('menerjemahkan status hitungan yang aman ditampilkan', () => {
    expect(fallbackReason('tidak_lolos')).toBe('Tidak lolos seleksi');
    expect(fallbackReason('perlu_ditinjau')).toBe('Perlu ditinjau');
    expect(fallbackReason('belum_lengkap')).toBe('Belum lengkap');
    expect(fallbackReason('lolos')).toBeNull();
    expect(fallbackReason(null)).toBeNull();
  });
});

describe('finalStatus', () => {
  it('diterima menang atas keputusan yang masih menunggu', () => {
    expect(finalStatus(true, true)).toBe('diterima');
    expect(finalStatus(false, true)).toBe('belum_diputuskan');
    expect(finalStatus(false, false)).toBe('tidak_diterima');
  });
});
