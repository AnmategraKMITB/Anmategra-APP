'use client';

import {
  ChevronDown,
  ClipboardCopy,
  Download,
  FileSpreadsheet,
  ListChecks,
  Loader2,
  Sheet,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  googleDriveToken,
  googleSheetsAvailable,
  prepareGoogleDrive,
  uploadAsGoogleSheet,
} from '~/lib/forms/google-drive';
import {
  type WorkbookSpec,
  XLSX_MIME,
  buildXlsx,
  tableToCsv,
  tableToTsv,
} from '~/lib/spreadsheet/workbook';

import {
  type QuestionChoice,
  QuestionPicker,
  type QuestionSource,
  choiceSummary,
  readStoredChoice,
  storeChoice,
} from './question-picker';

type Source =
  /** Route ekspor server; menu menambahkan `format=xlsx|csv`. */
  | { href: string; csv?: boolean }
  /** Dibentuk di peramban; CSV dan salinan Sheets memakai tab pertama. */
  | { build: () => WorkbookSpec | Promise<WorkbookSpec>; copy?: boolean };

function withFormat(href: string, format: 'xlsx' | 'csv'): string {
  const url = new URL(href, window.location.origin);
  url.searchParams.set('format', format);
  return `${url.pathname}${url.search}`;
}

/** Tambahkan `fields=` dari pilihan pertanyaan; `null` = bawaan route. */
function withFields(href: string, choice: QuestionChoice): string {
  if (!choice) return href;
  const url = new URL(href, window.location.origin);
  url.searchParams.set('fields', choice.fieldIds.join(','));
  return `${url.pathname}${url.search}`;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Ambil berkas dari route ekspor; pesan galat server ditampilkan apa adanya. */
async function fetchExport(
  href: string,
  format: 'xlsx' | 'csv',
): Promise<{ blob: Blob; filename: string | null }> {
  const res = await fetch(withFormat(href, format), {
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? `Ekspor gagal (${res.status}).`);
  }
  const disposition = res.headers.get('Content-Disposition') ?? '';
  return {
    blob: await res.blob(),
    filename: /filename="([^"]+)"/.exec(disposition)?.[1] ?? null,
  };
}

/**
 * Satu tombol "Ekspor" yang sama di semua fitur: unduh Excel, buka langsung di
 * Google Sheets (dibuat di Drive pengguna, semua tab ikut), salin untuk
 * ditempel ke Sheets, dan unduh CSV.
 */
