'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { JSX } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

/** Membuat periode kepengurusan bawaan, tempat organogram kepengurusan disimpan. */
export function CreatePeriodButton(props: { lembagaId: string }): JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const create = api.organization.import.createCurrentPeriod.useMutation();

  const handleCreate = async () => {
    setError(null);
    try {
      const { periodId } = await create.mutateAsync({
        lembagaId: props.lembagaId,
      });
      toast.success('Periode 2025/2026 dibuat.');
      router.push(`/lembaga/kegiatan/${periodId}/organogram`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Periode tidak bisa dibuat. Coba lagi.',
      );
    }
  };

  return (
    <div className="mt-6 max-w-xl border-b border-neutral-400 pb-6">
      <h2 className="text-lg font-semibold text-neutral-1000">
        Organogram kepengurusan
      </h2>
      <p className="mt-1 text-neutral-700">
        Lembaga ini belum punya periode kepengurusan. Buat periode 2025/2026
        untuk menyusun organogram pengurus dan memasukkan anggota lama.
      </p>
      <Button
        variant="light_blue"
        className="mt-3 rounded-[12px]"
        onClick={() => void handleCreate()}
        disabled={create.isPending}
      >
        {create.isPending ? 'Membuat' : 'Buat periode 2025/2026'}
      </Button>
      {error !== null ? (
        <p role="alert" className="mt-2 text-sm text-danger-dark">
          {error}
        </p>
      ) : null}
    </div>
  );
}
