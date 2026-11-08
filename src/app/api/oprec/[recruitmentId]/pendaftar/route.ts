import { TRPCError } from '@trpc/server';
import ExcelJS from 'exceljs';
import { type NextRequest, NextResponse } from 'next/server';
import { createCaller } from '~/server/api/root';
import {
  applicantCsv,
  applicantTable,
  exportFilename,
} from '~/server/api/routers/oprec/applicants-export';
import { createTRPCContext } from '~/server/api/trpc';
import { APPLICANTS_MAX_PAGE_SIZE } from '~/server/api/types/oprec.type';

const STATUS: Partial<Record<TRPCError['code'], number>> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
};

/**
 * Ekspor seluruh pendaftar satu oprec sebagai CSV atau XLSX (`?format=`).
 * Akses diperiksa lewat prosedur yang sama dengan halaman Pendaftar.
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
    const detail = await api.oprec.get({ recruitmentId });
    const rows: Awaited<ReturnType<typeof api.oprec.applicants>>['rows'] = [];
    for (let page = 1; ; page++) {
      const data = await api.oprec.applicants({
        recruitmentId,
        sort: 'gelombang',
        page,
        pageSize: APPLICANTS_MAX_PAGE_SIZE,
      });
      rows.push(...data.rows);
      if (rows.length >= data.total || data.rows.length === 0) break;
    }
    const table = applicantTable(rows, detail.maxChoices);
    const filename = exportFilename(detail.name, format);

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
    const sheet = workbook.addWorksheet('Pendaftar');
    sheet.addRow(table.header).font = { bold: true };
    for (const row of table.body) {
      // Teks diberi awalan aman bila berbentuk rumus.
      sheet.addRow(
        row.map((cell) =>
          typeof cell === 'string' && /^[=+\-@\t\r]/.test(cell)
            ? `'${cell}`
            : cell,
        ),
      );
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.columns.forEach((col) => {
      col.width = 22;
    });
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
