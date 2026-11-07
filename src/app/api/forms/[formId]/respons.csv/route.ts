import { TRPCError } from '@trpc/server';
import { type NextRequest, NextResponse } from 'next/server';
import { createCaller } from '~/server/api/root';
import { csvFilename, csvHeader, csvRow } from '~/server/api/routers/form/csv';
import { createTRPCContext } from '~/server/api/trpc';
import {
  RESPONSES_MAX_PAGE_SIZE,
  type ResponsesListOutput,
} from '~/server/api/types/form.type';

const STATUS: Partial<Record<TRPCError['code'], number>> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
};

/**
 * Ekspor semua respons satu form sebagai CSV (UTF-8 dengan BOM agar Excel
 * membacanya benar). Akses diperiksa lewat prosedur yang sama dengan halaman
 * respons *sebelum* aliran dimulai; setelah itu baris dialirkan per halaman.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  const { formId } = await params;
  // Satu caller untuk seluruh ekspor: aliran dibaca setelah handler selesai,
  // saat `headers()` milik request sudah tidak bisa dipakai.
  const api = createCaller(await createTRPCContext({ headers: req.headers }));
  // Batas waktu tetap: respons yang masuk selama aliran berjalan tidak
  // menggeser halaman (menggandakan atau menghilangkan baris).
  const until = new Date();

  let first: ResponsesListOutput;
  let title: string;
  try {
    first = await api.form.responses.list({
      formId,
      page: 1,
      pageSize: RESPONSES_MAX_PAGE_SIZE,
      until,
    });
    title = (await api.form.getById({ formId })).title;
  } catch (err) {
    if (err instanceof TRPCError) {
      return NextResponse.json(
        { message: err.message },
        { status: STATUS[err.code] ?? 500 },
      );
    }
    throw err;
  }

  const { columns } = first;
  const encoder = new TextEncoder();
  let page = 1;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`﻿${csvHeader(columns)}`));
    },
    async pull(controller) {
      const data: ResponsesListOutput =
        page === 1
          ? first
          : await api.form.responses.list({
              formId,
              page,
              pageSize: RESPONSES_MAX_PAGE_SIZE,
              until,
            });
      if (data.rows.length === 0) {
        controller.close();
        return;
      }
      controller.enqueue(
        encoder.encode(
          data.rows
            .map((row) =>
              csvRow(
                {
                  submittedAt: row.submittedAt,
                  updatedAt: row.updatedAt,
                  name: row.respondent.name,
                  nim: row.respondent.nim,
                  answers: row.answers,
                },
                columns,
              ),
            )
            .join(''),
        ),
      );
      if (data.rows.length < RESPONSES_MAX_PAGE_SIZE) controller.close();
      page += 1;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename(title)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
