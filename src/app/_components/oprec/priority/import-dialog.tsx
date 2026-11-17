'use client';

import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { type RouterOutputs, api } from '~/trpc/react';

import { ErrorNote, Modal, Notice } from '../placement/shared';

type Preview = RouterOutputs['oprec']['priorityImportPreview'];

/** Sama dengan batas server. */
const MAX_BYTES = 5 * 1024 * 1024;

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('File tidak bisa dibaca.'));
    reader.readAsDataURL(file);
  });
}

const rowLabel = (row: number | null) => (row === null ? '' : `Baris ${row}: `);

function IssueList({
  issues,
  total,
}: {
  issues: Preview['errors'];
  total: number;
}) {
  return (
    <>
      <ul className="max-h-60 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-neutral-700">
        {issues.map((issue, i) => (
          <li key={i}>
            {rowLabel(issue.row)}
            {issue.message}
          </li>
        ))}
      </ul>
      {total > issues.length ? (
        <p className="text-sm text-neutral-700">
          dan {total - issues.length} lainnya.
        </p>
      ) : null}
    </>
  );
}

function PreviewSummary({ data }: { data: Preview }) {
  const changed = data.divisions.filter(
    (d) => d.orderChanged || d.notesChanged > 0,
  );
  return (
    <div className="grid gap-3">
      <p className="text-sm text-neutral-700">
        {data.rowCount} baris dibaca, {data.divisions.length} divisi di file.
      </p>

      {data.errorCount > 0 ? (
        <div className="grid gap-2 rounded-xl bg-danger-light p-4">
          <p role="alert" className="text-sm font-semibold text-danger-dark">
            Perbaiki dulu di file ({data.errorCount} masalah), lalu unggah lagi.
            Belum ada yang disimpan.
          </p>
          <IssueList issues={data.errors} total={data.errorCount} />
        </div>
      ) : null}

      {data.divisions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Perubahan per divisi</caption>
            <thead>
              <tr className="border-b border-neutral-400 text-neutral-700">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Divisi
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Diurutkan
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Tidak ada di file
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Perubahan
                </th>
              </tr>
            </thead>
            <tbody>
              {data.divisions.map((d) => (
                <tr key={d.divisionId} className="border-b border-neutral-300">
                  <th
                    scope="row"
                    className="py-2 pr-3 font-semibold text-neutral-1000"
                  >
                    {d.name}
                  </th>
                  <td className="py-2 pr-3">{d.ranked} orang</td>
                  <td className="py-2 pr-3">{d.missing}</td>
                  <td className="py-2">
                    {[
                      d.orderChanged ? 'urutan diganti' : null,
                      d.notesChanged > 0
                        ? `${d.notesChanged} keterangan`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(', ') || 'tidak berubah'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {data.warningCount > 0 ? (
        <details className="rounded-xl border border-neutral-400 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-1000">
            {data.warningCount} catatan (tidak menghalangi)
          </summary>
          <div className="mt-2">
            <IssueList issues={data.warnings} total={data.warningCount} />
          </div>
        </details>
      ) : null}

      {data.errorCount === 0 && changed.length === 0 ? (
        <Notice>Tidak ada perubahan dibanding daftar yang tersimpan.</Notice>
      ) : null}
    </div>
  );
}

/**
 * Templat dan impor daftar prioritas lewat spreadsheet: unduh templat, isi
 * kolom Urutan di Excel atau Google Sheets, lalu unggah. Pratinjau tampil
 * dulu; daftar baru disimpan setelah Terapkan.
 */
export function PriorityImport({
  recruitmentId,
  canImport,
  onImported,
  announce,
}: {
  recruitmentId: string;
  /** Metode prioritas dan penempatan masih berjalan. */
  canImport: boolean;
  onImported: () => void;
  announce: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; content: string } | null>(
    null,
  );
  const [readError, setReadError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = api.oprec.priorityImportPreview.useMutation();
  const applyImport = api.oprec.priorityImportApply.useMutation();

  const reset = () => {
    setFile(null);
    setReadError('');
    preview.reset();
    applyImport.reset();
    if (inputRef.current) inputRef.current.value = '';
  };

  const pick = async (picked: File | undefined) => {
    setFile(null);
    setReadError('');
    preview.reset();
    applyImport.reset();
    if (!picked) return;
    if (picked.size > MAX_BYTES) {
      setReadError('File terlalu besar (batas 5 MB).');
      return;
    }
    try {
      const content = await readBase64(picked);
      setFile({ name: picked.name, content });
      preview.mutate({ recruitmentId, fileName: picked.name, content });
    } catch (err) {
      setReadError(
        err instanceof Error ? err.message : 'File tidak bisa dibaca.',
      );
    }
  };

  const data = preview.data;
  const changed =
    data?.divisions.filter((d) => d.orderChanged || d.notesChanged > 0) ?? [];
  const canApply =
    file !== null &&
    data?.errorCount === 0 &&
    changed.length > 0 &&
    !applyImport.isPending;

  const apply = () => {
    if (!file || !canApply) return;
    applyImport.mutate(
      {
        recruitmentId,
        fileName: file.name,
        content: file.content,
        versions: Object.fromEntries(
          changed.map((d) => [d.divisionId, d.version]),
        ),
      },
      {
        onSuccess: (result) => {
          setOpen(false);
          reset();
          announce(
            `Urutan dari ${file.name} diterapkan ke ${result.updated} divisi.`,
          );
          onImported();
        },
      },
    );
  };

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button asChild variant="dark_blue_outline">
          <a href={`/api/oprec/${recruitmentId}/prioritas`} download>
            <Download /> Unduh templat
          </a>
        </Button>
        {canImport ? (
          <Button
            variant="dark_blue_outline"
            onClick={() => {
              reset();
              setOpen(true);
            }}
          >
            <Upload /> Impor urutan
          </Button>
        ) : null}
        <p className="text-sm text-neutral-700">
          Untuk menyusun banyak pendaftar di Excel atau Google Sheets.
        </p>
      </div>

      <Modal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        wide
        title="Impor urutan dari spreadsheet"
        description="Unggah templat yang sudah diisi (.xlsx atau .csv). Divisi yang ada di file diganti seluruh urutannya; yang tidak ada di file tidak berubah. Belum ada yang disimpan sampai kamu menekan Terapkan."
        footer={
          <>
            <Button
              variant="dark_blue_outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Batal
            </Button>
            <Button variant="dark_blue" disabled={!canApply} onClick={apply}>
              {applyImport.isPending ? 'Menerapkan…' : 'Terapkan'}
            </Button>
          </>
        }
      >
        <label className="grid gap-1 text-sm font-semibold text-neutral-1000">
          File isian
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(event) => void pick(event.target.files?.[0])}
            className="text-sm font-normal text-neutral-700 file:mr-3 file:rounded-full file:border-0 file:bg-primary-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-500"
          />
        </label>
        {readError ? <ErrorNote message={readError} /> : null}
        {preview.isPending ? (
          <p role="status" className="text-sm text-neutral-700">
            Membaca file…
          </p>
        ) : null}
        {preview.error ? <ErrorNote message={preview.error.message} /> : null}
        {data ? <PreviewSummary data={data} /> : null}
        {applyImport.error ? (
          <ErrorNote message={applyImport.error.message} />
        ) : null}
      </Modal>
    </>
  );
}
