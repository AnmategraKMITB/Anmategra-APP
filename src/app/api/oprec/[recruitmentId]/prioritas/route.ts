import { TRPCError } from '@trpc/server';
import { type NextRequest, NextResponse } from 'next/server';
import { createCaller } from '~/server/api/root';
import { escapeCsvCell } from '~/server/api/routers/form/csv';
import { slugOf } from '~/server/api/routers/oprec/applicants-export';
import {
  templateTable,
  templateWorkbook,
} from '~/server/api/routers/oprec/priority-sheet';
import { createTRPCContext } from '~/server/api/trpc';

const STATUS: Partial<Record<TRPCError['code'], number>> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
};

/**
 * Templat daftar prioritas sebagai XLSX (bawaan) atau CSV (`?format=csv`):
 * satu baris per pendaftar per divisi yang boleh disusun pemanggil, diisi lalu
 * diunggah lagi lewat "Impor urutan". Akses sama dengan tab Prioritas.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recruitmentId: string }> },
) {
  const { recruitmentId } = await params;
  const format =
    req.nextUrl.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';
  const api = createCaller(await createTRPCContext({ headers: req.headers }));

  try {
    const data = await api.oprec.priorityTemplate({ recruitmentId });
    const filename = `${slugOf(data.recruitmentName)}-prioritas.${format}`;
    const headers = {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    };

    if (format === 'csv') {
      const table = templateTable(data);
      const line = (cells: (string | number)[]) =>
        `${cells.map((c) => escapeCsvCell(c)).join(',')}\r\n`;
      // UTF-8 dengan BOM (U+FEFF) agar Excel membaca huruf dengan benar.
      const bom = String.fromCharCode(0xfeff);
      const csv = `${bom}${line(table.header)}${table.body.map(line).join('')}`;
      return new Response(csv, {
        headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' },
      });
    }

    const buffer = await templateWorkbook(data);
    return new Response(buffer, {
      headers: {
        ...headers,
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
