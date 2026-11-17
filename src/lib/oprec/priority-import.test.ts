import { describe, expect, it } from 'vitest';

import {
  type ImportDivision,
  MAX_REPORTED_ISSUES,
  normalizeHeader,
  parseNim,
  parseRank,
  planPriorityImport,
} from './priority-import';

const HEADER = [
  'Divisi',
  'Kode',
  'NIM',
  'Urutan',
  'Keterangan',
  'ID (jangan diubah)',
];

function division(
  id: string,
  name: string,
  candidates: {
    id: string;
    nim?: number;
    tpb?: number;
    blocked?: 'tidak_lolos' | 'closerec';
  }[],
  over: Partial<ImportDivision> = {},
): ImportDivision {
  return {
    id,
    name,
    aliases: [],
    canRank: true,
    locked: false,
    candidates: candidates.map((c) => ({
      applicationId: c.id,
      nims: [c.nim, c.tpb].filter((n): n is number => n !== undefined),
      blocked: c.blocked ?? null,
    })),
    ...over,
  };
}

const LOG = division('d-log', 'Logistik', [
  { id: 'a1', nim: 13523001 },
  { id: 'a2', nim: 13523002 },
  { id: 'a3', nim: 13523003, tpb: 16023003 },
  { id: 'a4', nim: 13523004, blocked: 'tidak_lolos' },
]);
const IT = division('d-it', 'IT', [
  { id: 'a1', nim: 13523001 },
  { id: 'a5', nim: 13523005 },
]);

/** Baris: [divisi, nim, urutan, keterangan, id]. */
const row = (
  d: string,
  nim: string,
  rank: string,
  note: string,
  id: string,
) => [d, 'P-XXXX', nim, rank, note, id];

function plan(
  rows: string[][],
  divisions: ImportDivision[] = [LOG, IT],
  allowNim = true,
  header: string[] = HEADER,
) {
  return planPriorityImport({ table: [header, ...rows], divisions, allowNim });
}

describe('pengurai sel', () => {
  it('urutan: bilangan bulat, kosong, desimal nol, dan teks', () => {
    expect(parseRank('3')).toBe(3);
    expect(parseRank(' 2 ')).toBe(2);
    expect(parseRank('4.0')).toBe(4);
    expect(parseRank('5,00')).toBe(5);
    expect(parseRank('')).toBeNull();
    expect(parseRank('1.5')).toBeNaN();
    expect(parseRank('satu')).toBeNaN();
    expect(parseRank('-1')).toBeNaN();
  });

  it('NIM: spasi dan akhiran desimal dari spreadsheet', () => {
    expect(parseNim('13523001')).toBe(13523001);
    expect(parseNim('135 23 001')).toBe(13523001);
    expect(parseNim('13523001.0')).toBe(13523001);
    expect(parseNim('abc')).toBeNull();
    expect(parseNim('12')).toBeNull();
  });

  it('judul kolom: huruf, isi kurung, dan tanda baca diabaikan', () => {
    expect(normalizeHeader('ID (jangan diubah)')).toBe('id');
    expect(normalizeHeader('  URUTAN ')).toBe('urutan');
    expect(normalizeHeader('Program studi')).toBe('program studi');
  });
});

