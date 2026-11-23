import { describe, expect, it } from 'vitest';

import { runPriorityMatching } from './matching';
import {
  type PoolApplication,
  type PoolChoice,
  buildMatchingInput,
  candidacy,
  planWrites,
} from './priority';

const choice = (
  id: string,
  divisionId: string,
  rank: number | null,
  extra: Partial<PoolChoice> = {},
): PoolChoice => ({
  id,
  divisionId,
  rank,
  origin: rank === null ? 'dialihkan' : 'dipilih',
  status: 'lolos',
  decision: null,
  ...extra,
});

const app = (
  id: string,
  choices: PoolChoice[],
  extra: Partial<PoolApplication> = {},
): PoolApplication => ({
  id,
  source: 'form',
  willingToMove: false,
  choices,
  ...extra,
});

describe('candidacy', () => {
  it('pemilih divisi menjadi kandidat dengan pilihan ke-n', () => {
    const a = app('a', [choice('c1', 'logistik', 1), choice('c2', 'it', 2)]);
    expect(candidacy(a, 'it', false)).toEqual({
      kind: 'pilihan',
      choiceId: 'c2',
      choiceRank: 2,
      blocked: null,
    });
    expect(candidacy(a, 'hr', false)).toBeNull();
  });

  it('pilihan tidak lolos tampil tetapi tidak bisa diprioritaskan', () => {
    const a = app('a', [choice('c1', 'it', 1, { status: 'tidak_lolos' })]);
    expect(candidacy(a, 'it', false)?.blocked).toBe('tidak_lolos');
  });

  it('bersedia dipindahkan hanya bila oprec mengizinkan', () => {
    const a = app('a', [choice('c1', 'it', 1)], { willingToMove: true });
    expect(candidacy(a, 'hr', true)).toEqual({
      kind: 'dipindahkan',
      blocked: null,
    });
    expect(candidacy(a, 'hr', false)).toBeNull();
    const b = app('b', [choice('c1', 'it', 1)]);
    expect(candidacy(b, 'hr', true)).toBeNull();
  });

  it('pendaftar closerec bukan kandidat; yang sudah closerec diblokir', () => {
    const closerecOnly = app(
      'a',
      [choice('c1', 'it', null, { origin: 'closerec', decision: 'terima' })],
      { source: 'closerec' },
    );
    expect(candidacy(closerecOnly, 'it', true)).toBeNull();
    const both = app('b', [
      choice('c1', 'it', 1),
      choice('c2', 'hr', null, { origin: 'closerec', decision: 'terima' }),
    ]);
    expect(candidacy(both, 'it', false)?.blocked).toBe('closerec');
  });
});

describe('buildMatchingInput', () => {
  const divisions = [
    { id: 'logistik', quota: 1, sortOrder: 0 },
    { id: 'it', quota: 1, sortOrder: 1 },
  ];

  it('mengabaikan urutan milik yang tidak lolos atau bukan kandidat', () => {
    const applications = [
      app('a', [choice('a1', 'logistik', 1, { status: 'tidak_lolos' })]),
      app('b', [choice('b1', 'logistik', 1)]),
    ];
    const { matching, ignored } = buildMatchingInput({
      applications,
      divisions,
      priorities: [
        { divisionId: 'logistik', applicationId: 'a', rank: 1 },
        { divisionId: 'logistik', applicationId: 'b', rank: 2 },
        { divisionId: 'it', applicationId: 'b', rank: 1 },
        { divisionId: 'it', applicationId: 'a', rank: null },
      ],
      allowRedirect: false,
    });
    expect([...matching.divisions[0]!.priority]).toEqual([['b', 2]]);
    expect(matching.divisions[1]!.priority.size).toBe(0);
    expect(ignored).toEqual([
      { divisionId: 'logistik', applicationId: 'a', reason: 'tidak_lolos' },
      { divisionId: 'it', applicationId: 'b', reason: 'bukan_kandidat' },
    ]);
    // Pilihan tidak lolos tetap ada di urutan pilihan (tercatat ditolak).
    expect(matching.applicants.find((x) => x.id === 'a')!.choices).toEqual([
      'logistik',
    ]);
  });

  it('pendaftar closerec tidak ikut penempatan', () => {
    const applications = [
      app('a', [
        choice('a1', 'logistik', 1),
        choice('a2', 'it', null, { origin: 'closerec', decision: 'terima' }),
      ]),
    ];
    const { matching } = buildMatchingInput({
      applications,
      divisions,
      priorities: [],
      allowRedirect: false,
    });
    expect(matching.applicants).toEqual([]);
  });
});

describe('planWrites', () => {
  const a = app('a', [
    choice('c1', 'logistik', 1),
    choice('c2', 'it', 2),
    choice('c3', 'hr', 3),
  ]);

  it('pilihan di atas ditolak, yang diterima, yang di bawah dikosongkan', () => {
    expect(planWrites(a, 'it')).toEqual({
      terima: { choiceId: 'c2', divisionId: 'it', redirected: false },
      tolak: ['c1'],
      clear: ['c3'],
      drop: [],
    });
  });

  it('tidak ditempatkan: semua pilihan ditolak', () => {
    expect(planWrites(a, null)).toEqual({
      terima: null,
      tolak: ['c1', 'c2', 'c3'],
      clear: [],
      drop: [],
    });
  });

  it('dipindahkan: semua pilihan ditolak, pilihan dialihkan dibuat atau dipakai ulang', () => {
    expect(planWrites(a, 'acara').terima).toEqual({
      choiceId: null,
      divisionId: 'acara',
      redirected: true,
    });
    const withOld = app('a', [
      ...a.choices,
      choice('d1', 'acara', null),
      choice('d2', 'humas', null),
    ]);
    expect(planWrites(withOld, 'acara')).toEqual({
      terima: { choiceId: 'd1', divisionId: 'acara', redirected: true },
      tolak: ['c1', 'c2', 'c3'],
      clear: [],
      drop: ['d2'],
    });
    expect(planWrites(withOld, 'it').drop).toEqual(['d1', 'd2']);
  });

  it('cocok dengan hasil algoritma: contoh pengguna urutan 23 di Logistik', () => {
    const others = Array.from({ length: 22 }, (_, i) => `o${i}`);
    const applications = [
      app('x', [choice('x1', 'logistik', 1), choice('x2', 'it', 2)]),
      ...others.map((id) => app(id, [choice(`${id}1`, 'logistik', 1)])),
    ];
    const { matching } = buildMatchingInput({
      applications,
      divisions: [
        { id: 'logistik', quota: 20, sortOrder: 0 },
        { id: 'it', quota: 5, sortOrder: 1 },
      ],
      priorities: [
        ...others.map((id, i) => ({
          divisionId: 'logistik',
          applicationId: id,
          rank: i + 1,
        })),
        { divisionId: 'logistik', applicationId: 'x', rank: 23 },
        { divisionId: 'it', applicationId: 'x', rank: 2 },
      ],
      allowRedirect: false,
    });
    const result = runPriorityMatching(matching);
    expect(result.assignment.get('x')).toBe('it');
    expect(planWrites(applications[0]!, 'it')).toMatchObject({
      tolak: ['x1'],
      terima: { choiceId: 'x2' },
    });
  });
});
