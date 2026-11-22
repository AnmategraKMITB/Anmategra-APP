import { type NextRequest } from 'next/server';
import { createCaller } from '~/server/api/root';
import { slugOf } from '~/server/api/routers/oprec/applicants-export';
import { createTRPCContext } from '~/server/api/trpc';
import { loadPlacement, placementSheets } from '~/server/export/oprec';
import {
  exportErrorResponse,
  parseFormat,
  spreadsheetResponse,
} from '~/server/spreadsheet-response';

/**
 * Ekspor Penempatan: satu tab per divisi yang keputusannya dipegang
 * pengekspor, berisi kandidat, tahap, dan keputusan. Alasan tidak ikut.
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
    const sheets = placementSheets(await loadPlacement(api, recruitmentId));
    return await spreadsheetResponse(
      { title: `Penempatan ${name}`, sheets },
      `${slugOf(name)}-penempatan`,
      format,
    );
  } catch (err) {
    return exportErrorResponse(err);
  }
}
