import { describe, expect, it } from 'vitest';

import {
  type Answers,
  type ContactMap,
  acceptedSheets,
  answersSheets,
  resultsSheet,
} from './oprec';

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

const answers: Answers = {
  columns: [
    {
      fieldId: 'mbti',
      type: 'short_text',
      label: '**MBTI**',
      archived: false,
      sectionId: 's1',
      sectionTitle: 'Data diri',
      divisionIds: [],
    },
    {
      fieldId: 'porto',
      type: 'long_text',
      label: 'Portofolio desain',
      archived: false,
      sectionId: 's2',
      sectionTitle: 'Khusus Humas',
      divisionIds: ['a'],
    },
  ],
  divisions,
  byApp: new Map([
    ['1', { mbti: 'INTJ', porto: 'https://contoh.id/porto' }],
    ['3', { mbti: '=ENFP' }],
  ]),
};

describe('kolom jawaban formulir terpilih', () => {
  const rows = [row('1', 'Ani', 'a'), row('3', 'Cici', 'b')];

  it('tab gabungan hanya pertanyaan umum; tab divisi ditambah bagian divisinya', () => {
    const [all, acara, humas] = acceptedSheets(
      rows,
      divisions,
      null,
      undefined,
      answers,
    );
    expect(all!.header.slice(-1)).toEqual(['MBTI']);
    expect(acara!.header.slice(-1)).toEqual(['MBTI']);
    expect(acara!.rows[0]!.slice(-1)).toEqual(['=ENFP']);
    expect(humas!.header.slice(-2)).toEqual(['MBTI', 'Portofolio desain']);
    expect(humas!.rows[0]!.slice(-2)).toEqual([
      'INTJ',
      'https://contoh.id/porto',
    ]);
    expect(humas!.wrap).toEqual([humas!.header.length - 1]);
  });

  it('tab semua pendaftar memuat semua pertanyaan, pertanyaan divisi diberi nama divisinya', () => {
    const table = resultsSheet(rows, 2, undefined, answers);
    expect(table.header.slice(-2)).toEqual([
      'MBTI',
      'Portofolio desain [Humas]',
    ]);
    expect(table.rows[1]!.slice(-2)).toEqual(['=ENFP', '']);
  });

  it('tab Jawaban: umum untuk semua, tab divisi hanya untuk yang memilihnya', () => {
    const applicants = [
      { ...row('1', 'Ani', 'a'), choices: [{ divisionId: 'a', rank: 1 }] },
      { ...row('3', 'Cici', 'b'), choices: [{ divisionId: 'b', rank: 1 }] },
    ] as unknown as Parameters<typeof answersSheets>[0];
    const tables = answersSheets(applicants, answers);
    expect(tables.map((t) => [t.name, t.rows.length])).toEqual([
      ['Jawaban - Umum', 2],
      ['Jawaban - Humas', 1],
    ]);
    expect(tables[1]!.header.slice(-2)).toEqual([
      'Pilihan ke-',
      'Portofolio desain',
    ]);
  });
});
