import { plainLabel } from '~/lib/forms/plain-label';
import { type SheetCell, type SheetTable } from '~/lib/spreadsheet/workbook';
import { type createCaller } from '~/server/api/root';
import {
  type ResponseColumn,
  formatCsvAnswer,
  formatWib,
} from '~/server/api/routers/form/csv';
import {
  RESPONSES_MAX_PAGE_SIZE,
  type ResponsesListOutput,
} from '~/server/api/types/form.type';

type Caller = ReturnType<typeof createCaller>;

/**
 * Semua respons satu form lewat prosedur halaman respons (akses ikut
 * diperiksa di sana). Batas waktu tetap supaya respons yang masuk selama
 * pengambilan tidak menggeser halaman.
 */
export async function collectResponses(api: Caller, formId: string) {
  const until = new Date();
  const rows: ResponsesListOutput['rows'] = [];
  let columns: ResponseColumn[] = [];
  for (let page = 1; ; page++) {
    const data = await api.form.responses.list({
      formId,
      page,
      pageSize: RESPONSES_MAX_PAGE_SIZE,
      until,
    });
    columns = data.columns;
    rows.push(...data.rows);
    if (data.rows.length < RESPONSES_MAX_PAGE_SIZE) break;
  }
  return { columns, rows };
}

/** Satu sel jawaban: angka tetap angka, selebihnya teks seperti di CSV. */
export function answerCell(type: string, raw: unknown): SheetCell {
  const numeric = type === 'number' || type === 'scale';
  return numeric && typeof raw === 'number' ? raw : formatCsvAnswer(type, raw);
}

/** Judul kolom jawaban: label tanpa format, ditandai bila pertanyaannya diarsipkan. */
export const answerTitle = (c: { label: string; archived: boolean }) =>
  `${plainLabel(c.label)}${c.archived ? ' (diarsipkan)' : ''}`;

/** Tab respons: kolom yang sama dengan CSV, angka tetap angka. */
export function responsesSheet(
  name: string,
  { columns, rows }: Awaited<ReturnType<typeof collectResponses>>,
): SheetTable {
  return {
    name,
    header: [
      'Waktu kirim',
      'Diubah pada',
      'Nama',
      'NIM',
      'Email',
      ...columns.map(answerTitle),
    ],
    rows: rows.map((row) => [
      formatWib(row.submittedAt),
      formatWib(row.updatedAt),
      row.respondent.name,
      row.respondent.nim,
      row.respondent.email,
      ...columns.map((column) =>
        answerCell(column.type, row.answers[column.fieldId]),
      ),
    ]),
    wrap: columns
      .map((c, i) => (c.type === 'long_text' || c.type === 'file' ? i + 5 : -1))
      .filter((i) => i >= 0),
  };
}
