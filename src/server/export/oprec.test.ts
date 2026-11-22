import { describe, expect, it } from 'vitest';

import { type ContactMap, acceptedSheets } from './oprec';

type Row = Parameters<typeof acceptedSheets>[0][number];

const row = (id: string, name: string, divisionId: string | null): Row =>
  ({
    id,
    name,
    nim: 13523001,
    prodi: 'Teknik Informatika',
    angkatan: 2023,
    waveLabel: 'Gelombang 1',
    acceptedDivisionId: divisionId,
    acceptedLabel: divisionId ? `Divisi ${divisionId}` : null,
    acceptedAt: new Date('2026-11-20T03:00:00Z'),
    choices: divisionId
      ? [{ rank: 2, origin: 'dipilih', decision: 'terima', divisionId }]
      : [],
  }) as unknown as Row;

const divisions = [
  { id: 'b', label: 'Acara' },
  { id: 'a', label: 'Humas' },
];

describe('ekspor anggota diterima', () => {
  const rows = [
    row('1', 'Ani', 'a'),
    row('2', 'Budi', null),
    row('3', 'Cici', 'b'),
  ];

  it('tab gabungan diurutkan menurut urutan divisi, lalu satu tab per divisi', () => {
    const [all, ...perDivision] = acceptedSheets(rows, divisions, null);
    expect(all!.header[0]).toBe('Divisi');
    expect(all!.rows.map((r) => [r[0], r[1]])).toEqual([
      ['Acara', 'Cici'],
      ['Humas', 'Ani'],
    ]);
    expect(perDivision.map((s) => [s.name, s.rows.length])).toEqual([
      ['Acara', 1],
      ['Humas', 1],
    ]);
    expect(all!.header).not.toContain('Email');
  });

  it('data diri ikut bila tersedia', () => {
    const contacts: ContactMap = new Map([
      [
        '1',
        {
          applicationId: '1',
          email: '13523001@mahasiswa.itb.ac.id',
          whatsapp: '0812',
          line: null,
          nimTpb: 16523001,
        },
      ],
    ]);
    const [, , humas] = acceptedSheets(rows, divisions, contacts, 'SEMENTARA');
    expect(humas!.banner).toBe('SEMENTARA');
    expect(humas!.header.slice(-4)).toEqual([
      'NIM TPB',
      'Email',
      'WhatsApp',
      'LINE',
    ]);
    expect(humas!.rows[0]!.slice(-4)).toEqual([
      16523001,
      '13523001@mahasiswa.itb.ac.id',
      '0812',
      '',
    ]);
    expect(humas!.rows[0]![5]).toBe(2);
  });
});