export function ExportMenu({
  filename,
  label = 'Ekspor',
  disabled = false,
  variant = 'dark_blue_outline',
  size,
  note,
  questions,
  ...source
}: Source & {
  /** Nama berkas tanpa ekstensi; juga dipakai sebagai nama spreadsheet di Drive. */
  filename: string;
  label?: string;
  disabled?: boolean;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  /** Keterangan singkat di atas pilihan, mis. tab apa saja yang ikut. */
  note?: string;
  /**
   * Aktifkan "Pilih pertanyaan": jawaban formulir terpilih ikut diekspor
   * (`?fields=`). Hanya untuk sumber `href`.
   */
  questions?: {
    source: QuestionSource;
    /** Isi bawaan route tanpa pilihan, mis. "Tanpa jawaban formulir". */
    defaultLabel: string;
    description: string;
  };
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [choice, setChoice] = useState<QuestionChoice>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  /** Route ekspor beserta `fields=` dari pilihan pertanyaan (bila diaktifkan). */
  const hrefFor = (c: QuestionChoice) =>
    'href' in source
      ? questions
        ? withFields(source.href, c)
        : source.href
      : null;
  const hasCsv = 'href' in source ? source.csv !== false : true;
  const hasCopy = 'build' in source && source.copy === true;

  const run = (what: string, task: () => Promise<void>) => {
    setBusy(what);
    task()
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error ? error.message : 'Ekspor gagal. Coba lagi.',
        ),
      )
      .finally(() => setBusy(null));
  };

  const spec = async () => {
    if (!('build' in source)) throw new Error('Sumber ekspor tidak dikenal.');
    return source.build();
  };

  /** XLSX beserta nama berkasnya (tanpa ekstensi); route server boleh menamai sendiri. */
  const xlsxFile = async (
    c: QuestionChoice,
  ): Promise<{ blob: Blob; name: string }> => {
    const exportHref = hrefFor(c);
    if (exportHref) {
      const file = await fetchExport(exportHref, 'xlsx');
      return {
        blob: file.blob,
        name: file.filename?.replace(/\.xlsx$/, '') ?? filename,
      };
    }
    return {
      blob: new Blob([await buildXlsx(await spec())], { type: XLSX_MIME }),
      name: filename,
    };
  };

  const downloadFrom = (href: string, format: 'xlsx' | 'csv') =>
    run(format, async () => {
      const file = await fetchExport(href, format);
      saveBlob(file.blob, file.filename ?? `${filename}.${format}`);
    });

  const downloadXlsx = (c: QuestionChoice = choice) => {
    const exportHref = hrefFor(c);
    if (exportHref) {
      downloadFrom(exportHref, 'xlsx');
      return;
    }
    run('xlsx', async () => {
      const file = await xlsxFile(c);
      saveBlob(file.blob, `${file.name}.xlsx`);
    });
  };

  const downloadCsv = (c: QuestionChoice = choice) => {
    const exportHref = hrefFor(c);
    if (exportHref) {
      downloadFrom(exportHref, 'csv');
      return;
    }
    run('csv', async () => {
      const first = (await spec()).sheets[0];
      if (!first) return;
      saveBlob(
        new Blob([tableToCsv(first)], { type: 'text/csv;charset=utf-8' }),
        `${filename}.csv`,
      );
    });
  };

  const copyForSheets = () =>
    run('copy', async () => {
      const first = (await spec()).sheets[0];
      if (!first) return;
      try {
        await navigator.clipboard.writeText(tableToTsv(first));
      } catch {
        throw new Error(
          'Penyalinan diblokir peramban. Pakai Unduh Excel atau Buka di Google Sheets.',
        );
      }
      toast.success('Tersalin. Tempel di Google Sheets atau Excel.');
    });

  const openInSheets = (c: QuestionChoice = choice) => {
    if (!googleSheetsAvailable()) {
      // Tanpa Client ID: unduh XLSX lalu arahkan cara membukanya di Sheets.
      run('sheets', async () => {
        const file = await xlsxFile(c);
        saveBlob(file.blob, `${file.name}.xlsx`);
        toast.info(
          'Berkas Excel terunduh. Buka sheets.google.com → File → Impor → Unggah untuk membukanya di Google Sheets.',
          { duration: 12_000 },
        );
      });
      return;
    }
    // Token diminta lebih dulu, tanpa await, supaya popup izin tidak diblokir.
    const token = googleDriveToken();
    token.catch(() => undefined);
    run('sheets', async () => {
      const [access, file] = await Promise.all([token, xlsxFile(c)]);
      const link = await uploadAsGoogleSheet(file.blob, file.name, access);
      toast.success('Spreadsheet dibuat di Google Drive kamu.', {
        duration: 20_000,
        action: {
          label: 'Buka',
          onClick: () => window.open(link, '_blank', 'noopener'),
        },
      });
    });
  };

  return (
    <>
      <DropdownMenu
        modal={false}
        onOpenChange={(open) => {
          if (!open) return;
          if (googleSheetsAvailable()) prepareGoogleDrive();
          // Dibaca ulang tiap dibuka: menu lain di oprec yang sama bisa saja
          // baru mengubah pilihannya.
          if (questions) setChoice(readStoredChoice(questions.source));
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size={size}
            disabled={disabled || busy !== null}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            {busy === 'sheets' ? 'Menyiapkan Sheets…' : label}
            <ChevronDown className="opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {note ? (
            <>
              <DropdownMenuLabel className="text-xs font-normal text-neutral-700">
                {note}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          ) : null}
          {questions ? (
            <>
              <DropdownMenuItem onSelect={() => setPickerOpen(true)}>
                <ListChecks />
                <span className="min-w-0 flex-1">
                  Pilih pertanyaan…
                  <span className="block truncate text-xs text-neutral-700">
                    {choiceSummary(choice, questions.defaultLabel)}
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem onSelect={() => downloadXlsx()}>
            <FileSpreadsheet /> Unduh Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openInSheets()}>
            <Sheet /> Buka di Google Sheets
          </DropdownMenuItem>
          {hasCopy ? (
            <DropdownMenuItem onSelect={copyForSheets}>
              <ClipboardCopy /> Salin untuk Sheets
            </DropdownMenuItem>
          ) : null}
          {hasCsv ? (
            <DropdownMenuItem onSelect={() => downloadCsv()}>
              <Download /> Unduh CSV
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {questions && pickerOpen ? (
        <QuestionPicker
          source={questions.source}
          value={choice}
          defaultLabel={questions.defaultLabel}
          description={questions.description}
          csv={hasCsv}
          onApply={(next, format) => {
            setChoice(next);
            storeChoice(questions.source, next);
            if (format === 'xlsx') downloadXlsx(next);
            else if (format === 'sheets') openInSheets(next);
            else if (format === 'csv') downloadCsv(next);
            else {
              toast.success(
                `Pilihan disimpan: ${choiceSummary(next, questions.defaultLabel)}.`,
              );
            }
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </>
  );
}
