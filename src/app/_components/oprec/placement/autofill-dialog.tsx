'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

import { ErrorNote, Loading, Modal } from './shared';

/** Dialog "Isi dari penilaian": pratinjau lalu terapkan keputusan. */
export function AutofillDialog({
  recruitmentId,
  open,
  onOpenChange,
  onDone,
  announce,
  onError,
}: {
  recruitmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  announce: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [overQuota, setOverQuota] = useState<'tolak' | 'masukkan'>('tolak');
  const preview = api.oprec.autofillPreview.useQuery(
    { recruitmentId },
    { enabled: open },
  );
  const commit = api.oprec.autofillCommit.useMutation({
    onSuccess: (result) => {
      announce(
        `${result.applied} keputusan diisi dari penilaian.`,
      );
      onDone();
      onOpenChange(false);
    },
    onError: (error) => onError(error.message),
  });

  const totals = preview.data?.totals;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Isi dari penilaian"
      description="Hanya sel aktif yang belum diputuskan yang diisi. Keputusan yang sudah ada tidak ditimpa."
      wide
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            disabled={commit.isPending || !preview.data || (totals?.terima ?? 0) + (totals?.tolak ?? 0) === 0}
            onClick={() => commit.mutate({ recruitmentId, overQuota })}
          >
            {commit.isPending ? 'Menerapkan…' : 'Terapkan'}
          </Button>
        </>
      }
    >
      {preview.isError ? (
        <ErrorNote message={preview.error.message} />
      ) : preview.isLoading || !preview.data ? (
        <Loading label="Menghitung pratinjau…" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-neutral-400">
            <table className="w-full text-sm">
              <thead className="bg-neutral-200 text-left text-xs font-semibold text-neutral-700">
                <tr>
                  <th className="px-3 py-2">Divisi</th>
                  <th className="px-3 py-2">Terima</th>
                  <th className="px-3 py-2">Tolak</th>
                  <th className="px-3 py-2">Dilewati</th>
                  <th className="px-3 py-2">Sisa kuota</th>
                </tr>
              </thead>
              <tbody>
                {preview.data.divisions.map((row) => (
                  <tr key={row.divisionId} className="border-t border-neutral-400">
                    <td className="px-3 py-2 font-semibold text-neutral-1000">
                      {row.label}
                    </td>
                    <td className="px-3 py-2">{row.terima}</td>
                    <td className="px-3 py-2">{row.tolak}</td>
                    <td className="px-3 py-2">{row.dilewati}</td>
                    <td className="px-3 py-2">
                      {row.remaining ?? 'Tanpa batas'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-neutral-700">
            Total: {totals?.terima ?? 0} terima, {totals?.tolak ?? 0} tolak,{' '}
            {totals?.dilewati ?? 0} dilewati.
          </p>

          {(totals?.over ?? 0) > 0 ? (
            <fieldset className="grid gap-2 rounded-xl bg-warning-light p-3">
              <legend className="px-1 text-sm font-semibold text-neutral-1000">
                {totals?.over} penerimaan melebihi sisa kuota
              </legend>
              <label className="flex items-center gap-2 text-sm text-neutral-1000">
                <input
                  type="radio"
                  name="autofill-over"
                  checked={overQuota === 'tolak'}
                  onChange={() => setOverQuota('tolak')}
                />
                Tolak yang melebihi kuota
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-1000">
                <input
                  type="radio"
                  name="autofill-over"
                  checked={overQuota === 'masukkan'}
                  onChange={() => setOverQuota('masukkan')}
                />
                Tetap masukkan semuanya
              </label>
            </fieldset>
          ) : null}
        </>
      )}
    </Modal>
  );
}
