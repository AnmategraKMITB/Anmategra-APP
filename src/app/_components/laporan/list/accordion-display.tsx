import { getToken } from 'next-auth/jwt';
import Image, { type StaticImageData } from 'next/image';
import Link from 'next/link';
import { Accordion, AccordionItem } from '~/components/ui/accordion';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';

import { type Report } from '../board/report-card';
import { type ColumnType } from '../board/report-column';

interface AccordionProps {
  title: ColumnType;
  logo: StaticImageData;
  reports: Report[];
  selectedStatus: ColumnType[];
  isAdminView?: boolean;
  onEditReport?: (report: Report) => void;
  onRefresh?: () => void;
}

type DataItem = Report & {
  onEdit?: () => void;
  onDelete?: () => void;
  onSubmit?: () => void;
  column: ColumnType;
  isAdminView?: boolean;
};

export const ListDisplayItem = ({
  id,
  name,
  date,
  category,
  onEdit,
  onDelete,
  onSubmit,
  column,
  isAdminView,
}: DataItem) => {
  const showMenu = column === 'Draft' && !isAdminView;
  const showSubmit = column === 'Draft' && !isAdminView;

  return (
    <li className="relative flex flex-col gap-3 rounded-xl border-b p-4 text-[17px] text-[#636A6D] shadow-sm">
      <div className="flex w-full items-start justify-between gap-3">
        <Link
          href={isAdminView ? `/admin/${id}` : `/laporan/${id}`}
          className="min-w-0 flex-1"
        >
          <h1 className="truncate font-semibold text-[#2B6282]">{name}</h1>
        </Link>
        <div className="flex items-center gap-2">
          {showSubmit && (
            <Button
              size="sm"
              className="rounded-full bg-secondary-400 text-white hover:bg-secondary-500"
              onClick={(e) => {
                e.stopPropagation();
                onSubmit?.();
              }}
            >
              Kirim
            </Button>
          )}
          {showMenu && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                className="select-none text-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                ...
              </DropdownMenuTrigger>

              <DropdownMenuContent className="text-xl">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.();
                  }}
                >
                  <Button variant="ghost" className="w-full justify-start">
                    Edit
                  </Button>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.();
                  }}
                >
                  <Button variant="ghost" className="w-full justify-start">
                    Delete
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <Link
        href={isAdminView ? `/admin/${id}` : `/laporan/${id}`}
        className="flex w-full flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-6"
      >
        <h2 className="text-sm text-[#768085]">{date}</h2>
        <span className="rounded-full border border-[#636A6D] px-4 py-2 text-sm">
          {category}
        </span>
      </Link>
    </li>
  );
};

export const AccordionDisplay = ({
  title,
  logo,
  reports,
  isAdminView,
  onEditReport,
  onRefresh,
}: AccordionProps) => {
  const { toast } = useToast();
  const submitReportMutation = api.users.submitReport.useMutation({
    onSuccess: () => {
      toast({
        title: 'Laporan berhasil diajukan',
        description: 'Laporan telah berpindah ke status Reported.',
      });
      onRefresh?.();
    },
    onError: () => {
      toast({
        title: 'Gagal mengajukan laporan',
        description: 'Terjadi kesalahan saat mengajukan laporan.',
      });
      onRefresh?.();
    },
  });

  const deleteReportMutation = api.users.deleteReport.useMutation({
    onSuccess: () => {
      toast({
        title: 'Laporan berhasil dihapus',
        description: 'Laporan draft telah dihapus.',
      });
      onRefresh?.();
    },
    onError: () => {
      toast({
        title: 'Gagal menghapus laporan',
        description: 'Terjadi kesalahan saat menghapus laporan.',
      });
    },
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteReportMutation.mutateAsync({ id });
    } catch (e) {
      console.error('deleteReport failed', e);
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      await submitReportMutation.mutateAsync({ id });
    } catch (e) {
      console.error('submitReport failed', e);
    }
  };

  return (
    <Accordion type="multiple">
      <AccordionItem value={title}>
        {/* Trigger */}
        <div>
          <div className="rounded-xl bg-[#E9EDF1] px-5 py-3">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Kiri: Logo + Judul + Count */}
              <div className="flex items-center space-x-2">
                <Image
                  src={logo}
                  alt={`${title} Icon`}
                  width={24}
                  height={24}
                />
                <h1 className="text-xl font-semibold">{title}</h1>
                <span className="text-gray-500">{reports.length}</span>
              </div>

              {/* Kanan: Tombol Buat Laporan */}
            </div>
          </div>
        </div>

        {/* Content */}
        <ul className="space-y-2">
          {reports.map((report) => (
            <ListDisplayItem
              key={report.id}
              id={report.id}
              name={report.name}
              date={report.date}
              category={report.category}
              description={report.description}
              urgent={report.urgent}
              attachment={report.attachment}
              column={title}
              isAdminView={isAdminView}
              onEdit={() => onEditReport?.(report)}
              onDelete={() => handleDelete(report.id)}
              onSubmit={
                title === 'Draft' ? () => handleSubmit(report.id) : undefined
              }
            />
          ))}
        </ul>
      </AccordionItem>
    </Accordion>
  );
};
