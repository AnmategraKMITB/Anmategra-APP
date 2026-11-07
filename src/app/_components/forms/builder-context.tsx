'use client';

import { createContext, useContext } from 'react';

import type { FormBuilderApi } from './use-form-builder';

const BuilderContext = createContext<FormBuilderApi | null>(null);

export const BuilderProvider = BuilderContext.Provider;

export function useBuilder(): FormBuilderApi {
  const builder = useContext(BuilderContext);
  if (!builder)
    throw new Error('useBuilder harus dipakai di dalam FormBuilder.');
  return builder;
}
