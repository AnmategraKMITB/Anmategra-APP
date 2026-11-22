import { type SheetTable } from '~/lib/spreadsheet/workbook';

export type ExportRow = {
  path: string;
  unitName: string;
  depth: number;
  title: string;
  rankLabel: string;
  kindLabel: string;
  quota: number;
  filled: number;
  peopleLabel: string;
  tier: string;
  visibility: string;
};

export const EXPORT_HEADER: readonly string[] = [
  'Path',
  'Bagian',
  'Level',
  'Jabatan',
  'Rank',
  'Jenis',
  'Kuota',
  'Terisi',
  'Orang',
  'Tier',
  'Tampil',
];

const PEOPLE_COLUMN = 8;

/** "Orang" berisi nama yang dipisah titik koma. */
export function rowCells(row: ExportRow): (string | number)[] {
  return [
    row.path,
    row.unitName,
    row.depth,
    row.title,
    row.rankLabel,
    row.kindLabel,
    row.quota,
    row.filled,
    row.peopleLabel.split(', ').join('; '),
    row.tier,
    row.visibility,
  ];
}

/** Tab ekspor tabel organogram (baris yang sedang tampil, urutan ikut). */
export function organogramSheet(rows: ExportRow[], name: string): SheetTable {
  return {
    name: name.trim() === '' ? 'Organogram' : name,
    header: [...EXPORT_HEADER],
    rows: rows.map(rowCells),
    wrap: [PEOPLE_COLUMN],
  };
}
