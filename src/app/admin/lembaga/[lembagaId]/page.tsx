import { AdminGuard } from '~/app/_components/admin/admin-guard';
import { LembagaDetail } from '~/app/_components/admin/lembaga-detail';

export default async function AdminLembagaDetailPage({
  params,
}: {
  params: Promise<{ lembagaId: string }>;
}) {
  const { lembagaId } = await params;
  return (
    <AdminGuard permission="lembaga.read">
      <LembagaDetail lembagaId={lembagaId} />
    </AdminGuard>
  );
}
