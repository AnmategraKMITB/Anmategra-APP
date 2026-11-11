'use client';

import { Copy, Download, Upload } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { cn } from '~/lib/utils';
import { type RouterInputs, type RouterOutputs, api } from '~/trpc/react';

import { parseDelimited, rowsToObjects, toTsv } from './tsv';

type ImportRow = RouterInputs['oprec']['criteriaImportPreview']['rows'][number];

const KRITERIA_HEADERS: string[] = [
  'Divisi',
  'Kriteria',
  'Jenis',
  'Bobot',
  'Ekspektasi',
  'Pertanyaan terkait',
];

const PERTANYAAN_HEADERS: string[] = [
  'Divisi',
  'No',
  'Pertanyaan',
  'Tipe',
  'Wajib',
  'Opsi jawaban',
];

const HEADER_ALIASES: Record<string, string[]> = {
  divisi: ['divisi'],
  kriteria: ['kriteria'],
  jenis: ['jenis'],
  bobot: ['bobot'],
  ekspektasi: ['ekspektasi'],
  pertanyaanTerkait: ['pertanyaan terkait'],
};

const REQUIRED_HEADERS = ['divisi', 'kriteria', 'jenis'];

const PREVIEW_LIMIT = 20;

function criteriaTable(
  data: RouterOutputs['oprec']['criteriaExport'] | undefined,
  template: boolean,
): string[][] {
  if (template) {
    return [
      [
        'Umum',
        'Contoh kriteria',
        'Skor',
        '20',
        'Deskripsi ekspektasi umum',
        '1, 2',
      ],
    ];
  }
  return (data?.kriteria ?? []).map((row) => [
    row.divisi,
    row.kriteria,
    row.jenis,
    String(row.bobot ?? ''),
    row.ekspektasi,
    row.pertanyaanTerkait,
  ]);
}

function questionsTable(
  data: RouterOutputs['oprec']['criteriaExport'] | undefined,
  template: boolean,
): string[][] {
  if (template) {
    return [['Umum', '1', 'Contoh pertanyaan', 'Teks', 'Ya', 'Opsi 1; Opsi 2']];
  }
  return (data?.pertanyaan ?? []).map((row) => [
    row.divisi,
    String(row.no),
    row.pertanyaan,
    row.tipe,
    row.wajib,
    row.opsi,
  ]);
}

function toCsv(rows: (string | number | null)[][]): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = value === null ? '' : String(value);
          return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(','),
    )
    .join('\n');
}

function downloadCsv(
  filename: string,
  rows: (string | number | null)[][],
): void {
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fallbackCopy(text: string): void {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '0';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand('copy');
  } catch {
    // diabaikan: pengguna masih bisa memilih teks manual
  }
  area.remove();
}

