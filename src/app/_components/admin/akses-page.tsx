'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';

import { AdminEntitySearch } from './admin-entity-search';
import { AdminPageHeader } from './admin-page-header';

type Feature = 'admin' | 'oprec' | 'forms' | 'events' | 'organization';

const FEATURES = [
  ['admin', 'Semua kemampuan'],
  ['oprec', 'OPREC'],
  ['forms', 'Formulir'],
  ['events', 'Kegiatan/kepengurusan'],
  ['organization', 'Organogram'],
] as const;

type PermissionGroup = {
  label: string;
  permissions: readonly (readonly [string, string])[];
};

const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    label: 'Akun',
    permissions: [
      ['accounts.read', 'Lihat akun'],
      ['accounts.write', 'Ubah profil akun'],
      ['accounts.roles', 'Ubah email/role'],
    ],
  },
  {
    label: 'Lembaga',
    permissions: [
      ['lembaga.read', 'Lihat lembaga'],
      ['lembaga.write', 'Ubah profil lembaga'],
      ['lembaga.events', 'Kelola kegiatan/kepengurusan'],
      ['lembaga.organization', 'Kelola organogram'],
      ['lembaga.members', 'Kelola anggota'],
    ],
  },
  {
    label: 'Akses & audit',
    permissions: [
      ['access.read', 'Lihat akses'],
      ['access.write', 'Beri/cabut akses'],
      ['audit.read', 'Lihat audit'],
    ],
  },
  {
    label: 'Laporan',
    permissions: [
      ['reports.read', 'Lihat laporan'],
      ['reports.write', 'Ubah laporan'],
    ],
  },
] as const;

