'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { isFileAnswerList } from '~/lib/forms/file-answer';
import { formatCsvAnswer } from '~/server/api/routers/form/csv';
import { isAllowedFileHost } from '~/server/api/types/form.constants';
import type {
  ResponseColumn,
  ResponseRowOut,
} from '~/server/api/types/form.type';

import { richTextToPlain } from './rich-text';

const when = (d: Date) =>
  d.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  });

const show = (column: ResponseColumn, row: ResponseRowOut) =>
  formatCsvAnswer(column.type, row.answers[column.fieldId]);

/**
 * Jawaban berkas ditampilkan sebagai tautan. Isi jawaban dikirim klien, jadi
 * hanya URL dari host OneDrive/SharePoint yang dijadikan tautan.
 */
function FileAnswer({ value }: { value: unknown }) {
  const files = isFileAnswerList(value) ? value : [];
  if (files.length === 0) return '—';
  return (
    <ul className="grid gap-1">
      {files.map((file) => (
        <li key={file.itemId}>
          {isAllowedFileHost(file.url) ? (
            <a
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              {file.name}
            </a>
          ) : (
            file.name
          )}
        </li>
      ))}
    </ul>
  );
}

/** Tab Tabel: 50 respons per halaman; klik satu baris untuk melihat rinciannya. */
export function ResponsesTable({
  columns,
  rows,
  total,
  page,
  pageSize,
  onPage,
  loading,
}: {
  columns: ResponseColumn[];
  rows: ResponseRowOut[];
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState<ResponseRowOut | null>(null);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (total === 0) {
    return (
      <p className="rounded-[24px] border border-neutral-400 p-8 text-center text-neutral-700">
        Belum ada yang mengirim jawaban.
      </p>
    );
  }

  return (
    <div>
      <div
        className="overflow-x-auto rounded-[24px] border border-neutral-400 bg-neutral-50"
        aria-busy={loading}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Waktu kirim</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>NIM</TableHead>
              {columns.map((c) => (
                <TableHead key={c.fieldId} className="min-w-40">
                  {richTextToPlain(c.label)}
                  {c.archived ? ' (diarsipkan)' : ''}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => setOpen(row)}
              >
                <TableCell className="whitespace-nowrap">
                  <button
                    type="button"
                    className="text-left font-medium text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(row);
                    }}
                  >
                    {when(row.submittedAt)}
                  </button>
                </TableCell>
                <TableCell>{row.respondent.name ?? '—'}</TableCell>
                <TableCell>{row.respondent.nim ?? '—'}</TableCell>
                {columns.map((c) => (
                  <TableCell key={c.fieldId} className="max-w-64 align-top">
                    {c.type === 'file' ? (
                      <FileAnswer value={row.answers[c.fieldId]} />
                    ) : (
                      show(c, row) || '—'
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-neutral-700">
        <span>
          {total} respons · halaman {page} dari {pages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="dark_blue_outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft /> Sebelumnya
          </Button>
          <Button
            variant="dark_blue_outline"
            size="sm"
            disabled={page >= pages || loading}
            onClick={() => onPage(page + 1)}
          >
            Berikutnya <ChevronRight />
          </Button>
        </div>
      </div>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open ? (
            <>
              <SheetHeader>
                <SheetTitle>{open.respondent.name ?? 'Tanpa nama'}</SheetTitle>
                <SheetDescription>
                  {open.respondent.nim ? `NIM ${open.respondent.nim} · ` : ''}
                  {when(open.submittedAt)}
                </SheetDescription>
              </SheetHeader>
              <dl className="mt-6 grid gap-3">
                {columns.map((c) => (
                  <div
                    key={c.fieldId}
                    className="rounded-xl bg-neutral-100 px-3 py-2"
                  >
                    <dt className="text-sm text-neutral-700">
                      {richTextToPlain(c.label)}
                      {c.archived ? ' (diarsipkan)' : ''}
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-line break-words text-neutral-1000">
                      {c.type === 'file' ? (
                        <FileAnswer value={open.answers[c.fieldId]} />
                      ) : (
                        show(c, open) || '—'
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
