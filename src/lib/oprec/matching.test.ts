import { describe, expect, it } from 'vitest';

import {
  type MatchingApplicant,
  type MatchingDivision,
  type MatchingInput,
  runPriorityMatching,
} from './matching';

const div = (
  id: string,
  quota: number,
  ranked: string[],
  sortOrder = 0,
): MatchingDivision => ({
  id,
  quota,
  sortOrder,
  priority: new Map(ranked.map((applicantId, i) => [applicantId, i + 1])),
});

const app = (
  id: string,
  choices: string[],
  willingToMove = false,
): MatchingApplicant => ({ id, choices, willingToMove });

const run = (
  applicants: MatchingApplicant[],
  divisions: MatchingDivision[],
  allowRedirect = false,
) => runPriorityMatching({ applicants, divisions, allowRedirect });

describe('runPriorityMatching: contoh', () => {
  it('urutan 23 di Logistik berkuota 20 lalu masuk IT (contoh pengguna)', () => {
    const others = Array.from(
      { length: 22 },
      (_, i) => `o${String(i + 1).padStart(2, '0')}`,
    );
    const r = run(
      [
        ...others.map((id) => app(id, ['logistik'])),
        app('me', ['logistik', 'it', 'hr']),
        app('x', ['it']),
      ],
      [
        div('logistik', 20, [...others, 'me']),
        div('it', 5, ['x', 'me']),
        div('hr', 3, ['me']),
      ],
    );

    expect(r.assignment.get('me')).toBe('it');
    expect(r.cutoff.get('logistik')).toBe(20);
    expect(r.assignment.get('o21')).toBeNull();
    expect(r.trace.get('me')).toEqual([
      {
        divisionId: 'logistik',
        choiceRank: 1,
        priorityRank: 23,
        outcome: 'tergeser',
      },
      { divisionId: 'it', choiceRank: 2, priorityRank: 2, outcome: 'diterima' },
      {
        divisionId: 'hr',
        choiceRank: 3,
        priorityRank: 1,
        outcome: 'tidak_diproses',
      },
    ]);
  });

  it('kursi turun: urutan di bawah kuota tetap masuk bila yang di atas diterima di pilihan lebih tinggi', () => {
    const r = run(
      [
        app('p1', ['it', 'logistik']),
        app('p2', ['logistik']),
        app('me', ['logistik', 'it']),
      ],
      [div('logistik', 2, ['p1', 'p2', 'me']), div('it', 1, ['p1', 'me'])],
    );
    expect(r.assignment.get('p1')).toBe('it');
    expect(r.assignment.get('me')).toBe('logistik');
    expect(r.accepted.get('logistik')).toEqual(['p2', 'me']);
    expect(r.cutoff.get('logistik')).toBe(3);
  });

  it('penolakan berantai: yang tergeser melamar ke pilihan berikutnya', () => {
    const r = run(
      [
        app('a', ['it', 'logistik']),
        app('b', ['logistik', 'it']),
        app('c', ['it']),
      ],
      [div('it', 1, ['c', 'a', 'b']), div('logistik', 1, ['a', 'b'])],
    );
    expect(Object.fromEntries(r.assignment)).toEqual({
      a: 'logistik',
      b: null,
      c: 'it',
    });
    expect(r.trace.get('b')?.map((s) => s.outcome)).toEqual([
      'tergeser',
      'tergeser',
    ]);
  });

  it('tidak diprioritaskan berarti ditolak, lalu lanjut ke pilihan berikutnya', () => {
    const r = run(
      [app('a', ['logistik', 'it'])],
      [div('logistik', 5, []), div('it', 5, ['a'])],
    );
    expect(r.assignment.get('a')).toBe('it');
    expect(r.trace.get('a')?.[0]).toMatchObject({
      outcome: 'tidak_diprioritaskan',
      priorityRank: null,
    });
  });

  it('kuota 0 berarti tanpa batas dan tidak punya batas urutan', () => {
    const r = run(
      [app('a', ['it']), app('b', ['it']), app('c', ['it'])],
      [div('it', 0, ['c', 'b', 'a'])],
    );
    expect(r.accepted.get('it')).toEqual(['c', 'b', 'a']);
    expect(r.cutoff.get('it')).toBeNull();
  });

  it('pendaftar tanpa pilihan atau dengan pilihan tak dikenal tidak ditempatkan', () => {
    const r = run(
      [app('a', []), app('b', ['hilang'])],
      [div('it', 1, ['a', 'b'])],
    );
    expect(r.assignment.get('a')).toBeNull();
    expect(r.assignment.get('b')).toBeNull();
    expect(r.trace.get('a')).toEqual([]);
  });

  it('pilihan ganda hanya diproses sekali', () => {
    const r = run(
      [app('a', ['it', 'it', 'hr'])],
      [div('it', 1, []), div('hr', 1, ['a'])],
    );
    expect(r.trace.get('a')?.map((s) => [s.divisionId, s.choiceRank])).toEqual([
      ['it', 1],
      ['hr', 3],
    ]);
  });
});

