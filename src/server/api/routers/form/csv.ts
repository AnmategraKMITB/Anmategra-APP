export type ResponseColumn = {
  fieldId: string;
  type: string;
  label: string;
  archived: boolean;
};

export type ResponseRow = {
  submittedAt: Date;
  updatedAt: Date;
  name: string | null;
  nim: number | string | null;
  answers: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pad2 = (value: number): string => value.toString().padStart(2, '0');

function stripMarkdownLite(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\+\+([^+]+)\+\+/g, '$1');
}

/** Waktu WIB (UTC+7), `YYYY-MM-DD HH:mm:ss`. */
function formatWib(date: Date): string {
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  if (Number.isNaN(shifted.getTime())) return '';

  const day = `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
  const time = `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}`;
  return `${day} ${time}`;
}

function optionLabel(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (typeof value.label === 'string') return value.label;
  if (typeof value.optionId === 'string') return value.optionId;
  return null;
}

function selectedLabel(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (typeof value.label === 'string') return value.label;
  if (typeof value.columnId === 'string') return value.columnId;
  return null;
}

function formatMatrix(value: unknown): string {
  if (!Array.isArray(value)) return '';

  const rows: string[] = [];
  for (const row of value as unknown[]) {
    if (!isRecord(row)) continue;
    const rowLabel =
      typeof row.rowLabel === 'string'
        ? row.rowLabel
        : typeof row.rowId === 'string'
          ? row.rowId
          : '';
    if (rowLabel === '' || !Array.isArray(row.selected)) continue;

    const labels = (row.selected as unknown[])
      .map(selectedLabel)
      .filter((label): label is string => label !== null);
    if (labels.length > 0) rows.push(`${rowLabel}: ${labels.join(', ')}`);
  }
  return rows.join('; ');
}

/** Nama berkas aman dari judul form. */
export function csvFilename(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');

  return `${slug === '' ? 'form' : slug}-respons.csv`;
}

/** Satu sel CSV: lindungi dari rumus (hanya teks), lalu kutip bila perlu. */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text = typeof value === 'string' ? value : String(value as number);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  if (/[,"\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Jawaban sebagai teks datar; bentuk tak dikenal menjadi kosong. */
export function formatCsvAnswer(type: string, value: unknown): string {
  if (value === null || value === undefined) return '';

  switch (type) {
    case 'short_text':
    case 'long_text':
    case 'link':
    case 'date':
      return typeof value === 'string' ? value : '';
    case 'number':
    case 'scale':
      return typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : '';
    case 'checkbox':
      return value === true ? 'Ya' : value === false ? 'Tidak' : '';
    case 'single_choice':
      return optionLabel(value) ?? '';
    case 'unit_choice':
      return Array.isArray(value)
        ? (value as unknown[])
            .map(optionLabel)
            .map((label, i) => (label === null ? null : `${i + 1}. ${label}`))
            .filter((label): label is string => label !== null)
            .join('; ')
        : '';
    case 'multiple_choice':
      return Array.isArray(value)
        ? (value as unknown[])
            .map(optionLabel)
            .filter((label): label is string => label !== null)
            .join('; ')
        : '';
    case 'matrix':
      return formatMatrix(value);
    case 'file':
      return Array.isArray(value)
        ? (value as unknown[])
            .map((f) =>
              isRecord(f) && typeof f.name === 'string'
                ? `${f.name} (${typeof f.url === 'string' ? f.url : ''})`
                : '',
            )
            .filter(Boolean)
            .join('; ')
        : '';
    default:
      return '';
  }
}

export function csvHeader(columns: ResponseColumn[]): string {
  const cells = ['Waktu kirim', 'Diubah pada', 'Nama', 'NIM'];
  for (const column of columns) {
    const suffix = column.archived ? ' (diarsipkan)' : '';
    cells.push(`${stripMarkdownLite(column.label)}${suffix}`);
  }
  return `${cells.map((cell) => escapeCsvCell(cell)).join(',')}\r\n`;
}

export function csvRow(row: ResponseRow, columns: ResponseColumn[]): string {
  const cells = [
    formatWib(row.submittedAt),
    formatWib(row.updatedAt),
    escapeCsvCell(row.name),
    escapeCsvCell(row.nim),
  ];

  for (const column of columns) {
    const raw = row.answers[column.fieldId];
    const numeric = column.type === 'number' || column.type === 'scale';
    // Angka (termasuk negatif) ditulis apa adanya; hanya teks yang dijaga dari rumus.
    cells.push(
      numeric && typeof raw === 'number' && Number.isFinite(raw)
        ? String(raw)
        : escapeCsvCell(formatCsvAnswer(column.type, raw)),
    );
  }

  return `${cells.join(',')}\r\n`;
}
