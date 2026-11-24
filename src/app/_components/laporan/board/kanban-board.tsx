'use client';

import {
  DndContext,
  type DragEndEvent,
  // type DragOverEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useState } from 'react';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';

import { canDropReport } from './column-type';
import { Droppable } from './droppable';
import { type Report, ReportCard } from './report-card';
import {
  type ColumnProps,
  type ColumnType,
  ReportColumn,
} from './report-column';

export interface KanbanBoardProps {
  kanbanData: ColumnProps[];
  displayedColumn: ColumnType[];
  hideColumnAction: (type: ColumnType) => void;
  isAdminView?: boolean;
  onEditReport?: (report: Report) => void;
  onRefresh?: () => void;
}

export const KanbanBoard = ({
  kanbanData,
  hideColumnAction,
  displayedColumn,
  isAdminView = false, // default: bukan admin
  onEditReport,
  onRefresh,
}: KanbanBoardProps) => {
  const { toast } = useToast();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    }),
  );

  const [reports, setReports] = useState<Record<ColumnType, Report[]>>(() =>
    kanbanData.reduce(
      (acc, col) => {
        acc[col.title] = col.reports;
        return acc;
      },
      {} as Record<ColumnType, Report[]>,
    ),
  );

  const [activeReport, setActiveReport] = useState<Report | null>(null);

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

  const setReportStatusMutation = api.admin.setReportStatus.useMutation({
    onError: (error) => {
      toast({
        title: 'Gagal memperbarui status',
        description: error.message,
      });
    },
  });

  const findColumnByReportId = (id: string): ColumnType | undefined =>
    (Object.keys(reports) as ColumnType[]).find((col) =>
      reports[col].some((r) => r.id === id),
    );

  const isForbiddenMove = (source?: ColumnType, dest?: ColumnType) =>
    !canDropReport(isAdminView, source, dest);

  // const onDragOver = (_event: DragOverEvent) => {
  //   //empty
  // };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveReport(null);
    if (!over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    const sourceColumn = findColumnByReportId(activeId);
    const destinationColumn =
      findColumnByReportId(overId) ?? (overId as ColumnType);

    if (isForbiddenMove(sourceColumn, destinationColumn)) {
      // debug
      // console.debug('drag blocked by isForbiddenMove', { activeId, overId, sourceColumn, destinationColumn, isAdminView });
      return;
    }
    if (!sourceColumn || !destinationColumn) return;

    if (
      !isAdminView &&
      sourceColumn === 'Draft' &&
      destinationColumn === 'Reported'
    ) {
      try {
        await submitReportMutation.mutateAsync({ id: activeId });
        setReports((prev) => {
          const src = prev[sourceColumn].filter((r) => r.id !== activeId);
          const moved = prev[sourceColumn].find((r) => r.id === activeId);
          return {
            ...prev,
            [sourceColumn]: src,
            [destinationColumn]: moved
              ? [...prev[destinationColumn], moved]
              : prev[destinationColumn],
          };
        });
      } catch (e) {
        console.error('submitReport failed', e);
      }
      return;
    }

    const sourceItems = reports[sourceColumn];
    const destinationItems = reports[destinationColumn];

    const activeIndex = sourceItems.findIndex((r) => r.id === activeId);
    if (activeIndex === -1) return;

    const activeItem = sourceItems[activeIndex];
    if (!activeItem) return;

    if (sourceColumn === destinationColumn) {
      const overIndex = sourceItems.findIndex((r) => r.id === overId);
      const targetIndex = overIndex >= 0 ? overIndex : sourceItems.length - 1;

      if (activeIndex === targetIndex) return;

      const updated = [...sourceItems];
      updated.splice(activeIndex, 1);
      updated.splice(targetIndex, 0, activeItem);

      setReports((prev) => ({
        ...prev,
        [sourceColumn]: updated,
      }));
      return;
    }

    const newSource = sourceItems.filter((r) => r.id !== activeId);
    const overIndexInDestination = destinationItems.findIndex(
      (r) => r.id === overId,
    );

    const insertIndex =
      overIndexInDestination >= 0
        ? overIndexInDestination
        : destinationItems.length;

    const newDestination = [
      ...destinationItems.slice(0, insertIndex),
      activeItem,
      ...destinationItems.slice(insertIndex),
    ];

    const prevState = JSON.parse(JSON.stringify(reports)) as typeof reports;
    setReports((prev) => ({
      ...prev,
      [sourceColumn]: newSource,
      [destinationColumn]: newDestination,
    }));

    if (isAdminView && sourceColumn !== destinationColumn) {
      try {
        await setReportStatusMutation.mutateAsync({
          id: activeId,
          status: destinationColumn,
        });
      } catch (e) {
        setReports(prevState);
      }
    }
  };

  const handleSubmitReport = async (id: string) => {
    try {
      await submitReportMutation.mutateAsync({ id });
      setReports((prev) => {
        const srcColumn: ColumnType = 'Draft';
        const destColumn: ColumnType = 'Reported';
        const src = prev[srcColumn].filter((r) => r.id !== id);
        const moved = prev[srcColumn].find((r) => r.id === id);
        return {
          ...prev,
          [srcColumn]: src,
          [destColumn]: moved ? [...prev[destColumn], moved] : prev[destColumn],
        };
      });
    } catch (e) {
      console.error('submitReport failed', e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReportMutation.mutateAsync({ id });
      setReports((prev) => {
        const copy = { ...prev };
        (Object.keys(copy) as ColumnType[]).forEach((c) => {
          copy[c] = copy[c].filter((r) => r.id !== id);
        });
        return copy;
      });
    } catch (e) {
      console.error('deleteReport failed', e);
    }
  };

  const handleEdit = (report: Report) => {
    if (onEditReport) {
      onEditReport(report);
    }
  };

  return (
    <div className="container mx-auto">
      <DndContext
        sensors={isAdminView ? sensors : []}
        onDragStart={({ active }) => {
          if (!isAdminView) return;
          const col = findColumnByReportId(active.id.toString());
          const item = col
            ? reports[col].find((r) => r.id === active.id.toString())
            : null;
          setActiveReport(item ?? null);
        }}
        // onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveReport(null)}
      >
        <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto md:pb-4">
          {(Object.keys(reports) as ColumnType[]).map((colId) => (
            <Droppable id={colId} key={colId}>
              <ReportColumn
                key={colId}
                title={colId}
                reports={reports[colId]}
                hideColumn={hideColumnAction}
                displayedStatus={displayedColumn}
                activeReportId={activeReport?.id}
                isAdminView={isAdminView}
                onEditReport={handleEdit}
                onDeleteReport={handleDelete}
                onSubmitReport={
                  !isAdminView && colId === 'Draft'
                    ? handleSubmitReport
                    : undefined
                }
              />
            </Droppable>
          ))}
        </div>

        <DragOverlay>
          {activeReport && (
            <ReportCard
              report={activeReport}
              column={findColumnByReportId(activeReport.id) ?? 'Draft'}
              // onClick={() => {}}
              // onEdit={() => {}}
              // onDelete={() => {}}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
