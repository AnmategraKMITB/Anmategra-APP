'use client';

// Library Import
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';
import { formatTanggal } from '~/utils/utils';

// Components Import
import { KanbanBoard } from './board/kanban-board';
import { type Report } from './board/report-card';
import { type ColumnProps, type ColumnType } from './board/report-column';
import LaporanFormDialog from './detail/laporan-form';
import { type CurrentDisplay, LaporanHeader } from './laporan-header';
import { ListDisplay } from './list/list-display';

interface LaporanProps {
  data: ColumnProps[];
  isAdminView?: boolean;
}

type ReportData = Report;
type Status = 'Draft' | 'Reported' | 'In Progress' | 'Resolved';

function isValidStatus(status: string): status is Status {
  return ['Draft', 'Reported', 'In Progress', 'Resolved'].includes(status);
}

export const LaporanMainContainer = (Laporan: LaporanProps) => {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [display, setCurrentDisplay] = useState<CurrentDisplay>('List');
  const [editingReport, setEditingReport] = useState<ReportData | null>(null);

  const { data: searchData } = Laporan.isAdminView
    ? api.admin.getAllReportsAdmin.useQuery(
        { search: debouncedSearch || undefined },
        { enabled: debouncedSearch.length > 0 },
      )
    : api.users.getAllReportsUser.useQuery(
        { search: debouncedSearch },
        { enabled: debouncedSearch.length > 0 },
      );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const displayData = useMemo(() => {
    if (debouncedSearch.length === 0) {
      return Laporan.data;
    }
    if (!searchData) {
      return [];
    }

    const reportsByStatus: Record<Status, Report[]> = {
      Draft: [],
      Reported: [],
      'In Progress': [],
      Resolved: [],
    };

    (searchData.reports || []).forEach((report) => {
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

    return [
      { title: 'Draft' as const, reports: reportsByStatus.Draft },
      { title: 'Reported' as const, reports: reportsByStatus.Reported },
      {
        title: 'In Progress' as const,
        reports: reportsByStatus['In Progress'],
      },
      { title: 'Resolved' as const, reports: reportsByStatus.Resolved },
    ];
  }, [debouncedSearch, searchData, Laporan.data]);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('laporan-display-mode');
    if (saved === 'List' || saved === 'Board') {
      setCurrentDisplay(saved);
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('laporan-display-mode', display);
    }
  }, [display, isMounted]);

  const [status, setStatus] = useState<ColumnType[]>(() => {
    const all: ColumnType[] = ['Draft', 'Reported', 'In Progress', 'Resolved'];

    if (Laporan.isAdminView) {
      return all.filter((col) => col !== 'Draft');
    }

    return all;
  });

  const toggleStatus = (column: ColumnType) => {
    setStatus(
      (prev) =>
        prev.includes(column)
          ? prev.filter((item) => item !== column) // Remove column
          : [...prev, column], // Add column
    );
  };

  const hideStatus = (column: ColumnType) => {
    setStatus((prev) =>
      prev.includes(column) ? prev.filter((item) => item !== column) : prev,
    );
  };

  const handleEditReport = (report: ReportData) => {
    setEditingReport(report);
  };

  const handleEditComplete = () => {
    setEditingReport(null);
    router.refresh();
  };

  const handleRefresh = () => {
    router.refresh();
  };

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [],
  );

  const isLaporanEmpty =
    displayData.length === 0 ||
    displayData.every((col) => col.reports.length === 0);

  return (
    <div className="flex w-full flex-col gap-4 pl-[42px] pr-[36px] pt-[68px]">
      {Laporan.isAdminView && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            className="rounded-xl border-neutral-300 text-sm font-semibold"
            onClick={() => signOut({ callbackUrl: '/authentication' })}
          >
            Logout
          </Button>
        </div>
      )}
      {/* Header */}
      <LaporanHeader
        setCurrentDisplay={setCurrentDisplay}
        status={status}
        toggleStatus={toggleStatus}
        isLaporanEmpty={isLaporanEmpty}
        currentDisplay={display}
        isAdminView={Laporan.isAdminView ?? false}
      />
      {/* Input */}
      <Input
        placeholder="Cari laporan"
        value={searchQuery}
        onChange={handleSearchChange}
        className="h-[60px] rounded-3xl bg-white py-5 text-[18px] placeholder:text-neutral-700 focus-visible:ring-transparent"
        startAdornment={
          <MagnifyingGlassIcon className="size-5 text-gray-500" />
        }
      />

      {/* Board Display */}
      {display === 'Board' && !isLaporanEmpty && (
        <KanbanBoard
          kanbanData={displayData}
          hideColumnAction={hideStatus}
          displayedColumn={status}
          isAdminView={Laporan.isAdminView ?? false}
          onEditReport={handleEditReport}
          onRefresh={handleRefresh}
        />
      )}
      {/* List Display */}
      {display === 'List' && !isLaporanEmpty && (
        <ListDisplay
          kanbanData={displayData}
          hideColumnAction={hideStatus}
          displayedColumn={status}
          isAdminView={Laporan.isAdminView}
          onEditReport={handleEditReport}
          onRefresh={handleRefresh}
        />
      )}

      {isLaporanEmpty && (
        <div className="flex h-4/5 flex-col items-center justify-center gap-3">
          <h1 className="text-2xl font-semibold text-neutral-300">
            {searchQuery
              ? 'Tidak ada laporan yang ditemukan'
              : 'Buat laporan baru!'}
          </h1>
          {!searchQuery && (
            <LaporanFormDialog isAdmin={Laporan.isAdminView ?? false} />
          )}
        </div>
      )}
      {/* Edit Mode Dialog */}
      {editingReport && (
        <LaporanFormDialog
          isAdmin={Laporan.isAdminView ?? false}
          editMode={true}
          reportToEdit={editingReport}
          onEditComplete={handleEditComplete}
        />
      )}
    </div>
  );
};
