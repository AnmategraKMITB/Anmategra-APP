'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { type Report, ReportCard } from './report-card';
import { type ColumnType } from './report-column';

export function SortableReportCard({
  report,
  column,
  onClickAction,
  onEdit,
  onDelete,
  isAdminView,
  onSubmitReport,
}: {
  report: Report;
  column: ColumnType;
  onClickAction: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isAdminView?: boolean;
  onSubmitReport?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: report.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const canDrag = Boolean(isAdminView);
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canDrag ? attributes : {})}
      {...(canDrag ? listeners : {})}
      className={canDrag ? 'cursor-grab active:cursor-grabbing' : ''}
    >
      <ReportCard
        report={report}
        column={column}
        onClick={onClickAction}
        onEdit={onEdit}
        onDelete={onDelete}
        onSubmit={onSubmitReport}
      />
    </div>
  );
}
