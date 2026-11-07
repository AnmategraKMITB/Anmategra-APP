import { TRPCError } from '@trpc/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { GetPublicFormOutput } from '~/server/api/types/form.type';
import { api } from '~/trpc/server';

import { ClientFormRenderer } from './client-form-renderer';

/**
 * Pratinjau publik lewat tautan (`/forms/preview/[token]`): tanpa login,
 * hanya baca. Token yang salah atau tautan yang dimatikan sama-sama 404.
 */
export async function PublicPreviewPage({ token }: { token: string }) {
  let form: GetPublicFormOutput;
  try {
    form = await api.form.getPreview({ token });
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }

  const fillable = form.status === 'Published';

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <div
        role="note"
        className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-400 bg-neutral-100 px-4 py-3 text-sm text-neutral-700"
      >
        <span>
          Ini pratinjau {form.owner.name}: kamu bisa mencoba mengisi, tetapi
          jawaban tidak dikirim.
        </span>
        {fillable ? (
          <Link
            href={`/forms/${form.id}`}
            className="font-medium text-primary-400 underline-offset-4 hover:underline"
          >
            Masuk untuk mengisi
          </Link>
        ) : null}
      </div>
      <ClientFormRenderer form={form} mode="preview" />
    </main>
  );
}
