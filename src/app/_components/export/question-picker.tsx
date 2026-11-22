'use client';

import { Download, FileSpreadsheet, Search, Sheet, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FIELD_KINDS } from '~/app/_components/forms/model';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { plainLabel } from '~/lib/forms/plain-label';
import { api } from '~/trpc/react';

/** Asal daftar pertanyaan: respons satu form, atau formulir satu oprec. */
export type QuestionSource = { formId: string } | { recruitmentId: string };

/** Pilihan aktif; `null` = bawaan ekspor itu (tanpa `?fields=`). */
export type QuestionChoice = {
  fieldIds: string[];
  presetName: string | null;
} | null;

const storageKey = (source: QuestionSource) =>
  `anmategra:ekspor-pertanyaan:${'formId' in source ? `form:${source.formId}` : `oprec:${source.recruitmentId}`}`;

/** Pilihan terakhir diingat per form/oprec di peramban ini (preset bersama ada di server). */
export function readStoredChoice(source: QuestionSource): QuestionChoice {
  try {
    const raw = window.localStorage.getItem(storageKey(source));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuestionChoice;
    return parsed && Array.isArray(parsed.fieldIds) ? parsed : null;
  } catch {
    return null;
  }
}

export function storeChoice(source: QuestionSource, choice: QuestionChoice) {
  try {
    if (choice) {
      window.localStorage.setItem(storageKey(source), JSON.stringify(choice));
    } else {
      window.localStorage.removeItem(storageKey(source));
    }
  } catch {
    // Penyimpanan diblokir: pilihan tetap berlaku sampai halaman ditutup.
  }
}

export function choiceSummary(
  choice: QuestionChoice,
  defaultLabel: string,
): string {
  if (!choice) return defaultLabel;
  if (choice.presetName) return choice.presetName;
  return choice.fieldIds.length === 0
    ? 'Tanpa jawaban formulir'
    : `${choice.fieldIds.length} pertanyaan`;
}

const KIND_LABEL = new Map<string, string>(
  FIELD_KINDS.map((k) => [k.kind, k.label]),
);

type Option = {
  fieldId: string;
  type: string;
  label: string;
  archived: boolean;
  sectionId: string | null;
  sectionTitle: string | null;
  divisions: string[];
};

function useOptions(source: QuestionSource) {
  const forForm = 'formId' in source;
  const form = api.form.export.options.useQuery(
    { formId: forForm ? source.formId : '' },
    { enabled: forForm },
  );
  const oprec = api.oprec.exportOptions.useQuery(
    { recruitmentId: forForm ? '' : source.recruitmentId },
    { enabled: !forForm },
  );
  return forForm ? form : oprec;
}

/**
 * Dialog memilih pertanyaan yang jawabannya ikut diekspor, dikelompokkan per
 * bagian form. Pilihan bisa disimpan sebagai preset bersama (mis. "Data
 * diri") supaya pengelola lain tinggal memakainya.
 */
