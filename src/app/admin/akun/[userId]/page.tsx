import { AdminGuard } from '~/app/_components/admin/admin-guard';
import { AkunDetail } from '~/app/_components/admin/akun-detail';

export default async function AdminAkunDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return (
    <AdminGuard permission="accounts.read">
      <AkunDetail userId={userId} />
    </AdminGuard>
  );
}
