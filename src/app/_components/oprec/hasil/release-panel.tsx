'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { type RouterOutputs, api } from '~/trpc/react';

import { Chip, Field, Modal, textareaClass, when } from '../placement/shared';

type Overview = RouterOutputs['oprec']['resultsOverview'];

/** Kendali rilis hasil: status, rilis (admin), dan tarik rilis dengan alasan. */
export function ReleasePanel({
  recruitmentId,
  overview,
  total,
  penempatanHref,
  announce,
  onError,
  onChanged,
}: {
  recruitmentId: string;
  overview: Overview;
  /** Jumlah seluruh pendaftar, untuk ringkasan dialog. */
  total: number;
  penempatanHref?: string;
  announce: (message: string) => void;
  onError: (message: string) => void;
  onChanged: () => void;
}) {
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [reason, setReason] = useState('');

  const release = api.oprec.resultsRelease.useMutation({
    onSuccess: (result) => {
      setReleaseOpen(false);
      announce(
        result.undecided > 0
          ? `Hasil dirilis, tetapi ${result.undecided} pilihan belum diputuskan.`
          : 'Hasil dirilis ke pendaftar.',
      );
      onChanged();
    },
    onError: (error) => onError(error.message),
  });
  const withdraw = api.oprec.resultsWithdraw.useMutation({
    onSuccess: () => {
      setWithdrawOpen(false);
      setReason('');
      announce('Rilis hasil ditarik.');
      onChanged();
    },
    onError: (error) => onError(error.message),
  });

  const accepted =
    overview.divisions.reduce((sum, division) => sum + division.accepted, 0) +
    overview.divisions.reduce((sum, division) => sum + division.extras, 0);
  const undecided = overview.warnings.undecided;
  const notAccepted = Math.max(0, total - accepted - undecided);

  return (
    <section
      aria-label="Rilis hasil"
      className="mt-4 rounded-[24px] border border-neutral-400 bg-neutral-50 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-neutral-1000">
            Rilis ke pendaftar
          </h2>
          {!overview.visibleToApplicants ? (
            <p className="mt-1 text-sm text-neutral-700">
              Pendaftar tidak memilih menerima hasil lewat Anmategra. Hasil
              diumumkan di luar aplikasi.
            </p>
          ) : overview.released ? (
            <p className="mt-1 text-sm text-neutral-700">
              Dirilis pada {when(overview.releasedAt)} WIB.
            </p>
          ) : (
            <p className="mt-1 text-sm text-neutral-700">
              Pendaftar baru bisa melihat hasil setelah rilis. Rilis hanya
              tersedia saat penempatan sudah final.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {overview.released ? (
            <Chip tone="success">Sudah dirilis</Chip>
          ) : (
            <Chip tone="muted">Belum dirilis</Chip>
          )}
          {overview.visibleToApplicants && !overview.released ? (
            <Button
              disabled={!overview.canRelease || release.isPending}
              onClick={() => setReleaseOpen(true)}
              title={
                overview.canRelease
                  ? undefined
                  : 'Tetapkan penempatan final terlebih dahulu.'
              }
            >
              Rilis hasil ke pendaftar
            </Button>
          ) : null}
          {overview.canWithdraw ? (
            <Button
              variant="dark_blue_outline"
              disabled={withdraw.isPending}
              onClick={() => {
                setReason('');
                setWithdrawOpen(true);
              }}
            >
              Tarik rilis
            </Button>
          ) : null}
        </div>
      </div>

      {overview.visibleToApplicants &&
      !overview.released &&
      overview.state !== 'final' ? (
        <p className="mt-2 text-sm text-neutral-700">
          Keadaan penempatan masih “{overview.state}”.{' '}
          {penempatanHref ? (
            <a
              href={penempatanHref}
              className="font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              Buka Penempatan
            </a>
          ) : null}
        </p>
      ) : null}

      <Modal
        open={releaseOpen}
        onOpenChange={setReleaseOpen}
        title="Rilis hasil ke pendaftar?"
        description="Setelah dirilis, pendaftar hanya melihat diterima di divisi mana atau belum diterima."
        footer={
          <>
            <Button variant="ghost" onClick={() => setReleaseOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={release.isPending}
              onClick={() => release.mutate({ recruitmentId })}
            >
              {release.isPending ? 'Merilis…' : 'Rilis sekarang'}
            </Button>
          </>
        }
      >
        <ul className="grid gap-1 text-sm text-neutral-1000">
          <li>{accepted} diterima</li>
          <li>{undecided} belum diputuskan</li>
          <li>{notAccepted} tidak diterima</li>
        </ul>
        {undecided > 0 ? (
          <p className="rounded-xl bg-warning-light px-3 py-2 text-sm text-neutral-1000">
            Masih ada {undecided} pilihan aktif yang belum diputuskan. Hasil
            tetap bisa dirilis, tetapi keputusan itu akan tampil sebagai belum
            diputuskan di data pengelola dan belum diterima bagi pendaftar.
          </p>
        ) : null}
        <p className="text-sm text-neutral-700">
          Data yang diekspor tidak memuat alasan, flag, atau catatan sensitif.
        </p>
      </Modal>

      <Modal
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title="Tarik rilis hasil?"
        description="Pendaftar tidak lagi melihat hasil sampai dirilis ulang."
        footer={
          <>
            <Button variant="ghost" onClick={() => setWithdrawOpen(false)}>
              Batal
            </Button>
            <Button
              variant="warning"
              disabled={withdraw.isPending || reason.trim().length < 3}
              onClick={() =>
                withdraw.mutate({ recruitmentId, reason: reason.trim() })
              }
            >
              {withdraw.isPending ? 'Menarik…' : 'Tarik rilis'}
            </Button>
          </>
        }
      >
        <Field label="Alasan penarikan (wajib)">
          <textarea
            className={textareaClass}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
          />
        </Field>
      </Modal>
    </section>
  );
}
