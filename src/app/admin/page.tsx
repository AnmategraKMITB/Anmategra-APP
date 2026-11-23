// Props Import
import { redirect } from 'next/navigation';
import { type ColumnProps } from '~/app/_components/laporan/board/report-column';
// Components Import
import { LaporanMainContainer } from '~/app/_components/laporan/laporan-main-container';
import { hasAdminPermission } from '~/server/api/admin-permissions';
import { loadAdminAccess } from '~/server/api/trpc';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { api } from '~/trpc/server';

// Urutan sama dengan AdminNav; operator tanpa reports.read dialihkan ke
// bagian pertama yang boleh dibukanya, bukan dilempar ke halaman error.
const FALLBACKS = [
  ['/admin/akun', 'accounts.read'],
  ['/admin/lembaga', 'lembaga.read'],
  ['/admin/akses', 'access.read'],
  ['/admin/email-terverifikasi', 'accounts.write'],
  ['/admin/alumni', 'alumni.write'],
  ['/admin/audit', 'audit.read'],
] as const;

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export default async function LaporanPage() {
  const session = await getServerAuthSession();
  if (!session) redirect('/authentication?callbackUrl=/admin');
  const access = await loadAdminAccess(db, session.user.id);
  const permissions = access?.isSuperadmin
    ? ['*']
    : (access?.permissions ?? []);
  if (!hasAdminPermission(permissions, 'reports.read')) {
    const next = FALLBACKS.find(([, p]) => hasAdminPermission(permissions, p));
    redirect(next ? next[0] : `/${session.user.role}`);
  }

  const { reports } = await api.admin.getAllReportsAdmin({});

  const columns: ColumnProps[] = ['Reported', 'In Progress', 'Resolved'].map(
    (status) => ({
      title: status as ColumnProps['title'],
      reports: reports
        .filter((r) => r.status === status)
        .map((r) => ({
          id: r.id,
          name: r.subject,
          date: formatDate(r.created_at),
          category: r.urgent,
          description: r.description,
          urgent: r.urgent,
          attachment: r.attachment,
        })),
    }),
  );

  return <LaporanMainContainer data={columns} isAdminView={true} />;
}
