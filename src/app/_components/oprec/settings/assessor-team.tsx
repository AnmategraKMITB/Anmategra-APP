'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

import { Labeled, fieldClass } from '../wizard/ui';
import { type OprecDetail } from './model';

/**
 * Daftar penilai oprec: ketua tujuan (dari organogram, baca saja) dan penilai
 * tambahan per lingkup (umum atau satu tujuan). Perubahan langsung tersimpan.
 */
export function AssessorTeam({
  recruitmentId,
  divisions,
  headsAssess,
}: {
  recruitmentId: string;
  divisions: OprecDetail['divisions'];
  /** false bila "Siapa yang menilai" = penilai umum saja (ketua tidak menilai). */
  headsAssess: boolean;
}) {
  const utils = api.useUtils();
  const list = api.oprec.assessorList.useQuery({ recruitmentId });
  const derived = api.oprec.assessorDerived.useQuery({ recruitmentId });
  const refresh = () => utils.oprec.assessorList.invalidate({ recruitmentId });
  const add = api.oprec.assessorAdd.useMutation({
    onSuccess: async () => {
      setIdentifier('');
      await refresh();
    },
  });
  const remove = api.oprec.assessorRemove.useMutation({ onSuccess: refresh });
  const [identifier, setIdentifier] = useState('');
  const [scope, setScope] = useState('');

  const heads = derived.data ?? [];
  const extras = list.data ?? [];

  return (
    <div className="grid gap-6">
      <div>
        <h3 className="text-lg font-semibold text-neutral-1000">
          Ketua dari organogram
        </h3>
        {!headsAssess ? (
          <p className="mt-1 text-sm text-neutral-700">
            Tidak ikut menilai karena oprec ini hanya memakai penilai umum.
          </p>
        ) : heads.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-700">
            {derived.isLoading
              ? 'Memuat…'
              : 'Belum ada ketua yang terisi di organogram.'}
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {heads.map((h) => (
              <li
                key={`${h.divisionId}-${h.userId}`}
                className="rounded-xl border border-neutral-400 px-4 py-3 text-sm"
              >
                <span className="block font-semibold text-neutral-1000">
                  {h.name ?? 'Tanpa nama'}
                </span>
                <span className="text-neutral-700">{h.divisionLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-neutral-1000">
          Penilai tambahan
        </h3>
        {extras.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-700">
            {list.isLoading ? 'Memuat…' : 'Belum ada penilai tambahan.'}
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {extras.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-400 px-4 py-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-neutral-1000">
                    {a.name ?? a.email}
                  </span>
                  <span className="text-neutral-700">
                    {a.nim ?? a.email} · {a.divisionLabel}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Hapus ${a.name ?? a.email} dari penilai`}
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate({ recruitmentId, assessorId: a.id })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!identifier.trim()) return;
            add.mutate({
              recruitmentId,
              identifier: identifier.trim(),
              divisionId: scope || null,
            });
          }}
        >
          <Labeled label="Email atau NIM">
            {(id) => (
              <input
                id={id}
                className={fieldClass}
                value={identifier}
                placeholder="mis. 13523001"
                onChange={(e) => setIdentifier(e.target.value)}
              />
            )}
          </Labeled>
          <Labeled label="Menilai">
            {(id) => (
              <select
                id={id}
                className={fieldClass}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="">Penilaian umum</option>
                {divisions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.unitName}
                  </option>
                ))}
              </select>
            )}
          </Labeled>
          <Button
            type="submit"
            variant="dark_blue_outline"
            disabled={add.isPending || !identifier.trim()}
          >
            <Plus /> {add.isPending ? 'Menambah…' : 'Tambah penilai'}
          </Button>
        </form>
        {(add.error ?? remove.error) ? (
          <p role="alert" className="mt-2 text-sm text-danger-dark">
            {(add.error ?? remove.error)?.message}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-neutral-700">
          Nilai yang sudah diisi penilai tetap tersimpan meski ia dihapus.
        </p>
      </div>
    </div>
  );
}
