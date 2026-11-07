import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { GetPublicFormOutput } from '~/server/api/types/form.type';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { mahasiswa } from '~/server/db/schema';
import { api } from '~/trpc/server';

import { FillForm } from './fill-form';
import { RichText } from './rich-text-view';

const DEFAULT_CLOSED_MESSAGE =
  'Form ini sudah ditutup dan tidak menerima jawaban lagi.';

function Notice({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto grid min-h-[60vh] w-full max-w-2xl place-items-center px-4 py-10">
      <div
        role="status"
        className="w-full rounded-[24px] border border-neutral-400 bg-neutral-50 p-8 text-center"
      >
        <h1 className="text-2xl font-semibold text-neutral-1000">{title}</h1>
        {children ? (
          <div className="mt-2 text-neutral-700">{children}</div>
        ) : null}
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-primary-400 underline-offset-4 hover:underline"
        >
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}

/**
 * Halaman mengisi form (`/forms/[formId]`), untuk semua peran yang sudah login.
 * Menentukan keadaannya di server: tidak berhak mengisi, sudah ditutup, sudah
 * mengirim, atau terbuka.
 */
export async function FillPage({ formId }: { formId: string }) {
  const session = await getServerAuthSession();
  if (!session) redirect(`/authentication?callbackUrl=/forms/${formId}`);

  let form: GetPublicFormOutput;
  try {
    form = await api.form.getPublic({ formId });
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }

  const userId = session.user.id;
  const [student] =
    session.user.role === 'mahasiswa'
      ? await db
          .select({ status: mahasiswa.status })
          .from(mahasiswa)
          .where(eq(mahasiswa.userId, userId))
      : [];
  if (student?.status !== 'aktif') {
    return (
      <Notice title={form.title}>
        Form ini hanya bisa diisi oleh mahasiswa aktif. Masuk dengan akun
        mahasiswa ITB untuk mengisinya.
      </Notice>
    );
  }

  if (!form.isAcceptingResponses) {
    return (
      <Notice title={form.title}>
        {form.settings.closedMessage.trim() === ''
          ? DEFAULT_CLOSED_MESSAGE
          : form.settings.closedMessage}
      </Notice>
    );
  }

  if (form.hasSubmitted && !form.allowMultipleSubmissions) {
    const mine = await api.form.getMySubmission({ formId });
    const when = mine?.submittedAt.toLocaleString('id-ID', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    });
    return (
      <Notice title="Kamu sudah mengirim jawaban">
        {when
          ? `Jawabanmu untuk “${form.title}” terkirim pada ${when} WIB.`
          : null}
      </Notice>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <p className="mb-3 text-sm text-neutral-700">
        <RichText value={form.owner.name} />
      </p>
      <FillForm form={form} userId={userId} />
    </main>
  );
}
