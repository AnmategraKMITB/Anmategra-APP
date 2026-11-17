import { describe, expect, it } from 'vitest';

import {
  DIVISION_HEADER,
  acceptedFlatTable,
  acceptedOnly,
  divisionSheets,
  parseResultsScope,
  resultsFilename,
} from './applicants-export';

const row = (name: string, div: string | null) => ({
  name,
  nim: 1,
  prodi: 'IF',
  angkatan: 2023,
  waveLabel: 'G1',
  acceptedDivisionId: div,
});
const divisions = [
  { id: 'a', label: 'Acara/Humas' },
  { id: 'b', label: 'Acara:Humas' },
];
const rows = [row('X', 'a'), row('Y', null), row('Z', 'b')];

describe('export hasil', () => {
  it('menyaring hanya yang diterima', () => {
    expect(acceptedOnly(rows).map((r) => r.name)).toEqual(['X', 'Z']);
  });
  it('mengelompokkan per divisi dengan nama tab aman dan unik', () => {
    const sheets = divisionSheets(rows, divisions);
    expect(sheets.map((s) => s.name)).toEqual([
      'Acara Humas',
      'Acara Humas (2)',
    ]);
    expect(sheets[0]!.header).toBe(DIVISION_HEADER);
    expect(sheets[0]!.body).toEqual([['X', 1, 'IF', 2023, 'G1']]);
  });
  it('CSV datar memuat kolom divisi', () => {
    const t = acceptedFlatTable(rows, divisions);
    expect(t.header[0]).toBe('Divisi');
    expect(t.body).toHaveLength(2);
    expect(t.body[1]![0]).toBe('Acara:Humas');
  });
  it('nama berkas dan scope', () => {
    expect(parseResultsScope('diterima')).toBe('diterima');
    expect(parseResultsScope('x')).toBe('semua');
    expect(resultsFilename('Oprec A', 'csv')).toBe('Oprec-A-hasil.csv');
    expect(
      resultsFilename('Oprec A', 'xlsx', {
        scope: 'diterima',
        provisional: true,
      }),
    ).toBe('Oprec-A-hasil-diterima-sementara.xlsx');
  });
});
