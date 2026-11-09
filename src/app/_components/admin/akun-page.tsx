'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';

const PAGE_SIZE = 25;

export function AkunPage() {
  const utils = api.useUtils();
  const stats = api.adminConsole.stats.useQuery();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const list = api.adminConsole.usersList.useQuery({
    search: search.trim() || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const create = api.adminConsole.userCreate.useMutation({
    onSuccess: () => {
      setOpen(false);
      void utils.adminConsole.usersList.invalidate();
      void utils.adminConsole.stats.invalidate();
    },
  });
  const update = api.adminConsole.userUpdate.useMutation({
    onSuccess: () => {
      void utils.adminConsole.usersList.invalidate();
      void utils.adminConsole.stats.invalidate();
    },
  });

  const [kind, setKind] = useState<'mahasiswa' | 'lembaga'>('mahasiswa');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [nim, setNim] = useState('');
  const [jurusan, setJurusan] = useState('');
  const [angkatan, setAngkatan] = useState('');
  const [lembagaName, setLembagaName] = useState('');
  const [lembagaType, setLembagaType] = useState<
    'Himpunan' | 'UKM' | 'Kepanitiaan' | 'BSO' | 'Badan' | 'Pusat' | 'Organisasi'
  >('Himpunan');
  const [acronym, setAcronym] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [hidden, setHidden] = useState(false);

  const isDemoDeployment = stats.data?.appEnv === 'demo';
  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate({
      kind,
      email,
      name,
      ...(kind === 'mahasiswa'
        ? {
            nim,
            jurusan,
            angkatan: Number(angkatan),
          }
        : {
            lembagaName,
            lembagaType,
            acronym: acronym.trim() || undefined,
          }),
      isDemo,
      hidden,
    });
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-1000">Akun</h1>
          <p className="mt-1 text-sm text-neutral-700">
            Buat akun mahasiswa/lembaga, tandai akun demo, dan sembunyikan dari
            daftar publik.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen((value) => !value)}>
          {open ? 'Tutup form' : 'Tambah akun'}
        </Button>
      </div>

      {stats.data ? (
        <p className="text-sm text-neutral-700">
          {stats.data.users} akun · {stats.data.lembaga} lembaga ·{' '}
          {stats.data.demoUsers} demo · {stats.data.hiddenUsers} disembunyikan
          {stats.data.appEnv !== 'demo'
            ? ' · mode produksi: login demo nonaktif'
            : ''}
        </p>
      ) : null}

      {open ? (
        <form
          onSubmit={submit}
          className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
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
            <label className="grid gap-1 text-sm font-semibold text-neutral-700">
              Email
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-neutral-700">
              Nama
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            {kind === 'mahasiswa' ? (
              <>
                <label className="grid gap-1 text-sm font-semibold text-neutral-700">
                  NIM (8 digit)
                  <Input
                    value={nim}
                    onChange={(event) => setNim(event.target.value)}
                    inputMode="numeric"
                    pattern="\d{8}"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-neutral-700">
                  Program studi
                  <Input
                    value={jurusan}
                    onChange={(event) => setJurusan(event.target.value)}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-neutral-700">
                  Angkatan
                  <Input
                    value={angkatan}
                    onChange={(event) => setAngkatan(event.target.value)}
                    inputMode="numeric"
                    required
                  />
                </label>
              </>
            ) : (
              <>
                <label className="grid gap-1 text-sm font-semibold text-neutral-700">
                  Nama lembaga
                  <Input
                    value={lembagaName}
                    onChange={(event) => setLembagaName(event.target.value)}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-neutral-700">
                  Jenis
                  <select
                    className="h-10 rounded-md border border-neutral-400 bg-neutral-50 px-3 text-sm"
                    value={lembagaType}
                    onChange={(event) =>
                      setLembagaType(
                        event.target.value as typeof lembagaType,
                      )
                    }
                  >
                    {[
                      'Himpunan',
                      'UKM',
                      'Kepanitiaan',
                      'BSO',
                      'Badan',
                      'Pusat',
                      'Organisasi',
                    ].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-neutral-700">
                  Singkatan
                  <Input
                    value={acronym}
                    onChange={(event) => setAcronym(event.target.value)}
                  />
                </label>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-neutral-1000">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hidden}
                onChange={(event) => setHidden(event.target.checked)}
              />
              Sembunyikan dari daftar publik
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isDemo}
                disabled={!isDemoDeployment}
                onChange={(event) => setIsDemo(event.target.checked)}
              />
              Akun demo
            </label>
          </div>
          {create.isError ? (
            <p role="alert" className="text-sm text-danger-dark">
              {create.error.message}
            </p>
          ) : null}
          <div>
            <Button type="submit" variant="dark_blue" disabled={create.isPending}>
              {create.isPending ? 'Menyimpan…' : 'Buat akun'}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="grid flex-1 gap-1 text-sm font-semibold text-neutral-700">
          Cari nama, email, atau NIM
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Cari akun"
          />
        </label>
      </div>

      {list.isLoading ? (
        <p className="text-sm text-neutral-700">Memuat akun…</p>
      ) : list.isError ? (
        <p role="alert" className="text-sm text-danger-dark">
          {list.error.message}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[20px] border border-neutral-400 bg-neutral-50">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-neutral-400 text-xs uppercase tracking-wide text-neutral-700">
              <tr>
                <th className="px-3 py-2">Akun</th>
                <th className="px-3 py-2">Tipe</th>
                <th className="px-3 py-2">Profil</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-neutral-200 align-top">
                  <td className="px-3 py-2">
                    <span className="font-semibold text-neutral-1000">
                      {row.name ?? 'Tanpa nama'}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-700">
                      {row.email}
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.role}</td>
                  <td className="px-3 py-2">
                    {row.nim
                      ? `${row.nim} · ${row.jurusan ?? ''} · ${row.angkatan ?? ''}`
                      : row.lembagaName
                        ? `${row.lembagaName}${row.lembagaType ? ` · ${row.lembagaType}` : ''}`
                        : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {row.isDemo ? <Badge>demo</Badge> : null}
                      {row.hiddenAt ? <Badge>hidden</Badge> : null}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const next = window.prompt(
                            'Nama baru',
                            row.name ?? '',
                          );
                          if (next?.trim()) {
                            update.mutate({
                              userId: row.id,
                              name: next.trim(),
                            });
                          }
                        }}
                      >
                        Ubah nama
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          update.mutate({
                            userId: row.id,
                            hidden: !row.hiddenAt,
                          })
                        }
                      >
                        {row.hiddenAt ? 'Tampilkan' : 'Sembunyikan'}
                      </Button>
                      {isDemoDeployment ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            update.mutate({
                              userId: row.id,
                              isDemo: !row.isDemo,
                            })
                          }
                        >
                          {row.isDemo ? 'Jadikan real' : 'Jadikan demo'}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-neutral-700">
                    Tidak ada akun yang cocok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
        <Button
          size="sm"
          variant="dark_blue_outline"
          disabled={page <= 1}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
        >
          Sebelumnya
        </Button>
        <Button
          size="sm"
          variant="dark_blue_outline"
          disabled={page >= pages}
          onClick={() => setPage((value) => value + 1)}
        >
          Berikutnya
        </Button>
        <span>
          {total} akun · halaman {page} dari {pages}
        </span>
      </div>
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
