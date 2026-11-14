'use client';

import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { api } from '~/trpc/react';

import {
  type OprecBase,
  RECRUITMENT_STATUS_LABEL,
  RECRUITMENT_STATUS_STYLE,
  STATUS_ACTION,
} from './status';

/**
 * Aksi pengelola di halaman oprec: status oprec, tautan ke formulir terikat,
 * dan tombol pindah status (Buka, Tutup, Buka lagi). Menutup dan membuka lagi
 * minta konfirmasi; alasan penolakan server ditampilkan apa adanya.
 */
export function OprecManageBar({
  basePath,
  recruitmentId,
  formId,
  status,
}: {
  basePath: OprecBase;
  recruitmentId: string;
  formId: string;
  status: 'draft' | 'open' | 'closed';
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [confirming, setConfirming] = useState(false);
  const setStatus = api.oprec.setStatus.useMutation({
    onSuccess: async () => {
      setConfirming(false);
      router.refresh();
      // Jendela penilaian dan isi tab lain bergantung pada status.
      await utils.oprec.invalidate();
    },
  });
  const action = STATUS_ACTION[status];
  const run = () => setStatus.mutate({ recruitmentId, status: action.to });

  return (
    <div className="mt-4 grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded-full px-3 py-1 text-sm font-semibold',
            RECRUITMENT_STATUS_STYLE[status],
          )}
        >
          {RECRUITMENT_STATUS_LABEL[status]}
        </span>
        <Button asChild variant="dark_blue_outline">
          <Link href={`${basePath}/forms/${formId}`}>
            <FileText /> Formulir
          </Link>
        </Button>
        {!confirming ? (
          <Button
            type="button"
            variant={status === 'open' ? 'dark_blue_outline' : 'light_blue'}
            disabled={setStatus.isPending}
            onClick={() => (action.confirm ? setConfirming(true) : run())}
          >
            {setStatus.isPending ? action.pending : action.label}
          </Button>
        ) : null}
      </div>
      {confirming && action.confirm ? (
        <div
          role="alertdialog"
          aria-label={action.label}
          className="grid gap-3 rounded-xl border border-neutral-400 bg-neutral-50 px-4 py-3 text-sm text-neutral-1000 sm:flex sm:items-center sm:justify-between"
        >
          <p>{action.confirm}</p>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="light_blue"
              size="sm"
              disabled={setStatus.isPending}
              onClick={run}
            >
              {setStatus.isPending
                ? action.pending
                : `Ya, ${action.label.toLowerCase()}`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={setStatus.isPending}
              onClick={() => setConfirming(false)}
            >
              Batal
            </Button>
          </div>
        </div>
      ) : null}
      {setStatus.error ? (
        <p
          role="alert"
          className="rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
        >
          Status belum bisa diubah: {setStatus.error.message}
        </p>
      ) : null}
    </div>
  );
}
