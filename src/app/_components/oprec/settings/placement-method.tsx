'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '~/trpc/react';

import { Note, OptionCards } from '../wizard/ui';
import { type OprecDetail } from './model';

/**
 * Metode penempatan (manual atau prioritas). Langsung tersimpan: ganti metode
 * menghitung ulang status, dan hanya boleh selama penempatan berjalan.
 */
export function PlacementMethod({
  detail,
  prioritasHref,
}: {
  detail: OprecDetail;
  prioritasHref: string;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const setMethod = api.oprec.prioritySetMethod.useMutation({
    onSuccess: async () => {
      router.refresh();
      await utils.oprec.invalidate();
    },
  });
  const locked = detail.placementState !== 'berjalan';

  return (
    <div className="min-w-0">
      <h3 className="text-lg font-semibold text-neutral-1000">
        Penempatan memakai cara apa?
      </h3>
      <p className="mt-1 max-w-prose text-sm text-neutral-700">
        Langsung tersimpan. Status lulus/tidak dihitung ulang karena metode
        prioritas tidak memotong status dengan kuota.
      </p>
      <div className="mt-4">
        <OptionCards
          label="Metode penempatan"
          value={detail.placementMethod}
          onChange={(method) => {
            if (method !== detail.placementMethod && !setMethod.isPending) {
              setMethod.mutate({ recruitmentId: detail.id, method });
            }
          }}
          options={[
            {
              value: 'manual',
              label: 'Manual',
              description:
                'Pengambil keputusan menerima atau menolak tiap pilihan di tab Penempatan.',
              disabled: locked || setMethod.isPending,
            },
            {
              value: 'prioritas',
              label: 'Prioritas',
              description:
                'Tiap divisi mengurutkan pendaftar yang diinginkan di tab Prioritas, lalu sistem menempatkan setiap pendaftar di pilihan tertinggi yang mengurutkannya, mengikuti kuota.',
              disabled: locked || setMethod.isPending,
            },
          ]}
        />
      </div>
      {detail.placementMethod === 'prioritas' ? (
        <Note>
          Susun daftar prioritas per divisi di tab{' '}
          <Link
            href={prioritasHref}
            className="text-primary-400 underline-offset-2 hover:underline"
          >
            Prioritas
          </Link>
          . Selama penempatan berjalan, terima/tolak manual dinonaktifkan.
        </Note>
      ) : null}
      {locked ? (
        <Note>
          Metode penempatan hanya bisa diganti selama penempatan berjalan.
        </Note>
      ) : null}
      {setMethod.error ? (
        <p role="alert" className="mt-2 text-sm text-danger-dark">
          {setMethod.error.message}
        </p>
      ) : null}
    </div>
  );
}
