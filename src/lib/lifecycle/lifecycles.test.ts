import { describe, expect, it } from 'vitest';
import {
  FORM_STATUSES,
  PLACEMENT_STATES,
  RECRUITMENT_STATUSES,
  TRANSFER_STATUSES,
  supportStatusEnum,
} from '~/server/db/schema';

import { type Lifecycle, check } from './define';
import { formLifecycle } from './form';
import {
  formStatusForOprec,
  oprecLifecycle,
  oprecStatusForForm,
} from './oprec';
import { placementLifecycle } from './placement';
import { releaseStateOf, resultsReleaseLifecycle } from './results-release';
import { supportLifecycle } from './support';
import { transferLifecycle } from './transfer';

/** Semua pasangan (dari, ke) yang berbeda dan lolos `check`. */
function allowedPairs<S extends string, C>(l: Lifecycle<S, C>, ctx: C) {
  return l.states.flatMap((from) =>
    l.states
      .filter((to) => to !== from && check(l, from, to, ctx).ok)
      .map((to) => `${from}→${to}`),
  );
}

describe('formLifecycle', () => {
  const free = { submissions: 0 };

  it('keadaannya sama dengan FORM_STATUSES', () => {
    expect(formLifecycle.states).toEqual(FORM_STATUSES);
  });

  it('perpindahan yang sah sama dengan tabel lama', () => {
    expect(allowedPairs(formLifecycle, free)).toEqual([
      'Draft→Published',
      'Published→Draft',
      'Published→Closed',
      'Closed→Draft',
      'Closed→Published',
    ]);
  });

  it('perpindahan tak sah memakai pesan lama', () => {
    expect(check(formLifecycle, 'Draft', 'Closed', free)).toEqual({
      ok: false,
      code: 'BAD_REQUEST',
      message: 'Status formulir tidak dapat diubah dari Draft ke Closed.',
    });
  });

  it('kembali ke Draft ditolak bila sudah ada jawaban', () => {
    for (const from of ['Published', 'Closed'] as const) {
      expect(check(formLifecycle, from, 'Draft', { submissions: 1 })).toEqual({
        ok: false,
        code: 'CONFLICT',
        message:
          'Formulir yang sudah memiliki jawaban tidak dapat dikembalikan ke Draft.',
      });
    }
  });
});

describe('placementLifecycle', () => {
  const unreleased = { resultsReleased: false };

  it('keadaannya sama dengan PLACEMENT_STATES', () => {
    expect(placementLifecycle.states).toEqual(PLACEMENT_STATES);
  });

  it('perpindahan yang sah sama dengan tabel lama', () => {
    expect(allowedPairs(placementLifecycle, unreleased)).toEqual([
      'berjalan→masa_banding',
      'masa_banding→berjalan',
      'masa_banding→final',
      'final→masa_banding',
    ]);
  });

  it('menuju final tanpa masa banding memakai pesan khusus', () => {
    expect(check(placementLifecycle, 'berjalan', 'final', unreleased)).toEqual({
      ok: false,
      code: 'BAD_REQUEST',
      message: 'Menuju final harus lewat masa banding.',
    });
    expect(check(placementLifecycle, 'final', 'berjalan', unreleased)).toEqual({
      ok: false,
      code: 'BAD_REQUEST',
      message: 'Perpindahan keadaan penempatan itu tidak diizinkan.',
    });
  });

  it('kembali ke berjalan ditolak selama hasil masih dirilis', () => {
    const released = { resultsReleased: true };
    expect(
      check(placementLifecycle, 'masa_banding', 'berjalan', released),
    ).toEqual({
      ok: false,
      code: 'CONFLICT',
      message:
        'Tarik rilis hasil dulu sebelum mengembalikan penempatan ke berjalan.',
    });
    expect(
      check(placementLifecycle, 'final', 'masa_banding', released).ok,
    ).toBe(true);
  });
});

describe('supportLifecycle', () => {
  it('keadaannya sama dengan enum support_status', () => {
    expect(supportLifecycle.states).toEqual(supportStatusEnum.enumValues);
  });

  it('maju boleh melompat, mundur ditolak dengan pesan lama', () => {
    expect(check(supportLifecycle, 'Draft', 'Resolved', undefined).ok).toBe(
      true,
    );
    expect(check(supportLifecycle, 'Resolved', 'Reported', undefined)).toEqual({
      ok: false,
      code: 'BAD_REQUEST',
      message:
        'Tidak dapat mengubah status laporan mundur dari Resolved ke Reported',
    });
  });

  it('status lama tanpa urutan tetap bebas, seperti sebelumnya', () => {
    expect(check(supportLifecycle, 'Open', 'Draft', undefined).ok).toBe(true);
    expect(check(supportLifecycle, 'Resolved', 'Closed', undefined).ok).toBe(
      true,
    );
    expect(check(supportLifecycle, 'Backlog', 'Open', undefined).ok).toBe(true);
  });
});

