'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';

const TYPES = [
  'Himpunan',
  'UKM',
  'Kepanitiaan',
  'BSO',
  'Badan',
  'Pusat',
  'Organisasi',
] as const;

type LembagaType = (typeof TYPES)[number];

export function LembagaPage() {
  const utils = api.useUtils();
  const options = api.adminConsole.accessOptions.useQuery();
  const update = api.adminConsole.lembagaUpdate.useMutation({
    onSuccess: () => {
      setEditing(null);
      void utils.adminConsole.accessOptions.invalidate();
    },
  });
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    acronym: string;
    type: LembagaType;
  } | null>(null);

  const rows = (options.data?.lembaga ?? []).filter((row) =>
    row.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-1000">Lembaga</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Ubah nama, singkatan, dan jenis lembaga. Akun lembaga baru dibuat dari
          menu Akun.
        </p>
      </div>

      <label className="grid max-w-md gap-1 text-sm font-semibold text-neutral-700">
        Cari lembaga
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nama lembaga"
        />
      </label>

      {options.isLoading ? (
        <p className="text-sm text-neutral-700">Memuat lembaga…</p>
      ) : options.isError ? (
        <p role="alert" className="text-sm text-danger-dark">
          {options.error.message}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[20px] border border-neutral-400 bg-neutral-50">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-neutral-400 text-xs uppercase tracking-wide text-neutral-700">
              <tr>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">Singkatan</th>
                <th className="px-3 py-2">Jenis</th>
                <th className="px-3 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-neutral-200 align-top">
                  <td className="px-3 py-2 font-semibold text-neutral-1000">
                    {row.name}
                  </td>
                  <td className="px-3 py-2">{row.acronym ?? '—'}</td>
                  <td className="px-3 py-2">{row.type ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditing({
                          id: row.id,
                          name: row.name,
                          acronym: row.acronym ?? '',
                          type: row.type ?? 'Organisasi',
                        })
                      }
                    >
                      Ubah
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-neutral-700">
                    Tidak ada lembaga yang cocok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            update.mutate({
              lembagaId: editing.id,
              name: editing.name,
              acronym: editing.acronym.trim() || null,
              type: editing.type,
            });
          }}
          className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
        >
          <h2 className="text-lg font-semibold text-neutral-1000">
            Ubah lembaga
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold text-neutral-700">
              Nama
              <Input
                value={editing.name}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-neutral-700">
              Singkatan
              <Input
                value={editing.acronym}
                onChange={(event) =>
                  setEditing({ ...editing, acronym: event.target.value })
                }
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-neutral-700">
              Jenis
              <select
                className="h-10 rounded-md border border-neutral-400 bg-neutral-50 px-3 text-sm"
                value={editing.type}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    type: event.target.value as LembagaType,
                  })
                }
              >
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {update.isError ? (
            <p role="alert" className="text-sm text-danger-dark">
              {update.error.message}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" variant="dark_blue" disabled={update.isPending}>
              {update.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Batal
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
