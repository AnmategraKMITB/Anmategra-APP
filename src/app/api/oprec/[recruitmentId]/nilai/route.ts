import { type NextRequest } from 'next/server';
import { createCaller } from '~/server/api/root';
import { slugOf } from '~/server/api/routers/oprec/applicants-export';
import { createTRPCContext } from '~/server/api/trpc';
import { assessmentSheets, loadAnswers } from '~/server/export/oprec';
import {
  exportErrorResponse,
  parseFields,
  parseFormat,
  spreadsheetResponse,
  unlessForbidden,
} from '~/server/spreadsheet-response';

/**
 * Ekspor Nilai: satu tab per lingkup yang boleh dinilai pengekspor (Umum dan
 * tiap divisi). CSV memuat lingkup pertama. `?fields=` menambah jawaban
 * pertanyaan terpilih: umum di tab Umum, umum + bagian divisi di tab divisi.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recruitmentId: string }> },
) {
  const { recruitmentId } = await params;
  const format = parseFormat(req.nextUrl.searchParams.get('format'));
  const api = createCaller(await createTRPCContext({ headers: req.headers }));

  try {
    const { name } = await api.oprec.assessScopes({ recruitmentId });
    const fields = parseFields(req.nextUrl.searchParams);
    const answers = fields?.length
      ? await unlessForbidden(() => loadAnswers(api, recruitmentId, fields))
      : null;
    const sheets = assessmentSheets(
      await api.oprec.exportAssessment({ recruitmentId }),
      answers,
    );
    return await spreadsheetResponse(
      { title: `Nilai ${name}`, sheets },
      `${slugOf(name)}-nilai`,
      format,
    );
  } catch (err) {
    return exportErrorResponse(err);
  }
}
