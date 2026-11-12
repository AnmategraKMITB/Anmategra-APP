'use client';

import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

import { type OprecBase, canOpenRegistration } from './status';

/**
 * Aksi pengelola di halaman oprec: tautan ke formulir terikat dan tombol
 * Buka pendaftaran. Tombol hanya tampil untuk oprec berstatus Draf; alasan
 * penolakan server (pengaturan, tujuan, blok Pilihan tujuan) ditampilkan apa
 * adanya.
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
  const setStatus = api.oprec.setStatus.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <div className="mt-4 grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="dark_blue_outline">
          <Link href={`${basePath}/forms/${formId}`}>
            <FileText /> Formulir
          </Link>
        </Button>
        {canOpenRegistration(status) ? (
          <Button
            type="button"
            variant="light_blue"
            disabled={setStatus.isPending}
            onClick={() =>
              setStatus.mutate({ recruitmentId, status: 'open' })
            }
          >
            {setStatus.isPending ? 'Membuka…' : 'Buka pendaftaran'}
          </Button>
        ) : null}
      </div>
      {setStatus.error ? (
        <p
          role="alert"
          className="rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
        >
          Pendaftaran belum bisa dibuka: {setStatus.error.message}
        </p>
      ) : null}
    </div>
  );
}
