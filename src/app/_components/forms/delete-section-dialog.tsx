'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

import { useBuilder } from './builder-context';
import type { SectionOut } from './model';

const NO_SECTION = '__none__';

/** Hapus bagian yang masih berisi pertanyaan: dipindahkan atau dihapus bersama. */
export function DeleteSectionDialog({
  section,
  onClose,
}: {
  section: SectionOut | null;
  onClose: () => void;
}) {
  const builder = useBuilder();
  const [mode, setMode] = useState<'move' | 'delete'>('move');
  const [target, setTarget] = useState(NO_SECTION);
  const [busy, setBusy] = useState(false);

  const count =
    builder.groups.find((g) => g.section?.id === section?.id)?.fields.length ??
    0;
  const others = (builder.detail?.sections ?? []).filter(
    (s) => s.id !== section?.id,
  );

  const confirm = async () => {
    if (!section) return;
    setBusy(true);
    await builder.removeSection(
      section,
      mode === 'move'
        ? { type: 'move', toSectionId: target === NO_SECTION ? null : target }
        : { type: 'delete' },
    );
    setBusy(false);
    onClose();
  };

  return (
    <Dialog open={section !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-[20px]">
        <DialogHeader>
          <DialogTitle>Hapus bagian “{section?.title}”?</DialogTitle>
          <DialogDescription>
            Bagian ini masih berisi {count} pertanyaan. Pilih apa yang dilakukan
            pada pertanyaan itu. Tindakan ini tidak bisa diurungkan.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-3">
          <legend className="sr-only">Pertanyaan di bagian ini</legend>
          <label className="flex items-start gap-3 rounded-xl border border-neutral-400 p-3">
            <input
              type="radio"
              name="section-resolution"
              checked={mode === 'move'}
              onChange={() => setMode('move')}
              className="mt-1 size-4 accent-[#2B6282]"
            />
            <span className="grid flex-1 gap-2">
              <span className="text-sm font-semibold text-neutral-1000">
                Pindahkan pertanyaan ke bagian lain
              </span>
              <Label className="sr-only" htmlFor="section-target">
                Bagian tujuan
              </Label>
              <Select
                value={target}
                onValueChange={setTarget}
                disabled={mode !== 'move'}
              >
                <SelectTrigger id="section-target" aria-label="Bagian tujuan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SECTION}>Tanpa bagian</SelectItem>
                  {others.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-neutral-400 p-3">
            <input
              type="radio"
              name="section-resolution"
              checked={mode === 'delete'}
              onChange={() => setMode('delete')}
              className="mt-1 size-4 accent-[#2B6282]"
            />
            <span className="text-sm font-semibold text-neutral-1000">
              Hapus bagian beserta semua pertanyaannya
            </span>
          </label>
        </fieldset>
        <DialogFooter className="gap-2">
          <Button variant="dark_blue_outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="warning"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? 'Menghapus…' : 'Hapus bagian'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
