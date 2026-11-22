import { TRPCError } from '@trpc/server';
import { NextResponse } from 'next/server';
import {
  type WorkbookSpec,
  XLSX_MIME,
  buildXlsx,
  tableToCsv,
} from '~/lib/spreadsheet/workbook';

export type SpreadsheetFormat = 'csv' | 'xlsx';

/** `?format=` dari URL; selain `csv`/`xlsx` jatuh ke bawaan. */
export function parseFormat(
  value: string | null,
  fallback: SpreadsheetFormat = 'xlsx',
): SpreadsheetFormat {
  return value === 'csv' || value === 'xlsx' ? value : fallback;
}

/**
 * `?fields=id1,id2` dari dialog Pilih pertanyaan: daftar id pertanyaan yang
 * jawabannya ikut diekspor. Tidak ada = bawaan route; kosong = tanpa jawaban.
 */
export function parseFields(params: URLSearchParams): string[] | undefined {
  const raw = params.get('fields');
  if (raw === null) return undefined;
  return [
    ...new Set(
      raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ].slice(0, 500);
}

/**
 * Kirim workbook sebagai unduhan. CSV hanya memuat satu tab, jadi pemanggil
 * memilih tab mana (bawaan: tab pertama).
 */
export async function spreadsheetResponse(
  spec: WorkbookSpec,
  filename: string,
  format: SpreadsheetFormat,
  csvSheet = 0,
): Promise<Response> {
  const headers = {
    'Content-Disposition': `attachment; filename="${filename}.${format}"`,
    'Cache-Control': 'private, no-store',
  };
  if (format === 'csv') {
    const table = spec.sheets[csvSheet] ?? { name: '', header: [], rows: [] };
    return new Response(tableToCsv(table), {
      headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' },
    });
  }
  return new Response(await buildXlsx(spec), {
    headers: { ...headers, 'Content-Type': XLSX_MIME },
  });
}

const STATUS: Partial<Record<TRPCError['code'], number>> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  CONFLICT: 409,
};

/** Galat tRPC dari prosedur yang dipanggil route ekspor menjadi JSON berstatus. */
export function exportErrorResponse(err: unknown): Response {
  if (err instanceof TRPCError) {
    return NextResponse.json(
      { message: err.message },
      { status: STATUS[err.code] ?? 500 },
    );
  }
  throw err;
}

/** Bagian ekspor yang ditolak aksesnya dilewati, bukan menggagalkan semuanya. */
export async function unlessForbidden<T>(
  load: () => Promise<T>,
): Promise<T | null> {
  try {
    return await load();
  } catch (err) {
    if (
      err instanceof TRPCError &&
      (err.code === 'FORBIDDEN' || err.code === 'NOT_FOUND')
    ) {
      return null;
    }
    throw err;
  }
}
