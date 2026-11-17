import { TRPCError } from '@trpc/server';
import ExcelJS from 'exceljs';
import { type NextRequest, NextResponse } from 'next/server';
import { createCaller } from '~/server/api/root';
import {
  DIVISION_HEADER,
  acceptedFlatTable,
  applicantCsv,
  divisionSheets,
  parseResultsScope,
  resultsFilename,
  resultsTable,
  safeCell,
} from '~/server/api/routers/oprec/applicants-export';
import { createTRPCContext } from '~/server/api/trpc';
import { RESULTS_MAX_PAGE_SIZE } from '~/server/api/types/oprec.type';

const STATUS: Partial<Record<TRPCError['code'], number>> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  CONFLICT: 409,
};

/**
 * Ekspor Hasil sebagai CSV atau XLSX (`?format=`): rekap utama ditambah satu
 * tab per divisi untuk XLSX. Tidak memuat alasan, flag, atau catatan sensitif.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recruitmentId: string }> },
) {
  const { recruitmentId } = await params;
  const format =
    req.nextUrl.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  const scope = parseResultsScope(req.nextUrl.searchParams.get('scope'));
  const api = createCaller(await createTRPCContext({ headers: req.headers }));

  try {
    const overview = await api.oprec.resultsOverview({ recruitmentId });
    const rows: Awaited<ReturnType<typeof api.oprec.resultsList>>['rows'] = [];
    for (let page = 1; ; page++) {
      const data = await api.oprec.resultsList({
        recruitmentId,
        page,
        pageSize: RESULTS_MAX_PAGE_SIZE,
      });
      rows.push(...data.rows);
      if (rows.length >= data.total || data.rows.length === 0) break;
    }

    const table = resultsTable(
      rows.map((row) => ({
        name: row.name,
        nim: row.nim,
        prodi: row.prodi,
        angkatan: row.angkatan,
        waveLabel: row.waveLabel,
        acceptedLabel: row.acceptedLabel,
        choices: row.choices.map((choice) => ({
          rank: choice.rank,
          label: choice.label,
          status:
            choice.decision === 'terima'
              ? ('diterima' as const)
              : choice.decision === 'tolak'
                ? ('ditolak' as const)
                : ('belum' as const),
        })),
      })),
      overview.maxChoices,
    );
    const filename = resultsFilename(overview.name, format, {
      scope,
      provisional: !overview.published,
    });

    await api.oprec.resultsLogExport({ recruitmentId, format });

    if (format === 'csv') {
      const csvTable =
        scope === 'diterima'
          ? acceptedFlatTable(rows, overview.divisions)
          : table;
      return new Response(applicantCsv(csvTable), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.title = `Hasil ${overview.name}${overview.published ? '' : ' - SEMENTARA (belum final)'}`;
    const style = (sheet: ExcelJS.Worksheet) => {
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.columns.forEach((column) => {
        column.width = 22;
      });
    };
    if (scope === 'semua') {
      const main = workbook.addWorksheet('Rekap');
      main.addRow(table.header).font = { bold: true };
      for (const row of table.body) main.addRow(row.map(safeCell));
      style(main);
    }
    const sheets = divisionSheets(rows, overview.divisions);
    for (const data of sheets) {
      const name =
        scope === 'semua' && data.name.toLowerCase() === 'rekap'
          ? 'Rekap (2)'
          : data.name;
      const sheet = workbook.addWorksheet(name);
      sheet.addRow(DIVISION_HEADER).font = { bold: true };
      for (const row of data.body) sheet.addRow(row.map(safeCell));
      style(sheet);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    if (err instanceof TRPCError) {
      return NextResponse.json(
        { message: err.message },
        { status: STATUS[err.code] ?? 500 },
      );
    }
    throw err;
  }
}
