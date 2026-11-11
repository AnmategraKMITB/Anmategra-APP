'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

import {
  Chip,
  ErrorNote,
  Field,
  inputClass,
  Loading,
  Modal,
  Notice,
  selectClass,
  textareaClass,
  when,
} from './shared';

type DivisionOption = { id: string; label: string; groupLabel: string | null };

/** Closerec: menambah orang langsung ke divisi tanpa mendaftar. */
export function CloserecPanel({
  recruitmentId,
  divisions,
  lock,
  announce,
  onError,
  onChanged,
}: {
  recruitmentId: string;
  divisions: DivisionOption[];
  lock: boolean;
  announce: (message: string) => void;
  onError: (message: string) => void;
  onChanged: () => void;
}) {
  const list = api.oprec.closerecList.useQuery({ recruitmentId });
  const [open, setOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [note, setNote] = useState('');
  const [revoke, setRevoke] = useState<{ choiceId: string; name: string } | null>(
    null,
  );

  const add = api.oprec.closerecAdd.useMutation({
    onSuccess: () => {
      announce('Closerec ditambahkan.');
      setOpen(false);
      setIdentifier('');
      setDivisionId('');
      setNote('');
      onChanged();
    },
    onError: (error) => onError(error.message),
  });
  const remove = api.oprec.closerecRemove.useMutation({
    onSuccess: () => {
      announce('Closerec dicabut.');
      setRevoke(null);
      onChanged();
    },
    onError: (error) => onError(error.message),
  });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-neutral-700">
          Penempatan closerec tidak dihitung ke kuota.
        </p>
        <Button
          size="sm"
          disabled={lock}
          onClick={() => setOpen(true)}
        >
          Tambah closerec
        </Button>
      </div>

      {list.isError ? (
        <ErrorNote message={list.error.message} />
      ) : list.isLoading ? (
        <Loading label="Memuat closerec…" />
      ) : (list.data?.length ?? 0) === 0 ? (
        <Notice>Belum ada penempatan closerec.</Notice>
      ) : (
        <div className="overflow-x-auto rounded-[20px] border border-neutral-400">
          <table className="w-full text-sm">
            <thead className="bg-neutral-200 text-left text-xs font-semibold text-neutral-700">
              <tr>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">NIM</th>
                <th className="px-3 py-2">Divisi</th>
                <th className="px-3 py-2">Catatan</th>
                <th className="px-3 py-2">Ditambah</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((row) => (
                <tr key={row.choiceId} className="border-t border-neutral-400">
                  <td className="px-3 py-2 font-semibold text-neutral-1000">
                    {row.name ?? 'Tanpa nama'}
                  </td>
                  <td className="px-3 py-2">{row.nim ?? '—'}</td>
                  <td className="px-3 py-2">{row.divisionLabel}</td>
                  <td className="max-w-56 px-3 py-2">{row.note ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {when(row.decidedAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={lock}
                      onClick={() =>
                        setRevoke({
                          choiceId: row.choiceId,
                          name: row.name ?? 'pendaftar ini',
                        })
                      }
                    >
                      Cabut
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Tambah closerec"
        description="Tambahkan orang langsung ke divisi tanpa lewat pendaftaran."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={
                add.isPending || identifier.trim() === '' || divisionId === ''
              }
              onClick={() =>
                add.mutate({
                  recruitmentId,
                  identifier: identifier.trim(),
                  divisionId,
                  note: note.trim() || undefined,
                })
              }
            >
              {add.isPending ? 'Menambah…' : 'Tambah'}
            </Button>
          </>
        }
      >
        <Field label="Email atau NIM">
          <input
            className={inputClass}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="nama@example.test atau 12345678"
          />
        </Field>
        <Field label="Divisi">
          <select
            className={selectClass}
            value={divisionId}
            onChange={(event) => setDivisionId(event.target.value)}
          >
            <option value="">Pilih divisi</option>
            {divisions.map((division) => (
              <option key={division.id} value={division.id}>
                {division.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Catatan (opsional)">
          <textarea
            className={textareaClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
          />
        </Field>
      </Modal>

      <Modal
        open={revoke !== null}
        onOpenChange={(value) => {
          if (!value) setRevoke(null);
        }}
        title="Cabut closerec?"
        description={
          revoke
            ? `${revoke.name} akan dilepas dari divisinya.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevoke(null)}>
              Batal
            </Button>
            <Button
              variant="warning"
              disabled={remove.isPending}
              onClick={() => {
                if (revoke) {
                  remove.mutate({ recruitmentId, choiceId: revoke.choiceId });
                }
              }}
            >
              Cabut
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Tindakan ini menghapus pilihan closerec dan penempatannya.
        </p>
        <Chip tone="warning">tidak dihitung kuota</Chip>
      </Modal>
    </div>
  );
}
