'use client';

import { TRPCClientError } from '@trpc/client';
import type { AppRouter } from '~/server/api/root';
import type { GetPublicFormOutput } from '~/server/api/types/form.type';
import { api } from '~/trpc/react';

import { ClientFormRenderer } from './client-form-renderer';
import type { FillSubmitResult } from './form-renderer';
import { buildSubmitPayload, extractFieldErrors } from './submit-payload';

/** Form yang sedang terbuka: mengirim jawaban lewat `form.submit`. */
export function FillForm({
  form,
  userId,
}: {
  form: GetPublicFormOutput;
  userId: string;
}) {
  const submit = api.form.submit.useMutation();

  const onSubmit = async (
    answers: Record<string, unknown>,
  ): Promise<FillSubmitResult> => {
    try {
      // Bentuk nilai sudah dijaga renderer; server memvalidasi ulang.
      const saved = await submit.mutateAsync(
        buildSubmitPayload(form.id, form.fields, answers) as Parameters<
          typeof submit.mutateAsync
        >[0],
      );
      return { ending: saved.ending };
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (err instanceof TRPCClientError) {
        return {
          fieldErrors,
          message: (err as TRPCClientError<AppRouter>).message,
        };
      }
      throw err;
    }
  };

  return (
    <ClientFormRenderer
      form={form}
      mode="fill"
      onSubmit={onSubmit}
      storageKey={`anmategra-form-draft:${form.id}:${userId}`}
    />
  );
}
