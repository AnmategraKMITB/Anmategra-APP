import { type NextRequest } from 'next/server';
import { createCaller } from '~/server/api/root';
import {
  PROVISIONAL_BANNER,
  parseResultsScope,
  resultsFilename,
} from '~/server/api/routers/oprec/applicants-export';
import { createTRPCContext } from '~/server/api/trpc';
import {
  acceptedSheets,
  loadContacts,
  loadResults,
  resultsSheet,
} from '~/server/export/oprec';
import {
  exportErrorResponse,
  parseFormat,
  spreadsheetResponse,
  unlessForbidden,
} from '~/server/spreadsheet-response';

/**
 * Ekspor Hasil sebagai XLSX atau CSV (`?format=`). `scope=semua`: rekap semua
 * pendaftar lalu anggota yang diterima; `scope=diterima`: hanya anggota yang
 * diterima, satu tab gabungan dan satu tab per divisi, lengkap dengan data diri
 * bila boleh dilihat. CSV memuat tab pertama. Tidak memuat alasan, flag, atau
 * catatan sensitif.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recruitmentId: string }> },
) {
  const { recruitmentId } = await params;
  const format = parseFormat(req.nextUrl.searchParams.get('format'), 'csv');
  const scope = parseResultsScope(req.nextUrl.searchParams.get('scope'));
  const api = createCaller(await createTRPCContext({ headers: req.headers }));

  try {
    const overview = await api.oprec.resultsOverview({ recruitmentId });
    const [rows, contacts] = await Promise.all([
      loadResults(api, recruitmentId),
      unlessForbidden(() => loadContacts(api, recruitmentId)),
    ]);
    const banner = overview.published ? undefined : PROVISIONAL_BANNER;
    const accepted = acceptedSheets(rows, overview.divisions, contacts, banner);
    const sheets =
      scope === 'semua'
        ? [resultsSheet(rows, overview.maxChoices, banner), ...accepted]
        : accepted;

    await api.oprec.resultsLogExport({ recruitmentId, format });

    return await spreadsheetResponse(
      {
        title: `Hasil ${overview.name}${overview.published ? '' : ' - SEMENTARA (belum final)'}`,
        sheets,
      },
      resultsFilename(overview.name, format, {
        scope,
        provisional: !overview.published,
      }).replace(/\.(csv|xlsx)$/, ''),
      format,
    );
  } catch (err) {
    return exportErrorResponse(err);
  }
}
