import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import type { GetPublicFormOutput } from '~/server/api/types/form.type';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { mahasiswa, recruitment } from '~/server/db/schema';
import { api } from '~/trpc/server';

import { ApplicantResultCard } from './applicant-result-card';
import { FillForm } from './fill-form';
import { DEFAULT_CLOSED_MESSAGE, Notice } from './notice';
import { RichText } from './rich-text-view';
import { SubmittedFill } from './submitted-fill';

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
  const [rec] = await db
    .select({ id: recruitment.id })
    .from(recruitment)
    .where(eq(recruitment.formId, formId));
  const recruitmentId = rec?.id ?? null;
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

  if (form.hasSubmitted && !form.allowMultipleSubmissions) {
    const mine = await api.form.getMySubmission({ formId });
    // Kuota hanya membatasi kiriman baru; menyunting jawaban sendiri tetap
    // boleh selama form masih terbuka dan saklar edit menyala.
    if (form.isOpen && form.allowEditAfterSubmit && mine) {
      return (
        <SubmittedFill
          form={form}
          submission={mine}
          recruitmentId={recruitmentId}
        />
      );
    }
    const when = mine?.submittedAt.toLocaleString('id-ID', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    });
    return (
      <div className="grid gap-3">
        <Notice title="Kamu sudah mengirim jawaban">
          {when
            ? `Jawabanmu untuk “${form.title}” terkirim pada ${when} WIB.`
            : null}
        </Notice>
        <ApplicantResultCard recruitmentId={recruitmentId} />
      </div>
    );
  }

  if (!form.isAcceptingResponses) {
    const closed =
      form.settings.closedMessage.trim() === ''
        ? form.isFull
          ? 'Form ini sudah menerima jumlah jawaban maksimum.'
          : DEFAULT_CLOSED_MESSAGE
        : form.settings.closedMessage;
    return <Notice title={form.title}>{closed}</Notice>;
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
