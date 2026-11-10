import { AdminGuard } from '~/app/_components/admin/admin-guard';
import { AkunPage } from '~/app/_components/admin/akun-page';

export default function AdminAkunPage() {
  return (
    <AdminGuard permission="accounts.read">
      <AkunPage />
    </AdminGuard>
  );
}
