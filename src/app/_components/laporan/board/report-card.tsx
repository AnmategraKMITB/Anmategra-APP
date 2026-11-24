'use client';

import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

import { type ColumnType } from './report-column';

// import Link from 'next/link';

export interface Report {
  id: string;
  name: string;
  date: string;
  category: string;
  description?: string;
  urgent?: string;
  attachment?: string;
}

export interface ReportCardProps {
  report: Report;
  column: ColumnType;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSubmit?: () => void;
}

export function ReportCard({
  report,
  column,
  onClick,
  onEdit,
  onDelete,
  onSubmit,
}: ReportCardProps) {
  const showMenu = column === 'Draft';
  const showSubmit = column === 'Draft' && Boolean(onSubmit);

  return (
    <div className="relative w-full">
      {(showMenu || showSubmit) && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
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
              <DropdownMenuTrigger className="select-none text-2xl">
                ...
              </DropdownMenuTrigger>

              <DropdownMenuContent className="text-xl">
                <DropdownMenuItem onClick={onEdit}>
                  <Button variant="ghost" className="w-full justify-start">
                    Edit
                  </Button>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onDelete}>
                  <Button variant="ghost" className="w-full justify-start">
                    Delete
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      <button
        onClick={onClick}
        className="w-full rounded-[20px] bg-white px-6 py-5 pr-14 text-left shadow"
      >
        <h3 className="mb-2 truncate text-[20px] font-semibold text-primary-400">
          {report.name}
        </h3>

        <div className="text-secondary-1100 flex items-center justify-between">
          <span className="text-[13px] text-gray-500">
            {report.date.slice(0, 11)}
          </span>

          <span className="max-w-[55%] truncate rounded-full border border-[#636A6D] bg-transparent px-4 py-1 text-right text-[13px] text-[#636A6D]">
            {report.category}
          </span>
        </div>
      </button>
    </div>
  );
}
