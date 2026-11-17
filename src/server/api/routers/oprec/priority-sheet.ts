/**
 * Baca dan tulis spreadsheet daftar prioritas: membaca file unggahan (.xlsx
 * atau .csv) menjadi tabel sel teks, dan menyusun templat yang diunduh dari
 * tab Prioritas.
 */
import { TRPCError } from '@trpc/server';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { MAX_IMPORT_ROWS } from '~/lib/oprec/priority-import';

/** Batas baris fisik yang dibaca; baris kosong di ekor dibuang dulu. */
const MAX_PHYSICAL_ROWS = MAX_IMPORT_ROWS + 50;
/** Batas kolom yang dibaca per baris. */
const MAX_COLUMNS = 60;

const badRequest = (message: string): never => {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
};

function trimTrailingEmpty(table: string[][]): string[][] {
  let end = table.length;
  while (end > 0 && table[end - 1]!.every((c) => c.trim() === '')) end -= 1;
  return table.slice(0, end);
}

function readCsv(content: Buffer): string[][] {
  const raw = content.toString('utf8');
  // Buang penanda BOM (U+FEFF) yang ditulis Excel di awal CSV.
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  // Excel berbahasa Indonesia sering menyimpan CSV dengan titik koma.
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delimiter =
    count(';') > count(',') ? ';' : count('\t') > count(',') ? '\t' : ',';
  let rows: string[][];
  try {
    rows = parse(text, {
      delimiter,
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: false,
      to: MAX_PHYSICAL_ROWS,
    });
  } catch {
    return badRequest(
      'File CSV tidak bisa dibaca. Simpan ulang sebagai .csv atau .xlsx.',
    );
  }
  return trimTrailingEmpty(rows.map((row) => row.slice(0, MAX_COLUMNS)));
}

async function readXlsx(content: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(
      content.buffer.slice(
        content.byteOffset,
        content.byteOffset + content.byteLength,
      ) as ArrayBuffer,
    );
  } catch {
    return badRequest(
      'File Excel tidak bisa dibaca. Simpan ulang sebagai .xlsx atau .csv.',
    );
  }
  const sheet =
    workbook.worksheets.find(
      (s) => s.name.trim().toLowerCase() === 'prioritas',
    ) ??
    workbook.worksheets.find(
      (s) => s.name.trim().toLowerCase() !== 'petunjuk',
    ) ??
    workbook.worksheets[0];
  if (!sheet) return badRequest('File Excel tidak berisi lembar apa pun.');

  const rowTotal = Math.min(sheet.rowCount, MAX_PHYSICAL_ROWS);
  const colTotal = Math.min(sheet.columnCount, MAX_COLUMNS);
  const table: string[][] = [];
  for (let r = 1; r <= rowTotal; r++) {
    const row = sheet.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= colTotal; c++) {
      let text = '';
      try {
        text = row.getCell(c).text ?? '';
      } catch {
        text = '';
      }
      cells.push(text);
    }
    table.push(cells);
  }
  return trimTrailingEmpty(table);
}

/** File unggahan → tabel sel teks. Format dikenali dari isinya, bukan nama. */
export async function readSheet(
  fileName: string,
  content: Buffer,
): Promise<string[][]> {
  // .xlsx adalah arsip zip (diawali "PK").
  if (content.length >= 2 && content[0] === 0x50 && content[1] === 0x4b) {
    return readXlsx(content);
  }
  if (/\.xlsx$/i.test(fileName)) {
    return badRequest(
      'File .xlsx ini rusak. Unduh ulang dari Google Sheets atau Excel.',
    );
  }
  if (/\.(xls|ods|numbers)$/i.test(fileName)) {
    return badRequest(
      'Format ini tidak didukung. Simpan sebagai .xlsx atau .csv.',
    );
  }
  return readCsv(content);
}

// ---------------------------------------------------------------------------
// Templat
// ---------------------------------------------------------------------------

export type TemplateRow = {
  division: string;
  code: string;
  name: string | null;
  nim: number | null;
  prodi: string | null;
  angkatan: number | null;
  /** Pilihan ke-n, atau null bila kandidat lewat "bersedia dipindahkan". */
  choiceRank: number | null;
  choices: string;
  willingToMove: boolean;
  blocked: 'tidak_lolos' | 'closerec' | null;
  score: number | null;
  rank: number | null;
  note: string | null;
  applicationId: string;
  /**
   * Jawaban formulir, sejajar dengan `TemplateData.answerColumns`. Kosong
   * untuk pertanyaan di bagian khusus divisi lain.
   */
  answers: string[];
};

export type TemplateData = {
  recruitmentName: string;
  blind: boolean;
  /** Judul pertanyaan formulir yang ikut di templat, urut seperti di form. */
  answerColumns: string[];
  divisions: {
    name: string;
    quota: number;
    candidates: number;
    rankable: number;
  }[];
  rows: TemplateRow[];
};

/** Lindungi teks dari rumus spreadsheet; dibuang lagi saat impor. */
function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Batas isi satu sel (Excel menolak lebih dari 32.767 karakter). */
const MAX_CELL = 32000;

/**
 * Judul kolom jawaban: diawali "Jawaban: " supaya tidak pernah tertukar dengan
 * kolom Divisi/Urutan/ID saat impor, dan dibuat unik bila ada judul kembar.
 */
