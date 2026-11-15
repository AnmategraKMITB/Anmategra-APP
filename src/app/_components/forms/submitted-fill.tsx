'use client';

import { TRPCClientError } from '@trpc/client';
import { ArrowLeft, CheckCircle2, Eye, PenLine, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import type { AppRouter } from '~/server/api/root';
import type { GetPublicFormOutput } from '~/server/api/types/form.type';
import { type RouterOutputs, api } from '~/trpc/react';

import { ApplicantResultCard } from './applicant-result-card';
import { ClientFormRenderer } from './client-form-renderer';
import { FillForm } from './fill-form';
import type { FillSubmitResult } from './form-renderer';
import { MyAnswers } from './my-answers';
import { buildSubmitPayload, extractFieldErrors } from './submit-payload';

type Submission = NonNullable<RouterOutputs['form']['getMySubmission']>;

const when = (date: Date) =>
  date.toLocaleString('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  });

type View = 'home' | 'lihat' | 'ubah' | 'baru';

/**
 * Pengisi yang sudah mengirim. Jawaban terkirim selalu bisa dilihat; bila form
 * mengizinkan, jawaban bisa diubah atau dikirim ulang sebagai respons baru.
 */
export function SubmittedFill({
  form,
  submission,
  userId,
  recruitmentId = null,
}: {
  form: GetPublicFormOutput;
  submission: Submission;
  userId: string;
  /** Oprec pemilik formulir ini, bila ada. */
  recruitmentId?: string | null;
}) {
  const [view, setView] = useState<View>('home');
  const [sent, setSent] = useState(false);
  const update = api.form.updateSubmission.useMutation();
  // Jawaban oprec tidak pernah bisa diubah setelah dikirim (server menolaknya).
  const canEdit =
    form.isOpen && form.allowEditAfterSubmit && !form.oprec && !recruitmentId;
  const canResubmit =
    form.allowMultipleSubmissions && form.isAcceptingResponses;

  const onUpdate = async (
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

  const back = (
    <Button variant="ghost" size="sm" onClick={() => setView('home')}>
      <ArrowLeft /> Kembali
    </Button>
  );

  if (view === 'lihat') {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {back}
          {canEdit ? (
            <Button
              variant="light_blue"
              size="sm"
              onClick={() => setView('ubah')}
            >
              <PenLine /> Ubah jawaban
            </Button>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold text-neutral-1000">Jawabanmu</h1>
        <p className="mb-6 mt-1 text-sm text-neutral-700">
          {form.title} · dikirim {when(submission.submittedAt)} WIB
        </p>
        <MyAnswers form={form} answers={submission.answers} />
      </main>
    );
  }

  if (view === 'ubah') {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-700">
            Mengubah jawaban yang sudah dikirim.
          </p>
          {back}
        </div>
        <ClientFormRenderer
          form={form}
          mode="edit"
          initialAnswers={submission.answers}
          onSubmit={onUpdate}
        />
      </main>
    );
  }

  if (view === 'baru') {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
        {sent ? null : (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-700">
              Mengirim respons baru. Jawaban sebelumnya tetap tersimpan.
            </p>
            {back}
          </div>
        )}
        <FillForm
          form={form}
          userId={userId}
          onSubmitted={() => setSent(true)}
        />
      </main>
    );
  }

  const changed =
    submission.updatedAt.getTime() !== submission.submittedAt.getTime();
  return (
    <main className="mx-auto grid min-h-[60vh] w-full max-w-2xl place-items-center px-4 py-10">
      <div
        role="status"
        className="w-full rounded-[24px] border border-neutral-400 bg-neutral-50 p-8 text-center"
      >
        <CheckCircle2
          aria-hidden
          className="mx-auto size-12 text-primary-400"
          strokeWidth={1.5}
        />
        <h1 className="mt-3 text-2xl font-semibold text-neutral-1000">
          Jawabanmu sudah terkirim
        </h1>
        <p className="mt-2 text-neutral-700">
          “{form.title}” · {when(submission.submittedAt)} WIB
        </p>
        {changed ? (
          <p className="mt-1 text-sm text-neutral-700">
            Terakhir diubah {when(submission.updatedAt)} WIB.
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="dark_blue" onClick={() => setView('lihat')}>
            <Eye /> Lihat jawaban
          </Button>
          {canEdit ? (
            <Button variant="dark_blue_outline" onClick={() => setView('ubah')}>
              <PenLine /> Ubah jawaban
            </Button>
          ) : null}
          {canResubmit ? (
            <Button variant="dark_blue_outline" onClick={() => setView('baru')}>
              <RotateCcw /> Kirim jawaban lagi
            </Button>
          ) : null}
        </div>
        {canEdit ? (
          <p className="mt-4 text-sm text-neutral-700">
            Kamu masih bisa mengubah jawaban selama formulir belum ditutup.
          </p>
        ) : null}
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-primary-400 underline-offset-4 hover:underline"
        >
          Kembali ke beranda
        </Link>
      </div>
      <div className="mt-3 w-full empty:hidden">
        <ApplicantResultCard recruitmentId={recruitmentId} />
      </div>
    </main>
  );
}
