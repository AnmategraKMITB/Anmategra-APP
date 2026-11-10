import {
  LaporanCard,
  type LaporanDetailProps,
} from "~/app/_components/laporan/detail/laporan-card";
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import { api } from "~/trpc/server";

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default async function ReportDetail(
  props: {
    params: Promise<{ laporanId: string }>;
  }
) {
  const params = await props.params;
  const laporanId = params.laporanId;
  const { reports } = await api.admin.getAllReportsAdmin({});
  const report = reports.find((r) => r.id === laporanId);

  if (!report) {
    return (
      <div className="flex flex-col gap-3 p-8">
        <h1>Laporan Tidak Ditemukan</h1>
        <p>Laporan dengan ID {laporanId} tidak dapat ditemukan.</p>
      </div>
    );
  }

  const detail: LaporanDetailProps = {
    id: report.id,
    name: report.subject,
    date: formatDate(report.created_at),
    category: report.urgent,
    content: report.description,
    status: report.status as LaporanDetailProps['status'],
    attachment: report.attachment ? [{ name: report.attachment }] : [],
  };

  return (
    <div className="flex flex-col gap-3 p-8">
      <h1 className="text-2xl font-semibold text-neutral-1000">Laporan</h1>
      <RaporBreadcrumb
        items={[
          { label: 'Beranda', href: '/admin' },
          { label: 'Laporan', href: '/admin' },
          { label: 'Detail' },
        ]}
      />
      <LaporanCard {...detail} />
    </div>
  );
}
