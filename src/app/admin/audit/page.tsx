import { AdminGuard } from '~/app/_components/admin/admin-guard';
import { AuditPage } from '~/app/_components/admin/audit-page';

export default function AdminAuditPage() {
  return (
    <AdminGuard permission="audit.read">
      <AuditPage />
    </AdminGuard>
  );
}
