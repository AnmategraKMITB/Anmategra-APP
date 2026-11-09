import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import type { GetPublicFormOutput } from '~/server/api/types/form.type';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { mahasiswa } from '~/server/db/schema';
import { api } from '~/trpc/server';

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
      return <SubmittedFill form={form} submission={mine} />;
    }
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

  // Form oprec: yang belum memenuhi syarat atau di luar jadwal melihat
  // penjelasan, bukan formulirnya.
  if (form.oprec && !form.oprec.canApply) {
    return (
      <Notice
        title={form.oprec.eligible ? form.title : 'Kamu belum bisa mendaftar'}
      >
        {form.oprec.reason ?? 'Pendaftaran belum bisa dikirim saat ini.'}
      </Notice>
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
      {form.oprec?.wave ? (
        <p className="mb-3 rounded-xl bg-neutral-200 px-4 py-2 text-sm text-neutral-700">
          Gelombang {form.oprec.wave.label}, berakhir{' '}
          {form.oprec.wave.endsAt.toLocaleString('id-ID', {
            dateStyle: 'long',
            timeStyle: 'short',
            timeZone: 'Asia/Jakarta',
          })}{' '}
          WIB.
        </p>
      ) : null}
      <FillForm form={form} userId={userId} />
    </main>
  );
}
