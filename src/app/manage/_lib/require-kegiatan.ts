import { notFound } from 'next/navigation';
import { api } from '~/trpc/server';

import { requireManagedLembaga } from './require-lembaga';

/** Guard /manage/[lembagaId]/kegiatan/[kegiatanId]/...: kegiatan harus milik lembaga. */
export async function requireManagedKegiatan(
  lembagaId: string,
  kegiatanId: string,
) {
  const managed = await requireManagedLembaga(lembagaId);
  const event = await api.event.getByID({ id: kegiatanId });
  const owner = event?.lembaga as { id: string } | null | undefined;
  if (!event || owner?.id !== lembagaId) notFound();
  return { ...managed, event };
}
