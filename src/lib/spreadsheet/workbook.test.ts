import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import {
  buildXlsx,
  guardCell,
  safeSheetName,
  tableToCsv,
  tableToTsv,
} from './workbook';

describe('workbook ekspor', () => {
  it('menjaga teks berawalan rumus, angka dibiarkan', () => {
    expect(guardCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(guardCell('-5 orang')).toBe("'-5 orang");
    expect(guardCell(-5)).toBe(-5);
    expect(guardCell(null)).toBe('');
  });

  it('nama tab aman, maksimal 31 karakter, dan unik', () => {
    const used = new Set<string>();
    expect(safeSheetName('Acara/Humas', used)).toBe('Acara Humas');
    expect(safeSheetName('acara humas', used)).toBe('acara humas (2)');
    const long = safeSheetName('x'.repeat(40), used);
    expect(long).toHaveLength(31);
  });

  it('CSV memakai BOM, banner, dan kutip bila perlu', () => {
    const csv = tableToCsv({
      name: 'A',
      banner: 'SEMENTARA',
      header: ['Nama', 'Catatan'],
      rows: [['Budi, S', '=1+1']],
    });
    expect(csv).toBe('﻿SEMENTARA\r\nNama,Catatan\r\n"Budi, S",\'=1+1\r\n');
  });

  it('TSV meratakan tab dan baris baru di dalam sel', () => {
    expect(
      tableToTsv({ name: 'A', header: ['A', 'B'], rows: [['x\ty', 'a\nb']] }),
    ).toBe('A\tB\r\nx y\ta b');
  });

  it('XLSX berisi satu tab per tabel dengan header beku dan filter', async () => {
    const buffer = await buildXlsx({
      title: 'Uji',
      sheets: [
        { name: 'Pendaftar', header: ['Nama', 'NIM'], rows: [['A', 1]] },
        {
          name: 'Pendaftar',
          banner: 'SEMENTARA',
          header: ['Divisi'],
          rows: [['Acara']],
        },
      ],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Pendaftar',
      'Pendaftar (2)',
    ]);
    const first = wb.worksheets[0]!;
    expect(first.getRow(2).values).toEqual([undefined, 'A', 1]);
    expect(first.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    const second = wb.worksheets[1]!;
    expect(second.getCell('A1').value).toBe('SEMENTARA');
    expect(second.getCell('A2').value).toBe('Divisi');
    expect(second.views[0]).toMatchObject({ ySplit: 2 });
  });
});
