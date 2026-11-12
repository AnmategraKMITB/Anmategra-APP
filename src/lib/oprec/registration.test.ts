import { describe, expect, it } from 'vitest';

import {
  REGISTRATION_TRANSITIONS,
  formStatusFor,
  recruitmentStatusFor,
  registrationEnded,
} from './registration';

describe('pasangan status oprec dan formulir', () => {
  it('memetakan bolak-balik', () => {
    for (const status of ['draft', 'open', 'closed'] as const) {
      expect(recruitmentStatusFor(formStatusFor(status))).toBe(status);
    }
    expect(formStatusFor('open')).toBe('Published');
    expect(recruitmentStatusFor('Closed')).toBe('closed');
  });

  it('draf tidak bisa langsung ditutup', () => {
    expect(REGISTRATION_TRANSITIONS.draft).not.toContain('closed');
    expect(REGISTRATION_TRANSITIONS.closed).toContain('open');
  });
});

describe('registrationEnded', () => {
  const now = new Date('2026-11-20T10:00:00Z');
  const past = new Date('2026-11-19T10:00:00Z');
  const future = new Date('2026-11-21T10:00:00Z');
  const open = {
    status: 'open' as const,
    formStatus: 'Published' as const,
    formClosesAt: null,
    waveEnds: [],
    now,
  };

  it('oprec ditutup berarti berakhir; draf belum pernah dibuka', () => {
    expect(registrationEnded({ ...open, status: 'closed' })).toBe(true);
    expect(registrationEnded({ ...open, status: 'draft' })).toBe(false);
  });

  it('oprec dibuka tanpa tenggat dan gelombang belum berakhir', () => {
    expect(registrationEnded(open)).toBe(false);
  });

  it('formulir yang ditutup mengakhiri pendaftaran', () => {
    expect(registrationEnded({ ...open, formStatus: 'Closed' })).toBe(true);
  });

  it('tenggat formulir yang lewat mengakhiri pendaftaran', () => {
    expect(registrationEnded({ ...open, formClosesAt: past })).toBe(true);
    expect(registrationEnded({ ...open, formClosesAt: now })).toBe(true);
    expect(registrationEnded({ ...open, formClosesAt: future })).toBe(false);
  });

  it('berakhir bila semua gelombang sudah selesai', () => {
    expect(registrationEnded({ ...open, waveEnds: [past, now] })).toBe(true);
    expect(registrationEnded({ ...open, waveEnds: [past, future] })).toBe(
      false,
    );
  });
});
