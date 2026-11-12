'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';

import { AdminEntitySearch } from './admin-entity-search';

const TYPES = ['Himpunan', 'UKM', 'Kepanitiaan', 'BSO', 'Badan', 'Pusat', 'Organisasi'] as const;

/** Membuat lembaga baru beserta akun Owner-nya (email Google resmi). */
export function LembagaCreateForm() {
  const router = useRouter();
  const utils = api.useUtils();
  const [name, setName] = useState('');
  const [acronym, setAcronym] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]>('Himpunan');
  const [parentId, setParentId] = useState('');
  const [email, setEmail] = useState('');
  const create = api.adminOps.lembagaCreate.useMutation({
    onSuccess: (created) => {
      void utils.adminConsole.lembagaList.invalidate();
      router.push(`/admin/lembaga/${created.id}`);
    },
  });

  return (
    <form
      className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate({
          name,
          type,
          acronym: acronym || undefined,
          parentId: parentId || null,
          email,
        });
      }}
    >
      <h2 className="text-lg font-semibold text-neutral-1000">Tambah lembaga</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          Nama lembaga
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          Singkatan
          <Input value={acronym} onChange={(event) => setAcronym(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          Jenis
          <select
            className="h-10 rounded-md border border-neutral-400 bg-neutral-50 px-3 text-sm"
            value={type}
            onChange={(event) => setType(event.target.value as (typeof TYPES)[number])}
          >
            {TYPES.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-1 text-sm font-semibold text-neutral-700">
          Lembaga induk (opsional)
          <AdminEntitySearch
            kind="lembaga"
            value={parentId}
            placeholder="Cari lembaga induk…"
            onSelect={(id) => setParentId(id)}
          />
        </div>
        <label className="grid gap-1 text-sm font-semibold text-neutral-700 sm:col-span-2">
          Email Google resmi Owner
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <span className="text-xs font-normal">
            Owner masuk dengan email ini. Email otomatis didaftarkan sebagai terverifikasi.
          </span>
        </label>
      </div>
      {create.error ? <p className="text-sm text-danger-dark">{create.error.message}</p> : null}
      <div>
        <Button type="submit" disabled={create.isPending || !name || !email}>
          Buat lembaga
        </Button>
      </div>
    </form>
  );
}
