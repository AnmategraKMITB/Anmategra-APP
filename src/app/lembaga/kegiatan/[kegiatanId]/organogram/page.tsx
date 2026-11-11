import { notFound } from 'next/navigation';
import { OrganogramWorkspace } from '~/app/_components/organogram/organogram-editor';
import { getServerAuthSession } from '~/server/auth';
import { api } from '~/trpc/server';

const OrganogramKegiatanPage = async ({
  params,
}: {
  params: Promise<{ kegiatanId: string }>;
}) => {
  const { kegiatanId } = await params;
  const session = await getServerAuthSession();
  const event = await api.event.getByID({ id: kegiatanId });
  if (!event) notFound();

  const lembagaId = event.lembaga?.id ?? null;
  const canCreate = lembagaId !== null && session?.user.lembagaId === lembagaId;

  return (
    <OrganogramWorkspace
      periodId={kegiatanId}
      session={session}
      lembagaName={event.lembaga?.name ?? 'Lembaga'}
      kegiatanName={event.name}
      kegiatanHref={`/lembaga/kegiatan/${kegiatanId}/panitia`}
      canCreate={canCreate}
    />
  );
};

export default OrganogramKegiatanPage;
