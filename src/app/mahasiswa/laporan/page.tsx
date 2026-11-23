import { type Report } from '~/app/_components/laporan/board/report-card';
import { type ColumnProps } from '~/app/_components/laporan/board/report-column';
import { LaporanMainContainer } from '~/app/_components/laporan/laporan-main-container';
import { api } from '~/trpc/server';
import { formatTanggal } from '~/utils/utils';

type Status = 'Draft' | 'Reported' | 'In Progress' | 'Resolved';

function isValidStatus(status: string): status is Status {
  return ['Draft', 'Reported', 'In Progress', 'Resolved'].includes(status);
}

async function LaporanPage() {
  const data = await api.users.getAllReportsUser({});

  const reportsByStatus: Record<Status, Report[]> = {
    Draft: [],
    Reported: [],
    'In Progress': [],
    Resolved: [],
  };

  (data.reports || []).forEach((report) => {
    if (isValidStatus(report.status)) {
      reportsByStatus[report.status].push({
        id: report.id,
        name: report.subject,
        date: formatTanggal(report.created_at),
        category: report.urgent,
        description: report.description,
        urgent: report.urgent,
        attachment: report.attachment,
      });
    }
  });

  const finalData: ColumnProps[] = [
    { title: 'Draft', reports: reportsByStatus.Draft },
    { title: 'Reported', reports: reportsByStatus.Reported },

    { title: 'In Progress', reports: reportsByStatus['In Progress'] },
    { title: 'Resolved', reports: reportsByStatus.Resolved },
  ];

  return <LaporanMainContainer data={finalData} isAdminView={false} />;
}

export default LaporanPage;
