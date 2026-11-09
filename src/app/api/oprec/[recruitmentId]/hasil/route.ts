import { TRPCError } from '@trpc/server';
import ExcelJS from 'exceljs';
import { type NextRequest, NextResponse } from 'next/server';
import { createCaller } from '~/server/api/root';
import {
  applicantCsv,
  resultsFilename,
  resultsTable,
  safeCell,
  safeSheetName,
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

const DIVISION_HEADER = [
  'Nama',
  'NIM',
  'Program studi',
  'Angkatan',
  'Gelombang',
];

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
    const filename = resultsFilename(overview.name, format);

    await api.oprec.resultsLogExport({ recruitmentId, format });

    if (format === 'csv') {
      return new Response(applicantCsv(table), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    const used = new Set<string>();
    const main = workbook.addWorksheet(safeSheetName('Rekap', used));
    main.addRow(table.header).font = { bold: true };
    for (const row of table.body) {
      main.addRow(row.map(safeCell));
    }
    main.views = [{ state: 'frozen', ySplit: 1 }];
    main.columns.forEach((column) => {
      column.width = 22;
    });

    for (const division of overview.divisions) {
      const accepted = rows.filter(
        (row) => row.acceptedDivisionId === division.id,
      );
      const sheet = workbook.addWorksheet(
        safeSheetName(division.label, used),
      );
      sheet.addRow(DIVISION_HEADER).font = { bold: true };
      for (const row of accepted) {
        sheet.addRow(
          [
            row.name ?? '',
            row.nim ?? '',
            row.prodi ?? '',
            row.angkatan ?? '',
            row.waveLabel ?? '',
          ].map(safeCell),
        );
      }
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.columns.forEach((column) => {
        column.width = 22;
      });
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
