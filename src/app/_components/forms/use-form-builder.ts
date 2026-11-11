'use client';

import { useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  ConditionInput,
  FormSettings,
  FormTheme,
  FormWelcome,
  UpdateFieldInput,
  UpdateFormInput,
} from '~/server/api/types/form.type';
import { api } from '~/trpc/react';

import {
  type FieldKind,
  type FieldOut,
  type FormStatus,
  type SectionOut,
  UndoStack,
  defaultFieldInput,
  duplicateInput,
  fieldToUpdateInput,
  groupContent,
  mergeBlock,
  numberQuestions,
  planDrop,
  recreateInput,
} from './model';

/** Teks pertanyaan disimpan setelah berhenti mengetik selama ini. */
const SAVE_DELAY_MS = 700;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Terjadi kesalahan.';

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

export type SectionResolution =
  | { type: 'move'; toSectionId: string }
  | { type: 'delete' };

/**
 * State dan aksi builder. Server adalah sumber kebenaran: sesudah tiap
 * mutasi `form.getById` diambil ulang. Teks yang sedang diketik disimpan
 * sebagai draf lokal dan dikirim berantrean per pertanyaan, supaya ketikan
 * tidak tertimpa data lama dan dua penyimpanan tidak saling menimpa.
 */
export function useFormBuilder(formId: string) {
  const utils = api.useUtils();
  const query = api.form.getById.useQuery(
    { formId },
    { staleTime: 0, refetchOnWindowFocus: false },
  );
  const detail = query.data;

  const createField = api.form.field.create.useMutation();
  const updateField = api.form.field.update.useMutation();
  const deleteField = api.form.field.delete.useMutation();
  const moveField = api.form.field.move.useMutation();
  const createSection = api.form.section.create.useMutation();
  const updateSection = api.form.section.update.useMutation();
  const deleteSection = api.form.section.delete.useMutation();
  const reorderSections = api.form.section.reorder.useMutation();
  const createEnding = api.form.ending.create.useMutation();
  const updateEnding = api.form.ending.update.useMutation();
  const deleteEnding = api.form.ending.delete.useMutation();
  const reorderEndings = api.form.ending.reorder.useMutation();
  const updateForm = api.form.update.useMutation();
  const setStatusMutation = api.form.setStatus.useMutation();
  const setPreviewMutation = api.form.setPreview.useMutation();
  const rotateMutation = api.form.rotatePreviewToken.useMutation();

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [drafts, setDrafts] = useState<Record<string, UpdateFieldInput>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [publishProblem, setPublishProblem] = useState<{
    fieldId: string | null;
    message: string;
  } | null>(null);
  const draftsRef = useRef<Record<string, UpdateFieldInput>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queues = useRef(new Map<string, Promise<void>>());
  const [stack] = useState(() => new UndoStack());
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const refresh = () => utils.form.getById.invalidate({ formId });
  const latest = () => utils.form.getById.getData({ formId });
  const latestField = (fieldId: string) =>
    latest()?.fields.find((f) => f.id === fieldId);

  /** Menjalankan satu operasi, lalu mengambil ulang data dan melaporkan hasilnya. */
  /**
   * `retryClearing`: dipanggil bila server menolak karena perubahan ini
   * merusak kondisi lain; pengguna ditawari menghapus kondisi itu dan lanjut.
   */
  async function run<T>(
    operation: () => Promise<T>,
    retryClearing?: () => Promise<T>,
  ): Promise<T | undefined> {
    setSaveState('saving');
    try {
      const result = await operation();
      await refresh();
      setSaveState('saved');
      return result;
    } catch (error) {
      setSaveState('error');
      const message = messageOf(error);
      if (retryClearing && message.includes('Hapus kondisi terkait')) {
        toast.error(message, {
          duration: 15000,
          action: {
            label: 'Hapus kondisi dan lanjutkan',
            onClick: () => void flushAll().then(() => run(retryClearing)),
          },
        });
      } else {
        toast.error(message);
      }
      await refresh().catch(() => undefined);
      return undefined;
    }
  }

  const groups = detail ? groupContent(detail) : [];
  const numbers = numberQuestions(groups);

  // -------------------------------------------------------------------------
  // Teks pertanyaan: draf lokal + simpan otomatis
  // -------------------------------------------------------------------------

  const draftOf = (field: FieldOut): UpdateFieldInput =>
    drafts[field.id] ?? fieldToUpdateInput(field, formId);

  function flush(fieldId: string): Promise<void> {
    const timer = timers.current.get(fieldId);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(fieldId);
    }
    const input = draftsRef.current[fieldId];
    if (!input) return queues.current.get(fieldId) ?? Promise.resolve();

    const next = (queues.current.get(fieldId) ?? Promise.resolve()).then(
      async () => {
        setSaveState('saving');
        try {
          await updateField.mutateAsync(input);
          await refresh();
          // Hanya bila tidak ada ketikan yang lebih baru sejak dikirim.
          if (draftsRef.current[fieldId] === input) {
            draftsRef.current = without(draftsRef.current, fieldId);
            setDrafts(draftsRef.current);
          }
          setFieldErrors((prev) => without(prev, fieldId));
          setSaveState('saved');
        } catch (error) {
          setSaveState('error');
          const message = messageOf(error);
          setFieldErrors((prev) => ({ ...prev, [fieldId]: message }));
          if (message.includes('Hapus kondisi terkait')) {
            toast.error(message, {
              duration: 15000,
              action: {
                label: 'Hapus kondisi dan lanjutkan',
                onClick: () =>
                  void run(async () => {
                    await updateField.mutateAsync({
                      ...input,
                      clearDependents: true,
                    });
                    if (draftsRef.current[fieldId] === input) {
                      draftsRef.current = without(draftsRef.current, fieldId);
                      setDrafts(draftsRef.current);
                    }
                    setFieldErrors((prev) => without(prev, fieldId));
                  }),
              },
            });
          }
        }
      },
    );
    queues.current.set(fieldId, next);
    return next;
  }

  function flushAll(): Promise<void> {
    const ids = new Set([
      ...Object.keys(draftsRef.current),
      ...queues.current.keys(),
    ]);
    return Promise.all([...ids].map((id) => flush(id))).then(() => undefined);
  }

  function edit(
    input: UpdateFieldInput,
    options: { immediate?: boolean } = {},
  ) {
    draftsRef.current = { ...draftsRef.current, [input.fieldId]: input };
    setDrafts(draftsRef.current);
    const pending = timers.current.get(input.fieldId);
    if (pending) clearTimeout(pending);
    if (options.immediate) {
      void flush(input.fieldId);
    } else {
      timers.current.set(
        input.fieldId,
        setTimeout(() => void flush(input.fieldId), SAVE_DELAY_MS),
      );
    }
  }

  const hasUnsaved = Object.keys(drafts).length > 0 || saveState === 'saving';

  // -------------------------------------------------------------------------
  // Undo / redo
  // -------------------------------------------------------------------------

  async function undo() {
    try {
      // Ketikan yang belum tersimpan disimpan dulu: tanpa ini draf bisa menunjuk
      // pertanyaan yang justru dihapus oleh undo.
      await flushAll();
      const label = await stack.undo();
      rerender();
      if (label) toast(`Dibatalkan: ${label}`);
    } catch (error) {
      toast.error(messageOf(error));
    }
  }

  async function redo() {
    try {
      await flushAll();
      const label = await stack.redo();
      rerender();
      if (label) toast(`Diulang: ${label}`);
    } catch (error) {
      toast.error(messageOf(error));
    }
  }

  const record = (entry: Parameters<UndoStack['push']>[0]) => {
    stack.push(entry);
    rerender();
  };

  // -------------------------------------------------------------------------
  // Pertanyaan
  // -------------------------------------------------------------------------

  const locate = (fieldId: string) => {
    for (const group of groups) {
      const index = group.fields.findIndex((f) => f.id === fieldId);
      if (index >= 0) return { sectionId: group.section.id, index };
    }
    const fallback = detail?.sections[0]?.id;
    if (!fallback) throw new Error('Formulir belum punya bagian.');
    return { sectionId: fallback, index: 0 };
  };

  async function addField(kind: FieldKind, sectionId: string) {
    const base = defaultFieldInput(kind, formId, sectionId);
    // "Pertanyaan baru wajib diisi" di pengaturan berlaku untuk jenis yang bisa dijawab.
    const input =
      detail?.settings.requiredByDefault && kind !== 'text_block'
        ? { ...base, required: true }
        : base;
    const created = await run(() => createField.mutateAsync(input));
    if (!created) return undefined;
    let currentId = created.id;
    // Isi terakhir pertanyaan, diambil saat undo, supaya redo mengembalikan
    // apa yang sudah diketik dan bukan pertanyaan bawaan yang kosong.
    let snapshot: FieldOut | undefined;
    record({
      label: 'Tambah pertanyaan',
      undo: async () => {
        snapshot = latestField(currentId);
        await deleteField.mutateAsync({ formId, fieldId: currentId });
        await refresh();
      },
      redo: async () => {
        const again = snapshot
          ? recreateInput(snapshot, formId, sectionId)
          : input;
        currentId = (await createField.mutateAsync(again)).id;
        await refresh();
      },
    });
    return created.id;
  }


  /** Ganti jenis pertanyaan dari kartunya; isi teks dan pengaturan dasar dipertahankan. */
  async function changeFieldType(field: FieldOut, kind: FieldKind) {
    await flushAll();
    const base = defaultFieldInput(kind, formId, field.sectionId);
    const { sectionId: _sectionId, ...rest } = base;
    void _sectionId;
    await run(() =>
      updateField.mutateAsync({
        ...rest,
        fieldId: field.id,
        label: field.label,
        description: field.description ?? undefined,
        required: field.required,
        ...(field.condition ? { condition: field.condition } : {}),
        ...(field.image ? { image: field.image } : {}),
      }),
    );
  }

  async function duplicateField(field: FieldOut) {
    await flushAll();
    const where = locate(field.id);
    const input = duplicateInput(
      latestField(field.id) ?? field,
      formId,
      where.sectionId,
    );
    const place = async (fieldId: string) => {
      await moveField.mutateAsync({
        formId,
        fieldId,
        toSectionId: where.sectionId,
        toIndex: where.index + 1,
      });
    };
    const created = await run(async () => {
      const made = await createField.mutateAsync(input);
      await place(made.id);
      return made;
    });
    if (!created) return;
    let currentId = created.id;
    let snapshot: FieldOut | undefined;
    record({
      label: 'Duplikat pertanyaan',
      undo: async () => {
        snapshot = latestField(currentId);
        await deleteField.mutateAsync({ formId, fieldId: currentId });
        await refresh();
      },
      redo: async () => {
        const again = snapshot
          ? recreateInput(snapshot, formId, where.sectionId)
          : input;
        currentId = (await createField.mutateAsync(again)).id;
        await place(currentId);
        await refresh();
      },
    });
  }

  async function removeField(field: FieldOut) {
    await flushAll();
    const where = locate(field.id);
    const snapshot = latestField(field.id) ?? field;
    const result = await run(
      () => deleteField.mutateAsync({ formId, fieldId: field.id }),
      () =>
        deleteField.mutateAsync({
          formId,
          fieldId: field.id,
          clearDependents: true,
        }),
    );
    if (!result) return;
    setFieldErrors((prev) => without(prev, field.id));
    if (result.result === 'archived') {
      toast(
        'Pertanyaan sudah punya jawaban, jadi diarsipkan dan tidak tampil lagi. Ini tidak bisa diurungkan.',
      );
      return;
    }
    let currentId: string | null = null;
    record({
      label: 'Hapus pertanyaan',
      undo: async () => {
        const made = await createField.mutateAsync(
          recreateInput(snapshot, formId, where.sectionId),
        );
        await moveField.mutateAsync({
          formId,
          fieldId: made.id,
          toSectionId: where.sectionId,
          toIndex: where.index,
        });
        currentId = made.id;
        await refresh();
      },
      redo: async () => {
        if (currentId)
          await deleteField.mutateAsync({ formId, fieldId: currentId });
        await refresh();
      },
    });
    toast('Pertanyaan dihapus.', {
      action: { label: 'Urungkan', onClick: () => void undo() },
    });
  }

  async function move(fieldId: string, toSectionId: string, toIndex: number) {
    await flushAll();
    const from = locate(fieldId);
    const done = await run(
      () => moveField.mutateAsync({ formId, fieldId, toSectionId, toIndex }),
      () =>
        moveField.mutateAsync({
          formId,
          fieldId,
          toSectionId,
          toIndex,
          clearDependents: true,
        }),
    );
    if (!done) return;
    record({
      label: 'Pindah pertanyaan',
      undo: async () => {
        await moveField.mutateAsync({
          formId,
          fieldId,
          toSectionId: from.sectionId,
          toIndex: from.index,
        });
        await refresh();
      },
      redo: async () => {
        await moveField.mutateAsync({ formId, fieldId, toSectionId, toIndex });
        await refresh();
      },
    });
  }

  /** Dari hasil seret-lepas: `overId` adalah id pertanyaan atau wadah. */
  async function drop(activeId: string, overId: string) {
    const plan = planDrop(groups, activeId, overId);
    if (!plan) return;
    await move(activeId, plan.toSectionId, plan.toIndex);
  }

  function setRequired(field: FieldOut, required: boolean) {
    const current = draftOf(field);
    edit({ ...current, required }, { immediate: true });
    const flip = (value: boolean) => {
      const base = latestField(field.id);
      if (!base) return;
      edit(
        {
          ...(draftsRef.current[field.id] ?? fieldToUpdateInput(base, formId)),
          required: value,
        },
        { immediate: true },
      );
    };
    record({
      label: required ? 'Jadikan wajib' : 'Jadikan tidak wajib',
      undo: async () => flip(!required),
      redo: async () => flip(required),
    });
  }

  // -------------------------------------------------------------------------
  // Bagian (section)
  // -------------------------------------------------------------------------

  async function addSection() {
    const count = detail?.sections.length ?? 0;
    const title = `Bagian ${count + 1}`;
    const created = await run(() =>
      createSection.mutateAsync({ formId, title }),
    );
    if (!created) return undefined;
    let currentId = created.id;
    record({
      label: 'Tambah bagian',
      undo: async () => {
        await deleteSection.mutateAsync({ formId, sectionId: currentId });
        await refresh();
      },
      redo: async () => {
        currentId = (await createSection.mutateAsync({ formId, title })).id;
        await refresh();
      },
    });
    return created.id;
  }

  async function editSection(
    sectionId: string,
    patch: {
      title?: string;
      description?: string | null;
      condition?: ConditionInput | null;
    },
  ) {
    await run(() => updateSection.mutateAsync({ formId, sectionId, ...patch }));
  }

  async function addEnding(input: {
    title: string;
    description?: string | null;
    condition?: ConditionInput | null;
  }) {
    return run(() => createEnding.mutateAsync({ formId, ...input }));
  }

  async function editEnding(
    endingId: string,
    patch: {
      title?: string;
      description?: string | null;
      condition?: ConditionInput | null;
    },
  ) {
    await run(() => updateEnding.mutateAsync({ formId, endingId, ...patch }));
  }

  async function removeEnding(endingId: string) {
    await run(() => deleteEnding.mutateAsync({ formId, endingId }));
  }

  async function reorderEndingIds(endingIds: string[]) {
    await run(() => reorderEndings.mutateAsync({ formId, endingIds }));
  }

  async function removeSection(
    section: SectionOut,
    resolution?: SectionResolution,
  ) {
    await flushAll();
    const members =
      groups.find((g) => g.section.id === section.id)?.fields ?? [];
    const result = await run(async () => {
      if (members.length > 0) {
        if (!resolution)
          throw new Error(
            'Pilih apa yang dilakukan pada pertanyaan di bagian ini.',
          );
        if (resolution.type === 'move') {
          const target = groups.find(
            (g) => g.section.id === resolution.toSectionId,
          );
          let index = target?.fields.length ?? 0;
          for (const field of members) {
            await moveField.mutateAsync({
              formId,
              fieldId: field.id,
              toSectionId: resolution.toSectionId,
              toIndex: index++,
            });
          }
        } else {
          for (const field of members) {
            await deleteField.mutateAsync({ formId, fieldId: field.id });
          }
        }
      }
      return deleteSection.mutateAsync({ formId, sectionId: section.id });
    });
    if (!result) return;
    if (members.length === 0) {
      let currentId: string | null = null;
      record({
        label: 'Hapus bagian',
        undo: async () => {
          currentId = (
            await createSection.mutateAsync({
              formId,
              title: section.title,
              description: section.description,
            })
          ).id;
          await refresh();
        },
        redo: async () => {
          if (currentId)
            await deleteSection.mutateAsync({ formId, sectionId: currentId });
          await refresh();
        },
      });
    }
    toast('Bagian dihapus.');
  }

  async function reorderSectionIds(sectionIds: string[]) {
    const before = (detail?.sections ?? []).map((s) => s.id);
    const done = await run(
      () => reorderSections.mutateAsync({ formId, sectionIds }),
      () =>
        reorderSections.mutateAsync({
          formId,
          sectionIds,
          clearDependents: true,
        }),
    );
    if (!done) return;
    record({
      label: 'Urutkan bagian',
      undo: async () => {
        await reorderSections.mutateAsync({ formId, sectionIds: before });
        await refresh();
      },
      redo: async () => {
        await reorderSections.mutateAsync({ formId, sectionIds });
        await refresh();
      },
    });
  }

  // -------------------------------------------------------------------------
  // Form: pengaturan, status, pratinjau
  // -------------------------------------------------------------------------

  async function saveForm(patch: Partial<Omit<UpdateFormInput, 'formId'>>) {
    return run(() => updateForm.mutateAsync({ formId, ...patch }));
  }

  type Blocks = {
    settings: FormSettings;
    theme: FormTheme;
    welcome: FormWelcome;
  };
  // Server mengganti blok JSON secara utuh. Tambalan karena itu digabung di
  // atas blok yang terakhir dikirim (atau data server terbaru), bukan di atas
  // render terakhir: dua klik beruntun tidak boleh saling membatalkan.
  const blocksRef = useRef<Partial<Blocks>>({});

  async function saveBlock<K extends keyof Blocks>(
    key: K,
    patch: Partial<Blocks[K]>,
  ) {
    const base = (blocksRef.current[key] ??
      latest()?.[key] ??
      detail?.[key]) as Blocks[K] | undefined;
    if (!base) return undefined;
    const merged = mergeBlock(
      base as Record<string, unknown>,
      patch as Record<string, unknown>,
    ) as Blocks[K];
    blocksRef.current = { ...blocksRef.current, [key]: merged };
    const result = await run(() =>
      updateForm.mutateAsync({ formId, [key]: merged } as {
        formId: string;
      } & Partial<Blocks>),
    );
    if (blocksRef.current[key] === merged) {
      const rest = { ...blocksRef.current };
      delete rest[key];
      blocksRef.current = rest;
    }
    return result;
  }

  const saveSettings = (patch: Partial<FormSettings>) =>
    saveBlock('settings', patch);
  const saveTheme = (patch: Partial<FormTheme>) => saveBlock('theme', patch);
  const saveWelcome = (patch: Partial<FormWelcome>) =>
    saveBlock('welcome', patch);

  async function changeStatus(status: FormStatus) {
    await flushAll();
    setPublishProblem(null);
    setSaveState('saving');
    try {
      await setStatusMutation.mutateAsync({ formId, status });
      await refresh();
      setSaveState('saved');
      toast.success(
        status === 'Published'
          ? 'Form diterbitkan.'
          : status === 'Closed'
            ? 'Form ditutup.'
            : 'Form dikembalikan ke draf.',
      );
    } catch (error) {
      setSaveState('error');
      const message = messageOf(error);
      // Pesan server menyebut judul pertanyaan dalam tanda kutip.
      const quoted = /"([^"]+)"/.exec(message)?.[1];
      const field = quoted
        ? detail?.fields.find((f) => f.label === quoted)
        : undefined;
      setPublishProblem({ fieldId: field?.id ?? null, message });
    }
  }

  const setPreview = (enabled: boolean) =>
    run(() => setPreviewMutation.mutateAsync({ formId, enabled }));
  const rotatePreviewToken = () =>
    run(() => rotateMutation.mutateAsync({ formId }));

  return {
    formId,
    detail,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    groups,
    numbers,
    saveState,
    hasUnsaved,
    fieldErrors,
    publishProblem,
    draftOf,
    edit,
    flushAll,
    addField,
    changeFieldType,
    duplicateField,
    removeField,
    move,
    drop,
    setRequired,
    addSection,
    editSection,
    addEnding,
    editEnding,
    removeEnding,
    reorderEndingIds,
    removeSection,
    reorderSectionIds,
    saveForm,
    saveSettings,
    saveTheme,
    saveWelcome,
    changeStatus,
    setPreview,
    rotatePreviewToken,
    undo,
    redo,
    canUndo: stack.canUndo,
    canRedo: stack.canRedo,
  };
}

export type FormBuilderApi = ReturnType<typeof useFormBuilder>;
