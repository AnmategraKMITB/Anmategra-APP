'use client';

import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react';
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
import { Switch } from '~/components/ui/switch';
import { cn } from '~/lib/utils';

import { KindIcon } from './add-menu';
import { useBuilder } from './builder-context';
import { ConditionEditor } from './condition-editor';
import { ImageUpload } from './image-upload';
import { FIELD_KINDS, type FieldOut, conditionSources, kindOf } from './model';
import { RichTextEditor } from './rich-text-editor';
import { TypeEditor } from './type-editors';

/** Satu kartu pertanyaan. Perubahan teks disimpan otomatis; operasi struktur seketika. */
export function FieldCard({
  field,
  sectionId,
  index,
  size,
}: {
  field: FieldOut;
  sectionId: string;
  /** Posisi dalam kelompoknya, dari 0. */
  index: number;
  size: number;
}) {
  const builder = useBuilder();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const draft = builder.draftOf(field);
  const kind = kindOf(field);
  const kindLabel = FIELD_KINDS.find((k) => k.kind === kind)?.label ?? '';
  const isBlock = field.type === 'text_block';
  const number = builder.numbers.get(field.id);
  const sections = builder.detail?.sections ?? [];
  const problem =
    builder.fieldErrors[field.id] ??
    (builder.publishProblem?.fieldId === field.id
      ? builder.publishProblem.message
      : null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Di dalam kolom isian, Alt+panah milik kolom itu (daftar pilihan, atau
    // navigasi teks di macOS), bukan perintah memindahkan kartu.
    const target = e.target as HTMLElement;
    if (e.defaultPrevented || !e.altKey) return;
    if (target.matches('input, textarea, [contenteditable="true"]')) return;
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      void builder.move(field.id, sectionId, index - 1);
    } else if (e.key === 'ArrowDown' && index < size - 1) {
      e.preventDefault();
      void builder.move(field.id, sectionId, index + 1);
    }
  };

  return (
    <article
      id={`field-${field.id}`}
      onKeyDown={onKeyDown}
      aria-label={isBlock ? 'Blok teks' : `Pertanyaan ${number ?? ''}`}
      className={cn(
        'rounded-[24px] border bg-neutral-50 p-5 transition-colors duration-150 focus-within:border-primary-400',
        problem ? 'border-tomato' : 'border-neutral-400',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-400 text-sm font-semibold text-white"
        >
          {number ?? <KindIcon kind="text_block" className="size-4" />}
        </span>
        <Select
          value={kind}
          onValueChange={(value) =>
            void builder.changeFieldType(field, value as typeof kind)
          }
        >
          <SelectTrigger
            className="h-8 w-auto min-w-0 gap-1.5 border-transparent bg-transparent px-2 text-sm text-neutral-700"
            aria-label="Jenis pertanyaan"
          >
            <KindIcon kind={kind} className="size-4" />
            <SelectValue>{kindLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {FIELD_KINDS.map((k) => (
              <SelectItem key={k.kind} value={k.kind}>
                <span className="flex items-center gap-2">
                  <KindIcon kind={k.kind} className="size-4" />
                  {k.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 grid gap-3">
        <RichTextEditor
          id={`label-${field.id}`}
          label={isBlock ? 'Judul' : 'Pertanyaan'}
          value={draft.label}
          maxLength={500}
          onChange={(label) => builder.edit({ ...draft, label })}
        />
        <RichTextEditor
          id={`desc-${field.id}`}
          label={isBlock ? 'Isi penjelasan' : 'Keterangan (opsional)'}
          value={draft.description ?? ''}
          rows={isBlock ? 4 : 2}
          maxLength={2000}
          onChange={(description) => builder.edit({ ...draft, description })}
        />
        <TypeEditor draft={draft} onChange={(next) => builder.edit(next)} />
        <ImageUpload
          formId={builder.formId}
          label="Ilustrasi (opsional)"
          url={(draft.image === undefined ? field.image : draft.image)?.url}
          alt={(draft.image === undefined ? field.image : draft.image)?.alt}
          onUploaded={({ url, key }) =>
            builder.edit(
              { ...draft, image: { url, key, alt: null } },
              { immediate: true },
            )
          }
          onRemove={() =>
            builder.edit({ ...draft, image: null }, { immediate: true })
          }
          onAlt={(alt) => {
            const cur = draft.image === undefined ? field.image : draft.image;
            if (cur)
              builder.edit(
                { ...draft, image: { ...cur, alt } },
                { immediate: true },
              );
          }}
        />
        <div>
          <ConditionEditor
            title={field.label}
            value={draft.condition}
            sources={conditionSources(builder.groups, { fieldId: field.id })}
            onSave={(condition) => builder.edit({ ...draft, condition })}
          />
        </div>
      </div>

      {problem ? (
        <p role="alert" className="mt-3 text-sm text-danger-dark">
          {problem}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-neutral-400 pt-3">
        {isBlock ? null : (
          <div className="flex items-center gap-2">
            <Switch
              id={`required-${field.id}`}
              checked={draft.required || field.type === 'unit_choice'}
              // Pilihan tujuan selalu wajib: pendaftar tanpa pilihan tidak sah.
              disabled={field.type === 'unit_choice'}
              onCheckedChange={(value) => builder.setRequired(field, value)}
            />
            <Label htmlFor={`required-${field.id}`}>
              Wajib diisi{field.type === 'unit_choice' ? ' (selalu)' : ''}
            </Label>
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Select
            value={sectionId}
            onValueChange={(value) => {
              if (value === sectionId) return;
              const group = builder.groups.find(
                (g) => g.section.id === value,
              );
              void builder.move(field.id, value, group?.fields.length ?? 0);
            }}
          >
            <SelectTrigger
              className="h-9 w-40"
              aria-label="Pindahkan ke bagian"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Naikkan"
            disabled={index === 0}
            onClick={() => void builder.move(field.id, sectionId, index - 1)}
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Turunkan"
            disabled={index >= size - 1}
            onClick={() => void builder.move(field.id, sectionId, index + 1)}
          >
            <ArrowDown />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Duplikat"
            onClick={() => void builder.duplicateField(field)}
          >
            <Copy />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Hapus"
            className="text-danger-dark hover:text-danger-dark"
            onClick={() =>
              (builder.detail?.submissionCount ?? 0) > 0
                ? setConfirmDelete(true)
                : void builder.removeField(field)
            }
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="rounded-[20px]">
          <DialogHeader>
            <DialogTitle>Hapus pertanyaan ini?</DialogTitle>
            <DialogDescription>
              Form ini sudah punya {builder.detail?.submissionCount ?? 0}{' '}
              respons. Pertanyaan yang sudah dijawab tidak benar-benar dihapus,
              tetapi diarsipkan: pertanyaan hilang dari form dan jawaban lama
              tetap tersimpan. Tindakan ini tidak bisa diurungkan dari sini.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="dark_blue_outline"
              onClick={() => setConfirmDelete(false)}
            >
              Batal
            </Button>
            <Button
              variant="warning"
              onClick={() => {
                setConfirmDelete(false);
                void builder.removeField(field);
              }}
            >
              Hapus pertanyaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
