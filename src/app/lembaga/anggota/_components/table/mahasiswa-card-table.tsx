'use client';

// Library Import
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { type Session } from 'next-auth';
import Image from 'next/image';
import Link from 'next/link';
import CallMadeIcon from 'public/icons/call_made.svg';
import * as React from 'react';
import { ActionCell, type Member } from '~/app/_components/form/action-cell';
import { type comboboxDataType } from '~/app/_components/form/tambah-edit-anggota-form';
import CustomPagination from '~/app/_components/layout/pagination-comp';
import { Button } from '~/components/ui/button';
// Components Import
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';

type TableMeta = {
  lembagaId?: string;
  raporBasePath?: string;
  eventId?: string;
  session: Session | null;
  posisiBidangData: { posisi: comboboxDataType[]; bidang: comboboxDataType[] };
  isKegiatan?: boolean;
};

function SortableRow({
  row,
  isEditMode,
  index,
  onMoveUp,
  onMoveDown,
  currentPage,
  totalData,
  itemsPerPage,
}: {
  row: any;
  isEditMode: boolean;
  index: number;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  currentPage: number;
  totalData: number;
  itemsPerPage: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.original.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} key={row.id}>
      {isEditMode && (
        <TableCell className="w-12">
          <button
            className="cursor-grab rounded p-1 hover:bg-gray-100 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={20} className="text-gray-400" />
          </button>
        </TableCell>
      )}
      {row.getVisibleCells().map((cell: any) => (
        <TableCell key={cell.id} className="text-neutral-700">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
      {isEditMode && (
        <TableCell className="w-24">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onMoveUp(index)}
              disabled={(currentPage - 1) * itemsPerPage + index === 0}
            >
              <ChevronUp size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onMoveDown(index)}
              disabled={
                (currentPage - 1) * itemsPerPage + index === totalData - 1
              }
            >
              <ChevronDown size={16} />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

export function MahasiswaCardTable({
  data,
  lembagaId,
  raporBasePath = '/anggota',
  eventId,
  session,
  posisiBidangData,
  isKegiatan = false,
  isEditMode = false,
  onReorder,
  searchQuery = '',
  selectedFilters = [],
}: {
  data: Member[];
  lembagaId?: string;
  /** Awalan tautan rapor individu; bawaan halaman Owner. */
  raporBasePath?: string;
  eventId?: string;
  session: Session | null;
  posisiBidangData: { posisi: comboboxDataType[]; bidang: comboboxDataType[] };
  isKegiatan?: boolean;
  isEditMode?: boolean;
  onReorder?: (newOrder: Member[]) => void;
  searchQuery?: string;
  selectedFilters?: string[];
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [localData, setLocalData] = React.useState<Member[]>(data);
  const itemsPerPage = 10;

  React.useEffect(() => {
    setLocalData(data);
  }, [data]);

  const filteredData = React.useMemo(() => {
    let filtered = [...localData];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (member) =>
          member.nama.toLowerCase().includes(query) ||
          member.nim.toLowerCase().includes(query),
      );
    }

    if (selectedFilters.length > 0) {
      filtered = filtered.filter((member) =>
        selectedFilters.includes(member.divisi),
      );
    }

    return filtered;
  }, [localData, searchQuery, selectedFilters]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilters]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalData((items) => {
        const oldGlobalIndex = items.findIndex((item) => item.id === active.id);
        const newGlobalIndex = items.findIndex((item) => item.id === over.id);
        if (oldGlobalIndex !== -1 && newGlobalIndex !== -1) {
          const newOrder = arrayMove(items, oldGlobalIndex, newGlobalIndex);
          setTimeout(() => {
            if (onReorder) {
              onReorder(newOrder);
            }
          }, 0);
          return newOrder;
        }
        return items;
      });
    }
  };

  const handleMoveUp = React.useCallback(
    (index: number) => {
      const actualIndex = (currentPage - 1) * itemsPerPage + index;
      if (actualIndex > 0) {
        setLocalData((items) => {
          const newOrder = arrayMove(items, actualIndex, actualIndex - 1);
          setTimeout(() => {
            if (onReorder) {
              onReorder(newOrder);
            }
          }, 0);
          return newOrder;
        });
        const newIndex = actualIndex - 1;
        const newPage = Math.floor(newIndex / itemsPerPage) + 1;
        if (newPage !== currentPage) {
          setTimeout(() => setCurrentPage(newPage), 0);
        }
      }
    },
    [currentPage, itemsPerPage, onReorder],
  );

  const handleMoveDown = React.useCallback(
    (index: number) => {
      const actualIndex = (currentPage - 1) * itemsPerPage + index;
      setLocalData((items) => {
        if (actualIndex < items.length - 1) {
          const newOrder = arrayMove(items, actualIndex, actualIndex + 1);
          setTimeout(() => {
            if (onReorder) {
              onReorder(newOrder);
            }
          }, 0);
          const newIndex = actualIndex + 1;
          const newPage = Math.floor(newIndex / itemsPerPage) + 1;
          if (newPage !== currentPage) {
            setTimeout(() => setCurrentPage(newPage), 0);
          }
          return newOrder;
        }
        return items;
      });
    },
    [currentPage, itemsPerPage, onReorder],
  );

  const paginatedData = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage]);

  const tableMeta = React.useMemo(
    () => ({
      lembagaId,
      raporBasePath,
      eventId,
      session,
      posisiBidangData,
      isKegiatan,
    }),
    [lembagaId, raporBasePath, eventId, session, posisiBidangData, isKegiatan],
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const columns: ColumnDef<Member>[] = [
    {
      accessorKey: 'nama',
      header: 'Nama',
      cell: ({ row }) => <span>{row.getValue('nama')}</span>,
    },
    {
      accessorKey: 'nim',
      header: 'NIM',
      cell: ({ row }) => <span>{row.getValue('nim')}</span>,
    },
    {
      accessorKey: 'divisi',
      header: 'Divisi',
      cell: ({ row }) => <span>{row.getValue('divisi')}</span>,
    },
    {
      accessorKey: 'posisi',
      header: 'Posisi',
      cell: ({ row }) => <span>{row.getValue('posisi')}</span>,
    },
    {
      accessorKey: 'rapor',
      header: 'Rapor',
      cell: ({ row, table }) => {
        const eventId = (table.options.meta as TableMeta)?.eventId;
        const isKegiatan = (table.options.meta as TableMeta)?.isKegiatan;
        const base =
          (table.options.meta as TableMeta)?.raporBasePath ?? '/anggota';
        const href =
          isKegiatan && eventId
            ? `/kegiatan/${eventId}/panitia/${row.original.id}`
            : `${base}/${row.original.id}`;

        return (
          <Link href={href}>
            <Button
              variant="outline"
              className="bg-neutral-250 flex items-center gap-2 rounded-lg border-neutral-400 px-3 py-2 text-gray-700 hover:bg-neutral-300"
            >
              Lihat
              <Image
                src={CallMadeIcon}
                alt="Call Made Icon"
                width={16}
                height={16}
              />
            </Button>
          </Link>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row, table }) => (
        <ActionCell
          member={row.original}
          lembagaId={(table.options.meta as TableMeta)?.lembagaId}
          eventId={(table.options.meta as TableMeta)?.eventId}
          session={(table.options.meta as TableMeta)?.session}
          posisiBidangData={(table.options.meta as TableMeta)?.posisiBidangData}
          isKegiatan={(table.options.meta as TableMeta)?.isKegiatan}
        />
      ),
    },
  ];

  const table = useReactTable({
    data: paginatedData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta: tableMeta,
  });

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1">
        {/* Desktop Table View */}
        <div className="hidden w-full overflow-x-auto md:block">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table className="min-w-max">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="text-neutral-500">
                    {isEditMode && (
                      <TableHead className="w-12 text-left font-normal"></TableHead>
                    )}
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="text-left font-normal"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                    {isEditMode && (
                      <TableHead className="w-24 text-left font-normal"></TableHead>
                    )}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                <SortableContext
                  items={table.getRowModel().rows.map((row) => row.original.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {table.getRowModel().rows.length ? (
                    table
                      .getRowModel()
                      .rows.map((row, index) => (
                        <SortableRow
                          key={row.original.id}
                          row={row}
                          isEditMode={isEditMode}
                          index={index}
                          onMoveUp={handleMoveUp}
                          onMoveDown={handleMoveDown}
                          currentPage={currentPage}
                          totalData={localData.length}
                          itemsPerPage={itemsPerPage}
                        />
                      ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length + (isEditMode ? 2 : 0)}
                        className="py-12 text-center"
                      >
                        <div className="text-neutral-500">
                          <p className="mb-2 text-lg">
                            Tidak ada anggota ditemukan
                          </p>
                          <p className="text-sm">
                            Coba ubah filter atau kata kunci pencarian
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        </div>

        {/* Mobile Card View */}
        <div className="space-y-4 md:hidden">
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <div
                key={row.id}
                className="rounded-lg border bg-white p-4 shadow-sm"
              >
                {/* Header - Name and NIM */}
                <div className="mb-4 border-b pb-3">
                  <h3 className="text-lg font-semibold text-neutral-700">
                    {row.original.nama}
                  </h3>
                  <p className="text-sm text-neutral-500">{row.original.nim}</p>
                </div>

                {/* Details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-500">
                      Divisi
                    </span>
                    <span className="text-sm text-neutral-700">
                      {row.original.divisi}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-500">
                      Posisi
                    </span>
                    <span className="text-sm text-neutral-700">
                      {row.original.posisi}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-2 border-t pt-3">
                  <Link
                    href={
                      isKegiatan && eventId
                        ? `/kegiatan/${eventId}/panitia/${row.original.id}`
                        : `${raporBasePath}/${row.original.id}`
                    }
                    className="flex-1"
                  >
                    <Button
                      variant="outline"
                      className="bg-neutral-250 w-full border-neutral-400 text-gray-700 hover:bg-neutral-300"
                    >
                      Lihat Rapor
                    </Button>
                  </Link>
                  <ActionCell
                    member={row.original}
                    lembagaId={lembagaId}
                    eventId={eventId}
                    session={session}
                    posisiBidangData={posisiBidangData}
                    isKegiatan={isKegiatan}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border bg-white py-12 text-center">
              <div className="text-neutral-500">
                <p className="mb-2 text-lg">Tidak ada anggota ditemukan</p>
                <p className="text-sm">
                  Coba ubah filter atau kata kunci pencarian
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <CustomPagination
          currentPage={currentPage}
          totalPages={totalPages}
          setCurrentPage={setCurrentPage}
        />
      )}
    </div>
  );
}
