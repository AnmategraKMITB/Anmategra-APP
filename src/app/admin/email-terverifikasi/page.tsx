import { AdminGuard } from '~/app/_components/admin/admin-guard';
import { EmailTerverifikasiPage } from '~/app/_components/admin/email-terverifikasi-page';

export default function AdminEmailTerverifikasiPage() {
  return (
    <AdminGuard permission="accounts.write">
      <EmailTerverifikasiPage />
    </AdminGuard>
  );
}
