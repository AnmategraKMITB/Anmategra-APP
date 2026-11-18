import { describe, expect, it } from 'vitest';

import {
  type AudienceApplicant,
  tallyNotificationAudience,
} from './notification-audience';

const choice = (
  over: Partial<AudienceApplicant['choices'][number]> = {},
): AudienceApplicant['choices'][number] => ({
  id: over.id ?? crypto.randomUUID(),
  divisionId: over.divisionId ?? 'div-1',
  rank: over.rank ?? 1,
  status: over.status ?? 'lolos',
  decision: over.decision ?? null,
});

const applicant = (
  userId: string,
  choices: AudienceApplicant['choices'],
): AudienceApplicant => ({
  applicationId: `app-${userId}`,
  userId,
  choices,
});

describe('tallyNotificationAudience', () => {
  it('menghitung diterima, ditolak, dan belum diputuskan', () => {
    const applicants = [
      applicant('a', [choice({ decision: 'terima' })]),
      applicant('b', [choice({ decision: null })]),
      applicant('c', [choice({ decision: 'tolak' })]),
    ];

    expect(
      tallyNotificationAudience(applicants, {
        audience: 'all',
        staged: true,
      }),
    ).toEqual({
      all: 3,
      accepted: 1,
      rejected: 1,
      undecided: 1,
      recipients: ['a', 'b', 'c'],
    });
    expect(
      tallyNotificationAudience(applicants, {
        audience: 'accepted',
        staged: true,
      }).recipients,
    ).toEqual(['a']);
    expect(
      tallyNotificationAudience(applicants, {
        audience: 'undecided',
        staged: true,
      }).recipients,
    ).toEqual(['b']);
    expect(
      tallyNotificationAudience(applicants, {
        audience: 'rejected',
        staged: true,
      }).recipients,
    ).toEqual(['c']);
  });

  it('membatasi lingkup divisi tanpa menganggap penerimaan di divisi lain sebagai penolakan', () => {
    const applicants = [
      applicant('accepted-elsewhere', [
        choice({ divisionId: 'div-2', decision: 'terima' }),
        choice({ divisionId: 'div-1', decision: null }),
      ]),
      applicant('pending-here', [choice({ divisionId: 'div-1' })]),
      applicant('rejected-here', [
        choice({ divisionId: 'div-1', decision: 'tolak' }),
      ]),
      applicant('outside', [choice({ divisionId: 'div-3' })]),
    ];

    const tally = tallyNotificationAudience(applicants, {
      audience: 'all',
      divisionIds: ['div-1'],
      staged: true,
    });
    expect(tally).toMatchObject({
      all: 3,
      accepted: 0,
      rejected: 1,
      undecided: 1,
    });
    expect(tally.recipients).toEqual([
      'accepted-elsewhere',
      'pending-here',
      'rejected-here',
    ]);

    expect(
      tallyNotificationAudience(applicants, {
        audience: 'accepted',
        divisionIds: ['div-1'],
        staged: true,
      }).recipients,
    ).toEqual([]);
    expect(
      tallyNotificationAudience(applicants, {
        audience: 'undecided',
        divisionIds: ['div-1'],
        staged: true,
      }).recipients,
    ).toEqual(['pending-here']);
    expect(
      tallyNotificationAudience(applicants, {
        audience: 'rejected',
        divisionIds: ['div-1'],
        staged: true,
      }).recipients,
    ).toEqual(['rejected-here']);
  });

  it('menghitung pilihan aktif bertahap sebagai belum diputuskan', () => {
    const applicants = [
      applicant('staged', [
        choice({ rank: 1, decision: 'tolak' }),
        choice({ rank: 2, decision: null }),
        choice({ rank: 3, decision: null }),
      ]),
    ];
    expect(
      tallyNotificationAudience(applicants, {
        audience: 'undecided',
        staged: true,
      }).recipients,
    ).toEqual(['staged']);
  });
});
