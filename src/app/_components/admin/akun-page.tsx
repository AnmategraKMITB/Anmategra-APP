'use client';

import { type ColumnDef, type SortingState } from '@tanstack/react-table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';

import { AdminDataTable } from './admin-data-table';
import { AdminEditPanel } from './admin-edit-panel';
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
  name: string | null;
  email: string;
  role: 'admin' | 'lembaga' | 'mahasiswa';
  isDemo: boolean;
  hiddenAt: Date | null;
  nim: number | null;
  jurusan: string | null;
  angkatan: number | null;
  status: 'aktif' | 'alumni' | null;
  lembagaName: string | null;
  lembagaType: string | null;
};

type CreateValues = {
  kind: 'mahasiswa' | 'lembaga';
  email: string;
  name: string;
  nim?: string;
  jurusan?: string;
  angkatan?: number;
  lembagaName?: string;
  lembagaType?: (typeof TYPES)[number];
  acronym?: string;
  isDemo: boolean;
  hidden: boolean;
};

const SORT_MAP: Record<string, 'name' | 'email' | 'role' | 'created_at'> = {
  name: 'name',
  email: 'email',
  role: 'role',
  createdAt: 'created_at',
};

export function AkunPage() {
  const router = useRouter();
  const utils = api.useUtils();
  const permissions = api.adminConsole.myAdminPermissions.useQuery();
  const perms = permissions.data?.permissions ?? [];
  const canRead = perms.includes('*') || perms.includes('accounts.read');
  const canWrite = perms.includes('*') || perms.includes('accounts.write');
  const canRoles = perms.includes('*') || perms.includes('accounts.roles');

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<'all' | 'demo' | 'hidden'>('all');
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);
  const [openCreate, setOpenCreate] = useState(false);

  const sort = SORT_MAP[sorting[0]?.id ?? 'createdAt'] ?? 'created_at';
  const dir = sorting[0]?.desc === false ? 'asc' : 'desc';
  const list = api.adminConsole.usersList.useQuery(
    {
      search: search.trim() || undefined,
      role: (role || undefined) as 'admin' | 'lembaga' | 'mahasiswa' | undefined,
      status,
      page,
      pageSize: PAGE_SIZE,
      sort,
      dir,
    },
    { enabled: canRead },
  );
  const stats = api.adminConsole.stats.useQuery(undefined, { enabled: canRead });
  const create = api.adminConsole.userCreate.useMutation({
    onSuccess: () => {
      setOpenCreate(false);
      void utils.adminConsole.usersList.invalidate();
      void utils.adminConsole.stats.invalidate();
    },
  });

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Akun',
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <Link
              href={`/admin/akun/${row.original.id}`}
              className="font-semibold text-neutral-1000 underline-offset-2 hover:underline"
            >
              {row.original.name ?? 'Tanpa nama'}
            </Link>
            <span className="block text-xs text-neutral-700">{row.original.email}</span>
          </div>
        ),
      },
      {
        id: 'role',
        accessorKey: 'role',
        header: 'Tipe',
        cell: ({ row }) => <span className="capitalize">{row.original.role}</span>,
      },
      {
        id: 'profile',
        header: 'Profil',
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          if (r.nim) {
            return `${r.nim} · ${r.jurusan ?? '—'} · ${r.angkatan ?? '—'}`;
          }
          if (r.lembagaName) {
            return `${r.lembagaName}${r.lembagaType ? ` · ${r.lembagaType}` : ''}`;
          }
          return '—';
        },
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1">
            {row.original.isDemo ? <Badge>demo</Badge> : null}
            {row.original.hiddenAt ? <Badge>hidden</Badge> : null}
            {row.original.status === 'alumni' ? <Badge>alumni</Badge> : null}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Aksi',
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/admin/akun/${row.original.id}`}
            className="text-sm font-semibold text-primary-400 underline-offset-2 hover:underline"
          >
            Ubah
          </Link>
        ),
      },
    ],
    [],
  );

  if (!canRead) {
    return <p className="text-sm text-danger-dark">Tidak punya izin melihat akun.</p>;
  }

  return (
    <div className="grid gap-4">
      <AdminPageHeader
        title="Akun"
        description="Cari, urutkan, dan ubah akun mahasiswa/lembaga. Klik nama untuk membuka editor lengkap."
        actions={
          canWrite ? (
            <Button type="button" onClick={() => setOpenCreate((value) => !value)}>
              {openCreate ? 'Tutup form' : 'Tambah akun'}
            </Button>
          ) : null
        }
      />

      {stats.data ? (
        <p className="text-sm text-neutral-700">
          {stats.data.users} akun · {stats.data.lembaga} lembaga · {stats.data.demoUsers} demo ·{' '}
          {stats.data.hiddenUsers} disembunyikan
        </p>
      ) : null}

      {openCreate ? (
        <CreateAkunPanel
          canEditDemo={stats.data?.appEnv === 'demo'}
          pending={create.isPending}
          error={create.error?.message ?? null}
          onSubmit={(values) => create.mutate(values)}
        />
      ) : null}

      <div className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="grid gap-2">
            <span className="text-sm font-semibold text-neutral-700">Cari cepat akun</span>
            <AdminEntitySearch
              kind="user"
              value=""
              placeholder="Ketik nama, email, atau NIM untuk membuka detail…"
              onSelect={(id) => router.push(`/admin/akun/${id}`)}
            />
          </div>
          <label className="grid gap-1 text-sm font-semibold text-neutral-700">
            Filter status
            <select
              className="h-10 rounded-md border border-neutral-400 bg-neutral-50 px-3 text-sm"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setPage(1);
              }}
            >
              <option value="all">Semua</option>
              <option value="demo">Demo</option>
              <option value="hidden">Disembunyikan</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <label className="grid gap-1 text-sm font-semibold text-neutral-700">
            Cari di tabel
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Nama, email, atau NIM"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-neutral-700">
            Role
            <select
              className="h-10 rounded-md border border-neutral-400 bg-neutral-50 px-3 text-sm"
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua role</option>
              <option value="mahasiswa">Mahasiswa</option>
              <option value="lembaga">Lembaga</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
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
        empty="Tidak ada akun yang cocok."
        rowKey={(row) => row.id}
      />
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] text-neutral-700">
      {children}
    </span>
  );
}

function CreateAkunPanel({
  canEditDemo,
  pending,
  error,
  onSubmit,
}: {
  canEditDemo: boolean;
  pending: boolean;
  error: string | null;
  onSubmit: (values: CreateValues) => void;
}) {
  const [kind, setKind] = useState<'mahasiswa' | 'lembaga'>('mahasiswa');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [nim, setNim] = useState('');
  const [jurusan, setJurusan] = useState('');
  const [angkatan, setAngkatan] = useState('');
  const [lembagaName, setLembagaName] = useState('');
  const [lembagaType, setLembagaType] = useState<(typeof TYPES)[number]>('Himpunan');
  const [acronym, setAcronym] = useState('');
  const [hidden, setHidden] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  return (
    <AdminEditPanel
      title="Tambah akun"
      description="Akun lembaga baru otomatis memiliki profil lembaga."
      error={error}
      footer={
        <Button type="submit" form="create-akun" variant="dark_blue" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Buat akun'}
        </Button>
      }
    >
      <form
        id="create-akun"
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            kind,
            email,
            name,
            ...(kind === 'mahasiswa'
              ? { nim, jurusan, angkatan: Number(angkatan) }
              : { lembagaName, lembagaType, acronym: acronym.trim() || undefined }),
            hidden,
            isDemo: canEditDemo ? isDemo : false,
          });
        }}
      >
        <div className="flex flex-wrap gap-2">
          {(['mahasiswa', 'lembaga'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={
                kind === value
                  ? 'rounded-full bg-primary-200 px-3 py-1 text-sm font-semibold text-primary-400'
                  : 'rounded-full border border-neutral-400 px-3 py-1 text-sm text-neutral-700'
              }
            >
              {value === 'mahasiswa' ? 'Mahasiswa' : 'Himpunan/UKM/Panitia'}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Nama">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {kind === 'mahasiswa' ? (
            <>
              <Field label="NIM (8 digit)">
                <Input
                  required
                  inputMode="numeric"
                  pattern="\d{8}"
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                />
              </Field>
              <Field label="Program studi">
                <Input required value={jurusan} onChange={(e) => setJurusan(e.target.value)} />
              </Field>
              <Field label="Angkatan">
                <Input
                  required
                  inputMode="numeric"
                  value={angkatan}
                  onChange={(e) => setAngkatan(e.target.value)}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Nama lembaga">
                <Input required value={lembagaName} onChange={(e) => setLembagaName(e.target.value)} />
              </Field>
              <Field label="Jenis">
                <select
                  className="h-10 rounded-md border border-neutral-400 bg-neutral-50 px-3 text-sm"
                  value={lembagaType}
                  onChange={(e) => setLembagaType(e.target.value as (typeof TYPES)[number])}
                >
                  {TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </Field>
              <Field label="Singkatan">
                <Input value={acronym} onChange={(e) => setAcronym(e.target.value)} />
              </Field>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
            Sembunyikan dari publik
          </label>
          {canEditDemo ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isDemo}
                onChange={(e) => setIsDemo(e.target.checked)}
              />
              Akun demo
            </label>
          ) : null}
        </div>
      </form>
    </AdminEditPanel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-neutral-700">
      {label}
      {children}
    </label>
  );
}
