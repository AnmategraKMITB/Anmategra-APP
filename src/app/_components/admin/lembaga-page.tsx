'use client';

import { type ColumnDef, type SortingState } from '@tanstack/react-table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';

import { AdminDataTable } from './admin-data-table';
import { AdminEntitySearch } from './admin-entity-search';
import { AdminPageHeader } from './admin-page-header';

const PAGE_SIZE = 25;
const TYPES = [
  'Himpunan',
  'UKM',
  'Kepanitiaan',
  'BSO',
  'Badan',
  'Pusat',
  'Organisasi',
] as const;

type Row = {
  id: string;
  name: string;
  acronym: string | null;
  type: string | null;
  parentId: string | null;
  image: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  memberCount: number | null;
};

const SORT_MAP: Record<string, 'name' | 'acronym' | 'type' | 'created_at'> = {
  name: 'name',
  acronym: 'acronym',
  type: 'type',
  createdAt: 'created_at',
};

export function LembagaPage() {
  const router = useRouter();
  const permissions = api.adminConsole.myAdminPermissions.useQuery();
  const canRead =
    permissions.data?.permissions.includes('*') ??
    permissions.data?.permissions.includes('lembaga.read') ??
    false;
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const sort = SORT_MAP[sorting[0]?.id ?? 'name'] ?? 'name';
  const dir = sorting[0]?.desc ? 'desc' : 'asc';

  const list = api.adminConsole.lembagaList.useQuery(
    {
      search: search.trim() || undefined,
      type: (type || undefined) as (typeof TYPES)[number] | undefined,
      page,
      pageSize: PAGE_SIZE,
      sort,
      dir,
    },
    { enabled: canRead },
  );
  const groups = api.adminConsole.lembagaGroups.useQuery(undefined, { enabled: canRead });

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Lembaga',
        cell: ({ row }) => (
          <Link
            href={`/admin/lembaga/${row.original.id}`}
            className="font-semibold text-neutral-1000 underline-offset-2 hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        id: 'acronym',
        accessorKey: 'acronym',
        header: 'Singkatan',
        cell: ({ row }) => row.original.acronym ?? '—',
      },
      {
        id: 'type',
        accessorKey: 'type',
        header: 'Jenis',
        cell: ({ row }) => row.original.type ?? '—',
      },
      {
        id: 'owner',
        header: 'Akun',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs text-neutral-700">
            {row.original.ownerName ?? '—'}
            <br />
            {row.original.ownerEmail ?? ''}
          </span>
        ),
      },
      {
        id: 'members',
        header: 'Anggota',
        enableSorting: false,
        cell: ({ row }) => row.original.memberCount ?? '—',
      },
      {
        id: 'actions',
        header: 'Aksi',
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/admin/lembaga/${row.original.id}`}
            className="text-sm font-semibold text-primary-400 underline-offset-2 hover:underline"
          >
            Ubah
          </Link>
        ),
      },
    ],
    [],
  );

  if (!canRead) return <p className="text-sm text-danger-dark">Tidak punya izin melihat lembaga.</p>;

  return (
    <div className="grid gap-4">
      <AdminPageHeader
        title="Lembaga"
        description="Cari, urutkan, dan kelola profil lembaga, kegiatan, kepengurusan, dan organogram."
      />

      <div className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="grid gap-2">
            <span className="text-sm font-semibold text-neutral-700">Cari cepat lembaga</span>
            <AdminEntitySearch
              kind="lembaga"
              value=""
              placeholder="Ketik nama, singkatan, atau jenis…"
              onSelect={(id) => router.push(`/admin/lembaga/${id}`)}
            />
          </div>
          <label className="grid gap-1 text-sm font-semibold text-neutral-700">
            Filter jenis
            <select
              className="h-10 rounded-md border border-neutral-400 bg-neutral-50 px-3 text-sm"
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua jenis</option>
              {TYPES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {(groups.data ?? []).map((group) => (
            <button
              key={group.type}
              type="button"
              onClick={() => {
                setType(group.type);
                setPage(1);
              }}
              className="rounded-full border border-neutral-400 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-200"
            >
              {group.type} · {group.n}
            </button>
          ))}
        </div>
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          Cari di tabel
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Nama, singkatan, atau jenis"
          />
        </label>
      </div>

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
        empty="Tidak ada lembaga yang cocok."
        rowKey={(row) => row.id}
      />
    </div>
  );
}