export function answerHeaders(labels: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return labels.map((label) => {
    const base = `Jawaban: ${label.replace(/\s+/g, ' ').trim() || 'Tanpa judul'}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

/**
 * Tabel templat: judul dan isi, tanpa kolom identitas pada mode blind. Kolom
 * jawaban formulir ada di paling kanan, setelah ID.
 */
export function templateTable(data: TemplateData) {
  const identity = !data.blind;
  const header = [
    'Divisi',
    'Kode',
    ...(identity ? ['Nama', 'NIM', 'Program studi', 'Angkatan'] : []),
    'Pilihan',
    'Urutan pilihan pendaftar',
    'Bersedia dipindahkan',
    'Bisa diurutkan',
    'Nilai',
    'Urutan',
    'Keterangan',
    'ID (jangan diubah)',
    ...answerHeaders(data.answerColumns),
  ];
  const body = data.rows.map((r) => [
    safeText(r.division),
    r.code,
    ...(identity
      ? [
          safeText(r.name ?? ''),
          r.nim ?? '',
          safeText(r.prodi ?? ''),
          r.angkatan ?? '',
        ]
      : []),
    r.choiceRank ?? 'Dipindahkan',
    safeText(r.choices),
    r.willingToMove ? 'Ya' : 'Tidak',
    r.blocked === 'tidak_lolos'
      ? 'Tidak: tidak lolos'
      : r.blocked === 'closerec'
        ? 'Tidak: sudah diterima lewat closerec'
        : 'Ya',
    r.score === null ? '' : Math.round(r.score * 100) / 100,
    r.rank ?? '',
    safeText(r.note ?? ''),
    r.applicationId,
    ...data.answerColumns.map((_, i) =>
      safeText((r.answers[i] ?? '').slice(0, MAX_CELL)),
    ),
  ]);
  return { header, body };
}

const GUIDE = [
  'Cara mengisi',
  '1. Satu baris = satu pendaftar di satu divisi. Orang yang memilih beberapa divisi muncul di tiap divisi itu, dan tiap divisi mengurutkan sendiri.',
  '2. Isi kolom Urutan: 1 = paling diinginkan divisi itu. Kosongkan untuk pendaftar yang tidak diambil.',
  '3. Urutan dalam satu divisi tidak boleh dobel. Celah (1, 2, 5) tidak apa-apa; urutannya dirapatkan.',
  '4. Urutkan lebih banyak dari kuota bila calonnya masih layak. Orang di bawah batas kuota masih bisa masuk bila orang di atasnya diterima di pilihan yang lebih tinggi.',
  '5. Penempatan akhir ditentukan sistem dari urutan ini dan urutan pilihan pendaftar, bukan dari spreadsheet ini.',
  '6. Baris dengan "Bisa diurutkan: Tidak" diabaikan walau diberi urutan.',
  '7. Keterangan opsional. Sel kosong menghapus keterangan lama.',
  '8. Jangan ubah kolom Divisi dan ID. Baris boleh disortir atau difilter. Kolom lain boleh dihapus, kecuali Divisi, Urutan, dan ID (atau NIM).',
  '9. Divisi yang ada di file diganti seluruh urutannya. Kandidat divisi itu yang barisnya dihapus dianggap tidak diambil. Divisi yang tidak ada di file tidak berubah.',
  '10. Simpan sebagai .xlsx atau .csv (Google Sheets: File → Download), lalu unggah lewat "Impor urutan" di tab Prioritas. Sistem menampilkan pratinjau dulu sebelum menyimpan.',
  '11. Kolom "Jawaban: ..." di paling kanan berisi jawaban formulir pendaftar, untuk bahan menyeleksi. Pertanyaan khusus divisi lain dikosongkan. Kolom ini tidak dibaca saat impor.',
];

/** Workbook templat: lembar Prioritas (diisi) dan Petunjuk (kuota per divisi). */
export async function templateWorkbook(
  data: TemplateData,
): Promise<ArrayBuffer> {
  const table = templateTable(data);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Prioritas');
  sheet.addRow(table.header).font = { bold: true };
  for (const row of table.body) sheet.addRow(row);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns.forEach((col) => {
    col.width = 18;
  });
  const widen = (title: string, width: number) => {
    const index = table.header.indexOf(title);
    if (index >= 0) sheet.getColumn(index + 1).width = width;
  };
  widen('Nama', 28);
  widen('Urutan pilihan pendaftar', 36);
  widen('Keterangan', 40);
  widen('ID (jangan diubah)', 38);
  for (const title of answerHeaders(data.answerColumns)) widen(title, 40);
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: table.header.length },
  };

  const guide = workbook.addWorksheet('Petunjuk');
  guide.getColumn(1).width = 110;
  guide.addRow([data.recruitmentName]).font = { bold: true, size: 14 };
  guide.addRow([]);
  for (const [i, line] of GUIDE.entries()) {
    const row = guide.addRow([line]);
    if (i === 0) row.font = { bold: true };
    row.alignment = { wrapText: true, vertical: 'top' };
  }
  guide.addRow([]);
  const head = guide.addRow(['Divisi', 'Kuota', 'Kandidat', 'Bisa diurutkan']);
  head.font = { bold: true };
  guide.getColumn(2).width = 12;
  guide.getColumn(3).width = 12;
  guide.getColumn(4).width = 16;
  for (const d of data.divisions) {
    guide.addRow([
      safeText(d.name),
      d.quota === 0 ? 'Tanpa batas' : d.quota,
      d.candidates,
      d.rankable,
    ]);
  }
  return workbook.xlsx.writeBuffer();
}
