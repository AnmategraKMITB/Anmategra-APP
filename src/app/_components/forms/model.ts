import type {
  CreateFieldInput,
  UpdateFieldInput,
} from '~/server/api/types/form.type';
import type { RouterOutputs } from '~/trpc/react';

import { isConditionSource } from './condition-labels';

export type FormDetailOut = RouterOutputs['form']['getById'];
export type FieldOut = FormDetailOut['fields'][number];
export type SectionOut = FormDetailOut['sections'][number];
export type EndingOut = FormDetailOut['endings'][number];
export type FormStatus = FormDetailOut['status'];

/** What the "Tambah Konten" menu offers. `dropdown` is a single choice shown as a list. */
export type FieldKind = FieldOut['type'] | 'dropdown';

export const FIELD_KINDS: { kind: FieldKind; label: string; hint: string }[] = [
  {
    kind: 'short_text',
    label: 'Teks pendek',
    hint: 'Jawaban satu baris, misalnya nama',
  },
  {
    kind: 'long_text',
    label: 'Teks panjang',
    hint: 'Jawaban beberapa baris, misalnya alasan',
  },
  { kind: 'number', label: 'Angka', hint: 'Jawaban berupa bilangan' },
  { kind: 'date', label: 'Tanggal', hint: 'Memilih satu tanggal' },
  {
    kind: 'single_choice',
    label: 'Pilihan tunggal',
    hint: 'Memilih satu dari beberapa pilihan',
  },
  {
    kind: 'dropdown',
    label: 'Dropdown',
    hint: 'Pilihan tunggal dalam daftar turun',
  },
  {
    kind: 'multiple_choice',
    label: 'Pilihan ganda',
    hint: 'Memilih beberapa pilihan',
  },
  {
    kind: 'checkbox',
    label: 'Kotak centang',
    hint: 'Persetujuan ya atau tidak',
  },
  { kind: 'matrix', label: 'Matriks', hint: 'Tabel pilihan untuk tiap baris' },
  { kind: 'scale', label: 'Skala', hint: 'Penilaian dalam rentang angka' },
  { kind: 'link', label: 'Tautan', hint: 'Alamat situs atau berkas' },
  {
    kind: 'file',
    label: 'Unggah berkas',
    hint: 'Pengisi mengunggah berkas lewat OneDrive',
  },
  {
    kind: 'text_block',
    label: 'Blok teks',
    hint: 'Penjelasan tanpa pertanyaan',
  },
];

export function kindOf(field: FieldOut): FieldKind {
  return field.type === 'single_choice' && field.config.tampilan === 'dropdown'
    ? 'dropdown'
    : field.type;
}

const STATUS_LABELS: Record<FormStatus, 'Draf' | 'Terbit' | 'Ditutup'> = {
  Draft: 'Draf',
  Published: 'Terbit',
  Closed: 'Ditutup',
};

export function statusLabel(status: FormStatus): 'Draf' | 'Terbit' | 'Ditutup' {
  return STATUS_LABELS[status];
}

