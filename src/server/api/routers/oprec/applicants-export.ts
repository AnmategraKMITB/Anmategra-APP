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

function slugOf(name: string) {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug === '' ? 'oprec' : slug;
}

export function exportFilename(name: string, ext: 'csv' | 'xlsx'): string {
  return `${slugOf(name)}-pendaftar.${ext}`;
}

// ---------------------------------------------------------------------------
// Ekspor Hasil (tanpa data sensitif: alasan, flag, catatan)
// ---------------------------------------------------------------------------

type ResultChoice = {
  rank: number | null;
  label: string;
  status: 'diterima' | 'ditolak' | 'belum';
};

type ResultExportRow = {
  name: string | null;
  nim: number | null;
  prodi: string | null;
  angkatan: number | null;
  waveLabel: string | null;
  choices: ResultChoice[];
  acceptedLabel: string | null;
};

const RESULT_STATUS: Record<ResultChoice['status'], string> = {
  diterima: 'Diterima',
  ditolak: 'Ditolak',
  belum: 'Belum diputuskan',
};

/**
 * Tabel utama Hasil: satu baris per pendaftar, pilihan berurutan beserta
 * statusnya, dan divisi tempat diterima. Tidak memuat alasan/flag.
 */
export function resultsTable(rows: ResultExportRow[], maxChoices: number) {
  const header = [
    'Gelombang',
    'Nama',
    'NIM',
    'Program studi',
    'Angkatan',
    ...Array.from({ length: maxChoices }, (_, i) => `Pilihan ${i + 1}`),
    'Diterima di',
  ];
  const body = rows.map((r) => {
    const byRank = new Map(r.choices.map((c) => [c.rank, c]));
    return [
      r.waveLabel ?? '',
      r.name ?? '',
      r.nim ?? '',
      r.prodi ?? '',
      r.angkatan ?? '',
      ...Array.from({ length: maxChoices }, (_, i) => {
        const choice = byRank.get(i + 1);
        return choice
          ? `${choice.label} · ${RESULT_STATUS[choice.status]}`
          : '';
      }),
      r.acceptedLabel ?? '',
    ];
  });
  return { header, body };
}

/** Nama tab Excel: maksimal 31 karakter, tanpa karakter terlarang, unik. */
export function safeSheetName(label: string, used: Set<string>): string {
  const base =
    label
      .replace(/[\[\]:*?\/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 31)
      .trim() || 'Divisi';
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) {
    const suffix = ` (${i})`;
    name = `${base.slice(0, 31 - suffix.length).trimEnd()}${suffix}`;
  }
  used.add(name.toLowerCase());
  return name;
}

/** Sel aman: teks berawalan rumus diberi apostrof agar tidak dieksekusi Excel. */
export function safeCell(value: string | number) {
  return typeof value === 'string' && /^[=+\-@\t\r]/.test(value)
    ? `'${value}`
    : value;
}

export function resultsFilename(
  name: string,
  ext: 'csv' | 'xlsx',
): string {
  return `${slugOf(name)}-hasil.${ext}`;
}