describe('oprecLifecycle', () => {
  const free = { openProblems: [], applications: 0 };

  it('keadaannya sama dengan RECRUITMENT_STATUSES', () => {
    expect(oprecLifecycle.states).toEqual(RECRUITMENT_STATUSES);
  });

  it('semua pasangan berbeda sah bila syarat terpenuhi', () => {
    expect(allowedPairs(oprecLifecycle, free)).toEqual([
      'draft→open',
      'draft→closed',
      'open→draft',
      'open→closed',
      'closed→draft',
      'closed→open',
    ]);
  });

  it('membuka ditolak dengan masalah pertama', () => {
    const ctx = { openProblems: ['Masalah A.', 'Masalah B.'], applications: 0 };
    for (const from of ['draft', 'closed'] as const) {
      expect(check(oprecLifecycle, from, 'open', ctx)).toEqual({
        ok: false,
        code: 'CONFLICT',
        message: 'Masalah A.',
      });
    }
  });

  it('kembali ke draf ditolak bila sudah ada pendaftar', () => {
    for (const from of ['open', 'closed'] as const) {
      expect(
        check(oprecLifecycle, from, 'draft', {
          openProblems: [],
          applications: 1,
        }),
      ).toEqual({
        ok: false,
        code: 'CONFLICT',
        message: 'Oprec yang sudah punya pendaftar tidak bisa kembali ke draf.',
      });
    }
  });

  it('pemetaan status form dan oprec saling membalik', () => {
    for (const s of RECRUITMENT_STATUSES) {
      expect(oprecStatusForForm(formStatusForOprec(s))).toBe(s);
    }
    for (const s of FORM_STATUSES) {
      expect(formStatusForOprec(oprecStatusForForm(s))).toBe(s);
    }
  });
});

describe('resultsReleaseLifecycle', () => {
  const banding = { placementState: 'masa_banding' as const };

  it('keadaannya diturunkan dari resultsReleasedAt', () => {
    expect(releaseStateOf(null)).toBe('belum_dirilis');
    expect(releaseStateOf(new Date())).toBe('dirilis');
  });

  it('rilis dan tarik rilis sah di luar penempatan berjalan', () => {
    expect(allowedPairs(resultsReleaseLifecycle, banding)).toEqual([
      'belum_dirilis→dirilis',
      'dirilis→belum_dirilis',
    ]);
  });

  it('rilis ditolak selama penempatan berjalan', () => {
    expect(
      check(resultsReleaseLifecycle, 'belum_dirilis', 'dirilis', {
        placementState: 'berjalan',
      }),
    ).toEqual({
      ok: false,
      code: 'CONFLICT',
      message: 'Buka masa banding atau tetapkan final sebelum merilis hasil.',
    });
  });

  it('rilis ulang dan tarik ulang memakai pesan lama', () => {
    expect(
      check(resultsReleaseLifecycle, 'dirilis', 'dirilis', banding),
    ).toEqual({
      ok: false,
      code: 'CONFLICT',
      message: 'Hasil sudah dirilis.',
    });
    expect(
      check(resultsReleaseLifecycle, 'belum_dirilis', 'belum_dirilis', banding),
    ).toEqual({ ok: false, code: 'CONFLICT', message: 'Hasil belum dirilis.' });
  });
});

describe('transferLifecycle', () => {
  it('keadaannya sama dengan TRANSFER_STATUSES', () => {
    expect(transferLifecycle.states).toEqual(TRANSFER_STATUSES);
  });

  it('hanya permintaan terbuka yang bisa diputuskan', () => {
    expect(allowedPairs(transferLifecycle, undefined)).toEqual([
      'diminta→disetujui',
      'diminta→ditolak',
      'diminta→dibatalkan',
    ]);
  });

  it('keputusan bersifat akhir, dengan pesan lama', () => {
    for (const from of ['disetujui', 'ditolak', 'dibatalkan'] as const) {
      expect(check(transferLifecycle, from, 'dibatalkan', undefined)).toEqual({
        ok: false,
        code: 'BAD_REQUEST',
        message: 'Permintaan ini sudah diputuskan.',
      });
    }
  });
});
