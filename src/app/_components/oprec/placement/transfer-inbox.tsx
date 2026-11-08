'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

import {
  ErrorNote,
  Loading,
  Modal,
  Notice,
  textareaClass,
  when,
} from './shared';

type Request = {
  id: string;
  name: string | null;
  fromLabel: string;
  toLabel: string;
  reason: string;
  requestedAt: Date;
  canResolve: boolean;
  canCancel: boolean;
};

/** Kotak masuk permintaan pindah selama masa banding. */
export function TransferInbox({
  recruitmentId,
  announce,
  onError,
  onChanged,
}: {
  recruitmentId: string;
  announce: (message: string) => void;
  onError: (message: string) => void;
  onChanged: () => void;
}) {
  const inbox = api.oprec.transferInbox.useQuery({ recruitmentId });
  const [resolve, setResolve] = useState<{
    request: Request;
    resolution: 'setuju' | 'tolak';
  } | null>(null);
  const [note, setNote] = useState('');
  const [quota, setQuota] = useState<{
    requestId: string;
    note: string;
    accepted: number;
    quota: number;
  } | null>(null);
  const [cancel, setCancel] = useState<Request | null>(null);

  const done = (message: string) => {
    setResolve(null);
    setQuota(null);
    setCancel(null);
    setNote('');
    announce(message);
    onChanged();
  };

  const resolveOne = api.oprec.transferResolve.useMutation({
    onSuccess: (result) => {
      if (result.needsQuotaConfirm) {
        setQuota({
          requestId: resolve?.request.id ?? quota?.requestId ?? '',
          note,
          accepted: result.accepted,
          quota: result.quota,
        });
        setResolve(null);
        return;
      }
      done(
        quota !== null || resolve?.resolution === 'setuju'
          ? 'Permintaan pindah disetujui.'
          : 'Permintaan pindah ditolak.',
      );
    },
    onError: (error) => onError(error.message),
  });

  const cancelOne = api.oprec.transferCancel.useMutation({
    onSuccess: () => done('Permintaan pindah dibatalkan.'),
    onError: (error) => onError(error.message),
  });

  if (inbox.isError) return <ErrorNote message={inbox.error.message} />;
  if (inbox.isLoading) return <Loading label="Memuat permintaan pindah…" />;
  if ((inbox.data?.length ?? 0) === 0) {
    return <Notice>Tidak ada permintaan pindah yang terbuka.</Notice>;
  }

  return (
    <div className="grid gap-2">
      {(inbox.data ?? []).map((row) => (
        <div
          key={row.id}
          className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-1000">
                {row.name ?? 'Tanpa nama'}
              </p>
              <p className="text-sm text-neutral-700">
                {row.fromLabel} → {row.toLabel} · {when(row.requestedAt)}
              </p>
              <p className="mt-1 text-sm text-neutral-700">{row.reason}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {row.canResolve ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => {
                      setNote('');
                      setResolve({ request: row, resolution: 'setuju' });
                    }}
                  >
                    Setujui
                  </Button>
                  <Button
                    size="sm"
                    variant="warning_outline"
                    onClick={() => {
                      setNote('');
                      setResolve({ request: row, resolution: 'tolak' });
                    }}
                  >
                    Tolak
                  </Button>
                </>
              ) : null}
              {row.canCancel ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCancel(row)}
                >
                  Batalkan
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ))}

      <Modal
        open={resolve !== null}
        onOpenChange={(open) => {
          if (!open) setResolve(null);
        }}
        title={
          resolve?.resolution === 'setuju'
            ? 'Setujui permintaan pindah?'
            : 'Tolak permintaan pindah?'
        }
        description={
          resolve
            ? `${resolve.request.name ?? 'Pendaftar'} dari ${resolve.request.fromLabel} ke ${resolve.request.toLabel}.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setResolve(null)}>
              Batal
            </Button>
            <Button
              disabled={resolveOne.isPending}
              onClick={() => {
                if (!resolve) return;
                resolveOne.mutate({
                  recruitmentId,
                  requestId: resolve.request.id,
                  resolution: resolve.resolution,
                  note: note.trim() || undefined,
                });
              }}
            >
              {resolve?.resolution === 'setuju' ? 'Setujui' : 'Tolak'}
            </Button>
          </>
        }
      >
        <label className="grid gap-1 text-xs font-semibold text-neutral-700">
          Catatan (opsional)
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={textareaClass}
            maxLength={2000}
          />
        </label>
      </Modal>

      <Modal
        open={quota !== null}
        onOpenChange={(open) => {
          if (!open) setQuota(null);
        }}
        title="Kuota divisi tujuan sudah terisi"
        description={`Kuota ${quota?.quota ?? 0} sudah terisi ${quota?.accepted ?? 0}. Tetap setujui?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setQuota(null)}>
              Batal
            </Button>
            <Button
              disabled={resolveOne.isPending}
              onClick={() => {
                if (!quota) return;
                resolveOne.mutate({
                  recruitmentId,
                  requestId: quota.requestId,
                  resolution: 'setuju',
                  note: quota.note.trim() || undefined,
                  confirmOverQuota: true,
                });
              }}
            >
              Tetap setujui
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Penerimaan melewati kuota akan tercatat pada keputusan.
        </p>
      </Modal>

      <Modal
        open={cancel !== null}
        onOpenChange={(open) => {
          if (!open) setCancel(null);
        }}
        title="Batalkan permintaan pindah?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancel(null)}>
              Tidak
            </Button>
            <Button
              disabled={cancelOne.isPending}
              onClick={() => {
                if (cancel) {
                  cancelOne.mutate({ recruitmentId, requestId: cancel.id });
                }
              }}
            >
              Batalkan
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Pendaftar tetap di divisi asalnya.
        </p>
      </Modal>
    </div>
  );
}