describe('planPriorityImport: urutan dan keterangan', () => {
  it('mengurutkan menurut kolom Urutan, merapatkan celah, kosong = tidak diambil', () => {
    const p = plan([
      row('Logistik', '', '5', '', 'a3'),
      row('Logistik', '', '1', 'paling cocok', 'a2'),
      row('Logistik', '', '', '', 'a1'),
    ]);
    expect(p.errors).toEqual([]);
    expect(p.divisions).toHaveLength(1);
    const log = p.divisions[0]!;
    expect(log.order).toEqual(['a2', 'a3']);
    expect(log.notes).toEqual(
      new Map([
        ['a3', null],
        ['a2', 'paling cocok'],
        ['a1', null],
      ]),
    );
    expect(p.rowCount).toBe(3);
  });

  it('divisi yang tidak ada di file tidak masuk rencana', () => {
    const p = plan([row('Logistik', '', '1', '', 'a1')]);
    expect(p.divisions.map((d) => d.divisionId)).toEqual(['d-log']);
  });

  it('satu orang boleh diurutkan di beberapa divisi', () => {
    const p = plan([
      row('Logistik', '', '1', '', 'a1'),
      row('IT', '', '1', '', 'a1'),
    ]);
    expect(p.errors).toEqual([]);
    expect(p.divisions.map((d) => d.order)).toEqual([['a1'], ['a1']]);
  });

  it('divisi dengan semua urutan kosong tetap masuk rencana (daftarnya dikosongkan)', () => {
    const p = plan([row('IT', '', '', '', 'a1'), row('IT', '', '', '', 'a5')]);
    expect(p.divisions).toHaveLength(1);
    expect(p.divisions[0]!.order).toEqual([]);
    expect(p.divisions[0]!.missing).toBe(0);
  });

  it('kandidat yang barisnya dihapus dihitung sebagai tidak ada di file', () => {
    const p = plan([row('Logistik', '', '1', '', 'a1')]);
    // a2 dan a3 bisa diurutkan tetapi tidak ada; a4 tidak lolos jadi tidak dihitung.
    expect(p.divisions[0]!.missing).toBe(2);
    expect(p.warnings).toEqual([
      {
        row: null,
        message:
          '2 kandidat Logistik tidak ada di file; mereka dianggap tidak diurutkan.',
      },
    ]);
  });

  it('tanpa kolom Keterangan, keterangan tidak diubah (notes null)', () => {
    const p = planPriorityImport({
      table: [
        ['Divisi', 'Urutan', 'ID'],
        ['Logistik', '1', 'a1'],
      ],
      divisions: [LOG],
      allowNim: true,
    });
    expect(p.errors).toEqual([]);
    expect(p.divisions[0]!.notes).toBeNull();
  });

  it('awalan pengaman rumus pada keterangan dibuang lagi', () => {
    const p = plan([row('Logistik', '', '1', "'- rajin", 'a1')]);
    expect(p.divisions[0]!.notes!.get('a1')).toBe('- rajin');
  });

  it('judul boleh di bawah baris lain, nama divisi tidak peka huruf dan spasi', () => {
    const p = planPriorityImport({
      table: [
        ['Daftar prioritas Tour AMI'],
        [],
        ['divisi', 'id', 'URUTAN'],
        ['  logistik ', 'a1', '1'],
      ],
      divisions: [LOG],
      allowNim: true,
    });
    expect(p.errors).toEqual([]);
    expect(p.divisions[0]!.order).toEqual(['a1']);
  });

  it('nama alias divisi (Induk / Unit) diterima', () => {
    const p = plan(
      [row('Bidang Operasional / Logistik', '', '1', '', 'a1')],
      [{ ...LOG, aliases: ['Bidang Operasional / Logistik'] }],
    );
    expect(p.errors).toEqual([]);
    expect(p.divisions[0]!.order).toEqual(['a1']);
  });
});

describe('planPriorityImport: mengenali pendaftar', () => {
  it('lewat NIM bila kolom ID kosong, termasuk NIM TPB', () => {
    const p = plan([
      row('Logistik', '13523002', '1', '', ''),
      row('Logistik', '16023003', '2', '', ''),
    ]);
    expect(p.errors).toEqual([]);
    expect(p.divisions[0]!.order).toEqual(['a2', 'a3']);
  });

  it('ID didahulukan atas NIM', () => {
    const p = plan([row('Logistik', '13523002', '1', '', 'a1')]);
    expect(p.divisions[0]!.order).toEqual(['a1']);
  });

  it('mode blind: NIM tidak dipakai, ID wajib', () => {
    const p = plan([row('Logistik', '13523002', '1', '', '')], [LOG], false);
    expect(p.errors.map((e) => e.message)).toEqual([
      'Kolom ID kosong; pendaftar tidak bisa dikenali.',
    ]);
    const noId = planPriorityImport({
      table: [
        ['Divisi', 'NIM', 'Urutan'],
        ['Logistik', '13523002', '1'],
      ],
      divisions: [LOG],
      allowNim: false,
    });
    expect(noId.errors[0]!.message).toContain('kolom "ID"');
  });

  it('NIM yang cocok dengan dua pendaftar ditolak', () => {
    const twin = division('d-x', 'X', [
      { id: 'b1', nim: 13523009 },
      { id: 'b2', tpb: 13523009 },
    ]);
    const p = plan([row('X', '13523009', '1', '', '')], [twin]);
    expect(p.errors[0]!.message).toContain('lebih dari satu pendaftar');
  });
});

