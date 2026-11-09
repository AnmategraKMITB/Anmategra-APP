'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';

export function AksesPage() {
  const utils = api.useUtils();
  const options = api.adminConsole.accessOptions.useQuery();
  const grants = api.adminConsole.grantsList.useQuery();
  const grant = api.adminConsole.grantSet.useMutation({
    onSuccess: () => {
      void utils.adminConsole.grantsList.invalidate();
    },
  });

  const [kind, setKind] = useState<'lembaga' | 'event'>('lembaga');
  const [targetId, setTargetId] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [revoke, setRevoke] = useState(false);

  const targets: { id: string; label: string }[] =
    kind === 'lembaga'
      ? (options.data?.lembaga ?? []).map((row) => ({
          id: row.id,
          label: row.name,
        }))
      : (options.data?.events ?? []).map((row) => ({
          id: row.id,
          label: `${row.orgName ?? ''} · ${row.name}`,
        }));

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-1000">Akses</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Beri atau cabut akses admin lembaga/periode. Penerima harus sudah punya
          akun; buat akunnya di menu Akun terlebih dahulu.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          grant.mutate({ kind, targetId, identifier, revoke });
        }}
        className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
      >
        <div className="flex flex-wrap gap-2">
          {(['lembaga', 'event'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => {
                setKind(value);
                setTargetId('');
              }}
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
          <label className="grid gap-1 text-sm font-semibold text-neutral-700">
            Email atau NIM penerima
            <Input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="nama@km.itb.ac.id atau 13523094"
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-neutral-700">
            {kind === 'lembaga' ? 'Lembaga' : 'Kegiatan'}
            <select
              className="h-10 rounded-md border border-neutral-400 bg-neutral-50 px-3 text-sm"
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              required
            >
              <option value="">Pilih…</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-1000">
          <input
            type="checkbox"
            checked={revoke}
            onChange={(event) => setRevoke(event.target.checked)}
          />
          Cabut akses (bukan memberi)
        </label>
        {grant.isError ? (
          <p role="alert" className="text-sm text-danger-dark">
            {grant.error.message}
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="dark_blue" disabled={grant.isPending}>
            {grant.isPending ? 'Menyimpan…' : revoke ? 'Cabut akses' : 'Beri akses'}
          </Button>
        </div>
      </form>

      <section>
        <h2 className="text-lg font-semibold text-neutral-1000">
          Akses aktif ({grants.data?.length ?? 0})
        </h2>
        {grants.isLoading ? (
          <p className="mt-2 text-sm text-neutral-700">Memuat akses…</p>
        ) : grants.isError ? (
          <p role="alert" className="mt-2 text-sm text-danger-dark">
            {grants.error.message}
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-[20px] border border-neutral-400 bg-neutral-50">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-neutral-400 text-xs uppercase tracking-wide text-neutral-700">
                <tr>
                  <th className="px-3 py-2">Penerima</th>
                  <th className="px-3 py-2">Lingkup</th>
                  <th className="px-3 py-2">Fitur</th>
                  <th className="px-3 py-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(grants.data ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-neutral-200">
                    <td className="px-3 py-2">
                      <span className="font-semibold text-neutral-1000">
                        {row.userName ?? row.userEmail}
                      </span>
                      <span className="block text-xs text-neutral-700">
                        {row.userEmail}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {row.lembagaName
                        ? `Lembaga · ${row.lembagaName}`
                        : `Kegiatan · ${row.periodName ?? ''}`}
                    </td>
                    <td className="px-3 py-2">{row.features.join(', ')}</td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          grant.mutate({
                            kind: row.lembagaId ? 'lembaga' : 'event',
                            targetId: (row.lembagaId ?? row.periodId)!,
                            identifier: row.userEmail,
                            revoke: true,
                          })
                        }
                      >
                        Cabut
                      </Button>
                    </td>
                  </tr>
                ))}
                {(grants.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-neutral-700">
                      Belum ada akses aktif.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
