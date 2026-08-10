import {
  LaporanCard,
  type Attachment,
} from "~/app/_components/laporan/detail/laporan-card";
import { toColumnType } from "~/app/_components/laporan/board/column-type";
import { api } from "~/trpc/server";
import { RaporBreadcrumb } from "~/app/_components/breadcrumb";
import { formatTanggal } from "~/utils/utils";

export default async function ReportDetail({ params }: { params: { laporanId: string } }) {  
  const data = await api.users.getAllReportsUser({});
  const report = data.reports.find((r) => r.id === params.laporanId);

  // jika laporan tidak ditemukan
  if (!report) {
    return (
      <div className="flex flex-col gap-3 p-8">
        <h1>Laporan Tidak Ditemukan</h1>
        <p>Laporan dengan ID {params.laporanId} tidak dapat ditemukan.</p>
      </div>
    );
  }

  const attachment: Attachment[] = [];
  if (report.attachment && typeof report.attachment === 'string') {
    attachment.push({ name: report.attachment });
  }

  return (
    <div className="flex flex-col gap-3 p-8">
      <h1 className='text-[28px] font-semibold lg:text-[32px]'>Detail Laporan</h1>
      <RaporBreadcrumb
        items={[
          {label:'Laporan', href:'/lembaga/laporan'},
          {label:'Detail', href:`/lembaga/laporan/${params.laporanId}`}
        ]}
      />

      <LaporanCard
        status={toColumnType(report.status)}
        content={report.description}
        id={report.id}
        name={report.subject}
        date={formatTanggal(report.created_at)}
        category={report.urgent}
        attachment={attachment}
      />
    </div>
  );
}