export function AksesPage() {
  const utils = api.useUtils();
  const permissions = api.adminConsole.myAdminPermissions.useQuery();
  const perms = permissions.data?.permissions ?? [];
  const canWrite = perms.includes('*') || perms.includes('access.write');
  const [tab, setTab] = useState<'operator' | 'scoped'>('operator');

  return (
    <div className="grid gap-4">
      <AdminPageHeader
        title="Akses"
        description="Atur operator admin console dan pengelola lembaga/kegiatan secara spesifik."
      />
      <div className="flex gap-2">
        {([
          ['operator', 'Operator admin'],
          ['scoped', 'Pengelola lembaga/kegiatan'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={
              tab === value
                ? 'rounded-full bg-primary-200 px-3 py-1 text-sm font-semibold text-primary-400'
                : 'rounded-full border border-neutral-400 px-3 py-1 text-sm text-neutral-700'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'operator' ? <OperatorPanel canWrite={canWrite} /> : <ScopedPanel canWrite={canWrite} />}
    </div>
  );

  function OperatorPanel({ canWrite }: { canWrite: boolean }) {
    const [userId, setUserId] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const [expiresAt, setExpiresAt] = useState('');
    const list = api.adminConsole.operatorPermissionsList.useQuery();
    const setPermissions = api.adminConsole.operatorPermissionSet.useMutation({
      onSuccess: () => {
        void utils.adminConsole.operatorPermissionsList.invalidate();
        void utils.adminConsole.myAdminPermissions.invalidate();
      },
    });
    const revoke = api.adminConsole.operatorPermissionRevoke.useMutation({
      onSuccess: () => {
        void utils.adminConsole.operatorPermissionsList.invalidate();
        void utils.adminConsole.myAdminPermissions.invalidate();
      },
    });

    return (
      <div className="grid gap-4">
        <form
          className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            setPermissions.mutate({
              identifier: userId,
              permissions: selected,
              expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`) : null,
            });
          }}
        >
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <div className="grid gap-1 text-sm font-semibold text-neutral-700">
              Penerima
              <AdminEntitySearch
                kind="user"
                value={userId}
                placeholder="Cari nama, email, atau NIM…"
                onSelect={(id) => setUserId(id)}
                disabled={!canWrite}
              />
            </div>
            <label className="grid gap-1 text-sm font-semibold text-neutral-700">
              Berlaku sampai (opsional)
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} disabled={!canWrite} />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {PERMISSION_GROUPS.map((group) => (
              <fieldset key={group.label} className="rounded-lg border border-neutral-300 bg-white p-3">
                <legend className="px-1 text-sm font-semibold text-neutral-1000">{group.label}</legend>
                <div className="mt-2 grid gap-1">
                  {group.permissions.map((entry) => {
                    const value = entry[0];
                    const label = entry[1];
                    return (
                    <label key={value} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected.includes(value)}
                        disabled={!canWrite}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...new Set([...current, value])]
                              : current.filter((item) => item !== value),
                          )
                        }
                      />
                      {label}
                    </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
          {setPermissions.isError ? <p role="alert" className="text-sm text-danger-dark">{setPermissions.error.message}</p> : null}
          <div>
            <Button type="submit" variant="dark_blue" disabled={!canWrite || !userId || setPermissions.isPending}>
              {setPermissions.isPending ? 'Menyimpan…' : 'Simpan izin operator'}
            </Button>
          </div>
        </form>

        <section>
          <h2 className="text-lg font-semibold text-neutral-1000">Operator terdaftar</h2>
          <div className="mt-2 overflow-x-auto rounded-[20px] border border-neutral-400 bg-neutral-50">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-neutral-400 text-xs uppercase tracking-wide text-neutral-700">
                <tr>
                  <th className="px-3 py-2">Penerima</th>
                  <th className="px-3 py-2">Izin</th>
                  <th className="px-3 py-2">Berlaku sampai</th>
                  <th className="px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(list.data ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-neutral-200 align-top">
                    <td className="px-3 py-2">
                      <span className="font-semibold">{row.userName ?? row.userEmail}</span>
                      <span className="block text-xs text-neutral-700">{row.userEmail}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">{row.permissions.join(', ') || '—'}</td>
                    <td className="px-3 py-2">{row.expiresAt ? row.expiresAt.toLocaleDateString('id-ID') : '—'}</td>
                    <td className="px-3 py-2">
                      {canWrite ? (
                        <Button size="sm" variant="ghost" disabled={revoke.isPending} onClick={() => revoke.mutate({ userId: row.userId })}>
                          Cabut
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {(list.data ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-neutral-700">Belum ada operator.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  function ScopedPanel({ canWrite }: { canWrite: boolean }) {
    const [kind, setKind] = useState<'lembaga' | 'event'>('lembaga');
    const [targetId, setTargetId] = useState('');
    const [userId, setUserId] = useState('');
    const [features, setFeatures] = useState<Feature[]>(['admin']);
    const [propagate, setPropagate] = useState(false);
    const [search, setSearch] = useState('');
    const grants = api.adminConsole.grantsList.useQuery({
      search: search.trim() || undefined,
      scope: 'all',
      page: 1,
      pageSize: 50,
      sort: 'created_at',
      dir: 'desc',
    });
    const grant = api.adminConsole.grantSet.useMutation({
      onSuccess: () => void utils.adminConsole.grantsList.invalidate(),
    });
    const revoke = api.adminConsole.grantRevokeById.useMutation({
      onSuccess: () => void utils.adminConsole.grantsList.invalidate(),
    });

    return (
      <div className="grid gap-4">
        <form
          className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            grant.mutate({ kind, targetId, identifier: userId, features, propagate, revoke: false });
          }}
        >
          <div className="flex flex-wrap gap-2">
            {(['lembaga', 'event'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={kind === value}
                onClick={() => { setKind(value); setTargetId(''); }}
                className={
                  kind === value
                    ? 'rounded-full bg-primary-200 px-3 py-1 text-sm font-semibold text-primary-400'
                    : 'rounded-full border border-neutral-400 px-3 py-1 text-sm text-neutral-700'
                }
              >
                {value === 'lembaga' ? 'Lembaga' : 'Periode/Kegiatan'}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1 text-sm font-semibold text-neutral-700">
              Penerima
              <AdminEntitySearch kind="user" value={userId} placeholder="Cari nama, email, atau NIM…" onSelect={(id) => setUserId(id)} disabled={!canWrite} />
            </div>
            <div className="grid gap-1 text-sm font-semibold text-neutral-700">
              {kind === 'lembaga' ? 'Lembaga' : 'Kegiatan'}
              {kind === 'lembaga' ? (
                <AdminEntitySearch kind="lembaga" value={targetId} placeholder="Cari lembaga…" onSelect={(id) => setTargetId(id)} disabled={!canWrite} />
              ) : (
                <AdminEntitySearch
                  kind="event"
                  value={targetId}
                  placeholder="Cari kegiatan/kepengurusan…"
                  onSelect={(id) => setTargetId(id)}
                  disabled={!canWrite}
                />
              )}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={features.includes(value)}
                  disabled={!canWrite}
                  onChange={(event) =>
                    setFeatures((current) =>
                      event.target.checked
                        ? [...new Set([...current, value])]
                        : current.filter((item) => item !== value),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
          {kind === 'lembaga' ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={propagate} disabled={!canWrite} onChange={(e) => setPropagate(e.target.checked)} />
              Berlaku juga untuk lembaga turunan
            </label>
          ) : null}
          {grant.isError ? <p role="alert" className="text-sm text-danger-dark">{grant.error.message}</p> : null}
          <div>
            <Button type="submit" variant="dark_blue" disabled={!canWrite || !userId || !targetId || features.length === 0 || grant.isPending}>
              {grant.isPending ? 'Menyimpan…' : 'Beri akses'}
            </Button>
          </div>
        </form>

        <section className="grid gap-2">
          <h2 className="text-lg font-semibold text-neutral-1000">Akses aktif</h2>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari penerima, lembaga, atau kegiatan" />
          <div className="overflow-x-auto rounded-[20px] border border-neutral-400 bg-neutral-50">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-neutral-400 text-xs uppercase tracking-wide text-neutral-700">
                <tr>
                  <th className="px-3 py-2">Penerima</th>
                  <th className="px-3 py-2">Lingkup</th>
                  <th className="px-3 py-2">Fitur</th>
                  <th className="px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(grants.data?.rows ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-neutral-200">
                    <td className="px-3 py-2">
                      <span className="font-semibold">{row.userName ?? row.userEmail}</span>
                      <span className="block text-xs text-neutral-700">{row.userEmail}</span>
                    </td>
                    <td className="px-3 py-2">
                      {row.lembagaName ? `Lembaga · ${row.lembagaName}` : `Kegiatan · ${row.periodName ?? ''}`}
                      {row.propagate ? ' · turunan' : ''}
                    </td>
                    <td className="px-3 py-2">{row.features.join(', ')}</td>
                    <td className="px-3 py-2">
                      {canWrite ? (
                        <Button size="sm" variant="ghost" disabled={revoke.isPending} onClick={() => revoke.mutate({ grantId: row.id })}>
                          Cabut
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {(grants.data?.rows ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-neutral-700">Belum ada akses aktif.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }
}
