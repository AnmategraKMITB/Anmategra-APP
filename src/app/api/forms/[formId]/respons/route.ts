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
  parseFormat,
  spreadsheetResponse,
} from '~/server/spreadsheet-response';

import { GET as streamCsv } from '../respons.csv/route';

/**
 * Ekspor respons form sebagai XLSX (bawaan). `?format=csv` ditangani route
 * `respons.csv` yang mengalirkan baris per halaman.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  if (parseFormat(req.nextUrl.searchParams.get('format')) === 'csv') {
    return streamCsv(req, { params });
  }
  const { formId } = await params;
  const api = createCaller(await createTRPCContext({ headers: req.headers }));
  try {
    const data = await collectResponses(api, formId);
    const { title } = await api.form.getById({ formId });
    return await spreadsheetResponse(
      { title: `Respons ${title}`, sheets: [responsesSheet('Respons', data)] },
      `${fileSlug(title, 'form')}-respons`,
      'xlsx',
    );
  } catch (err) {
    return exportErrorResponse(err);
  }
}
