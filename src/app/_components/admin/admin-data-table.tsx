'use client';

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';

type AdminDataTableProps<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  error?: string | null;
  empty?: string;
  rowKey: (row: T) => string;
};

function sortIcon(sorted: false | 'asc' | 'desc') {
  if (sorted === 'asc') return <ArrowUp className="size-3.5" />;
  if (sorted === 'desc') return <ArrowDown className="size-3.5" />;
  return <ChevronsUpDown className="size-3.5 text-neutral-500" />;
}

function ariaSort(sorted: false | 'asc' | 'desc') {
  if (sorted === 'asc') return 'ascending' as const;
  if (sorted === 'desc') return 'descending' as const;
  return 'none' as const;
}

export function AdminDataTable<T>({
  columns,
  data,
  sorting,
  onSortingChange,
  page,
  total,
  pageSize,
  onPageChange,
  loading,
  error,
  empty = 'Tidak ada data yang cocok.',
  rowKey,
}: AdminDataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(sorting) : updater;
      onSortingChange(next);
    },
    manualSorting: true,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => rowKey(row),
  });
  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (error) {
    return (
      <p role="alert" className="text-sm text-danger-dark">
        {error}
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-[20px] border border-neutral-400 bg-neutral-50">
        <Table className="min-w-[820px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id} aria-sort={ariaSort(sorted)}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-neutral-700"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {sortIcon(sorted)}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-6 text-center text-neutral-700">
                  Memuat…
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-6 text-center text-neutral-700">
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
        <Button
          size="sm"
          variant="dark_blue_outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Sebelumnya
        </Button>
        <Button
          size="sm"
          variant="dark_blue_outline"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Berikutnya
        </Button>
        <span>
          {total} data · halaman {page} dari {pages}
        </span>
      </div>
    </div>
  );
}