describe('runPriorityMatching: bersedia dipindahkan', () => {
  const divisions = [
    div('logistik', 2, []),
    div('it', 2, ['x'], 1),
    div('hr', 2, ['x'], 2),
  ];

  it('diproses di divisi lain setelah pilihan sendiri habis', () => {
    const r = run([app('x', ['logistik'], true)], divisions, true);
    expect(r.assignment.get('x')).toBe('it');
    expect(r.trace.get('x')).toEqual([
      {
        divisionId: 'logistik',
        choiceRank: 1,
        priorityRank: null,
        outcome: 'tidak_diprioritaskan',
      },
      {
        divisionId: 'it',
        choiceRank: null,
        priorityRank: 1,
        outcome: 'diterima',
      },
    ]);
  });

  it('tidak diproses bila oprec tidak mengizinkan atau pendaftar tidak bersedia', () => {
    expect(
      run([app('x', ['logistik'], true)], divisions, false).assignment.get('x'),
    ).toBeNull();
    expect(
      run([app('x', ['logistik'], false)], divisions, true).assignment.get('x'),
    ).toBeNull();
  });

  it('divisi lain dicoba menurut urutan yang diberikan divisi itu', () => {
    const r = run(
      [app('x', ['logistik'], true), app('y', ['it']), app('z', ['it'])],
      [
        div('logistik', 1, []),
        div('it', 3, ['y', 'z', 'x'], 1),
        div('hr', 1, ['x'], 2),
      ],
      true,
    );
    // Di HR x berurutan 1, di IT berurutan 3, jadi HR dicoba lebih dulu.
    expect(r.assignment.get('x')).toBe('hr');
  });

  it('pilihan sendiri tetap didahulukan', () => {
    const r = run(
      [app('x', ['logistik'], true)],
      [div('logistik', 1, ['x']), div('it', 1, ['x'])],
      true,
    );
    expect(r.assignment.get('x')).toBe('logistik');
  });

  it('pendaftar dipindahkan bisa menggeser pemilih dengan prioritas lebih rendah', () => {
    const r = run(
      [app('x', ['logistik'], true), app('y', ['it'])],
      [div('logistik', 1, []), div('it', 1, ['x', 'y'])],
      true,
    );
    expect(r.assignment.get('x')).toBe('it');
    expect(r.assignment.get('y')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Uji sifat pada instance acak
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInstance(seed: number): MatchingInput {
  const rnd = mulberry32(seed);
  const int = (lo: number, hi: number) =>
    lo + Math.floor(rnd() * (hi - lo + 1));
  const shuffle = <T>(xs: readonly T[]): T[] => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = int(0, i);
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };

  const divisionIds = Array.from({ length: int(2, 5) }, (_, i) => `d${i}`);
  const allowRedirect = rnd() < 0.5;
  const applicants = Array.from({ length: int(3, 25) }, (_, i) =>
    app(
      `a${String(i).padStart(2, '0')}`,
      shuffle(divisionIds).slice(0, int(1, Math.min(3, divisionIds.length))),
      rnd() < 0.4,
    ),
  );
  const divisions = divisionIds.map((id, i) => {
    // Divisi hanya bisa mengurutkan pemilihnya, ditambah yang bersedia dipindahkan.
    const candidates = applicants.filter(
      (a) => a.choices.includes(id) || (allowRedirect && a.willingToMove),
    );
    const ranked = shuffle(candidates).filter(() => rnd() < 0.8);
    return div(
      id,
      rnd() < 0.2 ? 0 : int(1, 4),
      ranked.map((a) => a.id),
      i,
    );
  });
  return { applicants, divisions, allowRedirect };
}

/** Daftar preferensi yang ditulis ulang secara terpisah dari implementasi. */
function expectedPreferences(
  applicant: MatchingApplicant,
  input: MatchingInput,
): string[] {
  const own = applicant.choices.filter((d, i, all) => all.indexOf(d) === i);
  if (!input.allowRedirect || !applicant.willingToMove) return own;
  const extra = input.divisions
    .filter((d) => !own.includes(d.id) && d.priority.has(applicant.id))
    .sort(
      (a, b) =>
        a.priority.get(applicant.id)! - b.priority.get(applicant.id)! ||
        a.sortOrder - b.sortOrder,
    )
    .map((d) => d.id);
  return [...own, ...extra];
}

describe('runPriorityMatching: sifat pada 300 instance acak', () => {
  const seeds = Array.from({ length: 300 }, (_, i) => i + 1);

  it.each(seeds)('instance #%i stabil, patuh kuota, dan konsisten', (seed) => {
    const input = randomInstance(seed);
    const r = runPriorityMatching(input);
    const divisionById = new Map(input.divisions.map((d) => [d.id, d]));
    const countIn = (divisionId: string) =>
      [...r.assignment.values()].filter((d) => d === divisionId).length;

    for (const d of input.divisions) {
      // Kuota dipatuhi; daftar diterima sama dengan penempatan.
      if (d.quota > 0) expect(countIn(d.id)).toBeLessThanOrEqual(d.quota);
      expect([...(r.accepted.get(d.id) ?? [])].sort()).toEqual(
        input.applicants
          .filter((a) => r.assignment.get(a.id) === d.id)
          .map((a) => a.id)
          .sort(),
      );
    }

    for (const a of input.applicants) {
      const prefs = expectedPreferences(a, input);
      const assigned = r.assignment.get(a.id) ?? null;
      if (assigned !== null) {
        // Hanya ditempatkan di divisi yang memprioritaskannya dan ada di preferensinya.
        expect(divisionById.get(assigned)!.priority.has(a.id)).toBe(true);
        expect(prefs).toContain(assigned);
      }

      // Stabil: setiap divisi yang lebih disukai pendaftar sudah penuh oleh
      // orang-orang dengan prioritas lebih baik, atau tidak memprioritaskannya.
      const limit = assigned === null ? prefs.length : prefs.indexOf(assigned);
      for (const preferred of prefs.slice(0, limit)) {
        const d = divisionById.get(preferred)!;
        const myRank = d.priority.get(a.id);
        if (myRank === undefined) continue;
        const holders = r.accepted.get(d.id) ?? [];
        expect(d.quota > 0 && holders.length >= d.quota).toBe(true);
        for (const h of holders) {
          expect(d.priority.get(h)!).toBeLessThan(myRank);
        }
      }

      // Jejak: langkah terakhir yang diproses adalah tempat diterima.
      const steps = r.trace.get(a.id) ?? [];
      const accepted = steps.filter((s) => s.outcome === 'diterima');
      expect(accepted.map((s) => s.divisionId)).toEqual(
        assigned ? [assigned] : [],
      );
    }
  });

  it.each(seeds.slice(0, 50))(
    'instance #%i tidak bergantung urutan input',
    (seed) => {
      const input = randomInstance(seed);
      const reversed: MatchingInput = {
        ...input,
        applicants: [...input.applicants].reverse(),
        divisions: [...input.divisions].reverse(),
      };
      const a = runPriorityMatching(input);
      const b = runPriorityMatching(reversed);
      expect(Object.fromEntries(b.assignment)).toEqual(
        Object.fromEntries(a.assignment),
      );
      expect(Object.fromEntries(b.trace)).toEqual(Object.fromEntries(a.trace));
    },
  );
});
