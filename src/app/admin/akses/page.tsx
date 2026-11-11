import { AdminGuard } from '~/app/_components/admin/admin-guard';
import { AksesPage } from '~/app/_components/admin/akses-page';

export default function AdminAksesPage() {
  return (
    <AdminGuard permission="access.read">
      <AksesPage />
    </AdminGuard>
  );
}
