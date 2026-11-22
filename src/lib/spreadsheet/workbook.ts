/**
 * Bentuk ekspor spreadsheet bersama (server dan peramban): satu workbook berisi
 * beberapa tab, tiap tab satu tabel. Semua ekspor (Forms, Organogram, Oprec)
 * dibentuk lewat sini supaya tampilannya seragam: header tebal berlatar,
 * baris header dibekukan, filter aktif, lebar kolom menyesuaikan isi, dan teks
 * berawalan rumus dijaga.
 */

export type SheetCell = string | number | null | undefined;

export type SheetTable = {
  /** Nama tab; dirapikan otomatis (maks. 31 karakter, unik). */
  name: string;
  header: string[];
  rows: SheetCell[][];
  /** Satu baris penanda merah di atas header, mis. "SEMENTARA - belum final". */
  banner?: string;
  /** Kolom (indeks 0) yang dibungkus teks, mis. daftar nama atau jawaban panjang. */
  wrap?: number[];
};

export type WorkbookSpec = {
  title?: string;
  sheets: SheetTable[];
};

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Awalan kutip mencegah Excel atau Sheets menjalankan teks yang diawali = + - @ sebagai rumus. */
export function guardCell(value: SheetCell): string | number {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Nama tab Excel: maksimal 31 karakter, tanpa karakter terlarang, unik. */
export function safeSheetName(label: string, used: Set<string>): string {
  const base =
    label
      .replace(/[[\]:*?/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 31)
      .trim() || 'Sheet';
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) {
    const suffix = ` (${i})`;
    name = `${base.slice(0, 31 - suffix.length).trimEnd()}${suffix}`;
  }
  used.add(name.toLowerCase());
  return name;
}

/** Nama berkas aman dari judul, tanpa ekstensi. */
export function fileSlug(name: string, fallback: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug === '' ? fallback : slug;
}

const csvCell = (value: SheetCell): string => {
  const text = String(guardCell(value));
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV satu tab, UTF-8 dengan BOM agar Excel membaca huruf dengan benar. */
export function tableToCsv(table: SheetTable): string {
  const line = (cells: SheetCell[]) => `${cells.map(csvCell).join(',')}\r\n`;
  return `﻿${table.banner ? line([table.banner]) : ''}${line(table.header)}${table.rows.map(line).join('')}`;
}

/** Dipisah tab: tempel langsung ke Google Sheets atau Excel dan kolomnya tetap terpisah. */
export function tableToTsv(table: SheetTable): string {
  const cell = (value: SheetCell) =>
    String(guardCell(value)).replace(/[\t\r\n]+/g, ' ');
  return [table.header, ...table.rows]
    .map((cells) => cells.map(cell).join('\t'))
    .join('\r\n');
}

const HEADER_FILL = 'FFEAEFF2';
const BANNER_COLOR = 'FFB91C1C';

/**
 * Workbook XLSX dari spesifikasi. ExcelJS dimuat dinamis supaya halaman yang
 * mengekspor di peramban tidak ikut berat sebelum tombolnya ditekan.
 */
export async function buildXlsx(spec: WorkbookSpec): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  if (spec.title) workbook.title = spec.title;
  workbook.creator = 'Anmategra';
  workbook.created = new Date();

  const used = new Set<string>();
  const sheets = spec.sheets.length
    ? spec.sheets
    : [{ name: 'Data', header: [], rows: [] }];
  for (const table of sheets) {
    const headerRow = table.banner ? 2 : 1;
    const sheet = workbook.addWorksheet(safeSheetName(table.name, used), {
      views: [{ state: 'frozen', ySplit: headerRow }],
    });
    if (table.banner) {
      sheet.addRow([table.banner]).font = {
        bold: true,
        color: { argb: BANNER_COLOR },
      };
    }
    const header = sheet.addRow(table.header);
    header.font = { bold: true };
    header.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: HEADER_FILL },
      };
    });
    for (const cells of table.rows) sheet.addRow(cells.map(guardCell));

    const wrap = new Set(table.wrap ?? []);
    table.header.forEach((title, index) => {
      const longest = table.rows.reduce(
        (max, cells) => Math.max(max, String(cells[index] ?? '').length),
        title.length,
      );
      const column = sheet.getColumn(index + 1);
      column.width = Math.min(
        wrap.has(index) ? 60 : 48,
        Math.max(8, longest + 2),
      );
      if (wrap.has(index)) {
        column.alignment = { wrapText: true, vertical: 'top' };
      }
    });
    if (table.header.length > 0) {
      sheet.autoFilter = {
        from: { row: headerRow, column: 1 },
        to: { row: headerRow, column: table.header.length },
      };
    }
  }

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
