'use client';

import { TRPCClientError } from '@trpc/client';
import { useEffect, useState } from 'react';
import { lastAcceptedAt, shouldShowGraceNotice } from '~/lib/forms/grace';
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
    <>
      <GraceNotice
        deadline={earliest(form.closesAt, form.oprec?.wave?.endsAt ?? null)}
      />
      <ClientFormRenderer
        form={form}
        mode="fill"
        onSubmit={onSubmit}
        storageKey={`anmategra-form-draft:${form.id}:${userId}`}
      />
    </>
  );
}

function earliest(a: Date | null, b: Date | null): Date | null {
  if (!a || !b) return a ?? b;
  return a.getTime() <= b.getTime() ? a : b;
}

const WIB = {
  timeStyle: 'medium',
  timeZone: 'Asia/Jakarta',
} as const;

/**
 * Baru tampil 5 menit sebelum tenggat. Tambahan 10 menit sengaja tidak
 * diumumkan lebih awal supaya orang tidak menunda ke menit terakhir.
 */
function GraceNotice({ deadline }: { deadline: Date | null }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  if (!deadline || !now || !shouldShowGraceNotice(deadline, now)) return null;
  const last = lastAcceptedAt(deadline);
  return (
    <p
      role="status"
      className="mx-auto mb-3 w-full max-w-2xl rounded-xl bg-amber-100 px-4 py-2 text-sm text-amber-900"
    >
      {now < deadline
        ? `Tenggat pendaftaran hampir tiba. Kamu masih bisa mengirim sampai ${last.toLocaleTimeString('id-ID', WIB)} WIB.`
        : `Tenggat sudah lewat. Kamu masih bisa mengirim sampai ${last.toLocaleTimeString('id-ID', WIB)} WIB.`}
    </p>
  );
}
