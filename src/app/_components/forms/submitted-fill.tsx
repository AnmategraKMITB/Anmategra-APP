'use client';

import { TRPCClientError } from '@trpc/client';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import type { AppRouter } from '~/server/api/root';
import type { GetPublicFormOutput } from '~/server/api/types/form.type';
import { type RouterOutputs, api } from '~/trpc/react';

import { ClientFormRenderer } from './client-form-renderer';
import type { FillSubmitResult } from './form-renderer';
import { Notice } from './notice';
import { buildSubmitPayload, extractFieldErrors } from './submit-payload';
import { ApplicantResultCard } from './applicant-result-card';

type Submission = NonNullable<RouterOutputs['form']['getMySubmission']>;

const when = (date: Date) =>
  date.toLocaleString('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  });

/**
 * Pengisi yang sudah mengirim: menampilkan jawaban terkirim dan, bila form
 * mengizinkan, membuka kembali isian untuk disunting.
 */
export function SubmittedFill({
  form,
  submission,
  recruitmentId = null,
}: {
  form: GetPublicFormOutput;
  submission: Submission;
  /** Oprec pemilik formulir ini, bila ada. */
  recruitmentId?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const update = api.form.updateSubmission.useMutation();

  const onSubmit = async (
    answers: Record<string, unknown>,
  ): Promise<FillSubmitResult> => {
    try {
      const saved = await update.mutateAsync(
        buildSubmitPayload(form.id, form.fields, answers) as Parameters<
          typeof update.mutateAsync
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

  if (!editing) {
    const changed =
      submission.updatedAt.getTime() !== submission.submittedAt.getTime();
    return (
      <div className="grid gap-3">
        <Notice
          title="Kamu sudah mengirim jawaban"
          action={
            <Button variant="light_blue" onClick={() => setEditing(true)}>
              Ubah jawaban
            </Button>
          }
        >
          <p>
            Jawabanmu untuk “{form.title}” terkirim pada{' '}
            {when(submission.submittedAt)} WIB.
          </p>
          {changed ? (
            <p className="mt-1">
              Terakhir diubah {when(submission.updatedAt)} WIB.
            </p>
          ) : null}
          <p className="mt-2 text-sm">
            Kamu masih bisa mengubah jawaban selama formulir belum ditutup.
          </p>
        </Notice>
        <ApplicantResultCard recruitmentId={recruitmentId} />
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-700">
          Mengubah jawaban yang sudah dikirim.
        </p>
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Batal
        </Button>
      </div>
      <ClientFormRenderer
        form={form}
        mode="edit"
        initialAnswers={submission.answers}
        onSubmit={onSubmit}
      />
    </main>
  );
}
