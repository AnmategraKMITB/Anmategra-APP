'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { type RouterOutputs, api } from '~/trpc/react';

import { Chip, Modal } from './shared';

type Overview = RouterOutputs['oprec']['placementOverview'];
type State = Overview['state'];
type Blocker = NonNullable<Overview['blockers']>[number];

const LABEL: Record<State, string> = {
  berjalan: 'Berjalan',
  masa_banding: 'Masa banding',
  final: 'Final',
};

const HELP: Record<State, string> = {
  berjalan: 'Keputusan masih bisa diubah selama belum masuk masa banding.',
  masa_banding:
    'Pendaftar yang ditolak bisa diterima lewat banding, dan Kadiv bisa meminta pindah divisi.',
  final: 'Penempatan sudah final. Semua perubahan dikunci.',
};

/** Baris keadaan oprec: penanda tahap dan kendali admin. */
export function StateBar({
  recruitmentId,
  overview,
  onChanged,
  announce,
  onError,
}: {
  recruitmentId: string;
  overview: Overview;
  onChanged: () => void;
  announce: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [ask, setAsk] = useState<State | null>(null);
  const [blockers, setBlockers] = useState<Blocker[] | null>(null);
  const [quota, setQuota] = useState<{
    state: State;
    resolution?: 'batalkan_semua' | 'setujui_semua';
    rows: { label: string; accepted: number; quota: number }[];
  } | null>(null);

  const change = api.oprec.setPlacementState.useMutation({
    onSuccess: (result) => {
      if (result.needsResolution) {
        setAsk(null);
        setBlockers(result.blockers);
        return;
      }
      if (result.needsQuotaConfirm) {
        setAsk(null);
        setBlockers(null);
        setQuota({
          state: 'final',
          resolution: 'setujui_semua',
          rows: result.overQuota.map((row) => ({
            label: row.label,
            accepted: row.accepted,
            quota: row.quota,
          })),
        });
        return;
      }
      setAsk(null);
      setBlockers(null);
      setQuota(null);
      announce(`Keadaan penempatan diubah menjadi ${LABEL[result.state]}.`);
      onChanged();
    },
    onError: (error) => {
      setAsk(null);
      onError(error.message);
    },
  });

  const run = (
    state: State,
    resolution?: 'batalkan_semua' | 'setujui_semua',
    confirmOverQuota = false,
  ) => {
    change.mutate({ recruitmentId, state, resolution, confirmOverQuota });
  };

  const state = overview.state;

  return (
    <section
      aria-label="Keadaan penempatan"
      className="mt-6 grid gap-3 rounded-[24px] border border-neutral-400 bg-neutral-50 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-neutral-1000">
          Keadaan
        </span>
        <Chip tone={state === 'final' ? 'success' : 'primary'}>
          {LABEL[state]}
        </Chip>
        {overview.blockers.length > 0 ? (
          <Chip tone="warning">
            {overview.blockers.length} permintaan pindah terbuka
          </Chip>
        ) : null}
      </div>
      <p className="text-sm text-neutral-700">{HELP[state]}</p>

      {overview.isAdmin ? (
        <div className="flex flex-wrap gap-2">
          {state === 'berjalan' ? (
            <Button size="sm" onClick={() => setAsk('masa_banding')}>
              Masuk masa banding
            </Button>
          ) : null}
          {state === 'masa_banding' ? (
            <>
              <Button
                size="sm"
                variant="dark_blue_outline"
                onClick={() => setAsk('berjalan')}
              >
                Kembali ke berjalan
              </Button>
              <Button size="sm" onClick={() => setAsk('final')}>
                Tetapkan final
              </Button>
            </>
          ) : null}
          {state === 'final' ? (
            <Button
              size="sm"
              variant="dark_blue_outline"
              onClick={() => setAsk('masa_banding')}
            >
              Buka masa banding lagi
            </Button>
          ) : null}
          {state === 'final' ? (
            <p
              role="status"
              className="rounded-xl bg-warning-light px-3 py-2 text-sm text-neutral-1000"
            >
              Penempatan sudah final. Semua kontrol pengubahan nonaktif.
            </p>
          ) : null}
        </div>
      ) : null}

      <Modal
        open={ask !== null}
        onOpenChange={(open) => {
          if (!open) setAsk(null);
        }}
        title={
          ask === null
            ? ''
            : ask === 'final'
              ? 'Tetapkan penempatan final?'
              : ask === 'masa_banding'
                ? 'Ubah keadaan penempatan?'
                : 'Kembali ke berjalan?'
        }
        description={
          ask === 'final'
            ? 'Setelah final, keputusan tidak bisa diubah. Permintaan pindah yang masih terbuka harus diselesaikan dulu.'
            : ask === 'masa_banding'
              ? 'Masa banding membuka permintaan pindah dan penerimaan lewat banding.'
              : 'Permintaan pindah yang terbuka akan dibatalkan saat keluar dari masa banding.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsk(null)}>
              Batal
            </Button>
            <Button
              disabled={change.isPending}
              onClick={() => {
                if (ask) run(ask);
              }}
            >
              {change.isPending ? 'Menyimpan…' : 'Lanjutkan'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Keadaan sekarang: <strong>{LABEL[state]}</strong>.
        </p>
      </Modal>

      <Modal
        open={blockers !== null}
        onOpenChange={(open) => {
          if (!open) setBlockers(null);
        }}
        title="Masih ada permintaan pindah"
        description="Selesaikan semua permintaan terbuka sebelum menetapkan final."
        footer={
          <>
            <Button
              variant="dark_blue_outline"
              disabled={change.isPending}
              onClick={() => run('final', 'batalkan_semua')}
            >
              Batalkan semua
            </Button>
            <Button
              disabled={change.isPending}
              onClick={() => run('final', 'setujui_semua')}
            >
              Setujui semua
            </Button>
          </>
        }
      >
        <ul className="grid gap-2">
          {(blockers ?? []).map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm text-neutral-1000"
            >
              <span className="font-semibold">{row.name ?? 'Tanpa nama'}</span>
              <span className="block text-xs text-neutral-700">
                {row.fromLabel} → {row.toLabel}
              </span>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={quota !== null}
        onOpenChange={(open) => {
          if (!open) setQuota(null);
        }}
        title="Kuota divisi tujuan sudah terisi"
        description="Menyetujui semua permintaan akan melewati kuota. Lanjutkan?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setQuota(null)}>
              Batal
            </Button>
            <Button
              disabled={change.isPending}
              onClick={() => {
                if (quota) run(quota.state, quota.resolution, true);
              }}
            >
              Tetap setujui
            </Button>
          </>
        }
      >
        <ul className="grid gap-2">
          {(quota?.rows ?? []).map((row) => (
            <li key={row.label} className="text-sm text-neutral-1000">
              {row.label}: {row.accepted} dari {row.quota}
            </li>
          ))}
        </ul>
      </Modal>
    </section>
  );
}
