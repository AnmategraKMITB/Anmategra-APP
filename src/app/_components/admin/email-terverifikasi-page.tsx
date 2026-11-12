'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';

import { AdminPageHeader } from './admin-page-header';

export function EmailTerverifikasiPage() {
  const utils = api.useUtils();
  const list = api.adminOps.verifiedEmailList.useQuery();
  const [email, setEmail] = useState('');
  const refresh = () => void utils.adminOps.verifiedEmailList.invalidate();
  const add = api.adminOps.verifiedEmailAdd.useMutation({
    onSuccess: () => {
      setEmail('');
      refresh();
    },
  });
  const remove = api.adminOps.verifiedEmailRemove.useMutation({ onSuccess: refresh });

  return (
    <div className="grid gap-4">
      <AdminPageHeader
        title="Email terverifikasi"
        description="Email non-KM yang boleh masuk sebagai akun lembaga. Menghapus email dari daftar tidak menghapus akunnya."
      />
      <form
        className="flex flex-wrap items-end gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate({ email });
        }}
      >
        <label className="grid flex-1 gap-1 text-sm font-semibold text-neutral-700">
          Email
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <Button type="submit" disabled={add.isPending || !email}>
          Tambah
        </Button>
      </form>
      {add.error ? <p className="text-sm text-danger-dark">{add.error.message}</p> : null}
      {remove.error ? <p className="text-sm text-danger-dark">{remove.error.message}</p> : null}

      {list.isLoading ? <p className="text-sm text-neutral-700">Memuat…</p> : null}
      {list.isError ? <p className="text-sm text-danger-dark">{list.error.message}</p> : null}
      <ul className="grid gap-2 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
        {(list.data ?? []).map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
            <span>{item.email}</span>
            <Button
              type="button"
              variant="outline"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Hapus ${item.email} dari daftar terverifikasi?`)) {
                  remove.mutate({ email: item.email });
                }
              }}
            >
              Hapus
            </Button>
          </li>
        ))}
        {list.data?.length === 0 ? (
          <li className="text-sm text-neutral-700">Belum ada email terverifikasi.</li>
        ) : null}
      </ul>
    </div>
  );
}
