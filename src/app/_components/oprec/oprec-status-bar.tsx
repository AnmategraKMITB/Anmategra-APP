'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

import { Chip, Modal } from './placement/shared';
import { RECRUITMENT_STATUS_LABEL } from './status';

type Status = keyof typeof RECRUITMENT_STATUS_LABEL;

const ACTIONS: Record<
  Status,
  { to: Status; label: string; title: string; description: string }
> = {
  draft: {
    to: 'open',
    label: 'Buka pendaftaran',
    title: 'Buka pendaftaran?',
    description:
      'Formulir diterbitkan dan mahasiswa bisa mulai mendaftar sesuai gelombang dan syarat yang diatur.',
  },
  open: {
    to: 'closed',
    label: 'Tutup pendaftaran',
    title: 'Tutup pendaftaran?',
    description:
      'Formulir ikut ditutup dan tidak menerima pendaftar baru. Penilaian terbuka untuk semua pendaftar.',
  },
  closed: {
    to: 'open',
    label: 'Buka lagi',
    title: 'Buka pendaftaran lagi?',
    description:
      'Formulir diterbitkan lagi dan pendaftar baru bisa masuk. Keputusan penempatan yang sudah ada tetap berlaku; pendaftar baru masuk sebagai belum diputuskan. Pada oprec tanpa gelombang, penilaian dijeda sampai pendaftaran ditutup lagi, dan nilai yang sudah masuk tetap tersimpan.',
  },
};

const TONE: Record<Status, 'muted' | 'success' | 'warning'> = {
  draft: 'muted',
  open: 'success',
  closed: 'warning',
};

/**
 * Status pendaftaran di atas tab oprec. Pengelola oprec bisa membuka, menutup,
 * dan membuka lagi pendaftaran; status formulir ikut berubah di server.
 */
export function OprecStatusBar({
  recruitmentId,
  status: rawStatus,
  formHref,
  canManage,
}: {
  recruitmentId: string;
  /** `recruitment.status` apa adanya dari basis data. */
  status: string;
  /** Tautan pembuat formulir; hanya untuk pengelola. */
  formHref: string | null;
  canManage: boolean;
}) {
  const status: Status =
    rawStatus === 'open' || rawStatus === 'closed' ? rawStatus : 'draft';
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const setStatus = api.oprec.setStatus.useMutation({
    onSuccess: () => {
      setConfirming(false);
      router.refresh();
    },
  });
  const action = canManage ? ACTIONS[status] : null;
  const problems =
    setStatus.error?.message.split('\n').filter((line) => line.trim()) ?? [];

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-sm text-neutral-700">
        Pendaftaran
        <Chip tone={TONE[status]}>{RECRUITMENT_STATUS_LABEL[status]}</Chip>
      </p>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          {formHref ? (
            <Button asChild variant="dark_blue_outline" size="sm">
              <Link href={formHref}>Formulir</Link>
            </Button>
          ) : null}
          {action ? (
            <Button
              size="sm"
              variant={status === 'open' ? 'warning' : 'dark_blue'}
              onClick={() => {
                setStatus.reset();
                setConfirming(true);
              }}
            >
              {action.label}
            </Button>
          ) : null}
        </div>
      ) : null}

      {action ? (
        <Modal
          open={confirming}
          onOpenChange={setConfirming}
          title={action.title}
          description={action.description}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Batal
              </Button>
              <Button
                variant={status === 'open' ? 'warning' : 'dark_blue'}
                disabled={setStatus.isPending}
                onClick={() =>
                  setStatus.mutate({ recruitmentId, status: action.to })
                }
              >
                {setStatus.isPending ? 'Menyimpan…' : action.label}
              </Button>
            </>
          }
        >
          {problems.length > 0 ? (
            <div
              role="alert"
              className="rounded-xl bg-danger-light px-3 py-2 text-sm text-danger-dark"
            >
              <p className="font-semibold">Belum bisa diubah:</p>
              <ul className="mt-1 list-disc pl-5">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
