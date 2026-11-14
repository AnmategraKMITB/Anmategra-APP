import { AdminGuard } from '~/app/_components/admin/admin-guard';
import { SuperadminPage } from '~/app/_components/admin/superadmin-page';

export default function AdminSuperadminPage() {
  return (
    <AdminGuard permission="superadmin">
      <SuperadminPage />
    </AdminGuard>
  );
}
