import { AdminGuard } from '~/app/_components/admin/admin-guard';
import { AlumniPage } from '~/app/_components/admin/alumni-page';

export default function AdminAlumniPage() {
  return (
    <AdminGuard permission="alumni.write">
      <AlumniPage />
    </AdminGuard>
  );
}
