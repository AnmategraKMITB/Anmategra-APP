import {
  type Attachment,
  LaporanCard,
} from "~/app/_components/laporan/detail/laporan-card";
import { toColumnType } from "~/app/_components/laporan/board/column-type";
import { api } from "~/trpc/server";
import { RaporBreadcrumb } from "~/app/_components/breadcrumb";
import { formatTanggal } from "~/utils/utils";

export default async function ReportDetail({params}: {params: { laporanId: string }}) {
  const data = await api.users.getAllReportsUser({});
  const report = data.reports.find((r) => r.id === params.laporanId);

  if (!report) {
    return (
      <div className="flex flex-col gap-3 p-8">
        <h1>Laporan Tidak Ditemukan</h1>
        <p>Laporan dengan ID {params.laporanId} tidak dapat ditemukan.</p>
      </div>
    );
  }
  const attachment: Attachment[] = [];
  if (report.attachment && typeof report.attachment === "string") {
    attachment.push({ name: report.attachment });
  }

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-8 pt-24 sm:pt-8">
      <RaporBreadcrumb
        items={[
          { label: "Laporan", href: "/laporan" },
          { label: "Detail Laporan", href: `/laporan/${report.id}` },
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
