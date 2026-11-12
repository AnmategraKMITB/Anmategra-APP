import { describe, expect, it } from 'vitest';

import { googlePopupErrorMessage } from './google-popup-error';

describe('googlePopupErrorMessage', () => {
  it('menjelaskan popup yang diblokir', () => {
    expect(googlePopupErrorMessage('popup_failed_to_open')).toMatch(/diblokir/);
  });

  it('menjelaskan popup yang ditutup', () => {
    expect(googlePopupErrorMessage('popup_closed')).toMatch(/ditutup/);
  });

  it('punya pesan cadangan untuk jenis lain atau kosong', () => {
    expect(googlePopupErrorMessage('unknown')).toMatch(/belum bisa diminta/);
    expect(googlePopupErrorMessage(undefined)).toMatch(/belum bisa diminta/);
  });
});
