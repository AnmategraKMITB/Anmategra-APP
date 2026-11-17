/**
 * Impor urutan prioritas dari spreadsheet: templat yang diunduh dari tab
 * Prioritas lalu diisi panitia di Excel atau Google Sheets.
 *
 * Murni, tanpa basis data. Masukannya tabel sel mentah dan kandidat tiap
 * divisi. Keluarannya rencana per divisi beserta masalah per baris. Selama
 * masih ada galat, tidak ada yang boleh ditulis.
 *
 * Aturan isi:
 * - Satu baris = satu pendaftar di satu divisi. Satu orang boleh muncul di
 *   beberapa divisi, karena tiap divisi mengurutkan sendiri.
 * - Urutan 1 paling diinginkan. Urutan kosong = tidak diambil. Celah
 *   (1, 2, 5) dirapatkan.
 * - Divisi yang muncul di file diganti seluruh urutannya. Kandidat divisi itu
 *   yang tidak ada di file dianggap tidak diurutkan. Divisi yang tidak muncul
 *   tidak disentuh.
 * - Kolom Keterangan opsional. Bila ada, keterangan baris itu diganti; sel
 *   kosong menghapusnya. Bila kolomnya tidak ada, keterangan tidak berubah.
 */
import { type CandidateBlock } from './priority';

/** Batas baris data yang dibaca dari satu file. */
export const MAX_IMPORT_ROWS = 20000;
/** Batas masalah yang dilaporkan per jenis; sisanya hanya dihitung. */
export const MAX_REPORTED_ISSUES = 200;
/** Sama dengan batas keterangan di papan prioritas. */
export const MAX_NOTE_LENGTH = 2000;
/** Sama dengan batas panjang daftar satu divisi. */
export const MAX_RANK = 5000;

/** Judul kolom yang dikenali (sudah dinormalkan) untuk tiap peran. */
const HEADER_ALIASES = {
  divisi: ['divisi'],
  id: ['id', 'id pendaftar'],
  nim: ['nim'],
  urutan: ['urutan', 'prioritas', 'peringkat', 'rank'],
  keterangan: ['keterangan', 'catatan', 'alasan'],
} as const;

type Role = keyof typeof HEADER_ALIASES;

export type ImportCandidate = {
  applicationId: string;
  /** NIM jurusan dan NIM TPB; keduanya dikenali. */
  nims: readonly number[];
  blocked: CandidateBlock | null;
};

export type ImportDivision = {
  id: string;
  /** Nama yang ditulis di templat; unik di oprec ini. */
  name: string;
  /** Nama lain yang juga diterima, mis. nama unit tanpa induknya. */
  aliases: readonly string[];
  canRank: boolean;
  locked: boolean;
  candidates: readonly ImportCandidate[];
};

export type ImportIssue = {
  /** Nomor baris di spreadsheet (1 = baris pertama file); null = per divisi. */
  row: number | null;
  message: string;
};

export type DivisionPlan = {
  divisionId: string;
  name: string;
  /** Id pendaftar terurut; indeks 0 = urutan 1. */
  order: string[];
  /** Keterangan per pendaftar yang barisnya ada; null bila tanpa kolom. */
  notes: Map<string, string | null> | null;
  /** Kandidat yang bisa diurutkan tetapi tidak ada di file. */
  missing: number;
  /** Baris berurutan yang diabaikan karena kandidatnya tidak bisa diurutkan. */
  skippedBlocked: number;
};

