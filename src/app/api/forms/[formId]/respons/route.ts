import { type NextRequest } from 'next/server';
import { fileSlug } from '~/lib/spreadsheet/workbook';
import { createCaller } from '~/server/api/root';
import { createTRPCContext } from '~/server/api/trpc';
import {
  collectResponses,
  responsesSheet,
} from '~/server/export/form-responses';
import {
  exportErrorResponse,
  parseFields,
  parseFormat,
  spreadsheetResponse,
} from '~/server/spreadsheet-response';

import { GET as streamCsv } from '../respons.csv/route';

/**
 * Ekspor respons form sebagai XLSX (bawaan) atau CSV. `?fields=id1,id2`
 * membatasi kolom jawaban ke pertanyaan terpilih (identitas responden tetap
 * ikut). CSV tanpa pilihan ditangani route `respons.csv` yang mengalirkan
 * baris per halaman.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  const format = parseFormat(req.nextUrl.searchParams.get('format'));
  const fields = parseFields(req.nextUrl.searchParams);
  if (format === 'csv' && fields === undefined) {
    return streamCsv(req, { params });
  }
  const { formId } = await params;
  const api = createCaller(await createTRPCContext({ headers: req.headers }));
  try {
    const data = await collectResponses(api, formId);
    if (fields) {
      const wanted = new Set(fields);
      data.columns = data.columns.filter((c) => wanted.has(c.fieldId));
    }
    const { title } = await api.form.getById({ formId });
    return await spreadsheetResponse(
      { title: `Respons ${title}`, sheets: [responsesSheet('Respons', data)] },
      `${fileSlug(title, 'form')}-respons`,
      format,
    );
  } catch (err) {
    return exportErrorResponse(err);
  }
}
