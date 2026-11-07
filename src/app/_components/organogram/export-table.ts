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

const NUMERIC_COLUMNS = new Set([2, 6, 7]);
const PEOPLE_COLUMN = 8;

/** Awalan kutip mencegah Excel atau Sheets menjalankan teks yang diawali = + - @ sebagai rumus. */
export function guardCell(value: string | number): string {
  if (typeof value === 'number') return String(value);
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

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

/** Dipisah tab: tempel langsung ke Google Sheets atau Excel dan kolomnya tetap terpisah. */
export function toTsv(rows: ExportRow[]): string {
  const lines = [EXPORT_HEADER.join('\t')];
  for (const row of rows) {
    lines.push(
      rowCells(row)
        .map((cell) => guardCell(cell).replace(/[\t\r\n]+/g, ' '))
        .join('\t'),
    );
  }
  return lines.join('\r\n');
}

export async function buildXlsx(
  rows: ExportRow[],
  sheetName: string,
): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const name = sheetName
    .replace(/[[\]:*?/\\]/g, '')
    .trim()
    .slice(0, 31);
  const sheet = workbook.addWorksheet(name === '' ? 'Organogram' : name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const data = rows.map(rowCells);
  const header = sheet.addRow([...EXPORT_HEADER]);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEAEFF2' },
    };
  });
  data.forEach((cells) => sheet.addRow(cells));

  EXPORT_HEADER.forEach((title, index) => {
    const longest = data.reduce(
      (max, cells) => Math.max(max, String(cells[index] ?? '').length),
      title.length,
    );
    const column = sheet.getColumn(index + 1);
    column.width = Math.min(48, Math.max(8, longest + 2));
    if (NUMERIC_COLUMNS.has(index)) column.alignment = { horizontal: 'right' };
    if (index === PEOPLE_COLUMN) {
      column.alignment = { wrapText: true, vertical: 'top' };
    }
  });
  sheet.autoFilter = {
    from: 'A1',
    to: { row: 1, column: EXPORT_HEADER.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