export function QuestionPicker({
  source,
  value,
  defaultLabel,
  description,
  csv,
  onApply,
  onClose,
}: {
  source: QuestionSource;
  value: QuestionChoice;
  /** Arti "bawaan" untuk ekspor ini, mis. "Tanpa jawaban formulir". */
  defaultLabel: string;
  description: string;
  /** Tampilkan tombol CSV (route mendukung CSV). */
  csv: boolean;
  /** Simpan pilihan, lalu langsung ekspor bila `format` diisi. */
  onApply: (choice: QuestionChoice, format?: 'xlsx' | 'sheets' | 'csv') => void;
  onClose: () => void;
}) {
  const options = useOptions(source);
  const utils = api.useUtils();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(value?.fieldIds ?? []),
  );
  const [presetName, setPresetName] = useState(value?.presetName ?? '');
  const [query, setQuery] = useState('');

  const fields: Option[] = useMemo(
    () => options.data?.fields ?? [],
    [options.data],
  );
  const presets = options.data?.presets ?? [];
  const canSave = options.data?.canSavePresets ?? false;
  const activePreset = presets.find((p) => p.name === presetName) ?? null;

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list: {
      key: string;
      title: string;
      divisions: string[];
      items: Option[];
    }[] = [];
    for (const field of fields) {
      if (needle && !plainLabel(field.label).toLowerCase().includes(needle)) {
        continue;
      }
      const key = field.archived ? 'arsip' : (field.sectionId ?? 'tanpa');
      let group = list.find((g) => g.key === key);
      if (!group) {
        group = {
          key,
          title: field.archived
            ? 'Pertanyaan diarsipkan'
            : (field.sectionTitle ?? 'Tanpa bagian'),
          divisions: field.archived ? [] : field.divisions,
          items: [],
        };
        list.push(group);
      }
      group.items.push(field);
    }
    return list;
  }, [fields, query]);

  const invalidate = () =>
    'formId' in source
      ? utils.form.export.options.invalidate({ formId: source.formId })
      : utils.oprec.exportOptions.invalidate({
          recruitmentId: source.recruitmentId,
        });
  const onError = (error: { message: string }) => toast.error(error.message);
  const saveForm = api.form.export.presetSave.useMutation({ onError });
  const saveOprec = api.oprec.exportPresetSave.useMutation({ onError });
  const deleteForm = api.form.export.presetDelete.useMutation({ onError });
  const deleteOprec = api.oprec.exportPresetDelete.useMutation({ onError });
  const saving = saveForm.isPending || saveOprec.isPending;
  const deleting = deleteForm.isPending || deleteOprec.isPending;

  /** Urutan id mengikuti urutan form, bukan urutan klik. */
  const orderedSelection = () =>
    fields.map((f) => f.fieldId).filter((id) => selected.has(id));

  const toggle = (ids: string[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const pickPreset = (name: string) => {
    const preset = presets.find((p) => p.name === name);
    if (!preset) return;
    setPresetName(preset.name);
    setSelected(new Set(preset.fieldIds));
  };

  const savePreset = async () => {
    const name = presetName.trim();
    if (!name) {
      toast.error('Isi nama preset dulu.');
      return;
    }
    const fieldIds = orderedSelection();
    const saved =
      'formId' in source
        ? await saveForm.mutateAsync({ formId: source.formId, name, fieldIds })
        : await saveOprec.mutateAsync({
            recruitmentId: source.recruitmentId,
            name,
            fieldIds,
          });
    await invalidate();
    setPresetName(saved.name);
    toast.success(`Preset "${saved.name}" disimpan untuk semua pengelola.`);
  };

  const deletePreset = async () => {
    if (!activePreset) return;
    if ('formId' in source) {
      await deleteForm.mutateAsync({
        formId: source.formId,
        presetId: activePreset.id,
      });
    } else {
      await deleteOprec.mutateAsync({
        recruitmentId: source.recruitmentId,
        presetId: activePreset.id,
      });
    }
    await invalidate();
    toast.success(`Preset "${activePreset.name}" dihapus.`);
    setPresetName('');
  };

  const apply = (format?: 'xlsx' | 'sheets' | 'csv') => {
    const fieldIds = orderedSelection();
    const sameAsPreset =
      activePreset !== null &&
      activePreset.fieldIds.length === fieldIds.length &&
      activePreset.fieldIds.every((id) => selected.has(id));
    onApply(
      { fieldIds, presetName: sameAsPreset ? activePreset.name : null },
      format,
    );
    onClose();
  };

  const visibleIds = groups.flatMap((g) => g.items.map((f) => f.fieldId));

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pilih pertanyaan</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={activePreset ? activePreset.name : ''}
            onValueChange={pickPreset}
            disabled={presets.length === 0}
          >
            <SelectTrigger aria-label="Preset" className="h-9 w-full sm:w-64">
              <SelectValue
                placeholder={
                  presets.length ? 'Pakai preset…' : 'Belum ada preset'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {presets.map((preset) => (
                <SelectItem key={preset.id} value={preset.name}>
                  {preset.name} ({preset.fieldIds.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canSave && activePreset ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deleting}
              onClick={() => void deletePreset()}
            >
              <Trash2 /> Hapus preset
            </Button>
          ) : null}
          <span className="ml-auto text-xs tabular-nums text-neutral-700">
            {selected.size} dari {fields.length} dipilih
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari pertanyaan"
            aria-label="Cari pertanyaan"
            startAdornment={<Search className="size-4 text-neutral-500" />}
            className="h-9 min-w-[12rem] flex-1 rounded-full border-neutral-400 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toggle(visibleIds, true)}
          >
            Pilih semua{query ? ' yang tampil' : ''}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              query ? toggle(visibleIds, false) : setSelected(new Set())
            }
          >
            Kosongkan
          </Button>
        </div>

        <div className="min-h-[12rem] flex-1 overflow-y-auto rounded-xl border border-neutral-400">
          {options.isPending ? (
            <p className="p-4 text-sm text-neutral-700">Memuat pertanyaan…</p>
          ) : options.error ? (
            <p className="p-4 text-sm text-neutral-1000">
              {options.error.message}
            </p>
          ) : groups.length === 0 ? (
            <p className="p-4 text-sm text-neutral-700">
              {fields.length === 0
                ? 'Form ini belum punya pertanyaan yang bisa diekspor.'
                : 'Tidak ada pertanyaan yang cocok.'}
            </p>
          ) : (
            groups.map((group) => {
              const ids = group.items.map((f) => f.fieldId);
              const count = ids.filter((id) => selected.has(id)).length;
              return (
                <fieldset
                  key={group.key}
                  className="border-b border-neutral-200 last:border-b-0"
                >
                  <legend className="sr-only">{group.title}</legend>
                  <label className="sticky top-0 z-10 flex cursor-pointer items-center gap-2 bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-1000">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary-400"
                      checked={count === ids.length}
                      ref={(el) => {
                        if (el)
                          el.indeterminate = count > 0 && count < ids.length;
                      }}
                      onChange={(event) => toggle(ids, event.target.checked)}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {plainLabel(group.title)}
                    </span>
                    {group.divisions.length ? (
                      <span className="shrink-0 rounded-full bg-primary-200 px-2 py-0.5 font-normal text-neutral-1000">
                        Divisi {group.divisions.join(', ')}
                      </span>
                    ) : 'recruitmentId' in source ? (
                      <span className="shrink-0 font-normal text-neutral-700">
                        Umum
                      </span>
                    ) : null}
                  </label>
                  {group.items.map((field) => (
                    <label
                      key={field.fieldId}
                      className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-neutral-100"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 shrink-0 accent-primary-400"
                        checked={selected.has(field.fieldId)}
                        onChange={(event) =>
                          toggle([field.fieldId], event.target.checked)
                        }
                      />
                      <span className="min-w-0 flex-1 break-words text-neutral-1000">
                        {plainLabel(field.label)}
                      </span>
                      <span className="shrink-0 text-xs text-neutral-700">
                        {KIND_LABEL.get(field.type) ?? field.type}
                      </span>
                    </label>
                  ))}
                </fieldset>
              );
            })
          )}
        </div>

        {canSave ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              maxLength={80}
              placeholder='Nama preset, mis. "Data diri"'
              aria-label="Nama preset"
              className="h-9 min-w-[12rem] flex-1 text-sm"
            />
            <Button
              type="button"
              variant="dark_blue_outline"
              size="sm"
              disabled={saving || !presetName.trim()}
              onClick={() => void savePreset()}
            >
              {activePreset ? 'Perbarui preset' : 'Simpan sebagai preset'}
            </Button>
          </div>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onApply(null);
              onClose();
            }}
          >
            Kembali ke bawaan ({defaultLabel.toLowerCase()})
          </Button>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              variant="dark_blue_outline"
              size="sm"
              onClick={() => apply()}
            >
              Simpan pilihan
            </Button>
            {csv ? (
              <Button
                type="button"
                variant="dark_blue_outline"
                size="sm"
                onClick={() => apply('csv')}
              >
                <Download /> CSV
              </Button>
            ) : null}
            <Button
              type="button"
              variant="dark_blue_outline"
              size="sm"
              onClick={() => apply('sheets')}
            >
              <Sheet /> Google Sheets
            </Button>
            <Button
              type="button"
              variant="dark_blue"
              size="sm"
              onClick={() => apply('xlsx')}
            >
              <FileSpreadsheet /> Unduh Excel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const OPREC_DESCRIPTION =
  'Jawaban pertanyaan terpilih ditambahkan sebagai kolom di ujung kanan. Pertanyaan umum ikut di semua tab; pertanyaan di bagian divisi hanya di tab divisi itu (di tab berisi semua pendaftar ditandai nama divisinya). Pilihan diingat untuk semua ekspor oprec ini.';

/** Pengaturan "Pilih pertanyaan" untuk ekspor oprec. */
export const oprecQuestions = (recruitmentId: string) => ({
  source: { recruitmentId },
  defaultLabel: 'Tanpa jawaban formulir',
  description: OPREC_DESCRIPTION,
});

/** Ekspor lengkap: tanpa pilihan, tab Jawaban memuat semua pertanyaan. */
export const oprecFullQuestions = (recruitmentId: string) => ({
  source: { recruitmentId },
  defaultLabel: 'Semua pertanyaan di tab Jawaban',
  description:
    'Tanpa pilihan, tab Jawaban memuat semua pertanyaan (satu tab umum dan satu tab per divisi). Dengan pilihan, tab Jawaban hanya memuat pertanyaan itu dan jawabannya ikut ditempel ke tab Pendaftar, Nilai, Penempatan, Hasil, dan Diterima.',
});

/** Ekspor respons Forms. */
export const formQuestions = (formId: string) => ({
  source: { formId },
  defaultLabel: 'Semua pertanyaan',
  description:
    'Waktu kirim, nama, NIM, dan email responden selalu ikut. Pilih pertanyaan yang jawabannya ikut diekspor; pilihan diingat di peramban ini.',
});
