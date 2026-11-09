'use client';

import { useState } from 'react';
import { api } from '~/trpc/react';

import { Loading, when } from './shared';

const ACTION_LABEL: Record<string, string> = {
  keputusan_penempatan: 'Keputusan disimpan',
  banding_diterima: 'Diterima lewat banding',
  pindah_langsung: 'Dipindahkan admin',
  pindah_diminta: 'Permintaan pindah dibuat',
  pindah_diputuskan: 'Permintaan pindah diputuskan',
  pindah_dibatalkan: 'Permintaan pindah dibatalkan',
  closerec_ditambah: 'Ditambahkan lewat closerec',
  closerec_dicabut: 'Closerec dicabut',
};

/** Riwayat tindakan penempatan satu pendaftar; dimuat saat dibuka. */
export function RowHistory({
  recruitmentId,
  applicationId,
}: {
  recruitmentId: string;
  applicationId: string;
}) {
  const [open, setOpen] = useState(false);
  const history = api.oprec.placementHistory.useQuery(
    { recruitmentId, applicationId },
    { enabled: open },
  );

  return (
    <details
      className="mt-1"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-xs font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
        Riwayat tindakan
      </summary>
      <div className="mt-2 max-w-72">
        {!open ? null : history.isLoading ? (
          <Loading label="Memuat riwayat…" />
        ) : history.isError ? (
          <p role="alert" className="text-xs text-danger-dark">
            {history.error.message}
          </p>
        ) : (history.data?.length ?? 0) === 0 ? (
          <p className="text-xs text-neutral-700">Belum ada tindakan.</p>
        ) : (
          <ol className="grid gap-1.5">
            {(history.data ?? []).map((entry) => (
              <li key={entry.id} className="text-xs text-neutral-700">
                <span className="font-semibold text-neutral-1000">
                  {ACTION_LABEL[entry.action] ?? entry.action}
                </span>
                {entry.actorName ? ` · ${entry.actorName}` : ''}
                <span className="block">{when(entry.createdAt)}</span>
                {typeof entry.detail.decision === 'string' ? (
                  <span className="block">
                    Keputusan: {entry.detail.decision}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
