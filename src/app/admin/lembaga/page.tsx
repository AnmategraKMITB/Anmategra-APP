import { AdminGuard } from '~/app/_components/admin/admin-guard';
import { LembagaPage } from '~/app/_components/admin/lembaga-page';

export default function AdminLembagaPage() {
  return (
    <AdminGuard permission="lembaga.read">
      <LembagaPage />
    </AdminGuard>
  );
}
