'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';

import { AdminPageHeader } from './admin-page-header';

/** Mengambil NIM 8 digit unik dari teks CSV mana pun (kolom apa pun, dengan atau tanpa header). */
export function parseNims(text: string): number[] {
  const found = text.match(/(?<!\d)\d{8}(?!\d)/g) ?? [];
  return Array.from(new Set(found.map(Number)));
}

export function AlumniPage() {
  const [nims, setNims] = useState<number[]>([]);
  const [fileName, setFileName] = useState('');
  const [batch, setBatch] = useState('');
  const upload = api.admin.uploadAlumniCsv.useMutation();

  return (
    <div className="grid gap-4">
      <AdminPageHeader
        title="Impor alumni"
        description="Unggah CSV daftar wisuda. NIM yang sudah punya akun langsung menjadi alumni; sisanya menunggu dan diterapkan saat pemilik NIM pertama kali masuk."
      />
      <form
        className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          upload.mutate({ nims, wisudaBatch: batch || undefined });
        }}
      >
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          Berkas CSV
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              upload.reset();
              if (!file) return setNims([]);
              setFileName(file.name);
              setNims(parseNims(await file.text()));
            }}
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-neutral-700">
          Angkatan wisuda (opsional)
          <Input value={batch} placeholder="mis. Wisuda Oktober 2026" onChange={(event) => setBatch(event.target.value)} />
        </label>
        {fileName ? (
          <p className="text-sm text-neutral-700">
            {fileName}: {nims.length} NIM 8 digit terdeteksi.
          </p>
        ) : null}
        {upload.error ? <p className="text-sm text-danger-dark">{upload.error.message}</p> : null}
        {upload.data ? (
          <p className="text-sm text-neutral-1000">
            Selesai: {upload.data.updatedCount} akun diperbarui menjadi alumni,{' '}
            {upload.data.pendingCount} NIM menunggu sampai pemiliknya masuk.
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={upload.isPending || nims.length === 0}>
            Impor
          </Button>
        </div>
      </form>
    </div>
  );
}
