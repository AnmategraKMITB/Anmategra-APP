'use client';

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Download,
  Search,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { cn } from '~/lib/utils';

import { downloadBlob, exportFileStem } from './export-image';
import {
  EXPORT_HEADER,
  buildXlsx,
  guardCell,
  rowCells,
  toTsv,
} from './export-table';
import {
  type Draft,
  type PlacementsByPosition,
  filledOfQuota,
  levelOf,
  pathOf,
  rankLabelFor,
} from './model';

type Row = {
  positionId: string;
  unitId: string;
  path: string;
  unitName: string;
  title: string;
  rankLabel: string;
  kindLabel: string;
  quota: number;
  filled: number;
  hidden: boolean;
  peopleLabel: string;
  depth: number;
  tier: string;
  visibility: string;
  searchText: string;
};

function fillClass(filled: number, quota: number): string {
  if (quota > 0 && filled >= quota) return 'font-semibold text-success-dark';
  if (quota > 0 && filled === 0) return 'font-semibold text-neutral-1000';
  return 'text-neutral-700';
}

const COLUMNS: ColumnDef<Row>[] = [
  {
    id: 'bagian',
    accessorFn: (row) => `${row.path} ${row.unitName}`,
    header: 'Bagian',
    cell: ({ row }) => (
      <div className="min-w-0">
        {row.original.path !== '' ? (
          <p className="text-xs tabular-nums text-neutral-700">
            {row.original.path}
          </p>
        ) : null}
        <p className="break-words font-medium text-neutral-1000">
          {row.original.unitName}
        </p>
      </div>
    ),
  },
  {
    id: 'jabatan',
    accessorFn: (row) => row.title,
    header: 'Jabatan',
    cell: ({ row }) => (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-neutral-1000">{row.original.title}</span>
        {row.original.hidden ? (
          <span className="text-xs text-neutral-700">Disembunyikan</span>
        ) : null}
      </div>
    ),
  },
  {
    id: 'rank',
    accessorFn: (row) => row.rankLabel,
    header: 'Rank',
    cell: ({ row }) => (
      <span className="text-neutral-700">{row.original.rankLabel}</span>
    ),
  },
  {
    id: 'jenis',
    accessorFn: (row) => row.kindLabel,
    header: 'Jenis',
    cell: ({ row }) => (
      <span className="text-neutral-700">{row.original.kindLabel}</span>
    ),
  },
  {
    id: 'kuota',
    accessorFn: (row) => row.quota,
    header: 'Kuota',
    cell: ({ row }) => (
      <span className="tabular-nums text-neutral-700">
        {row.original.quota === 0 ? 'Tanpa batas' : row.original.quota}
      </span>
    ),
  },
  {
    id: 'terisi',
    accessorFn: (row) => row.filled,
    header: 'Terisi',
    cell: ({ row }) => {
      const { filled, quota } = row.original;
      return (
        <span className={cn('tabular-nums', fillClass(filled, quota))}>
          {quota === 0 ? filled : `${filled}/${quota}`}
        </span>
      );
    },
  },
  {
    id: 'level',
    accessorFn: (row) => row.depth,
    header: 'Level',
    cell: ({ row }) => (
      <span className="tabular-nums text-neutral-700">
        {row.original.depth}
      </span>
    ),
  },
  {
    id: 'tier',
    accessorFn: (row) => row.tier,
    header: 'Tier',
    cell: ({ row }) => (
      <span className="text-neutral-700">{row.original.tier}</span>
    ),
  },
  {
    id: 'tampil',
    accessorFn: (row) => row.visibility,
    header: 'Tampil',
    cell: ({ row }) => (
      <span
        className={
          row.original.visibility === 'Tampil'
            ? 'text-neutral-700'
            : 'font-semibold text-neutral-1000'
        }
      >
        {row.original.visibility}
      </span>
    ),
  },
  {
    id: 'orang',
    accessorFn: (row) => row.peopleLabel,
    header: 'Orang',
    cell: ({ row }) => {
      const label = row.original.peopleLabel;
      if (label === '') return <span className="text-neutral-700">-</span>;
      return (
        <span
          className="block max-w-[16rem] truncate text-neutral-700"
          title={label}
        >
          {label}
        </span>
      );
    },
  },
];

