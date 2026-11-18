'use client';

import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
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
import { api } from '~/trpc/react';

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
 * hanya URL dari host berkas yang diizinkan yang dijadikan tautan. Jawaban
 * lama bertipe tautan (teks URL) tetap dibaca.
 */
export function FileAnswer({ value }: { value: unknown }) {
  if (typeof value === 'string' && isAllowedFileHost(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        {value}
      </a>
    );
  }
  const files = (isFileAnswerList(value) ? value : []).filter(
    (file, index, all) =>
      all.findIndex((other) => other.itemId === file.itemId) === index,
  );
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
      {files.some((f) => f.provider === 'google-drive') ? (
        <li className="text-xs text-neutral-700">
          Tidak bisa dibuka? Minta pelamar mengatur akses berkas ke &quot;Siapa
          saja yang memiliki link&quot;.
        </li>
      ) : null}
    </ul>
  );
}

/** Tab Tabel: 50 respons per halaman; klik satu baris untuk melihat rinciannya. */
export function ResponsesTable({
  formId,
  columns,
  rows,
  total,
  page,
  pageSize,
  onPage,
  loading,
}: {
  formId: string;
  columns: ResponseColumn[];
  rows: ResponseRowOut[];
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState<ResponseRowOut | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const utils = api.useUtils();
  const remove = api.form.responses.delete.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      setSelected(new Set());
      setConfirmDelete(false);
      void utils.form.responses.list.invalidate();
      void utils.form.responses.summary.invalidate();
      void utils.form.getById.invalidate({ formId });
      const lastPage = Math.max(
        1,
        Math.ceil((total - result.deleted) / pageSize),
      );
      if (page > lastPage) onPage(lastPage);
    },
    onError: (error) => toast.error(error.message),
  });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = rows.some((r) => selected.has(r.id));

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const changePage = (next: number) => {
    setSelected(new Set());
    onPage(next);
  };

  if (total === 0) {
    return (
      <p className="rounded-[24px] border border-neutral-400 p-8 text-center text-neutral-700">
        Belum ada yang mengirim jawaban.
      </p>
    );
  }

  return (
    <div>
      {selected.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-neutral-400 bg-neutral-50 px-4 py-3">
          <p className="text-sm font-medium text-neutral-700">
            {selected.size} respons dipilih
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={remove.isPending}
              onClick={() => setSelected(new Set())}
            >
              Batal pilih
            </Button>
            <Button
              variant="warning"
              size="sm"
              disabled={remove.isPending}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 /> Hapus
            </Button>
          </div>
        </div>
      ) : null}
      <div
        className="overflow-x-auto rounded-[24px] border border-neutral-400 bg-neutral-50"
        aria-busy={loading}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    allSelected ? true : someSelected ? 'indeterminate' : false
                  }
                  onCheckedChange={toggleAll}
                  aria-label="Pilih semua respons di halaman ini"
                />
              </TableHead>
              <TableHead className="whitespace-nowrap">Waktu kirim</TableHead>
              <TableHead className="whitespace-nowrap">Diubah pada</TableHead>
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
                <TableCell
                  className="w-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selected.has(row.id)}
                    onCheckedChange={() => toggleOne(row.id)}
                    aria-label={`Pilih respons ${row.respondent.name ?? row.id}`}
                  />
                </TableCell>
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
                <TableCell className="whitespace-nowrap">
                  {when(row.updatedAt)}
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
            disabled={page <= 1 || loading || remove.isPending}
            onClick={() => changePage(page - 1)}
          >
            <ChevronLeft /> Sebelumnya
          </Button>
          <Button
            variant="dark_blue_outline"
            size="sm"
            disabled={page >= pages || loading || remove.isPending}
            onClick={() => changePage(page + 1)}
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
                  Dikirim {when(open.submittedAt)}
                  {open.updatedAt.getTime() !== open.submittedAt.getTime()
                    ? ` · diubah ${when(open.updatedAt)}`
                    : ''}
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

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus {selected.size} respons?</DialogTitle>
            <DialogDescription>
              Jawaban yang dihapus tidak bisa dikembalikan. Pendaftar oprec yang
              terhubung tetap tercatat, tetapi jawabannya hilang dari form ini.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="dark_blue_outline"
              disabled={remove.isPending}
              onClick={() => setConfirmDelete(false)}
            >
              Batal
            </Button>
            <Button
              variant="warning"
              disabled={remove.isPending || selected.size === 0}
              onClick={() =>
                remove.mutate({
                  formId,
                  submissionIds: [...selected],
                })
              }
            >
              <Trash2 /> {remove.isPending ? 'Menghapus…' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
