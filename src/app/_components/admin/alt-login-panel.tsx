'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

import { AdminEditPanel } from './admin-edit-panel';

const STATUS_LABEL = {
  menunggu: 'Menunggu persetujuan',
  aktif: 'Aktif',
  berakhir: 'Berakhir',
  dicabut: 'Dicabut',
} as const;

function formatDate(value: Date) {
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Daftar pengguna jalur login alternatif (Google pribadi + KTM) dan tombol cabut akses. */
export function AltLoginPanel({
  canWrite,
  onClose,
}: {
  canWrite: boolean;
  onClose: () => void;
}) {
  const [onlyActive, setOnlyActive] = useState(false);
  const utils = api.useUtils();
  const list = api.altLogin.adminList.useQuery({ onlyActive });
  const refresh = () =>
    Promise.all([
      utils.altLogin.adminList.invalidate(),
      utils.altLogin.adminPendingCount.invalidate(),
    ]);
  const revoke = api.altLogin.adminRevoke.useMutation({ onSuccess: refresh });
  const approve = api.altLogin.adminApprove.useMutation({ onSuccess: refresh });
  const busy = revoke.isPending || approve.isPending;

  return (
    <AdminEditPanel
      title="Akses alternatif"
      description="Mahasiswa yang masuk lewat email kontak + NIM + KTM karena akun ITB bermasalah. Akses berlaku 6 jam dan hanya untuk mengisi form. Pengajuan yang bersengketa (NIM yang sama diajukan lebih dari sekali dalam 24 jam) ditahan sampai disetujui di sini; menyetujui satu pengajuan otomatis mencabut pengajuan saingannya."
      onClose={onClose}
      error={
        approve.error?.message ??
        revoke.error?.message ??
        list.error?.message ??
        null
      }
    >
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={onlyActive}
          onChange={(event) => setOnlyActive(event.target.checked)}
        />
        Hanya yang masih aktif
      </label>
      {list.isLoading ? (
        <p className="text-sm text-neutral-700">Memuat…</p>
      ) : list.data?.length ? (
        <ul className="grid gap-2">
          {list.data.map((row) => (
            <li
              key={row.id}
              className="grid gap-1 rounded-lg border border-neutral-300 bg-white p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-neutral-1000">
                  {row.userName ?? row.userEmail} · NIM {row.nim}
                </span>
                <span className="flex flex-wrap gap-1 text-xs">
                  <span className="rounded bg-neutral-200 px-1.5 py-0.5">
                    {STATUS_LABEL[row.status]}
                  </span>
                  {row.disputed ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                      Sengketa
                    </span>
                  ) : null}
                </span>
              </div>
              <p className="text-neutral-700">
                Email (tidak terverifikasi): {row.contactEmail} · diajukan {formatDate(row.createdAt)}{' '}
                · berlaku sampai {formatDate(row.expiresAt)}
                {row.revokedReason ? ` · dicabut (${row.revokedReason})` : ''}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {row.ktmUrl ? (
                  <a
                    href={row.ktmUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-semibold text-primary-400 underline-offset-2 hover:underline"
                  >
                    Lihat KTM
                  </a>
                ) : (
                  <span className="text-neutral-500">KTM sudah dihapus</span>
                )}
                {canWrite && row.status === 'menunggu' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="dark_blue"
                    disabled={busy}
                    onClick={() => approve.mutate({ claimId: row.id })}
                  >
                    Setujui
                  </Button>
                ) : null}
                {canWrite &&
                (row.status === 'aktif' || row.status === 'menunggu') ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => revoke.mutate({ claimId: row.id })}
                  >
                    {row.status === 'menunggu' ? 'Tolak' : 'Cabut akses'}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-700">Belum ada pengajuan.</p>
      )}
    </AdminEditPanel>
  );
}
