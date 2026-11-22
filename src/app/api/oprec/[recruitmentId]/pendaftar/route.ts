import { type NextRequest } from 'next/server';
import { createCaller } from '~/server/api/root';
import { slugOf } from '~/server/api/routers/oprec/applicants-export';
import { createTRPCContext } from '~/server/api/trpc';
import {
  applicantsSheet,
  loadAnswers,
  loadApplicants,
  loadContacts,
} from '~/server/export/oprec';
import {
  exportErrorResponse,
  parseFields,
  parseFormat,
  spreadsheetResponse,
  unlessForbidden,
} from '~/server/spreadsheet-response';

/**
 * Ekspor seluruh pendaftar satu oprec sebagai XLSX atau CSV (`?format=`).
 * Akses diperiksa lewat prosedur yang sama dengan halaman Pendaftar; data diri
 * (email, WhatsApp, LINE) ikut bila pengekspor boleh melihatnya, ditambah
 * jawaban pertanyaan yang dipilih (`?fields=`).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recruitmentId: string }> },
) {
  const { recruitmentId } = await params;
  const format = parseFormat(req.nextUrl.searchParams.get('format'), 'csv');
  const api = createCaller(await createTRPCContext({ headers: req.headers }));

  try {
    const detail = await api.oprec.get({ recruitmentId });
    const [rows, contacts] = await Promise.all([
      loadApplicants(api, recruitmentId),
      unlessForbidden(() => loadContacts(api, recruitmentId)),
    ]);
    const fields = parseFields(req.nextUrl.searchParams);
    const answers = fields?.length
      ? await unlessForbidden(() => loadAnswers(api, recruitmentId, fields))
      : null;
    return await spreadsheetResponse(
      {
        title: `Pendaftar ${detail.name}`,
        sheets: [applicantsSheet(rows, detail.maxChoices, contacts, answers)],
      },
      `${slugOf(detail.name)}-pendaftar`,
      format,
    );
  } catch (err) {
    return exportErrorResponse(err);
  }
}