async function writeClipboard(text: string): Promise<boolean> {
  const clipboard = navigator.clipboard;
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function tabClass(active: boolean): string {
  return cn(
    'flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
    active
      ? 'bg-neutral-50 text-primary-400'
      : 'text-neutral-700 hover:bg-neutral-200',
  );
}

function SheetBody({
  recruitmentId,
  onClose,
}: {
  recruitmentId: string;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const exported = api.oprec.criteriaExport.useQuery({ recruitmentId });
  const preview = api.oprec.criteriaImportPreview.useMutation();
  const apply = api.oprec.criteriaImportApply.useMutation();

  const [tab, setTab] = useState<'ekspor' | 'impor'>('ekspor');
  const [exportKind, setExportKind] = useState<'kriteria' | 'pertanyaan'>(
    'kriteria',
  );
  const [mode, setMode] = useState<'isi' | 'templat'>('isi');
  const [copied, setCopied] = useState(false);
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [missing, setMissing] = useState<string[]>([]);

  const template = mode === 'templat';
  const headers =
    exportKind === 'kriteria' ? KRITERIA_HEADERS : PERTANYAAN_HEADERS;
  const exportRows =
    exportKind === 'kriteria'
      ? criteriaTable(exported.data, template)
      : questionsTable(exported.data, template);
  const filename =
    exportKind === 'kriteria' ? 'kriteria.csv' : 'pertanyaan.csv';

  const copy = async () => {
    const text = toTsv([headers, ...exportRows]);
    const ok = await writeClipboard(text);
    if (!ok) fallbackCopy(text);
    setCopied(true);
  };

  const buildRows = (): ImportRow[] => {
    const parsed = parseDelimited(raw);
    const result = rowsToObjects(parsed, HEADER_ALIASES);
    const missingRequired = REQUIRED_HEADERS.filter((key) =>
      result.missing.includes(key),
    );
    setMissing(missingRequired);
    if (missingRequired.length > 0) return [];
    return result.objects.map((object) => ({
      divisi: object.divisi ?? '',
      kriteria: object.kriteria ?? '',
      jenis: object.jenis ?? '',
      bobot: object.bobot ?? '',
      ekspektasi: object.ekspektasi ?? '',
      pertanyaanTerkait: object.pertanyaanTerkait ?? '',
    }));
  };

  const runPreview = () => {
    const next = buildRows();
    setRows(next);
    preview.reset();
    apply.reset();
    if (next.length === 0) return;
    preview.mutate({ recruitmentId, rows: next });
  };

  const runApply = () => {
    if (rows.length === 0) return;
    apply.mutate(
      { recruitmentId, rows },
      {
        onSuccess: () => {
          void utils.oprec.criteriaList.invalidate({ recruitmentId });
        },
      },
    );
  };

  const readFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setRaw(text);
      preview.reset();
      apply.reset();
      setMissing([]);
      setRows([]);
    };
    reader.readAsText(file);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Ekspor / impor sheet</DialogTitle>
        <DialogDescription>
          Unduh kriteria atau pertanyaan sebagai CSV, atau tempel kembali dari
          spreadsheet. Baris bermasalah dilewati saat impor.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3">
        <div
          role="tablist"
          aria-label="Ekspor atau impor"
          className="flex gap-1 rounded-xl bg-neutral-100 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ekspor'}
            className={tabClass(tab === 'ekspor')}
            onClick={() => setTab('ekspor')}
          >
            Ekspor
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'impor'}
            className={tabClass(tab === 'impor')}
            onClick={() => setTab('impor')}
          >
            Impor
          </button>
        </div>

        {tab === 'ekspor' ? (
          <div role="tabpanel" className="grid gap-3">
            <div
              role="tablist"
              aria-label="Jenis data ekspor"
              className="flex gap-1 rounded-xl bg-neutral-100 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={exportKind === 'kriteria'}
                className={tabClass(exportKind === 'kriteria')}
                onClick={() => {
                  setExportKind('kriteria');
                  setCopied(false);
                }}
              >
                Kriteria
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={exportKind === 'pertanyaan'}
                className={tabClass(exportKind === 'pertanyaan')}
                onClick={() => {
                  setExportKind('pertanyaan');
                  setCopied(false);
                }}
              >
                Pertanyaan
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="radio"
                  name="sheet-mode"
                  className="size-4 accent-primary-400"
                  checked={mode === 'isi'}
                  onChange={() => setMode('isi')}
                />
                Isi sekarang
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="radio"
                  name="sheet-mode"
                  className="size-4 accent-primary-400"
                  checked={mode === 'templat'}
                  onChange={() => setMode('templat')}
                />
                Templat kosong
              </label>
            </div>

            <div className="overflow-x-auto rounded-xl border border-neutral-400">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr>
                    {headers.map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="bg-neutral-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-700"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exportRows.slice(0, PREVIEW_LIMIT).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-neutral-200">
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-3 py-2 text-neutral-1000"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {exportRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={headers.length}
                        className="px-3 py-3 text-sm text-neutral-700"
                      >
                        Belum ada data untuk diekspor.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {exportRows.length > PREVIEW_LIMIT ? (
              <p className="text-sm text-neutral-700">
                Pratinjau {PREVIEW_LIMIT} baris pertama dari {exportRows.length}{' '}
                baris.
              </p>
            ) : null}
            {template ? (
              <p className="text-sm text-neutral-700">
                Baris contoh hanya untuk melihat bentuk kolom, tidak ikut
                diterapkan.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="dark_blue_outline"
                size="sm"
                onClick={() => void copy()}
              >
                <Copy /> Salin sebagai tab-delimited
              </Button>
              <Button
                type="button"
                variant="dark_blue_outline"
                size="sm"
                onClick={() => downloadCsv(filename, [headers, ...exportRows])}
              >
                <Download /> Unduh CSV
              </Button>
              {copied ? (
                <span className="text-sm text-success-dark">Tersalin</span>
              ) : null}
            </div>
          </div>
        ) : (
          <div role="tabpanel" className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sheet-import-text">
                Tempel tab Kriteria dari spreadsheet
              </Label>
              <textarea
                id="sheet-import-text"
                rows={6}
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  preview.reset();
                  apply.reset();
                  setMissing([]);
                  setRows([]);
                }}
                placeholder={
                  'Divisi\tKriteria\tJenis\tBobot\tEkspektasi\tPertanyaan terkait'
                }
                className="w-full rounded-lg border border-neutral-400 bg-neutral-50 px-3 py-2 font-mono text-sm text-neutral-1000 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="sheet-import-file">
                Atau unggah berkas .csv, .tsv, .txt
              </Label>
              <Input
                id="sheet-import-file"
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                onChange={(e) => readFile(e.target.files?.[0])}
              />
            </div>

            {missing.length > 0 ? (
              <p role="alert" className="text-sm text-danger-dark">
                Kolom wajib tidak ditemukan: {missing.join(', ')}.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="dark_blue"
                size="sm"
                disabled={raw.trim() === '' || preview.isPending}
                onClick={runPreview}
              >
                <Upload /> Pratinjau impor
              </Button>
              <Button
                type="button"
                variant="dark_blue_outline"
                size="sm"
                disabled={
                  rows.length === 0 ||
                  apply.isPending ||
                  preview.data === undefined
                }
                onClick={runApply}
              >
                Terapkan
              </Button>
            </div>

            {preview.isError ? (
              <p role="alert" className="text-sm text-danger-dark">
                {preview.error.message}
              </p>
            ) : null}

            {preview.data ? (
              <div className="grid gap-1">
                <p className="text-sm text-neutral-1000">
                  {preview.data.newRows} baru, {preview.data.updatedRows}{' '}
                  diperbarui, {preview.data.problems.length} bermasalah
                </p>
                {preview.data.problems.length > 0 ? (
                  <ul className="grid gap-1 text-sm text-danger-dark">
                    {preview.data.problems.map((problem, index) => (
                      <li key={`${problem.row}-${index}`}>
                        Baris {problem.row}: {problem.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {apply.isError ? (
              <p role="alert" className="text-sm text-danger-dark">
                {apply.error.message}
              </p>
            ) : null}

            {apply.data ? (
              <div className="grid gap-1">
                <p className="text-sm text-success-dark">
                  {apply.data.applied} kriteria diterapkan.
                </p>
                {apply.data.problems.length > 0 ? (
                  <ul className="grid gap-1 text-sm text-danger-dark">
                    {apply.data.problems.map((problem, index) => (
                      <li key={`${problem.row}-${index}`}>
                        Baris {problem.row}: {problem.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="dark_blue_outline" onClick={onClose}>
          Tutup
        </Button>
      </DialogFooter>
    </>
  );
}

export function SheetDialog({
  recruitmentId,
  open,
  onOpenChange,
}: {
  recruitmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[20px] sm:max-w-3xl">
        <SheetBody
          key={open ? 'buka' : 'tutup'}
          recruitmentId={recruitmentId}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