describe('planPriorityImport: galat dan catatan', () => {
  it('melaporkan tiap jenis galat dengan nomor baris spreadsheet', () => {
    const p = plan([
      row('Humas', '', '1', '', 'a1'), // baris 2
      row('Humas', '', '2', '', 'a2'), // divisi sama: tidak dilaporkan lagi
      row('Logistik', '', 'satu', '', 'a1'), // baris 4
      row('Logistik', '', '0', '', 'a2'), // baris 5
      row('Logistik', '', '1', '', 'zz'), // baris 6
      row('Logistik', '', '1', '', 'a5'), // baris 7: kandidat IT saja
      row('Logistik', '99999999', '1', '', ''), // baris 8
      row('', '', '1', '', 'a1'), // baris 9
      row('IT', '', '1', '', 'a1'), // baris 10
      row('IT', '', '1', '', 'a5'), // baris 11: urutan dobel
      row('IT', '', '2', '', 'a1'), // baris 12: orang dobel
    ]);
    expect(p.errors).toEqual([
      {
        row: 2,
        message:
          'Divisi "Humas" tidak ada di oprec ini. Tulis persis seperti di templat.',
      },
      {
        row: 4,
        message:
          'Urutan "satu" tidak sah. Isi bilangan bulat mulai 1, atau kosongkan bila tidak diambil.',
      },
      { row: 5, message: 'Urutan harus antara 1 dan 5000.' },
      {
        row: 6,
        message: 'ID "zz" tidak dikenal. Jangan ubah kolom ID dari templat.',
      },
      {
        row: 7,
        message:
          'Pendaftar ini bukan kandidat Logistik (tidak memilih divisi ini dan tidak bersedia dipindahkan).',
      },
      { row: 8, message: 'NIM 99999999 bukan kandidat Logistik.' },
      { row: 9, message: 'Kolom Divisi kosong.' },
      { row: 12, message: 'Pendaftar ini sudah ada di baris 10 untuk IT.' },
      { row: 11, message: 'Urutan 1 di IT sudah dipakai di baris 10.' },
    ]);
    expect(p.errorCount).toBe(9);
  });

  it('divisi yang bukan haknya atau sudah dikunci ditolak sekali per divisi', () => {
    const p = plan(
      [
        row('Logistik', '', '1', '', 'a1'),
        row('Logistik', '', '2', '', 'a2'),
        row('IT', '', '1', '', 'a1'),
      ],
      [
        { ...LOG, canRank: false },
        { ...IT, locked: true },
      ],
    );
    expect(p.errors.map((e) => e.message)).toEqual([
      'Kamu tidak menyusun daftar Logistik.',
      'Daftar IT sudah dikunci. Buka kuncinya dulu di tab Prioritas.',
    ]);
    expect(p.divisions).toEqual([]);
  });

  it('kandidat yang tidak lolos diabaikan urutannya dengan catatan, keterangannya tetap', () => {
    const p = plan([
      row('Logistik', '', '1', 'tetap dicatat', 'a4'),
      row('Logistik', '', '2', '', 'a1'),
    ]);
    expect(p.errors).toEqual([]);
    expect(p.divisions[0]!.order).toEqual(['a1']);
    expect(p.divisions[0]!.skippedBlocked).toBe(1);
    expect(p.divisions[0]!.notes!.get('a4')).toBe('tetap dicatat');
    expect(p.warnings[0]).toEqual({
      row: 2,
      message:
        'Pendaftar ini tidak lolos di Logistik, jadi urutannya diabaikan.',
    });
  });

  it('keterangan terlalu panjang ditolak', () => {
    const p = plan([row('Logistik', '', '1', 'x'.repeat(2001), 'a1')]);
    expect(p.errors[0]!.message).toContain('Keterangan terlalu panjang');
  });

  it('tanpa kolom Divisi/Urutan, atau tanpa baris data', () => {
    const noHeader = planPriorityImport({
      table: [['Nama', 'NIM']],
      divisions: [LOG],
      allowNim: true,
    });
    expect(noHeader.errors[0]!.message).toContain('"Divisi" dan "Urutan"');
    const empty = plan([]);
    expect(empty.errors.map((e) => e.message)).toEqual([
      'File tidak berisi baris data di bawah judul kolom.',
    ]);
  });

  it('jumlah galat tetap dihitung walau daftar yang dilaporkan dibatasi', () => {
    const rows = Array.from({ length: MAX_REPORTED_ISSUES + 30 }, () =>
      row('Logistik', '', 'x', '', 'a1'),
    );
    const p = plan(rows);
    expect(p.errors).toHaveLength(MAX_REPORTED_ISSUES);
    expect(p.errorCount).toBe(MAX_REPORTED_ISSUES + 30);
  });
});
