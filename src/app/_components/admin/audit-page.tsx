'use client';

import { type SortingState } from '@tanstack/react-table';
import { useState } from 'react';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';

import { AdminDataTable } from './admin-data-table';
import { AdminPageHeader } from './admin-page-header';
import type { ColumnDef } from '@tanstack/react-table';

type Row = {
  id: string;
  action: string;
  entityType: string;
  summary: string;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string;
};

const PAGE_SIZE = 50;

export function AuditPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const list = api.adminConsole.auditList.useQuery({
    search: search.trim() || undefined,
    page,
    pageSize: PAGE_SIZE,
    sort: sorting[0]?.id === 'action' ? 'action' : 'created_at',
    dir: sorting[0]?.desc === false ? 'asc' : 'desc',
  });
  const columns: ColumnDef<Row>[] = [
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: 'Waktu',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-neutral-700">
          {row.original.createdAt.toLocaleString('id-ID')}
        </span>
      ),
    },
    {
      id: 'actor',
      header: 'Aktor',
      enableSorting: false,
      cell: ({ row }) => (
        <span>
          <span className="font-semibold">{row.original.actorName ?? row.original.actorEmail}</span>
          <span className="block text-xs text-neutral-700">{row.original.actorEmail}</span>
        </span>
      ),
    },
    {
      id: 'action',
      accessorKey: 'action',
      header: 'Aksi',
      cell: ({ row }) => (
        <span>
          {row.original.action}
          <span className="block text-xs text-neutral-700">{row.original.entityType}</span>
        </span>
      ),
    },
    {
      id: 'summary',
      accessorKey: 'summary',
      header: 'Ringkasan',
      cell: ({ row }) => row.original.summary,
    },
  ];

  return (
    <div className="grid gap-4">
      <AdminPageHeader
        title="Audit"
        description="Jejak tindakan backoffice: akun, lembaga, grant, dan izin operator."
      />
      <Input
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Cari ringkasan atau aksi"
      />
      <AdminDataTable
        columns={columns}
        data={(list.data?.rows ?? []) as Row[]}
        sorting={sorting}
        onSortingChange={(next) => {
          setSorting(next);
          setPage(1);
        }}
        page={page}
        total={list.data?.total ?? 0}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        loading={list.isLoading}
        error={list.isError ? list.error.message : null}
        empty="Belum ada audit."
        rowKey={(row) => row.id}
      />
    </div>
  );
}
