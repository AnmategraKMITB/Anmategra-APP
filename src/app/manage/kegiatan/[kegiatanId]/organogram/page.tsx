import { notFound } from 'next/navigation';
import { OrganogramWorkspace } from '~/app/_components/organogram/organogram-editor';
import { canManageEvent } from '~/server/api/access';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { api } from '~/trpc/server';

/**
 * Editor organogram untuk pengelola kegiatan: Owner, Admin Lembaga, atau Admin
 * Kegiatan dengan fitur `organization` (atau `admin`). Selain itu 404.
 */
const OrganogramKegiatanAdminPage = async ({
  params,
}: {
  params: Promise<{ kegiatanId: string }>;
}) => {
  const { kegiatanId } = await params;
  const session = await getServerAuthSession();
  if (!session) notFound();

  const { user } = session;
  const access = await canManageEvent(
    db,
    user.id,
    user.role,
    user.lembagaId,
    kegiatanId,
    'organization',
  );
  if (!access) notFound();

  const event = await api.event.getByID({ id: kegiatanId });
  if (!event) notFound();

  return (
    <OrganogramWorkspace
      periodId={kegiatanId}
      session={session}
      lembagaName={event.lembaga?.name ?? 'Lembaga'}
      kegiatanName={event.name}
      kegiatanHref={`/profile-kegiatan/${kegiatanId}`}
      canCreate
    />
  );
};

export default OrganogramKegiatanAdminPage;