export type ImportPlan = {
  divisions: DivisionPlan[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
  errorCount: number;
  warningCount: number;
  /** Baris data yang terbaca (di luar judul dan baris kosong). */
  rowCount: number;
};

/** Huruf kecil, tanpa isi kurung, spasi dirapatkan. */
export function normalizeHeader(text: string): string {
  return text
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Nama divisi untuk dicocokkan: huruf kecil, spasi dirapatkan. */
export function normalizeName(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** "1", " 2 ", "3.0", "4,0" → angka; kosong → null; selain itu → NaN. */
export function parseRank(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const m = /^(\d+)(?:[.,]0+)?$/.exec(t);
  if (!m) return Number.NaN;
  return Number(m[1]);
}

/** Ambil digit NIM dari sel ("135 23 001", "13523001.0"); null bila tidak sah. */
export function parseNim(text: string): number | null {
  const t = text.trim().replace(/[.,]0+$/, '');
  const digits = t.replace(/[\s-]/g, '');
  if (!/^\d{5,12}$/.test(digits)) return null;
  return Number(digits);
}

const BLOCK_LABEL: Record<CandidateBlock, string> = {
  tidak_lolos: 'tidak lolos',
  closerec: 'sudah diterima lewat closerec',
};

/** Cari baris judul (dalam 10 baris pertama) dan posisi tiap kolom. */
function findHeader(
  table: readonly (readonly string[])[],
): { index: number; columns: Partial<Record<Role, number>> } | null {
  const limit = Math.min(table.length, 10);
  for (let r = 0; r < limit; r++) {
    const columns: Partial<Record<Role, number>> = {};
    (table[r] ?? []).forEach((cell, c) => {
      const h = normalizeHeader(cell);
      for (const role of Object.keys(HEADER_ALIASES) as Role[]) {
        if (
          columns[role] === undefined &&
          (HEADER_ALIASES[role] as readonly string[]).includes(h)
        ) {
          columns[role] = c;
        }
      }
    });
    if (columns.divisi !== undefined && columns.urutan !== undefined) {
      return { index: r, columns };
    }
  }
  return null;
}

type Entry = {
  row: number;
  applicationId: string;
  rank: number | null;
  note: string | null;
  blocked: CandidateBlock | null;
};

/**
 * Susun rencana impor dari tabel sel. `allowNim` false (mode blind bagi bukan
 * admin) berarti pendaftar hanya dikenali lewat kolom ID dari templat.
 */
export function planPriorityImport(input: {
  table: readonly (readonly string[])[];
  divisions: readonly ImportDivision[];
  allowNim: boolean;
}): ImportPlan {
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  let errorCount = 0;
  let warningCount = 0;
  const error = (row: number | null, message: string) => {
    errorCount += 1;
    if (errors.length < MAX_REPORTED_ISSUES) errors.push({ row, message });
  };
  const warn = (row: number | null, message: string) => {
    warningCount += 1;
    if (warnings.length < MAX_REPORTED_ISSUES) warnings.push({ row, message });
  };
  const result = (divisions: DivisionPlan[], rowCount: number): ImportPlan => ({
    divisions,
    errors,
    warnings,
    errorCount,
    warningCount,
    rowCount,
  });

  const header = findHeader(input.table);
  if (!header) {
    error(
      null,
      'Kolom "Divisi" dan "Urutan" tidak ditemukan. Pakai templat dari tab Prioritas dan jangan ubah judul kolomnya.',
    );
    return result([], 0);
  }
  const { columns } = header;
  const hasId = columns.id !== undefined;
  const hasNim = columns.nim !== undefined && input.allowNim;
  if (!hasId && !hasNim) {
    error(
      null,
      input.allowNim
        ? 'Butuh kolom "ID" atau "NIM" untuk mengenali pendaftar.'
        : 'Nama dan NIM disembunyikan di oprec ini, jadi pendaftar dikenali lewat kolom "ID" dari templat. Kolom itu tidak ditemukan.',
    );
    return result([], 0);
  }
  const hasNotes = columns.keterangan !== undefined;
  const cell = (row: readonly string[], role: Role) => {
    const c = columns[role];
    return c === undefined ? '' : (row[c] ?? '').trim();
  };

  const dataRows = input.table.length - header.index - 1;
  if (dataRows > MAX_IMPORT_ROWS) {
    error(
      null,
      `File berisi ${dataRows} baris; batasnya ${MAX_IMPORT_ROWS}. Pecah menjadi beberapa file.`,
    );
    return result([], 0);
  }

  const divisionByName = new Map<string, ImportDivision>();
  for (const d of input.divisions) {
    for (const name of [d.name, ...d.aliases]) {
      divisionByName.set(normalizeName(name), d);
    }
  }
  const knownApplicationIds = new Set(
    input.divisions.flatMap((d) => d.candidates.map((c) => c.applicationId)),
  );

  const entries = new Map<string, Entry[]>();
  const reportedDivision = new Set<string>();
  const unknownDivision = new Set<string>();
  let rowCount = 0;

  for (let r = header.index + 1; r < input.table.length; r++) {
    const row = input.table[r] ?? [];
    const rowNumber = r + 1;
    if (row.every((c) => c.trim() === '')) continue;
    rowCount += 1;

    const divisionText = cell(row, 'divisi');
    const rankText = cell(row, 'urutan');
    // Templat memberi awalan ' pada teks yang mirip rumus; buang lagi.
    const note = hasNotes
      ? cell(row, 'keterangan').replace(/^'(?=[=+\-@])/, '') || null
      : null;
    const rank = parseRank(rankText);
    // Baris tanpa urutan dan tanpa keterangan tidak mengubah apa pun, kecuali
    // menghapus keterangan lama bila kolom Keterangan ada.
    const meaningful = rank !== null || note !== null || hasNotes;

    if (divisionText === '') {
      if (rank !== null || note !== null) {
        error(rowNumber, 'Kolom Divisi kosong.');
      }
      continue;
    }
    const division = divisionByName.get(normalizeName(divisionText));
    if (!division) {
      const key = normalizeName(divisionText);
      if (!unknownDivision.has(key)) {
        unknownDivision.add(key);
        error(
          rowNumber,
          `Divisi "${divisionText}" tidak ada di oprec ini. Tulis persis seperti di templat.`,
        );
      }
      continue;
    }
    if (!division.canRank || division.locked) {
      if (!reportedDivision.has(division.id)) {
        reportedDivision.add(division.id);
        error(
          rowNumber,
          division.canRank
            ? `Daftar ${division.name} sudah dikunci. Buka kuncinya dulu di tab Prioritas.`
            : `Kamu tidak menyusun daftar ${division.name}.`,
        );
      }
      continue;
    }
    // Divisi yang muncul di file diganti urutannya walau semua barisnya kosong.
    const list = entries.get(division.id) ?? [];
    entries.set(division.id, list);
    if (!meaningful) continue;

    if (Number.isNaN(rank)) {
      error(
        rowNumber,
        `Urutan "${rankText}" tidak sah. Isi bilangan bulat mulai 1, atau kosongkan bila tidak diambil.`,
      );
      continue;
    }
    if (rank !== null && (rank < 1 || rank > MAX_RANK)) {
      error(rowNumber, `Urutan harus antara 1 dan ${MAX_RANK}.`);
      continue;
    }
    if (note !== null && note.length > MAX_NOTE_LENGTH) {
      error(
        rowNumber,
        `Keterangan terlalu panjang (${note.length} karakter, batas ${MAX_NOTE_LENGTH}).`,
      );
      continue;
    }

    // Kenali pendaftar: ID dulu, lalu NIM.
    const idText = cell(row, 'id');
    const nimText = hasNim ? cell(row, 'nim') : '';
    let candidate: ImportCandidate | undefined;
    if (hasId && idText !== '') {
      candidate = division.candidates.find((c) => c.applicationId === idText);
      if (!candidate) {
        error(
          rowNumber,
          knownApplicationIds.has(idText)
            ? `Pendaftar ini bukan kandidat ${division.name} (tidak memilih divisi ini dan tidak bersedia dipindahkan).`
            : `ID "${idText}" tidak dikenal. Jangan ubah kolom ID dari templat.`,
        );
        continue;
      }
    } else if (nimText !== '') {
      const nim = parseNim(nimText);
      if (nim === null) {
        error(rowNumber, `NIM "${nimText}" tidak sah.`);
        continue;
      }
      const found = division.candidates.filter((c) => c.nims.includes(nim));
      if (found.length !== 1) {
        error(
          rowNumber,
          found.length === 0
            ? `NIM ${nim} bukan kandidat ${division.name}.`
            : `NIM ${nim} cocok dengan lebih dari satu pendaftar. Pakai kolom ID dari templat.`,
        );
        continue;
      }
      candidate = found[0];
    } else {
      if (rank !== null || note !== null) {
        error(
          rowNumber,
          hasNim
            ? 'Kolom ID dan NIM kosong; pendaftar tidak bisa dikenali.'
            : 'Kolom ID kosong; pendaftar tidak bisa dikenali.',
        );
      }
      continue;
    }
    if (!candidate) continue;

    const id = candidate.applicationId;
    const dup = list.find((e) => e.applicationId === id);
    if (dup) {
      error(
        rowNumber,
        `Pendaftar ini sudah ada di baris ${dup.row} untuk ${division.name}.`,
      );
      continue;
    }
    list.push({
      row: rowNumber,
      applicationId: id,
      rank,
      note,
      blocked: candidate.blocked,
    });
  }

  const plans: DivisionPlan[] = [];
  for (const d of input.divisions) {
    const list = entries.get(d.id);
    if (!list) continue;
    let skippedBlocked = 0;
    const ranked: Entry[] = [];
    const usedRank = new Map<number, number>();
    for (const e of list) {
      if (e.rank === null) continue;
      if (e.blocked) {
        skippedBlocked += 1;
        warn(
          e.row,
          `Pendaftar ini ${BLOCK_LABEL[e.blocked]} di ${d.name}, jadi urutannya diabaikan.`,
        );
        continue;
      }
      const other = usedRank.get(e.rank);
      if (other !== undefined) {
        error(
          e.row,
          `Urutan ${e.rank} di ${d.name} sudah dipakai di baris ${other}.`,
        );
        continue;
      }
      usedRank.set(e.rank, e.row);
      ranked.push(e);
    }
    ranked.sort((a, b) => a.rank! - b.rank!);
    const present = new Set(list.map((e) => e.applicationId));
    const missing = d.candidates.filter(
      (c) => !c.blocked && !present.has(c.applicationId),
    ).length;
    if (missing > 0) {
      warn(
        null,
        `${missing} kandidat ${d.name} tidak ada di file; mereka dianggap tidak diurutkan.`,
      );
    }
    plans.push({
      divisionId: d.id,
      name: d.name,
      order: ranked.map((e) => e.applicationId),
      notes: hasNotes
        ? new Map(list.map((e) => [e.applicationId, e.note]))
        : null,
      missing,
      skippedBlocked,
    });
  }

  if (rowCount === 0) {
    error(null, 'File tidak berisi baris data di bawah judul kolom.');
  }
  return result(plans, rowCount);
}
