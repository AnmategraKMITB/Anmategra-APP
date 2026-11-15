'use client';

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { UpdateFieldInput } from '~/server/api/types/form.type';

import { type FieldOut, fieldToUpdateInput } from './model';
import type { SharedBuilderApi } from './use-form-builder';

const BuilderContext = createContext<SharedBuilderApi | null>(null);

export const BuilderProvider = BuilderContext.Provider;

export function useBuilder(): SharedBuilderApi {
  const builder = useContext(BuilderContext);
  if (!builder)
    throw new Error('useBuilder harus dipakai di dalam FormBuilder.');
  return builder;
}

/** Draf satu pertanyaan; hanya merender ulang saat draf pertanyaan itu berubah. */
export function useFieldDraft(field: FieldOut): UpdateFieldInput {
  const builder = useBuilder();
  const draft = useSyncExternalStore(
    (listener) => builder.subscribeDraft(field.id, listener),
    () => builder.draftSnapshot(field.id),
    () => undefined,
  );
  const saved = useMemo(
    () => fieldToUpdateInput(field, builder.formId),
    [field, builder.formId],
  );
  return draft ?? saved;
}
