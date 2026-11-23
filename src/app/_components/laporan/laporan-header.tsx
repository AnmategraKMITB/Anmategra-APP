import Image from 'next/image';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

import { type ColumnType } from './board/report-column';
import LaporanFormDialog from './detail/laporan-form';
import DisplayBoard from '/public/icons/board-icon.svg';
import Display from '/public/icons/display.svg';
import DisplayList from '/public/icons/list-icon.svg';
import Status from '/public/icons/status.svg';
import Draft from '/public/images/laporan/draft.svg';
import InProgress from '/public/images/laporan/in-progress.svg';
import Resolved from '/public/images/laporan/resolved.svg';

export type CurrentDisplay = 'Board' | 'List';

interface LaporanHeaderProps {
  setCurrentDisplay: (value: CurrentDisplay) => void;
  status: ColumnType[];
  toggleStatus: (column: ColumnType) => void;
  isLaporanEmpty: boolean;
  currentDisplay: CurrentDisplay;
  isAdminView: boolean;
}

export const LaporanHeader = ({
  setCurrentDisplay,
  status,
  toggleStatus,
  isLaporanEmpty = false,
  currentDisplay,
  isAdminView,
}: LaporanHeaderProps) => {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <h1 className="text-[28px] font-semibold lg:text-[32px]">Laporan</h1>

      <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:gap-[19px]">
        {/* Dropdown Display */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="flex h-[50px] w-full items-center gap-2 rounded-xl border px-7 py-3 font-semibold lg:w-[169px]"
            >
              <Image
                src={Display}
                alt="Display"
                className="h-[21px] w-[19.5px]"
              />
              <p className="text-[16px] lg:text-[18px]">Display</p>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="flex w-[var(--radix-dropdown-menu-trigger-width)] flex-col items-center gap-4 rounded-md border px-3 py-4"
          >
            <DropdownMenuItem
              className="flex w-full min-w-[150px] flex-row items-center gap-4 text-lg font-semibold hover:bg-gray-200"
              onClick={() => setCurrentDisplay('List')}
            >
              <Image src={DisplayList} alt="Display-list" className="h-4 w-4" />
              <p className="text-sm">List</p>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="flex w-full min-w-[150px] flex-row items-center gap-4 text-lg font-semibold hover:bg-gray-200"
              onClick={() => setCurrentDisplay('Board')}
            >
              <Image
                src={DisplayBoard}
                alt="Display-board"
                className="h-4 w-4"
              />
              <p className="text-sm text-neutral-900">Board</p>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dropdown Status */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="flex h-[50px] w-full items-center gap-2 rounded-xl border px-7 py-3 font-semibold lg:w-[169px]"
            >
              <Image src={Status} alt="Status" className="h-[26px] w-[26px]" />
              <p className="text-[16px] lg:text-[18px]">Status</p>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="flex w-[var(--radix-dropdown-menu-trigger-width)] flex-col items-center gap-4 rounded-md border px-3 py-4"
          >
            <DropdownMenuCheckboxItem
              className="flex w-full min-w-[150px] flex-row items-center gap-5 text-lg font-semibold"
              checked={status.includes('Draft')}
              onClick={() => toggleStatus('Draft')}
            >
              <Image src={Draft} alt="Draft Icon" className="h-5 w-5" />
              <span className="text-sm">Draft</span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="flex w-full min-w-[150px] flex-row items-center gap-5 text-lg font-semibold"
              checked={status.includes('Reported')}
              onClick={() => toggleStatus('Reported')}
            >
              <Image src={Draft} alt="Draft Icon" className="h-5 w-5" />
              <span className="text-sm">Reported</span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="flex w-full min-w-[150px] flex-row items-center gap-5 text-lg font-semibold"
              checked={status.includes('In Progress')}
              onClick={() => toggleStatus('In Progress')}
            >
              <Image
                src={InProgress}
                alt="In Progress Icon"
                className="h-5 w-5"
              />
              <span className="text-sm text-yellow-500">In Progress</span>
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              className="flex w-full min-w-[150px] flex-row items-center gap-5 text-lg font-semibold"
              checked={status.includes('Resolved')}
              onClick={() => toggleStatus('Resolved')}
            >
              <Image src={Resolved} alt="Resolved Icon" className="h-5 w-5" />
              <span className="text-sm text-green-700">Resolved</span>
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tambah Laporan */}
        {!isLaporanEmpty && !isAdminView && (
          <LaporanFormDialog isAdmin={isAdminView ?? false} />
        )}
      </div>
    </header>
  );
};