export function previewUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/forms/preview/${token}`;
}

// ---------------------------------------------------------------------------
// Grouping and numbering
// ---------------------------------------------------------------------------

/** `section: null` is the group of fields outside every section. */
export type ContentGroup = { section: SectionOut | null; fields: FieldOut[] };

/**
 * Fields grouped for display: the no-section group first (only when it has
 * fields), then every section in order, empty ones included so they can be
 * filled. A field whose section is unknown joins the no-section group.
 */
export function groupContent(
  detail: Pick<FormDetailOut, 'sections' | 'fields'>,
): ContentGroup[] {
  const known = new Set(detail.sections.map((s) => s.id));
  const loose = detail.fields.filter(
    (f) => f.sectionId === null || !known.has(f.sectionId),
  );
  const groups: ContentGroup[] = [];
  if (loose.length > 0) groups.push({ section: null, fields: loose });
  for (const section of detail.sections) {
    groups.push({
      section,
      fields: detail.fields.filter((f) => f.sectionId === section.id),
    });
  }
  return groups;
}

/** Question numbers across the whole form; text blocks are not numbered. */
export function numberQuestions(groups: ContentGroup[]): Map<string, number> {
  const numbers = new Map<string, number>();
  let n = 0;
  for (const group of groups) {
    for (const field of group.fields) {
      if (field.type !== 'text_block') numbers.set(field.id, ++n);
    }
  }
  return numbers;
}

// ---------------------------------------------------------------------------
// Field <-> input
// ---------------------------------------------------------------------------

const NEW_LABEL = 'Pertanyaan baru';

export function defaultFieldInput(
  kind: FieldKind,
  formId: string,
  sectionId: string | null,
): CreateFieldInput {
  const base = { formId, label: NEW_LABEL, required: false, sectionId };
  const options = [{ label: 'Pilihan 1' }, { label: 'Pilihan 2' }];
  switch (kind) {
    case 'short_text':
      return { ...base, type: 'short_text', config: {} };
    case 'long_text':
      return { ...base, type: 'long_text', config: {} };
    case 'number':
      return { ...base, type: 'number', config: {} };
    case 'date':
      return { ...base, type: 'date', config: {} };
    case 'single_choice':
      return {
        ...base,
        type: 'single_choice',
        config: { tampilan: 'daftar' },
        options,
      };
    case 'dropdown':
      return {
        ...base,
        type: 'single_choice',
        config: { tampilan: 'dropdown' },
        options,
      };
    case 'multiple_choice':
      return { ...base, type: 'multiple_choice', config: {}, options };
    case 'checkbox':
      return { ...base, type: 'checkbox', config: {} };
    case 'matrix':
      return {
        ...base,
        type: 'matrix',
        config: {
          rows: [{ label: 'Baris 1' }, { label: 'Baris 2' }],
          columns: [
            { label: 'Kolom 1' },
            { label: 'Kolom 2' },
            { label: 'Kolom 3' },
          ],
          multiple: false,
        },
      };
    case 'scale':
      return {
        ...base,
        type: 'scale',
        config: { min: 1, max: 5, tampilan: 'angka' },
      };
    case 'link':
      return { ...base, type: 'link', config: {} };
    case 'file':
      return {
        ...base,
        type: 'file',
        config: {
          preset: 'pdf',
          maxFiles: 1,
          maxSizeMb: 10,
          linkAccess: 'anyone',
        },
      };
    case 'text_block':
      return { ...base, label: 'Penjelasan', type: 'text_block', config: {} };
  }
}

function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/** The whole card as the server wants it back (update replaces the card). */
export function fieldToUpdateInput(
  field: FieldOut,
  formId: string,
): UpdateFieldInput {
  const base = {
    formId,
    fieldId: field.id,
    label: field.label,
    description: field.description,
    required: field.required,
  };
  const c = field.config;
  const options = field.options.map((o) => ({ id: o.id, label: o.label }));
  switch (field.type) {
    case 'short_text':
    case 'long_text':
      return {
        ...base,
        type: field.type,
        config: compact({
          minLength: c.minLength,
          maxLength: c.maxLength,
          pattern: c.pattern,
        }),
      };
    case 'number':
      return {
        ...base,
        type: 'number',
        config: compact({ min: c.min, max: c.max }),
      };
    case 'date':
      return { ...base, type: 'date', config: {} };
    case 'single_choice':
      return {
        ...base,
        type: 'single_choice',
        config: { tampilan: c.tampilan === 'dropdown' ? 'dropdown' : 'daftar' },
        options,
      };
    case 'multiple_choice':
      return {
        ...base,
        type: 'multiple_choice',
        config: compact({
          minSelections: c.minSelections,
          maxSelections: c.maxSelections,
        }),
        options,
      };
    case 'checkbox':
      return { ...base, type: 'checkbox', config: {} };
    case 'text_block':
      return { ...base, type: 'text_block', config: {} };
    case 'link':
      return {
        ...base,
        type: 'link',
        config: compact({ buttonLabel: c.buttonLabel }),
      };
    case 'matrix':
      return {
        ...base,
        type: 'matrix',
        config: {
          rows: (c.rows ?? []).map((r) => ({ id: r.id, label: r.label })),
          columns: (c.columns ?? []).map((col) => ({
            id: col.id,
            label: col.label,
          })),
          multiple: c.multiple ?? false,
        },
      };
    case 'file':
      return {
        ...base,
        type: 'file',
        config: {
          preset: c.preset ?? 'pdf',
          maxFiles: c.maxFiles ?? 1,
          maxSizeMb: c.maxSizeMb ?? 10,
          linkAccess: c.linkAccess ?? 'anyone',
        },
      };
    case 'scale':
      return {
        ...base,
        type: 'scale',
        config: {
          min: c.min ?? 1,
          max: c.max ?? 5,
          ...compact({ minLabel: c.minLabel, maxLabel: c.maxLabel }),
          tampilan: c.tampilan === 'bintang' ? 'bintang' : 'angka',
        },
      };
  }
}

const COPY_SUFFIX = ' (salinan)';

/** The same content with fresh ids: options and matrix rows/columns lose theirs. */
function copyInput(
  field: FieldOut,
  formId: string,
  sectionId: string | null,
  label: string,
  keepImage = false,
): CreateFieldInput {
  const input = fieldToUpdateInput(field, formId);
  // Draf autosimpan tidak membawa `condition` (server mempertahankannya);
  // salinan dan pemulihan harus membawanya.
  const copy: Record<string, unknown> = {
    ...input,
    label,
    sectionId,
    condition: field.condition,
    // Hanya pemulihan (Urungkan) yang memakai gambar yang sama; duplikat sengaja
    // tidak menyalin gambar, dan file lamanya tetap ada untuk kasus ini.
    ...(keepImage && field.image ? { image: field.image } : {}),
  };
  delete copy.fieldId;
  if ('options' in input) {
    copy.options = input.options.map((o) => ({ label: o.label }));
  }
  if (input.type === 'matrix') {
    copy.config = {
      ...input.config,
      rows: input.config.rows.map((r) => ({ label: r.label })),
      columns: input.config.columns.map((col) => ({ label: col.label })),
    };
  }
  return copy as CreateFieldInput;
}

/** A new field with the same content, for "Duplikat". */
export function duplicateInput(
  field: FieldOut,
  formId: string,
  sectionId: string | null,
): CreateFieldInput {
  const label = `${field.label.slice(0, 500 - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
  return copyInput(field, formId, sectionId, label);
}

/** Puts a deleted field back exactly as it was (undo of a delete). */
export function recreateInput(
  field: FieldOut,
  formId: string,
  sectionId: string | null,
): CreateFieldInput {
  return copyInput(field, formId, sectionId, field.label, true);
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** WCAG contrast ratio of white text on `hex` (`#RRGGBB`). AA needs 4.5 for small text. */
export function contrastWithWhite(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  return 1.05 / (luminance + 0.05);
}

// ---------------------------------------------------------------------------
// Drag and drop
// ---------------------------------------------------------------------------

export const containerId = (sectionId: string | null) =>
  `container:${sectionId ?? 'none'}`;

/**
 * Where a dragged field lands. `overId` is a field id or a container id
 * (`container:<sectionId|none>`). `toIndex` counts inside the target group
 * with the dragged field taken out, which is what `field.move` expects.
 */
export function planDrop(
  groups: ContentGroup[],
  activeId: string,
  overId: string,
): { toSectionId: string | null; toIndex: number } | null {
  if (activeId === overId) return null;
  const locate = (id: string) => {
    for (const group of groups) {
      const index = group.fields.findIndex((f) => f.id === id);
      if (index >= 0) return { group, index };
    }
    return null;
  };
  const active = locate(activeId);
  if (!active) return null;

  if (overId.startsWith('container:')) {
    const key = overId.slice('container:'.length);
    const group = groups.find((g) => (g.section?.id ?? 'none') === key);
    if (!group) return null;
    const without = group.fields.filter((f) => f.id !== activeId).length;
    return { toSectionId: group.section?.id ?? null, toIndex: without };
  }

  const over = locate(overId);
  if (!over) return null;
  return { toSectionId: over.group.section?.id ?? null, toIndex: over.index };
}

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

type UndoEntry = {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

const UNDO_LIMIT = 50;

/**
 * Inverse operations of structural edits. Only one undo or redo runs at a
 * time (a second click or a held Ctrl+Z is ignored), and an entry that fails
 * is discarded: it usually points at ids that no longer exist, and leaving it
 * on top would block everything older.
 */
export class UndoStack {
  private done: UndoEntry[] = [];
  private undone: UndoEntry[] = [];
  private running = false;

  push(entry: UndoEntry) {
    this.done.push(entry);
    if (this.done.length > UNDO_LIMIT) this.done.shift();
    this.undone = [];
  }

  async undo(): Promise<string | null> {
    const entry = this.done[this.done.length - 1];
    if (!entry || this.running) return null;
    this.running = true;
    try {
      await entry.undo();
      this.done.pop();
      this.undone.push(entry);
      return entry.label;
    } catch (error) {
      this.done.pop();
      throw error;
    } finally {
      this.running = false;
    }
  }

  async redo(): Promise<string | null> {
    const entry = this.undone[this.undone.length - 1];
    if (!entry || this.running) return null;
    this.running = true;
    try {
      await entry.redo();
      this.undone.pop();
      this.done.push(entry);
      return entry.label;
    } catch (error) {
      this.undone.pop();
      throw error;
    } finally {
      this.running = false;
    }
  }

  get busy() {
    return this.running;
  }

  get canUndo() {
    return this.done.length > 0;
  }

  get canRedo() {
    return this.undone.length > 0;
  }
}

/** A JSON block (settings, theme, welcome) with `patch` applied; `undefined` keys are dropped. */
export function mergeBlock<T extends Record<string, unknown>>(
  base: T,
  patch: Partial<T>,
): T {
  return Object.fromEntries(
    Object.entries({ ...base, ...patch }).filter(([, v]) => v !== undefined),
  ) as T;
}

// ---------------------------------------------------------------------------
// Condition sources
// ---------------------------------------------------------------------------

/**
 * Pertanyaan yang boleh jadi acuan kondisi target: yang lebih dulu dalam
 * urutan form dan berjenis sah. `before` = id pertanyaan target, id bagian
 * target (acuannya hanya pertanyaan sebelum bagian itu), atau `null` untuk
 * ending (semua pertanyaan).
 */
export function conditionSources(
  groups: ContentGroup[],
  before: { fieldId: string } | { sectionId: string } | null,
): {
  id: string;
  type: string;
  label: string;
  options: { id: string; label: string }[];
}[] {
  const out: FieldOut[] = [];
  for (const group of groups) {
    if (
      before &&
      'sectionId' in before &&
      group.section?.id === before.sectionId
    ) {
      break;
    }
    for (const field of group.fields) {
      if (before && 'fieldId' in before && field.id === before.fieldId) {
        return out.filter((f) => isConditionSource(f.type));
      }
      out.push(field);
    }
  }
  return out.filter((f) => isConditionSource(f.type));
}
