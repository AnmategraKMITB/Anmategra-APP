'use client';

import { ListFilter } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { api } from '~/trpc/react';

import { useBuilder } from './builder-context';

/**
 * Ikatan satu bagian ke tujuan oprec: bagian hanya tampil bagi pendaftar yang
 * memilih salah satu tujuan terikat (di pilihan mana pun). Menggantikan editor
 * kondisi umum di form oprec, supaya ikatan dan kondisi tetap sejalan.
 */
export function SectionBindingEditor({
  sectionId,
  recruitmentId,
}: {
  sectionId: string;
  recruitmentId: string;
}) {
  const builder = useBuilder();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[] | null>(null);
  const oprec = api.oprec.get.useQuery({ recruitmentId });
  const save = api.oprec.setSectionBindings.useMutation();
  const utils = api.useUtils();

  const choice = builder.detail?.fields.find((f) => f.type === 'unit_choice');
  const options = choice?.options ?? [];
  const saved = (oprec.data?.sectionBindings ?? [])
    .filter((b) => b.formSectionId === sectionId)
    .map((b) => b.divisionId);
  const selected = draft ?? saved;
  const labels = options
    .filter((o) => saved.includes(o.id))
    .map((o) => o.label);
  const groups = [...new Set(options.map((o) => o.group ?? ''))];

  const apply = async () => {
    try {
      await save.mutateAsync({
        recruitmentId,
        formSectionId: sectionId,
        divisionIds: selected,
      });
      await Promise.all([
        utils.oprec.get.invalidate({ recruitmentId }),
        builder.refetch(),
      ]);
      setDraft(null);
      setOpen(false);
    } catch {
      // pesan galat ditampilkan di bawah dari state mutasi
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setDraft(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="dark_blue_outline" size="sm" disabled={!choice}>
          <ListFilter />
          {!choice
            ? 'Tambahkan pertanyaan Pilihan tujuan dulu'
            : labels.length === 0
              ? 'Tampil bagi semua pendaftar'
              : `Tampil bagi pemilih: ${labels.slice(0, 2).join(', ')}${labels.length > 2 ? ` +${labels.length - 2}` : ''}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[min(26rem,var(--radix-popover-content-available-height))] w-[min(22rem,90vw)] overflow-y-auto rounded-[20px] p-4"
      >
        <p className="text-sm font-semibold text-neutral-1000">
          Bagian ini tampil bagi pendaftar yang memilih…
        </p>
        <p className="mt-1 text-sm text-neutral-700">
          Pilih salah satu atau lebih tujuan. Kosongkan agar tampil bagi semua.
        </p>
        <div className="mt-3 grid gap-3">
          {groups.map((group) => (
            <fieldset key={group || 'tanpa-kelompok'} className="grid gap-1">
              {group ? (
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-700">
                  {group}
                </legend>
              ) : null}
              {options
                .filter((o) => (o.group ?? '') === group)
                .map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-neutral-200"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary-400"
                      checked={selected.includes(o.id)}
                      onChange={(e) =>
                        setDraft(
                          e.target.checked
                            ? [...selected, o.id]
                            : selected.filter((id) => id !== o.id),
                        )
                      }
                    />
                    {o.label}
                  </label>
                ))}
            </fieldset>
          ))}
        </div>
        {save.isError ? (
          <p role="alert" className="mt-3 text-sm text-danger-dark">
            {save.error.message}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(null);
              setOpen(false);
            }}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="dark_blue"
            size="sm"
            disabled={save.isPending}
            onClick={() => void apply()}
          >
            {save.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
