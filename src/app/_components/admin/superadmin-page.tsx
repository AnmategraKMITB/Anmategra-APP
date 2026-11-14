'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';

import { AdminPageHeader } from './admin-page-header';

export function SuperadminPage() {
  const utils = api.useUtils();
  const list = api.adminOps.superadminList.useQuery();
  const [identifier, setIdentifier] = useState('');
  const [confirmAdd, setConfirmAdd] = useState('');
  const [removing, setRemoving] = useState<{ id: string; email: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState('');

  const refresh = () => void utils.adminOps.superadminList.invalidate();
  const add = api.adminOps.superadminAdd.useMutation({
    onSuccess: () => {
      setIdentifier('');
      setConfirmAdd('');
      refresh();
    },
  });
  const remove = api.adminOps.superadminRemove.useMutation({
    onSuccess: () => {
      setRemoving(null);
      setConfirmRemove('');
      refresh();
    },
  });

  if (list.isLoading) return <p className="text-sm text-neutral-700">Memuat…</p>;
  if (list.isError) return <p className="text-sm text-danger-dark">{list.error.message}</p>;

  return (
    <div className="grid gap-4">
      <AdminPageHeader
        title="Superadmin"
        description="Kelola Superadmin. Akun darurat dari variabel lingkungan tidak dapat diubah dari sini. Perubahan berlaku bagi pengguna setelah login ulang."
      />

      <section className="grid gap-2 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
        <h2 className="text-lg font-semibold text-neutral-1000">Akun darurat</h2>
        <ul className="grid gap-1 text-sm text-neutral-700">
          {(list.data?.emergency ?? []).map((item) => (
            <li key={item.email}>
              {item.email} <span className="text-xs">(tidak dapat diubah)</span>
            </li>
          ))}
          {list.data?.emergency.length === 0 ? <li>Tidak ada akun darurat.</li> : null}
        </ul>
      </section>

      <section className="grid gap-2 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
        <h2 className="text-lg font-semibold text-neutral-1000">Superadmin terkelola</h2>
        <ul className="grid gap-2">
          {(list.data?.managed ?? []).map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {item.name ?? 'Tanpa nama'} · {item.email}
                {item.self ? ' (Anda)' : ''}
              </span>
              {item.self ? null : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRemoving({ id: item.id, email: item.email });
                    setConfirmRemove('');
                    remove.reset();
                  }}
                >
                  Turunkan
                </Button>
              )}
            </li>
          ))}
          {list.data?.managed.length === 0 ? (
            <li className="text-sm text-neutral-700">Belum ada Superadmin terkelola.</li>
          ) : null}
        </ul>

        {removing ? (
          <form
            className="grid gap-2 rounded-md border border-danger-dark p-3"
            onSubmit={(event) => {
              event.preventDefault();
              remove.mutate({ userId: removing.id, confirmEmail: confirmRemove });
            }}
          >
            <p className="text-sm">
              Menurunkan <strong>{removing.email}</strong> dari Superadmin. Ketik ulang email
              akun untuk mengonfirmasi.
            </p>
            <Input
              value={confirmRemove}
              placeholder={removing.email}
              onChange={(event) => setConfirmRemove(event.target.value)}
            />
            {remove.error ? (
              <p className="text-sm text-danger-dark">{remove.error.message}</p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={remove.isPending}>
                Turunkan
              </Button>
              <Button type="button" variant="outline" onClick={() => setRemoving(null)}>
                Batal
              </Button>
            </div>
          </form>
        ) : null}
      </section>

      <form
        className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate({ identifier, confirmEmail: confirmAdd });
        }}
      >
        <h2 className="text-lg font-semibold text-neutral-1000">Tambah Superadmin</h2>
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          Email, NIM, atau id akun
          <Input value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          Konfirmasi: ketik ulang email akun tersebut
          <Input value={confirmAdd} onChange={(event) => setConfirmAdd(event.target.value)} />
        </label>
        {add.error ? <p className="text-sm text-danger-dark">{add.error.message}</p> : null}
        <div>
          <Button type="submit" disabled={add.isPending || !identifier || !confirmAdd}>
            Jadikan Superadmin
          </Button>
        </div>
      </form>
    </div>
  );
}
