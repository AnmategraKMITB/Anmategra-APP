'use client';

import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

import { type OprecBase, pendaftarHref } from '../status';

/** Hasil pemberian akses pengelola yang dikembalikan server (semua berhasil atau oprec tidak dibuat). */
export type GrantResult = { identifier: string; ok: boolean; message?: string };

/** Layar sukses: langkah berikutnya sampai pendaftaran dibuka. */
export function Done({
  created,
  grants,
  eventId,
  basePath,
}: {
  created: { recruitmentId: string; formId: string };
  grants: GrantResult[];
  eventId: string;
  basePath: OprecBase;
}) {
  const [opened, setOpened] = useState(false);
  const setFormStatus = api.form.setStatus.useMutation();
  const setStatus = api.oprec.setStatus.useMutation();
  const busy = setFormStatus.isPending || setStatus.isPending;
  const error =
    setFormStatus.error?.message ?? setStatus.error?.message ?? null;

  const open = async () => {
    try {
      await setFormStatus.mutateAsync({
        formId: created.formId,
        status: 'Published',
      });
      await setStatus.mutateAsync({
        recruitmentId: created.recruitmentId,
        status: 'open',
      });
      setOpened(true);
    } catch {
      // pesan galat ditampilkan dari state mutasi
    }
  };

  return (
    <div className="max-w-2xl">
      <CheckCircle2 aria-hidden className="size-10 text-success-dark" />
      <h2 className="mt-3 text-2xl font-semibold text-neutral-1000 sm:text-[28px] sm:leading-9">
        Oprec sudah dibuat
      </h2>
      <p className="mt-2 text-neutral-700">
        {opened
          ? 'Formulir terbit dan pendaftaran dibuka.'
          : 'Statusnya draf. Lengkapi formulir bila perlu, lalu buka pendaftaran.'}
      </p>

      {grants.length > 0 ? (
        <ul className="mt-5 grid gap-1 text-sm">
          {grants.map((g) => (
            <li
              key={g.identifier}
              className={g.ok ? 'text-neutral-700' : 'text-danger-dark'}
            >
              {g.ok
                ? 'Akses oprec diberikan ke'
                : 'Akses belum bisa diberikan ke'}{' '}
              {g.identifier}
              {g.ok ? '' : `: ${g.message ?? 'gagal'}`}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
        >
          Pendaftaran belum bisa dibuka: {error}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="dark_blue_outline">
          <Link href={`${basePath}/forms/${created.formId}`}>
            Buka pembuat formulir
          </Link>
        </Button>
        {opened ? (
          <Button asChild variant="dark_blue">
            <Link
              href={pendaftarHref(basePath, eventId, created.recruitmentId)}
            >
              Lihat pendaftar
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="light_blue"
            disabled={busy}
            onClick={open}
          >
            {busy ? 'Membuka…' : 'Terbitkan formulir dan buka pendaftaran'}
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link href={`${basePath}/kegiatan/${eventId}/oprec`}>
            Ke daftar oprec
          </Link>
        </Button>
      </div>
    </div>
  );
}
