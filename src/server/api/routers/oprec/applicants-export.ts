import { escapeCsvCell, formatWib } from '../form/csv';

type ExportRow = {
  name: string | null;
  nim: number | null;
  prodi: string | null;
  angkatan: number | null;
  waveLabel: string | null;
  submittedAt: Date | null;
  choices: unknown[];
};

type ExportChoice = { rank: number | null; label: string };

/**
 * Tabel ekspor Pendaftar: identitas, gelombang, dan pilihan 1..N. Jawaban
 * formulir sengaja tidak ikut; itu ada di ekspor respons formulir.
 */
export function applicantTable(rows: ExportRow[], maxChoices: number) {
  const header = [
    'Gelombang',
    'Nama',
    'NIM',
    'Program studi',
    'Angkatan',
    ...Array.from({ length: maxChoices }, (_, i) => `Pilihan ${i + 1}`),
    'Waktu kirim',
  ];
  const body = rows.map((r) => {
    const byRank = new Map(
      (r.choices as ExportChoice[]).map((c) => [c.rank, c.label]),
    );
    return [
      r.waveLabel ?? '',
      r.name ?? '',
      r.nim ?? '',
      r.prodi ?? '',
      r.angkatan ?? '',
      ...Array.from({ length: maxChoices }, (_, i) => byRank.get(i + 1) ?? ''),
      r.submittedAt ? formatWib(r.submittedAt) : '',
    ];
  });
  return { header, body };
}

/** UTF-8 dengan BOM agar Excel membaca huruf dengan benar. */
export function applicantCsv(table: ReturnType<typeof applicantTable>) {
  const line = (cells: (string | number)[]) =>
    `${cells.map((c) => escapeCsvCell(c)).join(',')}\r\n`;
  return `﻿${line(table.header)}${table.body.map(line).join('')}`;
}

export function exportFilename(name: string, ext: 'csv' | 'xlsx'): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return `${slug === '' ? 'oprec' : slug}-pendaftar.${ext}`;
}
