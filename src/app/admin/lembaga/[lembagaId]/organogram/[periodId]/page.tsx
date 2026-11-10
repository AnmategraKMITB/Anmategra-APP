import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { OrganogramWorkspace } from '~/app/_components/organogram/organogram-editor';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { events, lembaga } from '~/server/db/schema';

export default async function AdminOrganogramPage({
  params,
}: {
  params: Promise<{ lembagaId: string; periodId: string }>;
}) {
  const { lembagaId, periodId } = await params;
  const session = await getServerAuthSession();
  const [row] = await db
    .select({
      periodName: events.name,
      lembagaName: lembaga.name,
    })
    .from(events)
    .leftJoin(lembaga, eq(lembaga.id, events.org_id))
    .where(and(eq(events.id, periodId), eq(events.org_id, lembagaId)))
    .limit(1);
  if (!row) notFound();

  return (
    <OrganogramWorkspace
      periodId={periodId}
      session={session}
      lembagaName={row.lembagaName ?? ''}
      kegiatanName={row.periodName}
      kegiatanHref={`/admin/lembaga/${lembagaId}`}
      canCreate
    />
  );
}