const csvCell = (value: string | number): string => {
  const text = guardCell(value);
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV dari baris yang sedang tampil (urutan dan pencarian ikut); "Orang" berisi nama, dipisah titik koma. */
function toCsv(rows: Row[]): string {
  const lines = [EXPORT_HEADER.join(',')];
  for (const row of rows) lines.push(rowCells(row).map(csvCell).join(','));
  return lines.join('\r\n');
}

function sortIcon(sorted: false | 'asc' | 'desc'): JSX.Element {
  if (sorted === 'asc') return <ArrowUp className="size-4" />;
  if (sorted === 'desc') return <ArrowDown className="size-4" />;
  return <ChevronsUpDown className="size-4 text-neutral-500" />;
}

function ariaSort(
  sorted: false | 'asc' | 'desc',
): 'ascending' | 'descending' | 'none' {
  if (sorted === 'asc') return 'ascending';
  if (sorted === 'desc') return 'descending';
  return 'none';
}

export function TableView(props: {
  draft: Draft;
  placements: PlacementsByPosition;
  selectedId: string | null;
  onSelect: (unitId: string) => void;
}): JSX.Element {
  const { draft, placements, selectedId, onSelect } = props;
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'bagian', desc: false },
  ]);

  const rows = useMemo<Row[]>(() => {
    const unitsById = new Map(
      draft.units.map((unit) => [unit.id, unit] as const),
    );
    return draft.positions.map((position) => {
      const unit = unitsById.get(position.unitId) ?? null;
      const path = unit === null ? '' : pathOf(draft.units, unit.id);
      const unitName = unit?.name ?? '';
      const people = placements[position.id] ?? [];
      const peopleLabel = people
        .map((person) => person.name ?? 'Tanpa nama')
        .join(', ');
      const rankLabel = rankLabelFor(position.rank, draft.ranks);
      const kindLabel =
        position.kind === 'struktural' ? 'Struktural' : 'Nonstruktural';
      const { filled, quota } = filledOfQuota(position, placements);
      return {
        positionId: position.id,
        unitId: position.unitId,
        path,
        unitName,
        title: position.title,
        rankLabel,
        kindLabel,
        quota,
        filled,
        hidden: position.hidden,
        peopleLabel,
        depth: unit === null ? 0 : levelOf(draft.units, unit.id),
        tier:
          unit?.layout.tier === undefined
            ? 'Ikut kedalaman'
            : `Tier ${unit.layout.tier}`,
        visibility:
          position.hidden || unit?.layout.hidden === true
            ? 'Disembunyikan'
            : 'Tampil',
        searchText:
          `${path} ${unitName} ${position.title} ${rankLabel} ${peopleLabel}`.toLowerCase(),
      };
    });
  }, [draft, placements]);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      query === ''
        ? rows
        : rows.filter((row) => row.searchText.includes(query)),
    [rows, query],
  );

  // TanStack Table mengembalikan fungsi yang tidak stabil; React Compiler
  // tidak perlu memoisasi hasilnya.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered,
    columns: COLUMNS,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.positionId,
  });

  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownRows = table.getRowModel().rows.map((row) => row.original);

  const fileStem = `organogram-${exportFileStem(draft.name)}`;

  /** TSV, bukan CSV: ditempel ke Google Sheets atau Excel, kolomnya langsung terpisah. */
  const copyForSheets = async () => {
    try {
      await navigator.clipboard.writeText(toTsv(shownRows));
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Penyalinan diblokir peramban. Pakai Unduh Excel atau CSV.');
    }
  };

  const downloadCsv = () => {
    // BOM supaya Excel membaca UTF-8 dengan benar.
    downloadBlob(
      new Blob(['\uFEFF', toCsv(shownRows)], {
        type: 'text/csv;charset=utf-8',
      }),
      `${fileStem}.csv`,
    );
  };

  const downloadXlsx = async () => {
    try {
      downloadBlob(await buildXlsx(shownRows, draft.name), `${fileStem}.xlsx`);
    } catch {
      toast.error('Berkas Excel gagal dibuat. Coba Unduh CSV.');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-400 bg-neutral-50 p-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari jabatan, bagian, atau orang"
          aria-label="Cari jabatan, bagian, atau orang"
          startAdornment={<Search className="size-4 text-neutral-500" />}
          className="h-9 min-w-[14rem] flex-1 rounded-full border-neutral-400 text-sm text-neutral-1000"
        />
        <span className="text-sm tabular-nums text-neutral-700">
          {shownRows.length} baris
        </span>
        <Button
          variant="dark_blue_outline"
          size="sm"
          onClick={() => void copyForSheets()}
          aria-live="polite"
        >
          {copied ? 'Tersalin' : 'Salin untuk Sheets'}
        </Button>
        <Button
          variant="dark_blue_outline"
          size="sm"
          onClick={() => void downloadXlsx()}
        >
          <Download className="size-4" />
          Unduh Excel
        </Button>
        <Button variant="dark_blue_outline" size="sm" onClick={downloadCsv}>
          <Download className="size-4" />
          Unduh CSV
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto [&>div]:overflow-visible">
        <Table className="text-sm">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-neutral-400 hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={ariaSort(sorted)}
                      className="sticky top-0 z-10 bg-neutral-50 px-3"
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 rounded-[8px] py-1 text-xs font-semibold text-neutral-700 transition-colors duration-150 hover:text-primary-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-400"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {sortIcon(sorted)}
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const selected = selectedId === row.original.unitId;
              return (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onSelect(row.original.unitId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect(row.original.unitId);
                    }
                  }}
                  className={cn(
                    'cursor-pointer border-neutral-200 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary-400',
                    selected
                      ? 'bg-primary-200 hover:bg-primary-200'
                      : 'hover:bg-neutral-200',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 py-3 text-sm">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-neutral-700">
            {rows.length === 0 ? 'Belum ada jabatan.' : 'Tidak ada yang cocok.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
